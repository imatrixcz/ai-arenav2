package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/jonradoff/lastsaas/backend/internal/models"
)

// GetModels handles GET /api/models - list all models
func (h *Handler) GetModels(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query params
	query := r.URL.Query()
	provider := query.Get("provider")
	search := query.Get("search")
	page := parseInt(query.Get("page"), 1)
	perPage := parseInt(query.Get("per_page"), 20)

	// Build filter
	filter := bson.M{"is_active": true}
	if provider != "" {
		filter["provider"] = provider
	}
	if search != "" {
		filter["$or"] = []bson.M{
			{"name": bson.M{"$regex": search, "$options": "i"}},
			{"description": bson.M{"$regex": search, "$options": "i"}},
		}
	}

	// Pagination
	skip := (page - 1) * perPage
	findOptions := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(perPage)).
		SetSort(bson.M{"elo_ratings.global": -1})

	// Query
	cursor, err := h.DB.Collection("ai_models").Find(ctx, filter, findOptions)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch models")
		return
	}
	defer cursor.Close(ctx)

	var models []models.AIModel
	if err = cursor.All(ctx, &models); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to decode models")
		return
	}

	// Count total
	total, _ := h.DB.Collection("ai_models").CountDocuments(ctx, filter)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"models": models,
		"pagination": map[string]int{
			"page":     page,
			"per_page": perPage,
			"total":    int(total),
			"pages":    int((total + int64(perPage) - 1) / int64(perPage)),
		},
	})
}

// GetModel handles GET /api/models/:slug - get single model
func (h *Handler) GetModel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := mux.Vars(r)["slug"]

	var model models.AIModel
	err := h.DB.Collection("ai_models").FindOne(ctx, bson.M{"slug": slug}).Decode(&model)
	if err != nil {
		respondError(w, http.StatusNotFound, "Model not found")
		return
	}

	// Fetch benchmark scores
	pipeline := []bson.M{
		{"$match": bson.M{"model_id": model.ID}},
		{"$lookup": bson.M{
			"from":         "benchmarks",
			"localField":   "benchmark_id",
			"foreignField": "_id",
			"as":           "benchmark",
		}},
		{"$unwind": "$benchmark"},
		{"$project": bson.M{
			"id":                 "$_id",
			"benchmark_id":       1,
			"benchmark_name":     "$benchmark.name",
			"benchmark_category": "$benchmark.category",
			"score":              1,
			"score_formatted":    1,
		}},
	}

	cursor, _ := h.DB.Collection("model_benchmark_scores").Aggregate(ctx, pipeline)
	var scores []models.BenchmarkScoreWithDetails
	cursor.All(ctx, &scores)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"model":  model,
		"scores": scores,
	})
}

// CompareModels handles GET /api/models/compare - compare multiple models
func (h *Handler) CompareModels(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	slugs := r.URL.Query()["slugs"]
	if len(slugs) == 0 {
		respondError(w, http.StatusBadRequest, "At least one model slug required")
		return
	}

	// Fetch models
	cursor, err := h.DB.Collection("ai_models").Find(ctx, bson.M{
		"slug":      bson.M{"$in": slugs},
		"is_active": true,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch models")
		return
	}
	defer cursor.Close(ctx)

	var models []models.AIModel
	if err = cursor.All(ctx, &models); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to decode models")
		return
	}

	// Reorder to match input order
	slugMap := make(map[string]int)
	for i, slug := range slugs {
		slugMap[slug] = i
	}

	// Sort models by slug order
	sorted := make([]models.AIModel, len(models))
	for _, m := range models {
		if idx, ok := slugMap[m.Slug]; ok {
			sorted[idx] = m
		}
	}

	// Filter out empty entries
	result := make([]models.AIModel, 0, len(sorted))
	for _, m := range sorted {
		if m.ID != primitive.NilObjectID {
			result = append(result, m)
		}
	}

	// Get benchmark comparison data
	modelIDs := make([]primitive.ObjectID, len(result))
	for i, m := range result {
		modelIDs[i] = m.ID
	}

	pipeline := []bson.M{
		{"$match": bson.M{"model_id": bson.M{"$in": modelIDs}}},
		{"$lookup": bson.M{
			"from":         "benchmarks",
			"localField":   "benchmark_id",
			"foreignField": "_id",
			"as":           "benchmark",
		}},
		{"$unwind": "$benchmark"},
		{"$group": bson.M{
			"_id": bson.M{
				"benchmark_id": "$_id",
				"category":     "$benchmark.category",
				"name":         "$benchmark.name",
			},
			"scores": bson.M{"$push": bson.M{
				"model_id":        "$model_id",
				"score":           "$score",
				"score_formatted": "$score_formatted",
			}},
		}},
		{"$sort": bson.M{"_id.category": 1, "_id.name": 1}},
	}

	benchCursor, _ := h.DB.Collection("model_benchmark_scores").Aggregate(ctx, pipeline)
	var benchmarkData []map[string]interface{}
	benchCursor.All(ctx, &benchmarkData)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"models":     result,
		"benchmarks": benchmarkData,
	})
}

// GetProviders handles GET /api/providers - list all providers
func (h *Handler) GetProviders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pipeline := []bson.M{
		{"$match": bson.M{"is_active": true}},
		{"$group": bson.M{
			"_id":   "$provider",
			"count": bson.M{"$sum": 1},
		}},
		{"$sort": bson.M{"_id": 1}},
	}

	cursor, err := h.DB.Collection("ai_models").Aggregate(ctx, pipeline)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch providers")
		return
	}
	defer cursor.Close(ctx)

	var providers []map[string]interface{}
	cursor.All(ctx, &providers)

	respondJSON(w, http.StatusOK, providers)
}

// CreateModel handles POST /api/admin/models - create new model (admin only)
func (h *Handler) CreateModel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.AIModel
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Generate slug if not provided
	if req.Slug == "" {
		req.Slug = generateSlug(req.Name)
	}

	// Check for duplicate slug
	exists, _ := h.DB.Collection("ai_models").CountDocuments(ctx, bson.M{"slug": req.Slug})
	if exists > 0 {
		respondError(w, http.StatusConflict, "Model with this slug already exists")
		return
	}

	// Set defaults
	req.ID = primitive.NewObjectID()
	req.Source = "manual"
	req.IsActive = true
	req.CreatedAt = primitive.NewDateTimeFromTime(time.Now())
	req.UpdatedAt = req.CreatedAt

	// Default ELO ratings
	req.ELORatings.Global = 1200
	req.ELORatings.Code = 1200
	req.ELORatings.Image = 1200
	req.ELORatings.Video = 1200
	req.ELORatings.Audio = 1200
	req.ELORatings.Text = 1200
	req.ELORatings.Vision = 1200

	_, err := h.DB.Collection("ai_models").InsertOne(ctx, req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create model")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// UpdateModel handles PUT /api/admin/models/:id - update model (admin only)
func (h *Handler) UpdateModel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid model ID")
		return
	}

	var req models.AIModel
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Don't allow changing slug or ID
	update := bson.M{
		"$set": bson.M{
			"name":              req.Name,
			"description":       req.Description,
			"provider":          req.Provider,
			"context_length":    req.ContextLength,
			"max_output_tokens": req.MaxOutputTokens,
			"pricing":           req.Pricing,
			"modalities":        req.Modalities,
			"architecture":      req.Architecture,
			"tokenizer":         req.Tokenizer,
			"is_moderated":      req.IsModerated,
			"is_active":         req.IsActive,
			"release_date":      req.ReleaseDate,
			"version":           req.Version,
			"manual_override":   true,
			"updated_at":        primitive.NewDateTimeFromTime(time.Now()),
		},
	}

	_, err = h.DB.Collection("ai_models").UpdateByID(ctx, objectID, update)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update model")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Model updated"})
}

// DeleteModel handles DELETE /api/admin/models/:id - deactivate model (admin only)
func (h *Handler) DeleteModel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid model ID")
		return
	}

	// Soft delete - just mark as inactive
	_, err = h.DB.Collection("ai_models").UpdateByID(ctx, objectID, bson.M{
		"$set": bson.M{
			"is_active":  false,
			"updated_at": primitive.NewDateTimeFromTime(time.Now()),
		},
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete model")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Model deactivated"})
}

// Helper functions
func generateSlug(name string) string {
	return strings.ToLower(strings.ReplaceAll(name, " ", "-"))
}
