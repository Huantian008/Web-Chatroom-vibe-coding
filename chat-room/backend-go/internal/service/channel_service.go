package service

import (
	"context"
	"fmt"

	"chat-room-backend/internal/models"
	"chat-room-backend/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ChannelService handles channel-related business logic
type ChannelService struct {
	channelRepo       *repository.ChannelRepository
	channelMemberRepo *repository.ChannelMemberRepository
}

// NewChannelService creates a new ChannelService
func NewChannelService(
	channelRepo *repository.ChannelRepository,
	channelMemberRepo *repository.ChannelMemberRepository,
) *ChannelService {
	return &ChannelService{
		channelRepo:       channelRepo,
		channelMemberRepo: channelMemberRepo,
	}
}

// CreateChannelRequest represents channel creation data
type CreateChannelRequest struct {
	Name        string `json:"name" binding:"required,min=2,max=50"`
	Description string `json:"description" binding:"max=200"`
	Icon        string `json:"icon"`
}

// GetUserChannels returns all channels a user has joined
func (s *ChannelService) GetUserChannels(ctx context.Context, userID primitive.ObjectID) ([]*models.Channel, error) {
	// Get user's channel memberships
	members, err := s.channelMemberRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user channels: %w", err)
	}

	if len(members) == 0 {
		return []*models.Channel{}, nil
	}

	// Extract channel IDs
	channelIDs := make([]primitive.ObjectID, 0, len(members))
	for _, member := range members {
		channelIDs = append(channelIDs, member.ChannelID)
	}

	// Get channel details
	channels, err := s.channelRepo.FindByIDs(ctx, channelIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get channels: %w", err)
	}

	return channels, nil
}

// GetAvailableChannels returns channels the user hasn't joined yet
func (s *ChannelService) GetAvailableChannels(ctx context.Context, userID primitive.ObjectID) ([]*models.Channel, error) {
	// Get all channels
	allChannels, err := s.channelRepo.FindAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get all channels: %w", err)
	}

	// Get user's joined channels
	members, err := s.channelMemberRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user memberships: %w", err)
	}

	// Create a map of joined channel IDs
	joinedChannelIDs := make(map[string]bool)
	for _, member := range members {
		joinedChannelIDs[member.ChannelID.Hex()] = true
	}

	// Filter out joined channels
	availableChannels := make([]*models.Channel, 0)
	for _, channel := range allChannels {
		if !joinedChannelIDs[channel.ID.Hex()] {
			availableChannels = append(availableChannels, channel)
		}
	}

	return availableChannels, nil
}

// CreateChannel creates a new channel
func (s *ChannelService) CreateChannel(ctx context.Context, req *CreateChannelRequest, createdBy primitive.ObjectID) (*models.Channel, error) {
	icon := req.Icon
	if icon == "" {
		icon = "ph-hash" // Default icon
	}

	channel := &models.Channel{
		Name:        req.Name,
		Description: req.Description,
		CreatedBy:   &createdBy,
		IsDefault:   false,
		Icon:        icon,
	}

	if err := s.channelRepo.Create(ctx, channel); err != nil {
		return nil, fmt.Errorf("failed to create channel: %w", err)
	}

	// Automatically add creator as member
	member := &models.ChannelMember{
		UserID:    createdBy,
		ChannelID: channel.ID,
	}

	if err := s.channelMemberRepo.Create(ctx, member); err != nil {
		// Log error but don't fail channel creation
		fmt.Printf("Warning: failed to add creator to channel: %v\n", err)
	}

	return channel, nil
}

// JoinChannel adds a user to a channel
func (s *ChannelService) JoinChannel(ctx context.Context, userID primitive.ObjectID, channelID string) error {
	channelObjID, err := primitive.ObjectIDFromHex(channelID)
	if err != nil {
		return fmt.Errorf("invalid channel ID: %w", err)
	}

	// Check if channel exists
	channel, err := s.channelRepo.FindByID(ctx, channelObjID)
	if err != nil {
		return fmt.Errorf("failed to find channel: %w", err)
	}
	if channel == nil {
		return fmt.Errorf("频道不存在")
	}

	// Check if user is already a member
	existing, err := s.channelMemberRepo.FindByUserAndChannel(ctx, userID, channelObjID)
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("您已经是该频道成员")
	}

	// Create membership
	member := &models.ChannelMember{
		UserID:    userID,
		ChannelID: channelObjID,
	}

	if err := s.channelMemberRepo.Create(ctx, member); err != nil {
		return fmt.Errorf("failed to join channel: %w", err)
	}

	return nil
}

// LeaveChannel removes a user from a channel
func (s *ChannelService) LeaveChannel(ctx context.Context, userID primitive.ObjectID, channelID string) error {
	channelObjID, err := primitive.ObjectIDFromHex(channelID)
	if err != nil {
		return fmt.Errorf("invalid channel ID: %w", err)
	}

	// Check if it's a default channel
	channel, err := s.channelRepo.FindByID(ctx, channelObjID)
	if err != nil {
		return fmt.Errorf("failed to find channel: %w", err)
	}
	if channel == nil {
		return fmt.Errorf("频道不存在")
	}
	if channel.IsDefault {
		return fmt.Errorf("不能离开默认频道")
	}

	// Remove membership
	if err := s.channelMemberRepo.Delete(ctx, userID, channelObjID); err != nil {
		return fmt.Errorf("failed to leave channel: %w", err)
	}

	return nil
}

// GetChannelByID returns a channel by ID
func (s *ChannelService) GetChannelByID(ctx context.Context, channelID string) (*models.Channel, error) {
	channelObjID, err := primitive.ObjectIDFromHex(channelID)
	if err != nil {
		return nil, fmt.Errorf("invalid channel ID: %w", err)
	}

	channel, err := s.channelRepo.FindByID(ctx, channelObjID)
	if err != nil {
		return nil, fmt.Errorf("failed to find channel: %w", err)
	}

	return channel, nil
}

// IsMember checks if a user is a member of a channel
func (s *ChannelService) IsMember(ctx context.Context, userID primitive.ObjectID, channelID string) (bool, error) {
	channelObjID, err := primitive.ObjectIDFromHex(channelID)
	if err != nil {
		return false, fmt.Errorf("invalid channel ID: %w", err)
	}

	member, err := s.channelMemberRepo.FindByUserAndChannel(ctx, userID, channelObjID)
	if err != nil {
		return false, fmt.Errorf("failed to check membership: %w", err)
	}

	return member != nil, nil
}
