package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"chat-room-backend/internal/middleware"
	"chat-room-backend/internal/service"
	"chat-room-backend/internal/utils"
)

// ChannelHandler handles channel HTTP requests
type ChannelHandler struct {
	channelService *service.ChannelService
	chatService    *service.ChatService
}

// NewChannelHandler creates a new ChannelHandler
func NewChannelHandler(channelService *service.ChannelService, chatService *service.ChatService) *ChannelHandler {
	return &ChannelHandler{
		channelService: channelService,
		chatService:    chatService,
	}
}

// GetUserChannels returns channels the user has joined
// GET /api/channels
func (h *ChannelHandler) GetUserChannels(c *gin.Context) {
	// Get user ID from context (set by AuthMiddleware)
	userIDStr, _ := middleware.GetUserID(c)
	userID, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	channels, err := h.channelService.GetUserChannels(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get channels"})
		return
	}

	// Convert to response format
	response := make([]interface{}, len(channels))
	for i, ch := range channels {
		response[i] = ch.ToResponse()
	}

	c.JSON(http.StatusOK, response)
}

// GetAvailableChannels returns channels the user can join
// GET /api/channels/available
func (h *ChannelHandler) GetAvailableChannels(c *gin.Context) {
	userIDStr, _ := middleware.GetUserID(c)
	userID, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	channels, err := h.channelService.GetAvailableChannels(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get available channels"})
		return
	}

	// Convert to response format
	response := make([]interface{}, len(channels))
	for i, ch := range channels {
		response[i] = ch.ToResponse()
	}

	c.JSON(http.StatusOK, response)
}

// CreateChannel creates a new channel (admin only)
// POST /api/channels
func (h *ChannelHandler) CreateChannel(c *gin.Context) {
	var req service.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr, _ := middleware.GetUserID(c)
	userID, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	channel, err := h.channelService.CreateChannel(c.Request.Context(), &req, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "频道创建成功",
		"channel": channel.ToResponse(),
	})
}

// JoinChannel allows a user to join a channel
// POST /api/channels/:id/join
func (h *ChannelHandler) JoinChannel(c *gin.Context) {
	channelID := c.Param("id")

	userIDStr, _ := middleware.GetUserID(c)
	userID, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.channelService.JoinChannel(c.Request.Context(), userID, channelID); err != nil {
		if err.Error() == "频道不存在" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err.Error() == "您已经是该频道成员" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "加入频道成功"})
}

// LeaveChannel allows a user to leave a channel
// POST /api/channels/:id/leave
func (h *ChannelHandler) LeaveChannel(c *gin.Context) {
	channelID := c.Param("id")

	userIDStr, _ := middleware.GetUserID(c)
	userID, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.channelService.LeaveChannel(c.Request.Context(), userID, channelID); err != nil {
		if err.Error() == "不能离开默认频道" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "离开频道成功"})
}

// GetChannelMessages returns message history for a channel
// GET /api/channels/:id/messages
func (h *ChannelHandler) GetChannelMessages(c *gin.Context) {
	channelID := c.Param("id")

	userIDStr, _ := middleware.GetUserID(c)
	userID, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Verify user is a member of the channel
	isMember, err := h.channelService.IsMember(c.Request.Context(), userID, channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify membership"})
		return
	}
	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "您不是该频道成员"})
		return
	}

	// Get limit from query parameter
	limit := 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	// Get messages
	messages, err := h.chatService.GetChannelHistory(c.Request.Context(), channelID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}

	// Convert to response format
	response := make([]interface{}, len(messages))
	for i, msg := range messages {
		response[i] = msg.ToResponse()
	}

	c.JSON(http.StatusOK, response)
}
