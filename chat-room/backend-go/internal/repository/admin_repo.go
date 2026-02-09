package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"chat-room-backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AdminRepository handles admin-related data access
type AdminRepository struct {
	wordFilterCollection    *mongo.Collection
	globalMuteCollection    *mongo.Collection
}

// NewAdminRepository creates a new AdminRepository
func NewAdminRepository(db *mongo.Database) *AdminRepository {
	wordFilterColl := db.Collection("wordfilters")
	globalMuteColl := db.Collection("globalmutestatuses")

	// Create indexes
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// WordFilter indexes
	wordFilterColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "word", Value: 1}},
	})

	wordFilterColl.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "isActive", Value: 1}},
	})

	return &AdminRepository{
		wordFilterCollection: wordFilterColl,
		globalMuteCollection: globalMuteColl,
	}
}

// ============================================================
// Word Filter Operations
// ============================================================

// CreateWordFilter creates a new word filter
func (r *AdminRepository) CreateWordFilter(ctx context.Context, filter *models.WordFilter) error {
	filter.AddedAt = time.Now()
	filter.IsActive = true
	filter.Word = strings.ToLower(strings.TrimSpace(filter.Word))

	result, err := r.wordFilterCollection.InsertOne(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to create word filter: %w", err)
	}

	filter.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetActiveWordFilters returns all active word filters
func (r *AdminRepository) GetActiveWordFilters(ctx context.Context) ([]*models.WordFilter, error) {
	cursor, err := r.wordFilterCollection.Find(ctx, bson.M{"isActive": true})
	if err != nil {
		return nil, fmt.Errorf("failed to find word filters: %w", err)
	}
	defer cursor.Close(ctx)

	var filters []*models.WordFilter
	if err := cursor.All(ctx, &filters); err != nil {
		return nil, fmt.Errorf("failed to decode word filters: %w", err)
	}

	return filters, nil
}

// GetAllWordFilters returns all word filters (for admin view)
func (r *AdminRepository) GetAllWordFilters(ctx context.Context) ([]*models.WordFilter, error) {
	opts := options.Find().SetSort(bson.D{{Key: "addedAt", Value: -1}})

	cursor, err := r.wordFilterCollection.Find(ctx, bson.M{"isActive": true}, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find word filters: %w", err)
	}
	defer cursor.Close(ctx)

	var filters []*models.WordFilter
	if err := cursor.All(ctx, &filters); err != nil {
		return nil, fmt.Errorf("failed to decode word filters: %w", err)
	}

	return filters, nil
}

// DeactivateWordFilter soft-deletes a word filter
func (r *AdminRepository) DeactivateWordFilter(ctx context.Context, filterID primitive.ObjectID) error {
	_, err := r.wordFilterCollection.UpdateOne(
		ctx,
		bson.M{"_id": filterID},
		bson.M{"$set": bson.M{"isActive": false}},
	)
	if err != nil {
		return fmt.Errorf("failed to deactivate word filter: %w", err)
	}
	return nil
}

// ============================================================
// Global Mute Operations
// ============================================================

// GetGlobalMuteStatus returns the global mute status (singleton)
func (r *AdminRepository) GetGlobalMuteStatus(ctx context.Context) (*models.GlobalMuteStatus, error) {
	var status models.GlobalMuteStatus
	err := r.globalMuteCollection.FindOne(ctx, bson.M{}).Decode(&status)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Create default status if not exists
			status = models.GlobalMuteStatus{
				IsEnabled: false,
				Reason:    "",
			}
			result, insertErr := r.globalMuteCollection.InsertOne(ctx, &status)
			if insertErr != nil {
				return nil, fmt.Errorf("failed to create global mute status: %w", insertErr)
			}
			status.ID = result.InsertedID.(primitive.ObjectID)
			return &status, nil
		}
		return nil, fmt.Errorf("failed to find global mute status: %w", err)
	}
	return &status, nil
}

// UpdateGlobalMuteStatus updates the global mute status
func (r *AdminRepository) UpdateGlobalMuteStatus(ctx context.Context, enabled bool, enabledBy *primitive.ObjectID, reason string) error {
	var enabledAt *time.Time
	if enabled {
		now := time.Now()
		enabledAt = &now
	}

	update := bson.M{
		"isEnabled": enabled,
		"enabledBy": enabledBy,
		"enabledAt": enabledAt,
		"reason":    reason,
	}

	// Use upsert to create if not exists
	opts := options.Update().SetUpsert(true)
	_, err := r.globalMuteCollection.UpdateOne(
		ctx,
		bson.M{},
		bson.M{"$set": update},
		opts,
	)
	if err != nil {
		return fmt.Errorf("failed to update global mute status: %w", err)
	}
	return nil
}
