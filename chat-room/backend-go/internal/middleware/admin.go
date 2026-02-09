package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"chat-room-backend/internal/utils"
)

// AdminMiddleware checks if the user is an admin
func AdminMiddleware(adminHelper *utils.AdminHelper) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get username from context (set by AuthMiddleware)
		username, exists := GetUsername(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			c.Abort()
			return
		}

		// Check if user is admin
		if !adminHelper.IsAdmin(username) {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
			c.Abort()
			return
		}

		c.Next()
	}
}
