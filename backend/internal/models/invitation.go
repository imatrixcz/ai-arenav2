package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type InvitationStatus string

const (
	InvitationPending  InvitationStatus = "pending"
	InvitationAccepted InvitationStatus = "accepted"
)

type Invitation struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	TenantID  primitive.ObjectID `json:"tenantId" bson:"tenantId"`
	Email     string             `json:"email" bson:"email"`
	Role      MemberRole         `json:"role" bson:"role"`
	Token     string             `json:"-" bson:"token"`
	Status    InvitationStatus   `json:"status" bson:"status"`
	InvitedBy primitive.ObjectID `json:"invitedBy" bson:"invitedBy"`
	ExpiresAt time.Time          `json:"expiresAt" bson:"expiresAt"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
}
