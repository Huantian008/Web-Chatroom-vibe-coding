package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Message represents a chat message
type Message struct {
	ID          primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	Username    string              `bson:"username" json:"username"`
	UserID      *primitive.ObjectID `bson:"userId,omitempty" json:"userId,omitempty"`
	Message     string              `bson:"message" json:"message"`
	ChannelID   primitive.ObjectID  `bson:"channelId" json:"channelId"`
	MessageType string              `bson:"messageType" json:"messageType"` // "user" | "system" | "ai"
	IsDeleted   bool                `bson:"isDeleted" json:"isDeleted"`
	Timestamp   time.Time           `bson:"timestamp" json:"timestamp"`
}

// MessageResponse is the message data returned to clients
type MessageResponse struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	UserID      string    `json:"userId,omitempty"`
	Message     string    `json:"message"`
	ChannelID   string    `json:"channelId"`
	MessageType string    `json:"messageType"`
	Timestamp   time.Time `json:"timestamp"`
}

// ToResponse converts Message to MessageResponse
func (m *Message) ToResponse() *MessageResponse {
	resp := &MessageResponse{
		ID:          m.ID.Hex(),
		Username:    m.Username,
		Message:     m.Message,
		ChannelID:   m.ChannelID.Hex(),
		MessageType: m.MessageType,
		Timestamp:   m.Timestamp,
	}
	if m.UserID != nil {
		resp.UserID = m.UserID.Hex()
	}
	return resp
}
