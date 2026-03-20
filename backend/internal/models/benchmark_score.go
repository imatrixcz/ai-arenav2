package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ModelBenchmarkScore represents a benchmark score for a model
type ModelBenchmarkScore struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ModelID     primitive.ObjectID `bson:"model_id" json:"model_id" validate:"required"`
	BenchmarkID primitive.ObjectID `bson:"benchmark_id" json:"benchmark_id" validate:"required"`

	// Score data
	Score          float64 `bson:"score" json:"score" validate:"required"`
	ScoreFormatted string  `bson:"score_formatted" json:"score_formatted"`
	RawValue       string  `bson:"raw_value" json:"raw_value"`

	// Metadata
	Source string `bson:"source" json:"source" validate:"oneof=manual huggingface openrouter"`
	URL    string `bson:"url" json:"url"`
	Notes  string `bson:"notes" json:"notes"`

	// Timestamps
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}

// TableName returns the collection name
func (ModelBenchmarkScore) TableName() string {
	return "model_benchmark_scores"
}

// BenchmarkScoreWithDetails includes model and benchmark info
type BenchmarkScoreWithDetails struct {
	ModelBenchmarkScore `bson:",inline"`
	ModelName           string `bson:"model_name" json:"model_name"`
	ModelSlug           string `bson:"model_slug" json:"model_slug"`
	BenchmarkName       string `bson:"benchmark_name" json:"benchmark_name"`
	BenchmarkCategory   string `bson:"benchmark_category" json:"benchmark_category"`
}
