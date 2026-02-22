package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Message struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID    primitive.ObjectID `json:"userId" bson:"userId"`
	Subject   string             `json:"subject" bson:"subject"`
	Body      string             `json:"body" bson:"body"`
	IsSystem  bool               `json:"isSystem" bson:"isSystem"`
	Read      bool               `json:"read" bson:"read"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
}
