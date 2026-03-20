package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/jonradoff/lastsaas/backend/internal/models"
)

// GetPrompts handles GET /api/prompts
func (h *Handler) GetPrompts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	modality := r.URL.Query().Get("modality")
	segment := r.URL.Query().Get("segment")
	page := parseInt(r.URL.Query().Get("page"), 1)
	perPage := parseInt(r.URL.Query().Get("per_page"), 20)

	filter := bson.M{"is_active": true}
	if modality != "" {
		filter["modality"] = modality
	}
	if segment != "" {
		filter["segment"] = segment
	}

	skip := (page - 1) * perPage
	findOptions := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(perPage)).
		SetSort(bson.M{"created_at": -1})

	cursor, err := h.DB.Collection("prompts").Find(ctx, filter, findOptions)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch prompts")
		return
	}
	defer cursor.Close(ctx)

	var prompts []models.Prompt
	if err = cursor.All(ctx, &prompts); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to decode prompts")
		return
	}

	// Count total
	total, _ := h.DB.Collection("prompts").CountDocuments(ctx, filter)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"prompts": prompts,
		"pagination": map[string]int{
			"page":     page,
			"per_page": perPage,
			"total":    int(total),
			"pages":    int((total + int64(perPage) - 1) / int64(perPage)),
		},
	})
}

// GetPrompt handles GET /api/prompts/:slug
func (h *Handler) GetPrompt(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := mux.Vars(r)["slug"]

	var prompt models.Prompt
	err := h.DB.Collection("prompts").FindOne(ctx, bson.M{"slug": slug}).Decode(&prompt)
	if err != nil {
		respondError(w, http.StatusNotFound, "Prompt not found")
		return
	}

	// Enrich outputs with model details
	enrichedOutputs := make([]map[string]interface{}, len(prompt.Outputs))
	for i, output := range prompt.Outputs {
		var model models.AIModel
		h.DB.Collection("ai_models").FindOne(ctx,
			bson.M{"_id": output.ModelID}).Decode(&model)

		enrichedOutputs[i] = map[string]interface{}{
			"model_id":    output.ModelID,
			"model_name":  model.Name,
			"model_slug":  model.Slug,
			"output_type": output.OutputType,
			"code":        output.Code,
			"media":       output.Media,
			"created_at":  output.CreatedAt,
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":         prompt.ID,
		"slug":       prompt.Slug,
		"title":      prompt.Title,
		"content":    prompt.Content,
		"modality":   prompt.Modality,
		"segment":    prompt.Segment,
		"outputs":    enrichedOutputs,
		"created_at": prompt.CreatedAt,
	})
}

// CreatePrompt handles POST /api/admin/prompts
func (h *Handler) CreatePrompt(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user from context
	userID, ok := ctx.Value("user_id").(primitive.ObjectID)
	if !ok {
		respondError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var req models.Prompt
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Generate slug
	if req.Slug == "" {
		req.Slug = generateSlug(req.Title)
	}

	// Check for duplicate
	exists, _ := h.DB.Collection("prompts").CountDocuments(ctx, bson.M{"slug": req.Slug})
	if exists > 0 {
		respondError(w, http.StatusConflict, "Prompt with this slug already exists")
		return
	}

	req.ID = primitive.NewObjectID()
	req.IsActive = true
	req.CreatedBy = userID
	req.CreatedAt = primitive.NewDateTimeFromTime(time.Now())
	req.UpdatedAt = req.CreatedAt

	// Set timestamps on outputs
	for i := range req.Outputs {
		req.Outputs[i].CreatedAt = primitive.NewDateTimeFromTime(time.Now())
	}

	_, err := h.DB.Collection("prompts").InsertOne(ctx, req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create prompt")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// UpdatePrompt handles PUT /api/admin/prompts/:id
func (h *Handler) UpdatePrompt(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid prompt ID")
		return
	}

	var req models.Prompt
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	update := bson.M{
		"$set": bson.M{
			"title":      req.Title,
			"content":    req.Content,
			"modality":   req.Modality,
			"segment":    req.Segment,
			"is_active":  req.IsActive,
			"updated_at": primitive.NewDateTimeFromTime(time.Now()),
		},
	}

	// Update outputs if provided
	if len(req.Outputs) > 0 {
		update["$set"]["outputs"] = req.Outputs
	}

	_, err = h.DB.Collection("prompts").UpdateByID(ctx, objectID, update)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update prompt")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Prompt updated"})
}

// DeletePrompt handles DELETE /api/admin/prompts/:id
func (h *Handler) DeletePrompt(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid prompt ID")
		return
	}

	// Soft delete
	_, err = h.DB.Collection("prompts").UpdateByID(ctx, objectID, bson.M{
		"$set": bson.M{
			"is_active":  false,
			"updated_at": primitive.NewDateTimeFromTime(time.Now()),
		},
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete prompt")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Prompt deactivated"})
}

// GetPromptModalities handles GET /api/prompts/modalities
func (h *Handler) GetPromptModalities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pipeline := []bson.M{
		{"$match": bson.M{"is_active": true}},
		{"$group": bson.M{"_id": "$modality"}},
		{"$sort": bson.M{"_id": 1}},
	}

	cursor, err := h.DB.Collection("prompts").Aggregate(ctx, pipeline)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch modalities")
		return
	}
	defer cursor.Close(ctx)

	var modalities []map[string]string
	cursor.All(ctx, &modalities)

	respondJSON(w, http.StatusOK, modalities)
}

// GetPromptSegments handles GET /api/prompts/segments
func (h *Handler) GetPromptSegments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pipeline := []bson.M{
		{"$match": bson.M{"is_active": true}},
		{"$group": bson.M{"_id": "$segment"}},
		{"$sort": bson.M{"_id": 1}},
	}

	cursor, err := h.DB.Collection("prompts").Aggregate(ctx, pipeline)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch segments")
		return
	}
	defer cursor.Close(ctx)

	var segments []map[string]string
	cursor.All(ctx, &segments)

	respondJSON(w, http.StatusOK, segments)
}
