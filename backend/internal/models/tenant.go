package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Tenant struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name      string             `json:"name" bson:"name"`
	Slug      string             `json:"slug" bson:"slug"`
	IsRoot    bool               `json:"isRoot" bson:"isRoot"`
	IsActive  bool                `json:"isActive" bson:"isActive"`
	PlanID              *primitive.ObjectID `json:"planId,omitempty" bson:"planId,omitempty"`
	BillingWaived       bool               `json:"billingWaived" bson:"billingWaived"`
	SubscriptionCredits int64              `json:"subscriptionCredits" bson:"subscriptionCredits"`
	PurchasedCredits    int64              `json:"purchasedCredits" bson:"purchasedCredits"`
	CreatedAt           time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
}
