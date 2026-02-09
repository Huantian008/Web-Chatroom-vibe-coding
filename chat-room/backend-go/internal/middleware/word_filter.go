package middleware

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"chat-room-backend/internal/repository"
)

// WordFilterCache maintains an in-memory cache of blocked words
type WordFilterCache struct {
	words map[string]bool
	mu    sync.RWMutex
	repo  *repository.AdminRepository
}

// NewWordFilterCache creates a new WordFilterCache
func NewWordFilterCache(repo *repository.AdminRepository) *WordFilterCache {
	cache := &WordFilterCache{
		words: make(map[string]bool),
		repo:  repo,
	}

	// Load initial cache
	if err := cache.Reload(); err != nil {
		log.Printf("⚠️  Warning: Failed to load word filter cache: %v", err)
	}

	return cache
}

// Reload reloads the word filter cache from database
func (wfc *WordFilterCache) Reload() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filters, err := wfc.repo.GetActiveWordFilters(ctx)
	if err != nil {
		return err
	}

	wfc.mu.Lock()
	defer wfc.mu.Unlock()

	// Clear and rebuild cache
	wfc.words = make(map[string]bool)
	for _, filter := range filters {
		wfc.words[strings.ToLower(filter.Word)] = true
	}

	log.Printf("✅ Loaded %d active word filter(s)", len(wfc.words))
	return nil
}

// ContainsBlockedWord checks if a message contains any blocked words
func (wfc *WordFilterCache) ContainsBlockedWord(message string) bool {
	wfc.mu.RLock()
	defer wfc.mu.RUnlock()

	lowerMsg := strings.ToLower(message)
	for word := range wfc.words {
		if strings.Contains(lowerMsg, word) {
			return true
		}
	}
	return false
}

// GetBlockedWords returns the list of blocked words (for debugging)
func (wfc *WordFilterCache) GetBlockedWords() []string {
	wfc.mu.RLock()
	defer wfc.mu.RUnlock()

	words := make([]string, 0, len(wfc.words))
	for word := range wfc.words {
		words = append(words, word)
	}
	return words
}
