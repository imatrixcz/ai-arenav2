package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type CreditBundle struct {
	ID         primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name       string             `json:"name" bson:"name"`
	Credits    int64              `json:"credits" bson:"credits"`
	PriceCents int64              `json:"priceCents" bson:"priceCents"`
	IsActive   bool               `json:"isActive" bson:"isActive"`
	SortOrder  int                `json:"sortOrder" bson:"sortOrder"`
	CreatedAt  time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt  time.Time          `json:"updatedAt" bson:"updatedAt"`
}
