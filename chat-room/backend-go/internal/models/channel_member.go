package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ChannelMember represents a user's membership in a channel
type ChannelMember struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID     primitive.ObjectID `bson:"userId" json:"userId"`
	ChannelID  primitive.ObjectID `bson:"channelId" json:"channelId"`
	JoinedAt   time.Time          `bson:"joinedAt" json:"joinedAt"`
	LastReadAt time.Time          `bson:"lastReadAt" json:"lastReadAt"`
}
