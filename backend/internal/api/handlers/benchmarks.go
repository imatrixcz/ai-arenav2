package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/jonradoff/lastsaas/backend/internal/models"
)

// GetBenchmarks handles GET /api/benchmarks
func (h *Handler) GetBenchmarks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	category := r.URL.Query().Get("category")

	filter := bson.M{"is_active": true}
	if category != "" {
		filter["category"] = category
	}

	cursor, err := h.DB.Collection("benchmarks").Find(ctx, filter,
		options.Find().SetSort(bson.M{"category": 1, "name": 1}))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch benchmarks")
		return
	}
	defer cursor.Close(ctx)

	var benchmarks []models.Benchmark
	if err = cursor.All(ctx, &benchmarks); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to decode benchmarks")
		return
	}

	respondJSON(w, http.StatusOK, benchmarks)
}

// GetBenchmarkCategories handles GET /api/benchmarks/categories
func (h *Handler) GetBenchmarkCategories(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pipeline := []bson.M{
		{"$match": bson.M{"is_active": true}},
		{"$group": bson.M{"_id": "$category"}},
		{"$sort": bson.M{"_id": 1}},
	}

	cursor, err := h.DB.Collection("benchmarks").Aggregate(ctx, pipeline)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch categories")
		return
	}
	defer cursor.Close(ctx)

	var categories []map[string]string
	cursor.All(ctx, &categories)

	respondJSON(w, http.StatusOK, categories)
}

// GetBenchmarkScores handles GET /api/benchmarks/:slug/scores
func (h *Handler) GetBenchmarkScores(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := mux.Vars(r)["slug"]

	// Get benchmark
	var benchmark models.Benchmark
	err := h.DB.Collection("benchmarks").FindOne(ctx, bson.M{"slug": slug}).Decode(&benchmark)
	if err != nil {
		respondError(w, http.StatusNotFound, "Benchmark not found")
		return
	}

	// Get scores with model details
	pipeline := []bson.M{
		{"$match": bson.M{"benchmark_id": benchmark.ID}},
		{"$lookup": bson.M{
			"from":         "ai_models",
			"localField":   "model_id",
			"foreignField": "_id",
			"as":           "model",
		}},
		{"$unwind": "$model"},
		{"$project": bson.M{
			"id":              "$_id",
			"score":           1,
			"score_formatted": 1,
			"model_name":      "$model.name",
			"model_slug":      "$model.slug",
			"provider":        "$model.provider",
		}},
		{"$sort": bson.M{"score": -1}},
	}

	cursor, err := h.DB.Collection("model_benchmark_scores").Aggregate(ctx, pipeline)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch scores")
		return
	}
	defer cursor.Close(ctx)

	var scores []map[string]interface{}
	cursor.All(ctx, &scores)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"benchmark": benchmark,
		"scores":    scores,
	})
}

// CreateBenchmark handles POST /api/admin/benchmarks
func (h *Handler) CreateBenchmark(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.Benchmark
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Generate slug if not provided
	if req.Slug == "" {
		req.Slug = generateSlug(req.Name)
	}

	// Check for duplicate
	exists, _ := h.DB.Collection("benchmarks").CountDocuments(ctx, bson.M{"slug": req.Slug})
	if exists > 0 {
		respondError(w, http.StatusConflict, "Benchmark with this slug already exists")
		return
	}

	req.ID = primitive.NewObjectID()
	req.IsActive = true
	req.CreatedAt = primitive.NewDateTimeFromTime(time.Now())
	req.UpdatedAt = req.CreatedAt

	_, err := h.DB.Collection("benchmarks").InsertOne(ctx, req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create benchmark")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// UpdateBenchmark handles PUT /api/admin/benchmarks/:id
func (h *Handler) UpdateBenchmark(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid benchmark ID")
		return
	}

	var req models.Benchmark
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	update := bson.M{
		"$set": bson.M{
			"name":        req.Name,
			"category":    req.Category,
			"description": req.Description,
			"url":         req.URL,
			"is_active":   req.IsActive,
			"updated_at":  primitive.NewDateTimeFromTime(time.Now()),
		},
	}

	_, err = h.DB.Collection("benchmarks").UpdateByID(ctx, objectID, update)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update benchmark")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Benchmark updated"})
}

// DeleteBenchmark handles DELETE /api/admin/benchmarks/:id
func (h *Handler) DeleteBenchmark(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid benchmark ID")
		return
	}

	// Also delete associated scores
	_, _ = h.DB.Collection("model_benchmark_scores").DeleteMany(ctx, bson.M{"benchmark_id": objectID})

	_, err = h.DB.Collection("benchmarks").DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete benchmark")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Benchmark deleted"})
}

// CreateBenchmarkScore handles POST /api/admin/scores
func (h *Handler) CreateBenchmarkScore(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.ModelBenchmarkScore
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.ID = primitive.NewObjectID()
	req.Source = "manual"
	req.CreatedAt = primitive.NewDateTimeFromTime(time.Now())
	req.UpdatedAt = req.CreatedAt

	// Format score for display
	if req.ScoreFormatted == "" {
		req.ScoreFormatted = formatScore(req.Score)
	}

	_, err := h.DB.Collection("model_benchmark_scores").InsertOne(ctx, req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create score")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// UpdateBenchmarkScore handles PUT /api/admin/scores/:id
func (h *Handler) UpdateBenchmarkScore(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid score ID")
		return
	}

	var req models.ModelBenchmarkScore
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	update := bson.M{
		"$set": bson.M{
			"score":           req.Score,
			"score_formatted": req.ScoreFormatted,
			"raw_value":       req.RawValue,
			"source":          req.Source,
			"url":             req.URL,
			"notes":           req.Notes,
			"updated_at":      primitive.NewDateTimeFromTime(time.Now()),
		},
	}

	_, err = h.DB.Collection("model_benchmark_scores").UpdateByID(ctx, objectID, update)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update score")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Score updated"})
}

// DeleteBenchmarkScore handles DELETE /api/admin/scores/:id
func (h *Handler) DeleteBenchmarkScore(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := mux.Vars(r)["id"]

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid score ID")
		return
	}

	_, err = h.DB.Collection("model_benchmark_scores").DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete score")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Score deleted"})
}

// Helper function to format scores
func formatScore(score float64) string {
	if score >= 1 {
		return fmt.Sprintf("%.1f%%", score)
	}
	return fmt.Sprintf("%.3f", score)
}
