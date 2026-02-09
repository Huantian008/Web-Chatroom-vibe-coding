package websocket

import (
	"log"
	"sync"
)

// Hub maintains active WebSocket connections and broadcasts messages
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Channels (rooms) - maps channel ID to set of clients
	channels map[string]map[*Client]bool

	// Broadcast messages to a specific channel
	broadcast chan *BroadcastMessage

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mu sync.RWMutex
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		channels:   make(map[string]map[*Client]bool),
		broadcast:  make(chan *BroadcastMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastToChannel(message)
		}
	}
}

// registerClient registers a new client
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[client] = true
	log.Printf("✅ Client registered: %s (total: %d)", client.username, len(h.clients))
}

// unregisterClient removes a client
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; ok {
		// Remove from all channels
		for channelID, clients := range h.channels {
			delete(clients, client)
			if len(clients) == 0 {
				delete(h.channels, channelID)
			}
		}

		// Remove from clients map
		delete(h.clients, client)
		close(client.send)

		log.Printf("👋 Client unregistered: %s (total: %d)", client.username, len(h.clients))
	}
}

// JoinChannel adds a client to a channel
func (h *Hub) JoinChannel(client *Client, channelID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.channels[channelID] == nil {
		h.channels[channelID] = make(map[*Client]bool)
	}

	h.channels[channelID][client] = true
	client.currentChannel = channelID

	log.Printf("📺 %s joined channel %s", client.username, channelID)
}

// LeaveChannel removes a client from a channel
func (h *Hub) LeaveChannel(client *Client, channelID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, ok := h.channels[channelID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.channels, channelID)
		}
	}

	log.Printf("📺 %s left channel %s", client.username, channelID)
}

// broadcastToChannel sends a message to all clients in a channel
func (h *Hub) broadcastToChannel(msg *BroadcastMessage) {
	h.mu.RLock()
	clients := h.channels[msg.ChannelID]
	h.mu.RUnlock()

	if clients == nil {
		return
	}

	for client := range clients {
		// Skip excluded client if specified
		if msg.Exclude != nil && client == msg.Exclude {
			continue
		}

		select {
		case client.send <- msg.Message:
		default:
			// Client's send buffer is full, close connection
			h.unregister <- client
		}
	}
}

// BroadcastToChannel sends a message to a specific channel
func (h *Hub) BroadcastToChannel(channelID string, message *WSMessage, exclude *Client) {
	h.broadcast <- &BroadcastMessage{
		ChannelID: channelID,
		Message:   message,
		Exclude:   exclude,
	}
}

// BroadcastToAll sends a message to all connected clients
func (h *Hub) BroadcastToAll(message *WSMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.send <- message:
		default:
			// Client's send buffer is full, close connection
			h.unregister <- client
		}
	}
}

// GetOnlineUsers returns a list of all online usernames
func (h *Hub) GetOnlineUsers() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]string, 0, len(h.clients))
	for client := range h.clients {
		users = append(users, client.username)
	}

	return users
}

// GetChannelClients returns clients in a specific channel
func (h *Hub) GetChannelClients(channelID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients := h.channels[channelID]
	if clients == nil {
		return []*Client{}
	}

	result := make([]*Client, 0, len(clients))
	for client := range clients {
		result = append(result, client)
	}

	return result
}
