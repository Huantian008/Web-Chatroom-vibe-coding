package websocket

// WSMessage represents a WebSocket message structure
type WSMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

// BroadcastMessage represents a message to broadcast to a channel
type BroadcastMessage struct {
	ChannelID string
	Message   *WSMessage
	Exclude   *Client // Optional: exclude this client from broadcast
}

// ============================================================
// Event Types (matching Node.js Socket.io events)
// ============================================================

const (
	// Server -> Client events
	EventInitialData       = "initial-data"
	EventChannelHistory    = "channel-history"
	EventNewMessage        = "new-message"
	EventUserList          = "user-list"
	EventUserJoinedChannel = "user-joined-channel"
	EventUserLeft          = "user-left"
	EventUserTyping        = "user-typing"
	EventUserStopTyping    = "user-stop-typing"
	EventMessageBlocked    = "message-blocked"
	EventError             = "error"

	// Client -> Server events (handled in client.go)
	EventSwitchChannel = "switch-channel"
	EventSendMessage   = "send-message"
	EventTyping        = "typing"
	EventStopTyping    = "stop-typing"
)

// ============================================================
// Data structures for events
// ============================================================

// InitialData sent when client connects
type InitialData struct {
	Channels          []ChannelData `json:"channels"`
	AvailableChannels []ChannelData `json:"availableChannels"`
	IsAdmin           bool          `json:"isAdmin"`
	Username          string        `json:"username"`
	UserID            string        `json:"userId"`
}

// ChannelData represents channel information
type ChannelData struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsDefault   bool   `json:"isDefault"`
	Icon        string `json:"icon"`
}

// MessageData represents a chat message
type MessageData struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	UserID      string `json:"userId,omitempty"`
	Message     string `json:"message"`
	Timestamp   string `json:"timestamp"`
	MessageType string `json:"messageType"`
	ChannelID   string `json:"channelId"`
}

// UserJoinedChannelData represents user joining a channel
type UserJoinedChannelData struct {
	Username  string `json:"username"`
	ChannelID string `json:"channelId"`
}

// TypingData represents typing indicator data
type TypingData struct {
	Username  string `json:"username"`
	ChannelID string `json:"channelId"`
}

// MessageBlockedData represents blocked message notification
type MessageBlockedData struct {
	Reason   string `json:"reason"`
	IsGlobal bool   `json:"isGlobal"`
}

// ErrorData represents error notification
type ErrorData struct {
	Message string `json:"message"`
}

// SwitchChannelData from client
type SwitchChannelData struct {
	ChannelID string `json:"channelId"`
}

// SendMessageData from client
type SendMessageData struct {
	Message   string `json:"message"`
	ChannelID string `json:"channelId"`
}

// TypingEventData from client
type TypingEventData struct {
	ChannelID string `json:"channelId"`
}
