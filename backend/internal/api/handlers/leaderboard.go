package handlers

import (
	"encoding/json"
	"math"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/jonradoff/lastsaas/backend/internal/models"
)

// GetLeaderboard handles GET /api/leaderboard
func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	modality := r.URL.Query().Get("modality")
	if modality == "" {
		modality = "global"
	}

	page := parseInt(r.URL.Query().Get("page"), 1)
	perPage := parseInt(r.URL.Query().Get("per_page"), 50)

	// Validate modality
	validModalities := []string{"global", "code", "image", "video", "audio", "text", "vision"}
	isValid := false
	for _, m := range validModalities {
		if m == modality {
			isValid = true
			break
		}
	}
	if !isValid {
		modality = "global"
	}

	// Sort field based on modality
	sortField := "elo_ratings.global"
	if modality != "global" {
		sortField = "elo_ratings." + modality
	}

	// Query
	skip := (page - 1) * perPage
	findOptions := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(perPage)).
		SetSort(bson.M{sortField: -1})

	cursor, err := h.DB.Collection("ai_models").Find(ctx,
		bson.M{"is_active": true}, findOptions)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch leaderboard")
		return
	}
	defer cursor.Close(ctx)

	var models []models.AIModel
	if err = cursor.All(ctx, &models); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to decode models")
		return
	}

	// Add rank
	type LeaderboardEntry struct {
		models.AIModel
		Rank  int     `json:"rank"`
		Score float64 `json:"score"`
	}

	entries := make([]LeaderboardEntry, len(models))
	for i, m := range models {
		entries[i] = LeaderboardEntry{
			AIModel: m,
			Rank:    skip + i + 1,
			Score:   m.GetELORating(modality),
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"modality": modality,
		"entries":  entries,
		"pagination": map[string]int{
			"page":     page,
			"per_page": perPage,
		},
	})
}

// GetBattlePair handles GET /api/battle-pair
func (h *Handler) GetBattlePair(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	modality := r.URL.Query().Get("modality")

	// Get random active prompt
	promptFilter := bson.M{"is_active": true}
	if modality != "" {
		promptFilter["modality"] = modality
	}

	var prompt models.Prompt
	err := h.DB.Collection("prompts").FindOne(ctx, promptFilter).Decode(&prompt)
	if err != nil {
		respondError(w, http.StatusNotFound, "No prompts available")
		return
	}

	// Get two random models with outputs for this prompt
	modelIDs := make([]primitive.ObjectID, 0)
	for _, output := range prompt.Outputs {
		modelIDs = append(modelIDs, output.ModelID)
	}

	if len(modelIDs) < 2 {
		respondError(w, http.StatusNotFound, "Not enough models for battle")
		return
	}

	// Shuffle and pick 2
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(modelIDs), func(i, j int) {
		modelIDs[i], modelIDs[j] = modelIDs[j], modelIDs[i]
	})

	modelA := modelIDs[0]
	modelB := modelIDs[1]

	// Fetch model details
	var modelADetails, modelBDetails models.AIModel
	h.DB.Collection("ai_models").FindOne(ctx, bson.M{"_id": modelA}).Decode(&modelADetails)
	h.DB.Collection("ai_models").FindOne(ctx, bson.M{"_id": modelB}).Decode(&modelBDetails)

	// Get outputs for these models
	var outputA, outputB models.PromptOutput
	for _, o := range prompt.Outputs {
		if o.ModelID == modelA {
			outputA = o
		}
		if o.ModelID == modelB {
			outputB = o
		}
	}

	// Randomize order for anonymity
	pair := models.BattlePair{
		PromptID: prompt.ID,
		Prompt:   prompt,
		Modality: prompt.Modality,
	}

	if rand.Intn(2) == 0 {
		pair.ModelAID = modelA
		pair.ModelA = modelADetails
		pair.ModelBID = modelB
		pair.ModelB = modelBDetails
		pair.ModelAAnonymous = "Model 1"
		pair.ModelBAnonymous = "Model 2"
	} else {
		pair.ModelAID = modelB
		pair.ModelA = modelBDetails
		pair.ModelBID = modelA
		pair.ModelB = modelADetails
		pair.ModelAAnonymous = "Model 1"
		pair.ModelBAnonymous = "Model 2"
	}

	// Include outputs in response
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"prompt": map[string]interface{}{
			"id":       prompt.ID,
			"title":    prompt.Title,
			"content":  prompt.Content,
			"modality": prompt.Modality,
		},
		"model_a": map[string]interface{}{
			"id":        pair.ModelAID,
			"anonymous": pair.ModelAAnonymous,
			"output":    outputA,
		},
		"model_b": map[string]interface{}{
			"id":        pair.ModelBID,
			"anonymous": pair.ModelBAnonymous,
			"output":    outputB,
		},
	})
}

// SubmitVote handles POST /api/vote
func (h *Handler) SubmitVote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user from context (set by auth middleware)
	userID, ok := ctx.Value("user_id").(primitive.ObjectID)
	if !ok {
		respondError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var req struct {
		PromptID string          `json:"prompt_id"`
		ModelAID string          `json:"model_a_id"`
		ModelBID string          `json:"model_b_id"`
		WinnerID *string         `json:"winner_id,omitempty"`
		VoteType models.VoteType `json:"vote_type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Parse IDs
	promptID, _ := primitive.ObjectIDFromHex(req.PromptID)
	modelAID, _ := primitive.ObjectIDFromHex(req.ModelAID)
	modelBID, _ := primitive.ObjectIDFromHex(req.ModelBID)

	var winnerID primitive.ObjectID
	if req.WinnerID != nil {
		winnerID, _ = primitive.ObjectIDFromHex(*req.WinnerID)
	}

	// Check if user already voted on this prompt
	existingCount, _ := h.DB.Collection("votes").CountDocuments(ctx, bson.M{
		"prompt_id": promptID,
		"user_id":   userID,
	})

	if existingCount > 0 {
		respondError(w, http.StatusConflict, "You have already voted on this prompt")
		return
	}

	// Get prompt modality
	var prompt models.Prompt
	h.DB.Collection("prompts").FindOne(ctx, bson.M{"_id": promptID}).Decode(&prompt)

	// Create vote
	vote := models.Vote{
		ID:        primitive.NewObjectID(),
		PromptID:  promptID,
		UserID:    userID,
		ModelAID:  modelAID,
		ModelBID:  modelBID,
		WinnerID:  winnerID,
		VoteType:  req.VoteType,
		Modality:  prompt.Modality,
		CreatedAt: primitive.NewDateTimeFromTime(time.Now()),
	}

	_, err := h.DB.Collection("votes").InsertOne(ctx, vote)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to record vote")
		return
	}

	// Update ELO ratings asynchronously
	go h.updateELORatings(modelAID, modelBID, winnerID, prompt.Modality)

	respondJSON(w, http.StatusCreated, map[string]string{
		"message": "Vote recorded successfully",
	})
}

// updateELORatings calculates and updates ELO ratings
func (h *Handler) updateELORatings(modelAID, modelBID, winnerID primitive.ObjectID, modality string) {
	// This would run in background
	// Get current ratings
	// Calculate new ratings based on match result
	// Update both global and modality-specific ratings
	// Log to ELO history
}

// GetUserVotes handles GET /api/user/votes
func (h *Handler) GetUserVotes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := ctx.Value("user_id").(primitive.ObjectID)
	if !ok {
		respondError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	page := parseInt(r.URL.Query().Get("page"), 1)
	perPage := parseInt(r.URL.Query().Get("per_page"), 20)

	skip := (page - 1) * perPage
	findOptions := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(perPage)).
		SetSort(bson.M{"created_at": -1})

	cursor, err := h.DB.Collection("votes").Find(ctx,
		bson.M{"user_id": userID}, findOptions)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch votes")
		return
	}
	defer cursor.Close(ctx)

	var votes []models.Vote
	cursor.All(ctx, &votes)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"votes": votes,
		"pagination": map[string]int{
			"page":     page,
			"per_page": perPage,
		},
	})
}

// calculateELO calculates new ELO ratings
// K-factor = 32 for standard games
func calculateELO(ratingA, ratingB float64, scoreA float64) (newRatingA, newRatingB float64) {
	const K = 32.0

	// Expected scores
	expectedA := 1.0 / (1.0 + math.Pow(10, (ratingB-ratingA)/400.0))
	expectedB := 1.0 - expectedA

	// New ratings
	newRatingA = ratingA + K*(scoreA-expectedA)
	newRatingB = ratingB + K*((1.0-scoreA)-expectedB)

	return newRatingA, newRatingB
}

// RecalculateELO handles POST /api/admin/elo/recalculate
func (h *Handler) RecalculateELO(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Reset all ELO ratings to 1200
	_, err := h.DB.Collection("ai_models").UpdateMany(ctx,
		bson.M{},
		bson.M{"$set": bson.M{
			"elo_ratings.global": 1200,
			"elo_ratings.code":   1200,
			"elo_ratings.image":  1200,
			"elo_ratings.video":  1200,
			"elo_ratings.audio":  1200,
			"elo_ratings.text":   1200,
			"elo_ratings.vision": 1200,
		}},
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to reset ratings")
		return
	}

	// Clear ELO history
	_, _ = h.DB.Collection("elo_history").DeleteMany(ctx, bson.M{})

	// Get all votes sorted by date
	cursor, _ := h.DB.Collection("votes").Find(ctx, bson.M{},
		options.Find().SetSort(bson.M{"created_at": 1}))

	var votes []models.Vote
	cursor.All(ctx, &votes)

	// Process each vote in chronological order
	for _, vote := range votes {
		// Get current ratings
		var modelA, modelB models.AIModel
		h.DB.Collection("ai_models").FindOne(ctx, bson.M{"_id": vote.ModelAID}).Decode(&modelA)
		h.DB.Collection("ai_models").FindOne(ctx, bson.M{"_id": vote.ModelBID}).Decode(&modelB)

		// Determine score
		var scoreA float64
		switch vote.VoteType {
		case models.VoteTypeWinner:
			if vote.WinnerID == vote.ModelAID {
				scoreA = 1.0
			} else {
				scoreA = 0.0
			}
		case models.VoteTypeTie:
			scoreA = 0.5
		case models.VoteTypeBothGood:
			scoreA = 0.6 // Small advantage
		case models.VoteTypeBothBad:
			scoreA = 0.4 // Small disadvantage
		}

		// Calculate new ratings
		globalA, globalB := calculateELO(modelA.ELORatings.Global, modelB.ELORatings.Global, scoreA)

		// Update global ratings
		h.DB.Collection("ai_models").UpdateByID(ctx, vote.ModelAID, bson.M{
			"$set": bson.M{"elo_ratings.global": globalA},
		})
		h.DB.Collection("ai_models").UpdateByID(ctx, vote.ModelBID, bson.M{
			"$set": bson.M{"elo_ratings.global": globalB},
		})

		// Update modality-specific ratings
		ratingA := modelA.GetELORating(vote.Modality)
		ratingB := modelB.GetELORating(vote.Modality)
		newA, newB := calculateELO(ratingA, ratingB, scoreA)

		h.DB.Collection("ai_models").UpdateByID(ctx, vote.ModelAID, bson.M{
			"$set": bson.M{"elo_ratings." + vote.Modality: newA},
		})
		h.DB.Collection("ai_models").UpdateByID(ctx, vote.ModelBID, bson.M{
			"$set": bson.M{"elo_ratings." + vote.Modality: newB},
		})
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":         "ELO ratings recalculated",
		"votes_processed": len(votes),
	})
}
