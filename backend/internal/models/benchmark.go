package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Benchmark represents a benchmark category/test
type Benchmark struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Slug        string             `bson:"slug" json:"slug" validate:"required,min=1,max=100"`
	Name        string             `bson:"name" json:"name" validate:"required"`
	Category    string             `bson:"category" json:"category" validate:"required"`
	Description string             `bson:"description" json:"description"`
	URL         string             `bson:"url" json:"url"`
	IsActive    bool               `bson:"is_active" json:"is_active"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

// TableName returns the collection name
func (Benchmark) TableName() string {
	return "benchmarks"
}

// BenchmarkCategory represents a category of benchmarks
type BenchmarkCategory struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Slug      string             `bson:"slug" json:"slug" validate:"required"`
	Name      string             `bson:"name" json:"name" validate:"required"`
	SortOrder int                `bson:"sort_order" json:"sort_order"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

// TableName returns the collection name
func (BenchmarkCategory) TableName() string {
	return "benchmark_categories"
}
