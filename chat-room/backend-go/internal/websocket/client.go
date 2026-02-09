package websocket

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"chat-room-backend/internal/middleware"
	"chat-room-backend/internal/service"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 8192
)

// Client represents a WebSocket client connection
type Client struct {
	hub            *Hub
	conn           *websocket.Conn
	send           chan *WSMessage
	userID         primitive.ObjectID
	username       string
	isAdmin        bool
	currentChannel string

	// Services
	chatService    *service.ChatService
	channelService *service.ChannelService

	// Middleware
	wordFilter  *middleware.WordFilterCache
	muteChecker *middleware.MuteChecker
}

// NewClient creates a new Client instance
func NewClient(
	hub *Hub,
	conn *websocket.Conn,
	userID primitive.ObjectID,
	username string,
	isAdmin bool,
	chatService *service.ChatService,
	channelService *service.ChannelService,
	wordFilter *middleware.WordFilterCache,
	muteChecker *middleware.MuteChecker,
) *Client {
	return &Client{
		hub:            hub,
		conn:           conn,
		send:           make(chan *WSMessage, 256),
		userID:         userID,
		username:       username,
		isAdmin:        isAdmin,
		chatService:    chatService,
		channelService: channelService,
		wordFilter:     wordFilter,
		muteChecker:    muteChecker,
	}
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse message
		var wsMsg WSMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Printf("Failed to parse WebSocket message: %v", err)
			continue
		}

		// Handle message based on event type
		c.handleMessage(&wsMsg)
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Send message as JSON
			if err := c.conn.WriteJSON(message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage handles incoming WebSocket messages
func (c *Client) handleMessage(msg *WSMessage) {
	ctx := context.Background()

	switch msg.Event {
	case EventSwitchChannel:
		c.handleSwitchChannel(ctx, msg)

	case EventSendMessage:
		c.handleSendMessage(ctx, msg)

	case EventTyping:
		c.handleTyping(msg)

	case EventStopTyping:
		c.handleStopTyping(msg)

	default:
		log.Printf("Unknown event type: %s", msg.Event)
	}
}

// handleSwitchChannel handles channel switching
func (c *Client) handleSwitchChannel(ctx context.Context, msg *WSMessage) {
	// Parse data
	dataBytes, _ := json.Marshal(msg.Data)
	var data SwitchChannelData
	if err := json.Unmarshal(dataBytes, &data); err != nil {
		c.sendError("Invalid switch channel data")
		return
	}

	// Verify user is a member of the channel
	isMember, err := c.channelService.IsMember(ctx, c.userID, data.ChannelID)
	if err != nil {
		c.sendError("Failed to verify channel membership")
		return
	}
	if !isMember {
		c.sendError("您不是该频道成员")
		return
	}

	// Join channel room
	c.hub.JoinChannel(c, data.ChannelID)

	// Send channel history
	messages, err := c.chatService.GetChannelHistory(ctx, data.ChannelID, 100)
	if err != nil {
		c.sendError("Failed to load channel history")
		return
	}

	// Convert messages to response format
	messageData := make([]MessageData, len(messages))
	for i, m := range messages {
		userID := ""
		if m.UserID != nil {
			userID = m.UserID.Hex()
		}
		messageData[i] = MessageData{
			ID:          m.ID.Hex(),
			Username:    m.Username,
			UserID:      userID,
			Message:     m.Message,
			Timestamp:   m.Timestamp.Format(time.RFC3339),
			MessageType: m.MessageType,
			ChannelID:   m.ChannelID.Hex(),
		}
	}

	c.send <- &WSMessage{
		Event: EventChannelHistory,
		Data:  messageData,
	}

	log.Printf("📺 %s switched to channel %s", c.username, data.ChannelID)
}

// handleSendMessage handles message sending
func (c *Client) handleSendMessage(ctx context.Context, msg *WSMessage) {
	// Parse data
	dataBytes, _ := json.Marshal(msg.Data)
	var data SendMessageData
	if err := json.Unmarshal(dataBytes, &data); err != nil {
		c.sendError("Invalid message data")
		return
	}

	message := strings.TrimSpace(data.Message)
	if message == "" {
		c.sendError("消息不能为空")
		return
	}

	// Check for AI command
	if strings.HasPrefix(message, "/chat ") {
		c.handleAICommand(ctx, data.ChannelID, message)
		return
	}

	// Check mute status
	muteResult, err := c.muteChecker.CheckMuteStatus(ctx, c.userID, c.username)
	if err != nil {
		c.sendError("Failed to check mute status")
		return
	}
	if muteResult.IsMuted {
		c.send <- &WSMessage{
			Event: EventMessageBlocked,
			Data: MessageBlockedData{
				Reason:   muteResult.Reason,
				IsGlobal: muteResult.IsGlobal,
			},
		}
		return
	}

	// Check word filter
	if c.wordFilter.ContainsBlockedWord(message) {
		c.send <- &WSMessage{
			Event: EventMessageBlocked,
			Data: MessageBlockedData{
				Reason:   "消息包含禁用词汇",
				IsGlobal: false,
			},
		}
		return
	}

	// Save message
	savedMsg, err := c.chatService.SendMessage(ctx, c.userID, c.username, message, data.ChannelID)
	if err != nil {
		c.sendError("Failed to send message")
		return
	}

	// Broadcast to channel
	userID := ""
	if savedMsg.UserID != nil {
		userID = savedMsg.UserID.Hex()
	}

	c.hub.BroadcastToChannel(data.ChannelID, &WSMessage{
		Event: EventNewMessage,
		Data: MessageData{
			ID:          savedMsg.ID.Hex(),
			Username:    savedMsg.Username,
			UserID:      userID,
			Message:     savedMsg.Message,
			Timestamp:   savedMsg.Timestamp.Format(time.RFC3339),
			MessageType: savedMsg.MessageType,
			ChannelID:   savedMsg.ChannelID.Hex(),
		},
	}, nil)

	log.Printf("💬 [%s] %s: %s", data.ChannelID, c.username, message[:min(50, len(message))])
}

// handleAICommand handles AI chat command
func (c *Client) handleAICommand(ctx context.Context, channelID, message string) {
	// Extract AI message (remove "/chat " prefix)
	aiMessage := strings.TrimSpace(strings.TrimPrefix(message, "/chat "))
	if aiMessage == "" {
		c.sendError("请在 /chat 后输入消息")
		return
	}

	// Send typing indicator
	c.hub.BroadcastToChannel(channelID, &WSMessage{
		Event: EventUserTyping,
		Data: TypingData{
			Username:  "DeepSeek AI",
			ChannelID: channelID,
		},
	}, nil)

	// Call AI service
	aiResponse, err := c.chatService.CallAIService(ctx, aiMessage, channelID, c.username)
	if err != nil {
		// Stop typing indicator
		c.hub.BroadcastToChannel(channelID, &WSMessage{
			Event: EventUserStopTyping,
			Data: TypingData{
				Username:  "DeepSeek AI",
				ChannelID: channelID,
			},
		}, nil)

		c.sendError("AI服务暂时不可用")
		return
	}

	// Stop typing indicator
	c.hub.BroadcastToChannel(channelID, &WSMessage{
		Event: EventUserStopTyping,
		Data: TypingData{
			Username:  "DeepSeek AI",
			ChannelID: channelID,
		},
	}, nil)

	// Broadcast AI response
	c.hub.BroadcastToChannel(channelID, &WSMessage{
		Event: EventNewMessage,
		Data: MessageData{
			ID:          aiResponse.ID.Hex(),
			Username:    aiResponse.Username,
			Message:     aiResponse.Message,
			Timestamp:   aiResponse.Timestamp.Format(time.RFC3339),
			MessageType: aiResponse.MessageType,
			ChannelID:   aiResponse.ChannelID.Hex(),
		},
	}, nil)

	log.Printf("🤖 [%s] DeepSeek AI responded to %s", channelID, c.username)
}

// handleTyping handles typing indicator
func (c *Client) handleTyping(msg *WSMessage) {
	dataBytes, _ := json.Marshal(msg.Data)
	var data TypingEventData
	if err := json.Unmarshal(dataBytes, &data); err != nil {
		return
	}

	c.hub.BroadcastToChannel(data.ChannelID, &WSMessage{
		Event: EventUserTyping,
		Data: TypingData{
			Username:  c.username,
			ChannelID: data.ChannelID,
		},
	}, c) // Exclude self
}

// handleStopTyping handles stop typing indicator
func (c *Client) handleStopTyping(msg *WSMessage) {
	dataBytes, _ := json.Marshal(msg.Data)
	var data TypingEventData
	if err := json.Unmarshal(dataBytes, &data); err != nil {
		return
	}

	c.hub.BroadcastToChannel(data.ChannelID, &WSMessage{
		Event: EventUserStopTyping,
		Data: TypingData{
			Username:  c.username,
			ChannelID: data.ChannelID,
		},
	}, c) // Exclude self
}

// sendError sends an error message to the client
func (c *Client) sendError(message string) {
	c.send <- &WSMessage{
		Event: EventError,
		Data: ErrorData{
			Message: message,
		},
	}
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
