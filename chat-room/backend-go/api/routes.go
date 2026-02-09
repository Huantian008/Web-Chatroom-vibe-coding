package api

import (
	"github.com/gin-gonic/gin"
	"chat-room-backend/internal/handler"
	"chat-room-backend/internal/middleware"
	"chat-room-backend/internal/utils"
)

// SetupRoutes configures all application routes
func SetupRoutes(
	router *gin.Engine,
	authHandler *handler.AuthHandler,
	channelHandler *handler.ChannelHandler,
	adminHandler *handler.AdminHandler,
	wsHandler *handler.WebSocketHandler,
	jwtSecret string,
	adminHelper *utils.AdminHelper,
) {
	// ============================================================
	// Health Check
	// ============================================================
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":      "healthy",
			"timestamp":   gin.H{"iso": "2024-01-01T00:00:00Z"}, // Will be replaced with actual time
			"service":     "Chat Room Backend (Go)",
			"environment": gin.Mode(),
		})
	})

	// ============================================================
	// WebSocket Endpoint (requires authentication via token query param)
	// ============================================================
	// Store JWT secret in context for WebSocket handler
	router.Use(func(c *gin.Context) {
		c.Set("jwtSecret", jwtSecret)
		c.Next()
	})
	router.GET("/ws", wsHandler.HandleWebSocket)

	// ============================================================
	// API Routes
	// ============================================================
	api := router.Group("/api")

	// ============================================================
	// Authentication Routes (public)
	// ============================================================
	auth := api.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.GET("/verify", authHandler.Verify)
	}

	// ============================================================
	// Channel Routes (require authentication)
	// ============================================================
	channels := api.Group("/channels")
	channels.Use(middleware.AuthMiddleware(jwtSecret))
	{
		// User channel operations
		channels.GET("", channelHandler.GetUserChannels)
		channels.GET("/available", channelHandler.GetAvailableChannels)
		channels.POST("/:id/join", channelHandler.JoinChannel)
		channels.POST("/:id/leave", channelHandler.LeaveChannel)
		channels.GET("/:id/messages", channelHandler.GetChannelMessages)

		// Admin-only: create channel
		channels.POST("", middleware.AdminMiddleware(adminHelper), channelHandler.CreateChannel)
	}

	// ============================================================
	// Admin Routes (require authentication + admin role)
	// ============================================================
	admin := api.Group("/admin")
	admin.Use(middleware.AuthMiddleware(jwtSecret))
	admin.Use(middleware.AdminMiddleware(adminHelper))
	{
		// Word filter management
		admin.GET("/word-filters", adminHandler.GetWordFilters)
		admin.POST("/word-filters", adminHandler.AddWordFilter)
		admin.DELETE("/word-filters/:id", adminHandler.RemoveWordFilter)

		// User management
		admin.GET("/users", adminHandler.GetAllUsers)
		admin.POST("/mute-user", adminHandler.MuteUser)
		admin.POST("/unmute-user", adminHandler.UnmuteUser)

		// Global mute
		admin.POST("/global-mute", adminHandler.ToggleGlobalMute)
	}

	// Global mute status (requires auth but not admin)
	api.GET("/admin/global-mute", middleware.AuthMiddleware(jwtSecret), adminHandler.GetGlobalMuteStatus)
}
