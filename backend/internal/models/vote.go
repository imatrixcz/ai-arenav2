package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// VoteType represents the type of vote
type VoteType string

const (
	VoteTypeWinner   VoteType = "winner"
	VoteTypeBothGood VoteType = "both_good"
	VoteTypeBothBad  VoteType = "both_bad"
	VoteTypeTie      VoteType = "tie"
)

// Vote represents a user's vote in a battle
type Vote struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PromptID primitive.ObjectID `bson:"prompt_id" json:"prompt_id" validate:"required"`
	UserID   primitive.ObjectID `bson:"user_id" json:"user_id" validate:"required"`

	// Models in battle (anonymized)
	ModelAID primitive.ObjectID `bson:"model_a_id" json:"model_a_id" validate:"required"`
	ModelBID primitive.ObjectID `bson:"model_b_id" json:"model_b_id" validate:"required"`

	// Result
	WinnerID primitive.ObjectID `bson:"winner_id,omitempty" json:"winner_id,omitempty"`
	VoteType VoteType           `bson:"vote_type" json:"vote_type" validate:"oneof=winner both_good both_bad tie"`

	// Context
	Modality string `bson:"modality" json:"modality"`

	CreatedAt time.Time `bson:"created_at" json:"created_at"`
}

// TableName returns the collection name
func (Vote) TableName() string {
	return "votes"
}

// ELOHistory tracks ELO rating changes
type ELOHistory struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ModelID  primitive.ObjectID `bson:"model_id" json:"model_id" validate:"required"`
	Modality string             `bson:"modality" json:"modality" validate:"required"`

	// Rating change
	OldRating float64 `bson:"old_rating" json:"old_rating"`
	NewRating float64 `bson:"new_rating" json:"new_rating"`
	Change    float64 `bson:"change" json:"change"`

	// Context
	PromptID primitive.ObjectID `bson:"prompt_id" json:"prompt_id"`
	VoteID   primitive.ObjectID `bson:"vote_id" json:"vote_id"`

	CalculatedAt time.Time `bson:"calculated_at" json:"calculated_at"`
}

// TableName returns the collection name
func (ELOHistory) TableName() string {
	return "elo_history"
}

// BattlePair represents a pair of models for battle
type BattlePair struct {
	PromptID primitive.ObjectID `json:"prompt_id"`
	Prompt   Prompt             `json:"prompt"`
	ModelAID primitive.ObjectID `json:"model_a_id"`
	ModelA   AIModel            `json:"model_a"`
	ModelBID primitive.ObjectID `json:"model_b_id"`
	ModelB   AIModel            `json:"model_b"`
	Modality string             `json:"modality"`

	// Anonymized display names (Model 1, Model 2)
	ModelAAnonymous string `json:"model_a_anonymous"`
	ModelBAnonymous string `json:"model_b_anonymous"`
}
