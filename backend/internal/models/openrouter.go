package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// OpenRouterSyncLog tracks OpenRouter synchronization runs
type OpenRouterSyncLog struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SyncType    string             `bson:"sync_type" json:"sync_type" validate:"oneof=daily manual"`
	StartedAt   time.Time          `bson:"started_at" json:"started_at"`
	CompletedAt *time.Time         `bson:"completed_at,omitempty" json:"completed_at,omitempty"`

	// Statistics
	Stats OpenRouterSyncLogStats `bson:"stats" json:"stats"`

	CreatedBy primitive.ObjectID `bson:"created_by" json:"created_by"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

// OpenRouterSyncLogStats represents sync statistics
type OpenRouterSyncLogStats struct {
	ModelsTotal     int      `bson:"models_total" json:"models_total"`
	ModelsNew       int      `bson:"models_new" json:"models_new"`
	ModelsUpdated   int      `bson:"models_updated" json:"models_updated"`
	ModelsUnchanged int      `bson:"models_unchanged" json:"models_unchanged"`
	Errors          []string `bson:"errors" json:"errors"`
}

// TableName returns the collection name
func (OpenRouterSyncLog) TableName() string {
	return "openrouter_sync_logs"
}

// OpenRouterModel represents a model from OpenRouter API
type OpenRouterModel struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Context     *int64 `json:"context_length"`
	Pricing     struct {
		Prompt     float64 `json:"prompt"`
		Completion float64 `json:"completion"`
		Image      float64 `json:"image"`
	} `json:"pricing"`
	TopProvider struct {
		IsModerated bool   `json:"is_moderated"`
		MaxTokens   *int64 `json:"max_tokens"`
	} `json:"top_provider"`
	Architecture struct {
		Modality         string   `json:"modality"`
		Tokenizer        string   `json:"tokenizer"`
		InputModalities  []string `json:"input_modalities"`
		OutputModalities []string `json:"output_modalities"`
	} `json:"architecture"`
}

// OpenRouterResponse represents the API response
type OpenRouterResponse struct {
	Data []OpenRouterModel `json:"data"`
}
