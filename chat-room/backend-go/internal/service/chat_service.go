package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chat-room-backend/internal/models"
	"chat-room-backend/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ChatService handles chat-related business logic
type ChatService struct {
	messageRepo   *repository.MessageRepository
	aiServiceURL  string
}

// NewChatService creates a new ChatService
func NewChatService(messageRepo *repository.MessageRepository, aiServiceURL string) *ChatService {
	return &ChatService{
		messageRepo:  messageRepo,
		aiServiceURL: aiServiceURL,
	}
}

// SendMessageRequest represents message sending data
type SendMessageRequest struct {
	Message   string `json:"message" binding:"required"`
	ChannelID string `json:"channelId" binding:"required"`
}

// SendMessage saves a message to the database
func (s *ChatService) SendMessage(ctx context.Context, userID primitive.ObjectID, username, message, channelID string) (*models.Message, error) {
	channelObjID, err := primitive.ObjectIDFromHex(channelID)
	if err != nil {
		return nil, fmt.Errorf("invalid channel ID: %w", err)
	}

	msg := &models.Message{
		Username:    username,
		UserID:      &userID,
		Message:     strings.TrimSpace(message),
		ChannelID:   channelObjID,
		MessageType: "user",
	}

	if err := s.messageRepo.Create(ctx, msg); err != nil {
		return nil, fmt.Errorf("failed to save message: %w", err)
	}

	return msg, nil
}

// GetChannelHistory retrieves message history for a channel
func (s *ChatService) GetChannelHistory(ctx context.Context, channelID string, limit int) ([]*models.Message, error) {
	channelObjID, err := primitive.ObjectIDFromHex(channelID)
	if err != nil {
		return nil, fmt.Errorf("invalid channel ID: %w", err)
	}

	if limit <= 0 {
		limit = 100
	}

	messages, err := s.messageRepo.FindByChannelID(ctx, channelObjID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get message history: %w", err)
	}

	return messages, nil
}

// AIRequest represents request to AI service
type AIRequest struct {
	Message   string `json:"message"`
	ChannelID string `json:"channelId"`
	Username  string `json:"username"`
}

// AIResponse represents response from AI service
type AIResponse struct {
	Response string `json:"response"`
}

// CallAIService calls the AI service and saves the response
func (s *ChatService) CallAIService(ctx context.Context, userMessage, channelID, username string) (*models.Message, error) {
	// Prepare request
	aiReq := AIRequest{
		Message:   userMessage,
		ChannelID: channelID,
		Username:  username,
	}

	reqBody, err := json.Marshal(aiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal AI request: %w", err)
	}

	// Create HTTP request with timeout
	httpCtx, cancel := context.WithTimeout(ctx, 35*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(httpCtx, "POST", s.aiServiceURL+"/chat", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create AI request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("AI服务暂时不可用: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}

	// Parse response
	var aiResp AIResponse
	if err := json.NewDecoder(resp.Body).Decode(&aiResp); err != nil {
		return nil, fmt.Errorf("failed to decode AI response: %w", err)
	}

	// Save AI response as message
	channelObjID, err := primitive.ObjectIDFromHex(channelID)
	if err != nil {
		return nil, fmt.Errorf("invalid channel ID: %w", err)
	}

	aiMessage := &models.Message{
		Username:    "DeepSeek AI",
		UserID:      nil, // AI has no user ID
		Message:     aiResp.Response,
		ChannelID:   channelObjID,
		MessageType: "ai",
	}

	if err := s.messageRepo.Create(ctx, aiMessage); err != nil {
		return nil, fmt.Errorf("failed to save AI message: %w", err)
	}

	return aiMessage, nil
}
