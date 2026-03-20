package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AIModel represents an AI model in the database
type AIModel struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Slug         string             `bson:"slug" json:"slug" validate:"required,min=1,max=100"`
	OpenRouterID string             `bson:"openrouter_id" json:"openrouter_id" validate:"required"`
	Name         string             `bson:"name" json:"name" validate:"required"`
	Description  string             `bson:"description" json:"description"`
	Provider     string             `bson:"provider" json:"provider" validate:"required"`

	// Capabilities
	ContextLength   int64 `bson:"context_length" json:"context_length"`
	MaxOutputTokens int64 `bson:"max_output_tokens" json:"max_output_tokens"`

	// Pricing (in USD per 1M tokens)
	Pricing AIModelPricing `bson:"pricing" json:"pricing"`

	// Architecture
	Modalities   []string `bson:"modalities" json:"modalities"`
	Architecture string   `bson:"architecture" json:"architecture"`
	Tokenizer    string   `bson:"tokenizer" json:"tokenizer"`

	// Metadata
	IsModerated bool      `bson:"is_moderated" json:"is_moderated"`
	IsActive    bool      `bson:"is_active" json:"is_active"`
	ReleaseDate time.Time `bson:"release_date" json:"release_date"`
	Version     string    `bson:"version" json:"version"`

	// ELO Ratings (7 categories)
	ELORatings AIModelELORatings `bson:"elo_ratings" json:"elo_ratings"`

	// Sync info
	Source         string    `bson:"source" json:"source" validate:"required,oneof=openrouter manual"`
	LastSyncedAt   time.Time `bson:"last_synced_at" json:"last_synced_at"`
	ManualOverride bool      `bson:"manual_override" json:"manual_override"`

	// Timestamps
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}

// AIModelPricing represents pricing structure
type AIModelPricing struct {
	Prompt     float64 `bson:"prompt" json:"prompt"`
	Completion float64 `bson:"completion" json:"completion"`
	Image      float64 `bson:"image" json:"image"`
	Tiers      []struct {
		Threshold       int64   `bson:"threshold" json:"threshold"`
		PromptPrice     float64 `bson:"prompt_price" json:"prompt_price"`
		CompletionPrice float64 `bson:"completion_price" json:"completion_price"`
		Label           string  `bson:"label" json:"label"`
	} `bson:"tiers" json:"tiers"`
}

// AIModelELORatings represents ELO ratings for different modalities
type AIModelELORatings struct {
	Global float64 `bson:"global" json:"global"`
	Code   float64 `bson:"code" json:"code"`
	Image  float64 `bson:"image" json:"image"`
	Video  float64 `bson:"video" json:"video"`
	Audio  float64 `bson:"audio" json:"audio"`
	Text   float64 `bson:"text" json:"text"`
	Vision float64 `bson:"vision" json:"vision"`
}

// GetELORating returns ELO rating for specific modality
func (m *AIModel) GetELORating(modality string) float64 {
	switch modality {
	case "code":
		return m.ELORatings.Code
	case "image":
		return m.ELORatings.Image
	case "video":
		return m.ELORatings.Video
	case "audio":
		return m.ELORatings.Audio
	case "text":
		return m.ELORatings.Text
	case "vision":
		return m.ELORatings.Vision
	default:
		return m.ELORatings.Global
	}
}

// SetELORating sets ELO rating for specific modality
func (m *AIModel) SetELORating(modality string, rating float64) {
	switch modality {
	case "code":
		m.ELORatings.Code = rating
	case "image":
		m.ELORatings.Image = rating
	case "video":
		m.ELORatings.Video = rating
	case "audio":
		m.ELORatings.Audio = rating
	case "text":
		m.ELORatings.Text = rating
	case "vision":
		m.ELORatings.Vision = rating
	default:
		m.ELORatings.Global = rating
	}
}

// TableName returns the collection name
func (AIModel) TableName() string {
	return "ai_models"
}
