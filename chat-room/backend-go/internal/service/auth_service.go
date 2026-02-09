package service

import (
	"context"
	"fmt"
	"time"

	"chat-room-backend/internal/models"
	"chat-room-backend/internal/repository"
	"chat-room-backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AuthService handles authentication business logic
type AuthService struct {
	userRepo       *repository.UserRepository
	channelRepo    *repository.ChannelRepository
	channelMemberRepo *repository.ChannelMemberRepository
	jwtSecret      string
}

// NewAuthService creates a new AuthService
func NewAuthService(
	userRepo *repository.UserRepository,
	channelRepo *repository.ChannelRepository,
	channelMemberRepo *repository.ChannelMemberRepository,
	jwtSecret string,
) *AuthService {
	return &AuthService{
		userRepo:       userRepo,
		channelRepo:    channelRepo,
		channelMemberRepo: channelMemberRepo,
		jwtSecret:      jwtSecret,
	}
}

// RegisterRequest represents registration data
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=2,max=20"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginRequest represents login data
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	Message string               `json:"message"`
	Token   string               `json:"token"`
	User    *models.UserResponse `json:"user"`
}

// Register registers a new user
func (s *AuthService) Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error) {
	// Check if username already exists
	existingUser, err := s.userRepo.FindByUsername(ctx, req.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to check username: %w", err)
	}
	if existingUser != nil {
		return nil, fmt.Errorf("用户名已存在")
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Username: req.Username,
		Password: hashedPassword,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Add user to default channel
	defaultChannel, err := s.channelRepo.FindDefault(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to find default channel: %w", err)
	}

	if defaultChannel != nil {
		member := &models.ChannelMember{
			UserID:    user.ID,
			ChannelID: defaultChannel.ID,
		}
		if err := s.channelMemberRepo.Create(ctx, member); err != nil {
			// Log error but don't fail registration
			fmt.Printf("Warning: failed to add user to default channel: %v\n", err)
		}
	}

	// Generate JWT token
	token, err := utils.GenerateToken(user.ID, user.Username, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Message: "注册成功",
		Token:   token,
		User:    user.ToResponse(),
	}, nil
}

// Login authenticates a user
func (s *AuthService) Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error) {
	// Find user
	user, err := s.userRepo.FindByUsername(ctx, req.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("用户名或密码错误")
	}

	// Verify password
	if !utils.ComparePassword(user.Password, req.Password) {
		return nil, fmt.Errorf("用户名或密码错误")
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(ctx, user.ID); err != nil {
		// Log error but don't fail login
		fmt.Printf("Warning: failed to update last login: %v\n", err)
	}

	// Generate JWT token
	token, err := utils.GenerateToken(user.ID, user.Username, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Message: "登录成功",
		Token:   token,
		User:    user.ToResponse(),
	}, nil
}

// VerifyToken verifies a JWT token and returns user info
func (s *AuthService) VerifyToken(ctx context.Context, tokenString string) (*models.UserResponse, error) {
	// Validate token
	claims, err := utils.ValidateToken(tokenString, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	// Parse user ID
	userID, err := utils.ParseUserID(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	// Find user
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	return user.ToResponse(), nil
}
