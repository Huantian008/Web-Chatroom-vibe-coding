package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Channel represents a chat channel
type Channel struct {
	ID          primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	Name        string              `bson:"name" json:"name"`
	Description string              `bson:"description" json:"description"`
	CreatedBy   *primitive.ObjectID `bson:"createdBy,omitempty" json:"createdBy,omitempty"`
	IsDefault   bool                `bson:"isDefault" json:"isDefault"`
	CreatedAt   time.Time           `bson:"createdAt" json:"createdAt"`
	Icon        string              `bson:"icon" json:"icon"`
}

// ChannelResponse is the channel data returned to clients
type ChannelResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsDefault   bool   `json:"isDefault"`
	Icon        string `json:"icon"`
}

// ToResponse converts Channel to ChannelResponse
func (c *Channel) ToResponse() *ChannelResponse {
	return &ChannelResponse{
		ID:          c.ID.Hex(),
		Name:        c.Name,
		Description: c.Description,
		IsDefault:   c.IsDefault,
		Icon:        c.Icon,
	}
}
