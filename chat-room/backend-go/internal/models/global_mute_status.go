package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GlobalMuteStatus represents the global mute status (singleton pattern)
type GlobalMuteStatus struct {
	ID        primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	IsEnabled bool                `bson:"isEnabled" json:"isEnabled"`
	EnabledBy *primitive.ObjectID `bson:"enabledBy,omitempty" json:"enabledBy,omitempty"`
	EnabledAt *time.Time          `bson:"enabledAt,omitempty" json:"enabledAt,omitempty"`
	Reason    string              `bson:"reason" json:"reason"`
}

// GlobalMuteResponse is the global mute status returned to clients
type GlobalMuteResponse struct {
	IsEnabled bool   `json:"isEnabled"`
	Reason    string `json:"reason"`
}

// ToResponse converts GlobalMuteStatus to GlobalMuteResponse
func (gms *GlobalMuteStatus) ToResponse() *GlobalMuteResponse {
	return &GlobalMuteResponse{
		IsEnabled: gms.IsEnabled,
		Reason:    gms.Reason,
	}
}
