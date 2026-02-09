package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// WordFilter represents a blocked word for content filtering
type WordFilter struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Word     string             `bson:"word" json:"word"`
	AddedBy  primitive.ObjectID `bson:"addedBy" json:"addedBy"`
	AddedAt  time.Time          `bson:"addedAt" json:"addedAt"`
	IsActive bool               `bson:"isActive" json:"isActive"`
}

// WordFilterResponse is the word filter data returned to clients
type WordFilterResponse struct {
	ID      string    `json:"id"`
	Word    string    `json:"word"`
	AddedBy string    `json:"addedBy"`
	AddedAt time.Time `json:"addedAt"`
}

// ToResponse converts WordFilter to WordFilterResponse
func (wf *WordFilter) ToResponse() *WordFilterResponse {
	return &WordFilterResponse{
		ID:      wf.ID.Hex(),
		Word:    wf.Word,
		AddedBy: wf.AddedBy.Hex(),
		AddedAt: wf.AddedAt,
	}
}
