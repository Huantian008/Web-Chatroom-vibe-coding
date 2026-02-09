package handler

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"chat-room-backend/internal/middleware"
	"chat-room-backend/internal/service"
	"chat-room-backend/internal/utils"
	ws "chat-room-backend/internal/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins (should be restricted in production)
		return true
	},
}

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	hub            *ws.Hub
	authService    *service.AuthService
	chatService    *service.ChatService
	channelService *service.ChannelService
	adminHelper    *utils.AdminHelper
	wordFilter     *middleware.WordFilterCache
	muteChecker    *middleware.MuteChecker
}

// NewWebSocketHandler creates a new WebSocketHandler
func NewWebSocketHandler(
	hub *ws.Hub,
	authService *service.AuthService,
	chatService *service.ChatService,
	channelService *service.ChannelService,
	adminHelper *utils.AdminHelper,
	wordFilter *middleware.WordFilterCache,
	muteChecker *middleware.MuteChecker,
) *WebSocketHandler {
	return &WebSocketHandler{
		hub:            hub,
		authService:    authService,
		chatService:    chatService,
		channelService: channelService,
		adminHelper:    adminHelper,
		wordFilter:     wordFilter,
		muteChecker:    muteChecker,
	}
}

// HandleWebSocket handles WebSocket connection upgrade
// This endpoint requires JWT token in query parameter or header
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// Get token from query parameter (for WebSocket handshake)
	token := c.Query("token")
	if token == "" {
		// Fallback to Authorization header
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		}
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
		return
	}

	// Validate token
	claims, err := utils.ValidateToken(token, c.GetString("jwtSecret"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的认证令牌"})
		return
	}

	// Parse user ID
	userID, err := utils.ParseUserID(claims.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的用户ID"})
		return
	}

	// Check if user is admin
	isAdmin := h.adminHelper.IsAdmin(claims.Username)

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}

	// Create client
	client := ws.NewClient(
		h.hub,
		conn,
		userID,
		claims.Username,
		isAdmin,
		h.chatService,
		h.channelService,
		h.wordFilter,
		h.muteChecker,
	)

	// Register client to hub
	h.hub.register <- client

	// Send initial data to client
	go h.sendInitialData(client)

	// Start client pumps
	go client.WritePump()
	go client.ReadPump()

	// Broadcast updated user list
	go h.broadcastUserList()

	log.Printf("✅ WebSocket connection established: %s", claims.Username)
}

// sendInitialData sends initial data to a newly connected client
func (h *WebSocketHandler) sendInitialData(client *ws.Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get user's channels
	channels, err := h.channelService.GetUserChannels(ctx, client.UserID())
	if err != nil {
		log.Printf("Failed to get user channels: %v", err)
		client.SendError("Failed to load channels")
		return
	}

	// Get available channels
	availableChannels, err := h.channelService.GetAvailableChannels(ctx, client.UserID())
	if err != nil {
		log.Printf("Failed to get available channels: %v", err)
		availableChannels = nil
	}

	// Convert channels to response format
	channelData := make([]ws.ChannelData, len(channels))
	for i, ch := range channels {
		channelData[i] = ws.ChannelData{
			ID:          ch.ID.Hex(),
			Name:        ch.Name,
			Description: ch.Description,
			IsDefault:   ch.IsDefault,
			Icon:        ch.Icon,
		}

		// Join channel room
		h.hub.JoinChannel(client, ch.ID.Hex())

		// Notify others in the channel
		h.hub.BroadcastToChannel(ch.ID.Hex(), &ws.WSMessage{
			Event: ws.EventUserJoinedChannel,
			Data: ws.UserJoinedChannelData{
				Username:  client.Username(),
				ChannelID: ch.ID.Hex(),
			},
		}, client) // Exclude self
	}

	// Convert available channels
	availableData := make([]ws.ChannelData, len(availableChannels))
	for i, ch := range availableChannels {
		availableData[i] = ws.ChannelData{
			ID:          ch.ID.Hex(),
			Name:        ch.Name,
			Description: ch.Description,
			IsDefault:   ch.IsDefault,
			Icon:        ch.Icon,
		}
	}

	// Send initial data
	initialData := ws.InitialData{
		Channels:          channelData,
		AvailableChannels: availableData,
		IsAdmin:           client.IsAdmin(),
		Username:          client.Username(),
		UserID:            client.UserID().Hex(),
	}

	client.Send(&ws.WSMessage{
		Event: ws.EventInitialData,
		Data:  initialData,
	})

	log.Printf("📨 Sent initial data to %s (%d channels)", client.Username(), len(channelData))
}

// broadcastUserList broadcasts the updated user list to all clients
func (h *WebSocketHandler) broadcastUserList() {
	users := h.hub.GetOnlineUsers()
	h.hub.BroadcastToAll(&ws.WSMessage{
		Event: ws.EventUserList,
		Data:  users,
	})
}
