package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a user in the system
type User struct {
	ID          primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	Username    string              `bson:"username" json:"username"`
	Password    string              `bson:"password" json:"-"` // Never expose password in JSON
	CreatedAt   time.Time           `bson:"createdAt" json:"createdAt"`
	LastLogin   time.Time           `bson:"lastLogin" json:"lastLogin"`
	Role        string              `bson:"role" json:"role"` // "user" | "admin"
	IsMuted     bool                `bson:"isMuted" json:"isMuted"`
	MutedUntil  *time.Time          `bson:"mutedUntil,omitempty" json:"mutedUntil,omitempty"`
	MutedBy     *primitive.ObjectID `bson:"mutedBy,omitempty" json:"mutedBy,omitempty"`
	MutedReason string              `bson:"mutedReason,omitempty" json:"mutedReason,omitempty"`
}

// UserResponse is the user data returned to clients (without sensitive info)
type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// ToResponse converts User to UserResponse
func (u *User) ToResponse() *UserResponse {
	return &UserResponse{
		ID:       u.ID.Hex(),
		Username: u.Username,
	}
}
