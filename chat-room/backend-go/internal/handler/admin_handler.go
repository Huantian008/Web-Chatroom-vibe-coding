package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"chat-room-backend/internal/middleware"
	"chat-room-backend/internal/service"
	"chat-room-backend/internal/utils"
)

// AdminHandler handles admin HTTP requests
type AdminHandler struct {
	adminService *service.AdminService
	wordFilter   *middleware.WordFilterCache
}

// NewAdminHandler creates a new AdminHandler
func NewAdminHandler(adminService *service.AdminService, wordFilter *middleware.WordFilterCache) *AdminHandler {
	return &AdminHandler{
		adminService: adminService,
		wordFilter:   wordFilter,
	}
}

// ============================================================
// Word Filter Handlers
// ============================================================

// GetWordFilters returns all active word filters
// GET /api/admin/word-filters
func (h *AdminHandler) GetWordFilters(c *gin.Context) {
	filters, err := h.adminService.GetWordFilters(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get word filters"})
		return
	}

	// Convert to response format
	response := make([]interface{}, len(filters))
	for i, filter := range filters {
		response[i] = filter.ToResponse()
	}

	c.JSON(http.StatusOK, response)
}

// AddWordFilter adds a new word filter
// POST /api/admin/word-filters
func (h *AdminHandler) AddWordFilter(c *gin.Context) {
	var req service.AddWordFilterRequest
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

	filter, err := h.adminService.AddWordFilter(c.Request.Context(), req.Word, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add word filter"})
		return
	}

	// Reload word filter cache
	if err := h.wordFilter.Reload(); err != nil {
		// Log error but don't fail the request
		c.JSON(http.StatusCreated, gin.H{
			"message": "敏感词添加成功",
			"filter":  filter.ToResponse(),
			"warning": "Failed to reload cache",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "敏感词添加成功",
		"filter":  filter.ToResponse(),
	})
}

// RemoveWordFilter removes a word filter
// DELETE /api/admin/word-filters/:id
func (h *AdminHandler) RemoveWordFilter(c *gin.Context) {
	filterID := c.Param("id")

	if err := h.adminService.RemoveWordFilter(c.Request.Context(), filterID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove word filter"})
		return
	}

	// Reload word filter cache
	if err := h.wordFilter.Reload(); err != nil {
		// Log error but don't fail the request
		c.JSON(http.StatusOK, gin.H{
			"message": "敏感词删除成功",
			"warning": "Failed to reload cache",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "敏感词删除成功"})
}

// ============================================================
// User Management Handlers
// ============================================================

// GetAllUsers returns all users
// GET /api/admin/users
func (h *AdminHandler) GetAllUsers(c *gin.Context) {
	users, err := h.adminService.GetAllUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}

	// Convert to response format (exclude passwords)
	response := make([]gin.H, len(users))
	for i, user := range users {
		response[i] = gin.H{
			"id":          user.ID.Hex(),
			"username":    user.Username,
			"role":        user.Role,
			"isMuted":     user.IsMuted,
			"mutedUntil":  user.MutedUntil,
			"mutedReason": user.MutedReason,
			"createdAt":   user.CreatedAt,
			"lastLogin":   user.LastLogin,
		}
	}

	c.JSON(http.StatusOK, response)
}

// MuteUser mutes a user
// POST /api/admin/mute-user
func (h *AdminHandler) MuteUser(c *gin.Context) {
	var req service.MuteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr, _ := middleware.GetUserID(c)
	mutedBy, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.adminService.MuteUser(c.Request.Context(), &req, mutedBy); err != nil {
		if err.Error() == "不能禁言管理员" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "禁言成功"})
}

// UnmuteUser unmutes a user
// POST /api/admin/unmute-user
func (h *AdminHandler) UnmuteUser(c *gin.Context) {
	var req service.UnmuteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.adminService.UnmuteUser(c.Request.Context(), &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unmute user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "解除禁言成功"})
}

// ============================================================
// Global Mute Handlers
// ============================================================

// GetGlobalMuteStatus returns the global mute status
// GET /api/admin/global-mute
func (h *AdminHandler) GetGlobalMuteStatus(c *gin.Context) {
	status, err := h.adminService.GetGlobalMuteStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get global mute status"})
		return
	}

	c.JSON(http.StatusOK, status.ToResponse())
}

// ToggleGlobalMute toggles the global mute status
// POST /api/admin/global-mute
func (h *AdminHandler) ToggleGlobalMute(c *gin.Context) {
	var req service.ToggleGlobalMuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr, _ := middleware.GetUserID(c)
	enabledBy, err := utils.ParseUserID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.adminService.ToggleGlobalMute(c.Request.Context(), &req, enabledBy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle global mute"})
		return
	}

	message := "全局禁言已关闭"
	if req.Enabled {
		message = "全局禁言已启用"
	}

	c.JSON(http.StatusOK, gin.H{"message": message})
}
