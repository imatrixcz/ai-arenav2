package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Prompt represents a test prompt with model outputs
type Prompt struct {
	ID      primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Slug    string             `bson:"slug" json:"slug" validate:"required,min=1,max=200"`
	Title   string             `bson:"title" json:"title" validate:"required"`
	Content string             `bson:"content" json:"content" validate:"required"`

	// Categorization
	Modality string `bson:"modality" json:"modality" validate:"oneof=code image video audio text vision"`
	Segment  string `bson:"segment" json:"segment"`

	// Model outputs
	Outputs []PromptOutput `bson:"outputs" json:"outputs"`

	// Metadata
	IsActive  bool               `bson:"is_active" json:"is_active"`
	CreatedBy primitive.ObjectID `bson:"created_by" json:"created_by"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

// PromptOutput represents a single model's output for a prompt
type PromptOutput struct {
	ModelID    primitive.ObjectID `bson:"model_id" json:"model_id"`
	OutputType string             `bson:"output_type" json:"output_type" validate:"oneof=code image video audio"`

	// For code outputs
	Code struct {
		HTML        string `bson:"html" json:"html"`
		CSS         string `bson:"css" json:"css"`
		JS          string `bson:"js" json:"js"`
		PreviewMode string `bson:"preview_mode" json:"preview_mode" validate:"oneof=live_iframe video_loop"`
		VideoURL    string `bson:"video_url" json:"video_url"`
	} `bson:"code" json:"code"`

	// For media outputs
	Media struct {
		ImageURL        string `bson:"image_url" json:"image_url"`
		VideoURL        string `bson:"video_url" json:"video_url"`
		AudioURL        string `bson:"audio_url" json:"audio_url"`
		AudioCoverImage string `bson:"audio_cover_image" json:"audio_cover_image"`
	} `bson:"media" json:"media"`

	CreatedAt time.Time `bson:"created_at" json:"created_at"`
}

// TableName returns the collection name
func (Prompt) TableName() string {
	return "prompts"
}

// PromptModality represents available modalities for prompts
type PromptModality struct {
	ID   primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Slug string             `bson:"slug" json:"slug"`
	Name string             `bson:"name" json:"name"`
}

// PromptSegment represents prompt categories
type PromptSegment struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Slug      string             `bson:"slug" json:"slug"`
	Name      string             `bson:"name" json:"name"`
	ParentID  primitive.ObjectID `bson:"parent_id,omitempty" json:"parent_id,omitempty"`
	SortOrder int                `bson:"sort_order" json:"sort_order"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}
