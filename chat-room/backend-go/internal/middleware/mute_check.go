package middleware

import (
	"context"
	"time"

	"chat-room-backend/internal/models"
	"chat-room-backend/internal/repository"
	"chat-room-backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// MuteCheckResult represents the result of a mute check
type MuteCheckResult struct {
	IsMuted  bool
	Reason   string
	IsGlobal bool
}

// MuteChecker handles mute status checking
type MuteChecker struct {
	userRepo  *repository.UserRepository
	adminRepo *repository.AdminRepository
	adminHelper *utils.AdminHelper
}

// NewMuteChecker creates a new MuteChecker
func NewMuteChecker(userRepo *repository.UserRepository, adminRepo *repository.AdminRepository, adminHelper *utils.AdminHelper) *MuteChecker {
	return &MuteChecker{
		userRepo:  userRepo,
		adminRepo: adminRepo,
		adminHelper: adminHelper,
	}
}

// CheckMuteStatus checks if a user is muted (global or individual)
func (mc *MuteChecker) CheckMuteStatus(ctx context.Context, userID primitive.ObjectID, username string) (*MuteCheckResult, error) {
	// Admins are never muted
	if mc.adminHelper.IsAdmin(username) {
		return &MuteCheckResult{IsMuted: false}, nil
	}

	// Check global mute
	globalMute, err := mc.adminRepo.GetGlobalMuteStatus(ctx)
	if err != nil {
		return nil, err
	}

	if globalMute.IsEnabled {
		return &MuteCheckResult{
			IsMuted:  true,
			Reason:   globalMute.Reason,
			IsGlobal: true,
		}, nil
	}

	// Check individual mute
	user, err := mc.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return &MuteCheckResult{IsMuted: false}, nil
	}

	if !user.IsMuted {
		return &MuteCheckResult{IsMuted: false}, nil
	}

	// Check if mute has expired
	if user.MutedUntil != nil && user.MutedUntil.Before(time.Now()) {
		// Mute expired, unmute the user
		if err := mc.userRepo.Unmute(ctx, userID); err != nil {
			return nil, err
		}
		return &MuteCheckResult{IsMuted: false}, nil
	}

	// User is muted
	reason := user.MutedReason
	if reason == "" {
		reason = "您已被禁言"
	}

	return &MuteCheckResult{
		IsMuted:  true,
		Reason:   reason,
		IsGlobal: false,
	}, nil
}

// IsMuted is a convenience method that returns only the muted status
func (mc *MuteChecker) IsMuted(ctx context.Context, user *models.User, username string) bool {
	result, err := mc.CheckMuteStatus(ctx, user.ID, username)
	if err != nil {
		return false
	}
	return result.IsMuted
}
