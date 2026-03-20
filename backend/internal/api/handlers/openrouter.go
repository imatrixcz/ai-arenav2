package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/jonradoff/lastsaas/backend/internal/models"
)

const openRouterAPIURL = "https://openrouter.ai/api/v1/models"

// OpenRouterSync handles POST /api/admin/sync/openrouter
func (h *Handler) OpenRouterSync(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	// Get user from context
	userID, ok := ctx.Value("user_id").(primitive.ObjectID)
	if !ok {
		respondError(w, http.StatusUnauthorized, "Authentication required")
		return
	}
	
	// Create sync log entry
	syncLog := models.OpenRouterSyncLog{
		ID:        primitive.NewObjectID(),
		SyncType:  "manual",
		StartedAt: primitive.NewDateTimeFromTime(time.Now()),
		CreatedBy: userID,
	}
	
	// Start sync in background
	go func() {
		stats := h.performOpenRouterSync(ctx, &syncLog)
		
		// Update sync log with results
		completedAt := primitive.NewDateTimeFromTime(time.Now())
		syncLog.CompletedAt = &completedAt
		syncLog.Stats = stats
		
		h.DB.Collection("openrouter_sync_logs").InsertOne(ctx, syncLog)
	}()
	
	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"message": "Sync started",
		"sync_id": syncLog.ID,
	})
}

// GetSyncLogs handles GET /api/admin/sync/logs
func (h *Handler) GetSyncLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	page := parseInt(r.URL.Query().Get("page"), 1)
	perPage := parseInt(r.URL.Query().Get("per_page"), 20)
	
	skip := (page - 1) * perPage
	findOptions := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(perPage)).
		SetSort(bson.M{"started_at": -1})
	
	cursor, err := h.DB.Collection("openrouter_sync_logs").Find(ctx, bson.M{}, findOptions)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch sync logs")
		return
	}
	defer cursor.Close(ctx)
	
	var logs []models.OpenRouterSyncLog
	cursor.All(ctx, &logs)
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"logs": logs,
		"pagination": map[string]int{
			"page":     page,
			"per_page": perPage,
		},
	})
}

// GetSyncStatus handles GET /api/admin/sync/status
func (h *Handler) GetSyncStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	// Get latest sync
	var latestSync models.OpenRouterSyncLog
	err := h.DB.Collection("openrouter_sync_logs").
		FindOne(ctx, bson.M{}, options.FindOne().SetSort(bson.M{"started_at": -1})).
		Decode(&latestSync)
	
	if err != nil {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"last_sync": nil,
			"status":    "never_synced",
		})
		return
	}
	
	status := "completed"
	if latestSync.CompletedAt == nil {
		status = "running"
	} else if len(latestSync.Stats.Errors) > 0 {
		status = "completed_with_errors"
	}
	
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"last_sync": latestSync,
		"status":    status,
	})
}

// performOpenRouterSync fetches and processes OpenRouter models
func (h *Handler) performOpenRouterSync(ctx context.Context, syncLog *models.OpenRouterSyncLog) models.OpenRouterSyncLogStats {
	stats := models.OpenRouterSyncLogStats{}
	
	// Fetch models from OpenRouter
	resp, err := http.Get(openRouterAPIURL)
	if err != nil {
		stats.Errors = append(stats.Errors, fmt.Sprintf("Failed to fetch from OpenRouter: %v", err))
		return stats
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		stats.Errors = append(stats.Errors, fmt.Sprintf("OpenRouter returned status: %d", resp.StatusCode))
		return stats
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		stats.Errors = append(stats.Errors, fmt.Sprintf("Failed to read response: %v", err))
		return stats
	}
	
	var apiResponse models.OpenRouterResponse
	if err := json.Unmarshal(body, &apiResponse); err != nil {
		stats.Errors = append(stats.Errors, fmt.Sprintf("Failed to parse JSON: %v", err))
		return stats
	}
	
	stats.ModelsTotal = len(apiResponse.Data)
	
	// Process each model
	for _, apiModel := range apiResponse.Data {
		if err := h.syncModel(ctx, apiModel, &stats); err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("Failed to sync %s: %v", apiModel.ID, err))
		}
	}
	
	return stats
}

// syncModel syncs a single OpenRouter model to our database
func (h *Handler) syncModel(ctx context.Context, apiModel models.OpenRouterModel, stats *models.OpenRouterSyncLogStats) error {
	// Extract provider from OpenRouter ID (format: "provider/model-name")
	parts := strings.Split(apiModel.ID, "/")
	if len(parts) < 2 {
		return fmt.Errorf("invalid model ID format: %s", apiModel.ID)
	}
	provider := parts[0]
	
	// Generate slug
	slug := generateSlug(apiModel.Name)
	
	// Check if model exists
	var existingModel models.AIModel
	err := h.DB.Collection("ai_models").FindOne(ctx, 
		bson.M{"openrouter_id": apiModel.ID}).Decode(&existingModel)
	
	if err == nil {
		// Model exists - check if we should update
		if existingModel.ManualOverride {
			stats.ModelsUnchanged++
			return nil // Skip manual override models
		}
		
		// Update existing model
		update := h.buildModelUpdate(apiModel, provider, existingModel.Slug)
		_, err = h.DB.Collection("ai_models").UpdateByID(ctx, existingModel.ID, update)
		if err != nil {
			return err
		}
		stats.ModelsUpdated++
	} else {
		// New model - create
		newModel := h.buildNewModel(apiModel, provider, slug)
		_, err = h.DB.Collection("ai_models").InsertOne(ctx, newModel)
		if err != nil {
			return err
		}
		stats.ModelsNew++
	}
	
	return nil
}

// buildModelUpdate creates update document for existing model
func (h *Handler) buildModelUpdate(apiModel models.OpenRouterModel, provider, slug string) bson.M {
	contextLength := int64(0)
	if apiModel.Context != nil {
		contextLength = *apiModel.Context
	}
	
	maxTokens := int64(0)
	if apiModel.TopProvider.MaxTokens != nil {
		maxTokens = *apiModel.TopProvider.MaxTokens
	}
	
	modalities := []string{"text"}
	if len(apiModel.Architecture.InputModalities) > 0 {
		modalities = apiModel.Architecture.InputModalities
	}
	
	return bson.M{
		"$set": bson.M{
			"name":              apiModel.Name,
			"description":       apiModel.Description,
			"provider":          provider,
			"context_length":    contextLength,
			"max_output_tokens": maxTokens,
			"pricing": bson.M{
				"prompt":     apiModel.Pricing.Prompt,
				"completion": apiModel.Pricing.Completion,
				"image":      apiModel.Pricing.Image,
			},
			"modalities":    modalities,
			"architecture":  apiModel.Architecture.Modality,
			"tokenizer":     apiModel.Architecture.Tokenizer,
			"is_moderated":  apiModel.TopProvider.IsModerated,
			"last_synced_at": primitive.NewDateTimeFromTime(time.Now()),
			"updated_at":    primitive.NewDateTimeFromTime(time.Now()),
		},
	}
}

// buildNewModel creates a new model document
func (h *Handler) buildNewModel(apiModel models.OpenRouterModel, provider, slug string) models.AIModel {
	contextLength := int64(0)
	if apiModel.Context != nil {
		contextLength = *apiModel.Context
	}
	
	maxTokens := int64(0)
	if apiModel.TopProvider.MaxTokens != nil {
		maxTokens = *apiModel.TopProvider.MaxTokens
	}
	
	modalities := []string{"text"}
	if len(apiModel.Architecture.InputModalities) > 0 {
		modalities = apiModel.Architecture.InputModalities
	}
	
	now := primitive.NewDateTimeFromTime(time.Now())
	
	return models.AIModel{
		ID:             primitive.NewObjectID(),
		Slug:           slug,
		OpenRouterID:   apiModel.ID,
		Name:           apiModel.Name,
		Description:    apiModel.Description,
		Provider:       provider,
		ContextLength:  contextLength,
		MaxOutputTokens: maxTokens,
		Pricing: struct {
			Prompt     float64 "json:"prompt" bson:"prompt""
			Completion float64 "json:"completion" bson:"completion""
			Image      float64 "json:"image" bson:"image""
			Tiers      []struct {
				Threshold       int64   "json:"threshold" bson:"threshold""
				PromptPrice     float64 "json:"prompt_price" bson:"prompt_price""
				CompletionPrice float64 "json:"completion_price" bson:"completion_price""
				Label           string  "json:"label" bson:"label""
			} "json:"tiers" bson:"tiers,omitempty""
		}{
			Prompt:     apiModel.Pricing.Prompt,
			Completion: apiModel.Pricing.Completion,
			Image:      apiModel.Pricing.Image,
		},
		Modalities:   modalities,
		Architecture: apiModel.Architecture.Modality,
		Tokenizer:    apiModel.Architecture.Tokenizer,
		IsModerated:  apiModel.TopProvider.IsModerated,
		IsActive:     true,
		ELORatings: struct {
			Global float64 "json:"global" bson:"global""
			Code   float64 "json:"code" bson:"code""
			Image  float64 "json:"image" bson:"image""
			Video  float64 "json:"video" bson:"video""
			Audio  float64 "json:"audio" bson:"audio""
			Text   float64 "json:"text" bson:"text""
			Vision float64 "json:"vision" bson:"vision""
		}{
			Global: 1200,
			Code:   1200,
			Image:  1200,
			Video:  1200,
			Audio:  1200,
			Text:   1200,
			Vision: 1200,
		},
		Source:         "openrouter",
		LastSyncedAt:   now,
		ManualOverride: false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}
