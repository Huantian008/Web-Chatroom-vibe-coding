package service

import (
	"context"
	"fmt"

	"chat-room-backend/internal/models"
	"chat-room-backend/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AdminService handles admin-related business logic
type AdminService struct {
	adminRepo *repository.AdminRepository
	userRepo  *repository.UserRepository
}

// NewAdminService creates a new AdminService
func NewAdminService(adminRepo *repository.AdminRepository, userRepo *repository.UserRepository) *AdminService {
	return &AdminService{
		adminRepo: adminRepo,
		userRepo:  userRepo,
	}
}

// ============================================================
// Word Filter Operations
// ============================================================

// AddWordFilterRequest represents word filter creation data
type AddWordFilterRequest struct {
	Word string `json:"word" binding:"required,min=1"`
}

// GetWordFilters returns all active word filters
func (s *AdminService) GetWordFilters(ctx context.Context) ([]*models.WordFilter, error) {
	filters, err := s.adminRepo.GetAllWordFilters(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get word filters: %w", err)
	}
	return filters, nil
}

// AddWordFilter adds a new word filter
func (s *AdminService) AddWordFilter(ctx context.Context, word string, addedBy primitive.ObjectID) (*models.WordFilter, error) {
	filter := &models.WordFilter{
		Word:    word,
		AddedBy: addedBy,
	}

	if err := s.adminRepo.CreateWordFilter(ctx, filter); err != nil {
		return nil, fmt.Errorf("failed to add word filter: %w", err)
	}

	return filter, nil
}

// RemoveWordFilter removes (deactivates) a word filter
func (s *AdminService) RemoveWordFilter(ctx context.Context, filterID string) error {
	filterObjID, err := primitive.ObjectIDFromHex(filterID)
	if err != nil {
		return fmt.Errorf("invalid filter ID: %w", err)
	}

	if err := s.adminRepo.DeactivateWordFilter(ctx, filterObjID); err != nil {
		return fmt.Errorf("failed to remove word filter: %w", err)
	}

	return nil
}

// ============================================================
// User Management Operations
// ============================================================

// GetAllUsers returns all users (for admin view)
func (s *AdminService) GetAllUsers(ctx context.Context) ([]*models.User, error) {
	users, err := s.userRepo.FindAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}
	return users, nil
}

// MuteUserRequest represents user mute data
type MuteUserRequest struct {
	UserID   string `json:"userId" binding:"required"`
	Duration int    `json:"duration"` // Duration in minutes, 0 for permanent
	Reason   string `json:"reason"`
}

// MuteUser mutes a user
func (s *AdminService) MuteUser(ctx context.Context, req *MuteUserRequest, mutedBy primitive.ObjectID) error {
	userObjID, err := primitive.ObjectIDFromHex(req.UserID)
	if err != nil {
		return fmt.Errorf("invalid user ID: %w", err)
	}

	// Check if user exists
	user, err := s.userRepo.FindByID(ctx, userObjID)
	if err != nil {
		return fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil {
		return fmt.Errorf("用户不存在")
	}

	// Don't allow muting admins (this should also be checked via adminHelper in middleware)
	if user.Role == "admin" {
		return fmt.Errorf("不能禁言管理员")
	}

	reason := req.Reason
	if reason == "" {
		reason = "违反聊天规则"
	}

	if err := s.userRepo.Mute(ctx, userObjID, mutedBy, req.Duration, reason); err != nil {
		return fmt.Errorf("failed to mute user: %w", err)
	}

	return nil
}

// UnmuteUserRequest represents user unmute data
type UnmuteUserRequest struct {
	UserID string `json:"userId" binding:"required"`
}

// UnmuteUser unmutes a user
func (s *AdminService) UnmuteUser(ctx context.Context, req *UnmuteUserRequest) error {
	userObjID, err := primitive.ObjectIDFromHex(req.UserID)
	if err != nil {
		return fmt.Errorf("invalid user ID: %w", err)
	}

	if err := s.userRepo.Unmute(ctx, userObjID); err != nil {
		return fmt.Errorf("failed to unmute user: %w", err)
	}

	return nil
}

// ============================================================
// Global Mute Operations
// ============================================================

// ToggleGlobalMuteRequest represents global mute toggle data
type ToggleGlobalMuteRequest struct {
	Enabled bool   `json:"enabled"`
	Reason  string `json:"reason"`
}

// GetGlobalMuteStatus returns the current global mute status
func (s *AdminService) GetGlobalMuteStatus(ctx context.Context) (*models.GlobalMuteStatus, error) {
	status, err := s.adminRepo.GetGlobalMuteStatus(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get global mute status: %w", err)
	}
	return status, nil
}

// ToggleGlobalMute toggles the global mute status
func (s *AdminService) ToggleGlobalMute(ctx context.Context, req *ToggleGlobalMuteRequest, enabledBy primitive.ObjectID) error {
	reason := req.Reason
	if reason == "" && req.Enabled {
		reason = "管理员启用全局禁言"
	}

	var enabledByPtr *primitive.ObjectID
	if req.Enabled {
		enabledByPtr = &enabledBy
	}

	if err := s.adminRepo.UpdateGlobalMuteStatus(ctx, req.Enabled, enabledByPtr, reason); err != nil {
		return fmt.Errorf("failed to update global mute status: %w", err)
	}

	return nil
}
