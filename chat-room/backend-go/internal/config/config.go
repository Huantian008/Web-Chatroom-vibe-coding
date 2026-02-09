package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Port         string
	GinMode      string
	MongoURI     string
	JWTSecret    string
	CORSOrigin   string
	AIServiceURL string
	LogLevel     string
}

// Load loads configuration from environment variables
func Load() *Config {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	return &Config{
		Port:         getEnv("PORT", "3000"),
		GinMode:      getEnv("GIN_MODE", "debug"),
		MongoURI:     getEnv("MONGODB_URI", "mongodb://localhost:27017/chat-room"),
		JWTSecret:    getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		CORSOrigin:   getEnv("CORS_ORIGIN", "*"),
		AIServiceURL: getEnv("AI_SERVICE_URL", "http://localhost:5000"),
		LogLevel:     getEnv("LOG_LEVEL", "info"),
	}
}

// getEnv gets environment variable with default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
