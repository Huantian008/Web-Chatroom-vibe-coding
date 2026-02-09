package utils

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// AdminConfig represents the structure of admins.json
type AdminConfig struct {
	Admins []string `json:"admins"`
}

// AdminHelper manages admin user list with hot-reload support
type AdminHelper struct {
	admins  map[string]bool
	mu      sync.RWMutex
	watcher *fsnotify.Watcher
	path    string
}

// NewAdminHelper creates a new AdminHelper instance
func NewAdminHelper(configPath string) (*AdminHelper, error) {
	ah := &AdminHelper{
		admins: make(map[string]bool),
		path:   configPath,
	}

	// Load initial admin list
	if err := ah.loadAdmins(); err != nil {
		return nil, err
	}

	// Start watching the config file
	if err := ah.watchAdminFile(); err != nil {
		log.Printf("⚠️  Warning: Failed to watch admin config file: %v", err)
	}

	return ah, nil
}

// loadAdmins loads the admin list from the config file
func (ah *AdminHelper) loadAdmins() error {
	// Get absolute path
	absPath, err := filepath.Abs(ah.path)
	if err != nil {
		return err
	}

	// Read file
	data, err := os.ReadFile(absPath)
	if err != nil {
		log.Printf("❌ Error reading admin config: %v", err)
		return err
	}

	// Parse JSON
	var config AdminConfig
	if err := json.Unmarshal(data, &config); err != nil {
		log.Printf("❌ Error parsing admin config: %v", err)
		return err
	}

	// Update admin map
	ah.mu.Lock()
	defer ah.mu.Unlock()

	ah.admins = make(map[string]bool)
	for _, admin := range config.Admins {
		ah.admins[admin] = true
	}

	log.Printf("✅ Loaded %d admin(s): %v", len(config.Admins), config.Admins)
	return nil
}

// IsAdmin checks if a username is an admin
func (ah *AdminHelper) IsAdmin(username string) bool {
	ah.mu.RLock()
	defer ah.mu.RUnlock()
	return ah.admins[username]
}

// GetAdminList returns the list of admin usernames
func (ah *AdminHelper) GetAdminList() []string {
	ah.mu.RLock()
	defer ah.mu.RUnlock()

	admins := make([]string, 0, len(ah.admins))
	for admin := range ah.admins {
		admins = append(admins, admin)
	}
	return admins
}

// watchAdminFile watches the admin config file for changes
func (ah *AdminHelper) watchAdminFile() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	ah.watcher = watcher

	// Get absolute path
	absPath, err := filepath.Abs(ah.path)
	if err != nil {
		return err
	}

	// Watch the file
	if err := watcher.Add(absPath); err != nil {
		return err
	}

	// Start watching in a goroutine
	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Op&fsnotify.Write == fsnotify.Write {
					log.Println("🔄 Admin config changed, reloading...")
					if err := ah.loadAdmins(); err != nil {
						log.Printf("❌ Failed to reload admin config: %v", err)
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("❌ Admin file watcher error: %v", err)
			}
		}
	}()

	return nil
}

// Close closes the file watcher
func (ah *AdminHelper) Close() error {
	if ah.watcher != nil {
		return ah.watcher.Close()
	}
	return nil
}
