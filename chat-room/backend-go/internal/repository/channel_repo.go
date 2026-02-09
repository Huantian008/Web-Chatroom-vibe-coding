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

// ChannelRepository handles channel data access
type ChannelRepository struct {
	collection *mongo.Collection
}

// NewChannelRepository creates a new ChannelRepository
func NewChannelRepository(db *mongo.Database) *ChannelRepository {
	collection := db.Collection("channels")

	// Create indexes
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// isDefault index
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "isDefault", Value: 1}},
	})

	// name index
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "name", Value: 1}},
	})

	return &ChannelRepository{collection: collection}
}

// Create creates a new channel
func (r *ChannelRepository) Create(ctx context.Context, channel *models.Channel) error {
	channel.CreatedAt = time.Now()

	result, err := r.collection.InsertOne(ctx, channel)
	if err != nil {
		return fmt.Errorf("failed to create channel: %w", err)
	}

	channel.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// FindByID finds a channel by ID
func (r *ChannelRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Channel, error) {
	var channel models.Channel
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&channel)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find channel: %w", err)
	}
	return &channel, nil
}

// FindDefault finds the default channel
func (r *ChannelRepository) FindDefault(ctx context.Context) (*models.Channel, error) {
	var channel models.Channel
	err := r.collection.FindOne(ctx, bson.M{"isDefault": true}).Decode(&channel)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find default channel: %w", err)
	}
	return &channel, nil
}

// FindAll finds all channels
func (r *ChannelRepository) FindAll(ctx context.Context) ([]*models.Channel, error) {
	opts := options.Find().SetSort(bson.D{
		{Key: "isDefault", Value: -1}, // Default channels first
		{Key: "name", Value: 1},        // Then by name
	})

	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find channels: %w", err)
	}
	defer cursor.Close(ctx)

	var channels []*models.Channel
	if err := cursor.All(ctx, &channels); err != nil {
		return nil, fmt.Errorf("failed to decode channels: %w", err)
	}

	return channels, nil
}

// FindByIDs finds channels by IDs
func (r *ChannelRepository) FindByIDs(ctx context.Context, ids []primitive.ObjectID) ([]*models.Channel, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
	if err != nil {
		return nil, fmt.Errorf("failed to find channels: %w", err)
	}
	defer cursor.Close(ctx)

	var channels []*models.Channel
	if err := cursor.All(ctx, &channels); err != nil {
		return nil, fmt.Errorf("failed to decode channels: %w", err)
	}

	return channels, nil
}

// ChannelMemberRepository handles channel member data access
type ChannelMemberRepository struct {
	collection *mongo.Collection
}

// NewChannelMemberRepository creates a new ChannelMemberRepository
func NewChannelMemberRepository(db *mongo.Database) *ChannelMemberRepository {
	collection := db.Collection("channelmembers")

	// Create indexes
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Unique compound index: userId + channelId
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{
			{Key: "userId", Value: 1},
			{Key: "channelId", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	})

	// userId index
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "userId", Value: 1}},
	})

	// channelId index
	collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "channelId", Value: 1}},
	})

	return &ChannelMemberRepository{collection: collection}
}

// Create creates a new channel membership
func (r *ChannelMemberRepository) Create(ctx context.Context, member *models.ChannelMember) error {
	member.JoinedAt = time.Now()
	member.LastReadAt = time.Now()

	result, err := r.collection.InsertOne(ctx, member)
	if err != nil {
		return fmt.Errorf("failed to create channel member: %w", err)
	}

	member.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// FindByUserID finds all channel memberships for a user
func (r *ChannelMemberRepository) FindByUserID(ctx context.Context, userID primitive.ObjectID) ([]*models.ChannelMember, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return nil, fmt.Errorf("failed to find channel members: %w", err)
	}
	defer cursor.Close(ctx)

	var members []*models.ChannelMember
	if err := cursor.All(ctx, &members); err != nil {
		return nil, fmt.Errorf("failed to decode channel members: %w", err)
	}

	return members, nil
}

// FindByUserAndChannel finds a specific channel membership
func (r *ChannelMemberRepository) FindByUserAndChannel(ctx context.Context, userID, channelID primitive.ObjectID) (*models.ChannelMember, error) {
	var member models.ChannelMember
	err := r.collection.FindOne(ctx, bson.M{
		"userId":    userID,
		"channelId": channelID,
	}).Decode(&member)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find channel member: %w", err)
	}
	return &member, nil
}

// Delete removes a channel membership
func (r *ChannelMemberRepository) Delete(ctx context.Context, userID, channelID primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{
		"userId":    userID,
		"channelId": channelID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete channel member: %w", err)
	}
	return nil
}

// CountByChannelID counts members in a channel
func (r *ChannelMemberRepository) CountByChannelID(ctx context.Context, channelID primitive.ObjectID) (int64, error) {
	count, err := r.collection.CountDocuments(ctx, bson.M{"channelId": channelID})
	if err != nil {
		return 0, fmt.Errorf("failed to count channel members: %w", err)
	}
	return count, nil
}
