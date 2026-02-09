package repository

import (
	"context"
	"fmt"
	"time"

	"chat-room-backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MessageRepository handles message data access
type MessageRepository struct {
	collection *mongo.Collection
}

// NewMessageRepository creates a new MessageRepository
func NewMessageRepository(db *mongo.Database) *MessageRepository {
	collection := db.Collection("messages")

	// Create indexes
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Compound index: channelId + timestamp (descending)
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "channelId", Value: 1},
			{Key: "timestamp", Value: -1},
		},
	})

	// userId index
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "userId", Value: 1}},
	})

	// timestamp index
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "timestamp", Value: -1}},
	})

	return &MessageRepository{collection: collection}
}

// Create creates a new message
func (r *MessageRepository) Create(ctx context.Context, message *models.Message) error {
	message.Timestamp = time.Now()
	message.IsDeleted = false

	result, err := r.collection.InsertOne(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to create message: %w", err)
	}

	message.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// FindByChannelID finds messages by channel ID with limit
func (r *MessageRepository) FindByChannelID(ctx context.Context, channelID primitive.ObjectID, limit int) ([]*models.Message, error) {
	if limit <= 0 {
		limit = 100 // Default limit
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}). // Descending order
		SetLimit(int64(limit))

	cursor, err := r.collection.Find(ctx, bson.M{
		"channelId":  channelID,
		"isDeleted": false,
	}, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find messages: %w", err)
	}
	defer cursor.Close(ctx)

	var messages []*models.Message
	if err := cursor.All(ctx, &messages); err != nil {
		return nil, fmt.Errorf("failed to decode messages: %w", err)
	}

	// Reverse to get chronological order (oldest first)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// SoftDelete marks a message as deleted (soft delete)
func (r *MessageRepository) SoftDelete(ctx context.Context, messageID primitive.ObjectID) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": messageID},
		bson.M{"$set": bson.M{"isDeleted": true}},
	)
	if err != nil {
		return fmt.Errorf("failed to delete message: %w", err)
	}
	return nil
}
