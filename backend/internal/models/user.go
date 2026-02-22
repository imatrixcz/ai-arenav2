package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AuthMethod string

const (
	AuthMethodPassword AuthMethod = "password"
	AuthMethodGoogle   AuthMethod = "google"
)

type User struct {
	ID                   primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email                string             `json:"email" bson:"email"`
	DisplayName          string             `json:"displayName" bson:"displayName"`
	PasswordHash         string             `json:"-" bson:"passwordHash,omitempty"`
	GoogleID             string             `json:"-" bson:"googleId,omitempty"`
	AuthMethods          []AuthMethod       `json:"authMethods" bson:"authMethods"`
	EmailVerified        bool               `json:"emailVerified" bson:"emailVerified"`
	IsActive             bool               `json:"isActive" bson:"isActive"`
	CreatedAt            time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt            time.Time          `json:"updatedAt" bson:"updatedAt"`
	LastLoginAt          *time.Time         `json:"lastLoginAt,omitempty" bson:"lastLoginAt,omitempty"`
	LastVerificationSent *time.Time         `json:"-" bson:"lastVerificationSent,omitempty"`
	FailedLoginAttempts  int                `json:"-" bson:"failedLoginAttempts"`
	AccountLockedUntil   *time.Time         `json:"-" bson:"accountLockedUntil,omitempty"`
}

func (u *User) HasAuthMethod(method AuthMethod) bool {
	for _, m := range u.AuthMethods {
		if m == method {
			return true
		}
	}
	return false
}

func (u *User) IsLocked() bool {
	if u.AccountLockedUntil == nil {
		return false
	}
	return time.Now().Before(*u.AccountLockedUntil)
}
