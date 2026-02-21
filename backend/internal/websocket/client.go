package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// LeetCodeWSClient represents a WebSocket client for LeetCode
type LeetCodeWSClient struct {
	conn      *websocket.Conn
	url       string
	slug      string
	onMessage func([]byte)
	onError   func(error)
	mu        sync.RWMutex
	connected bool
}

// WSMessage represents a WebSocket message from LeetCode
type WSMessage struct {
	Type    string      `json:"type"`
	Data    interface{} `json:"data"`
	Count   int         `json:"count,omitempty"`
	Problem string      `json:"problem,omitempty"`
}

// NewLeetCodeWSClient creates a new WebSocket client
func NewLeetCodeWSClient(problemSlug string, onMessage func([]byte), onError func(error)) *LeetCodeWSClient {
	return &LeetCodeWSClient{
		url:       "wss://collaboration-ws.leetcode.cn/problems/" + problemSlug,
		slug:      problemSlug,
		onMessage: onMessage,
		onError:   onError,
	}
}

// Connect establishes the WebSocket connection and sends subscription message
func (c *LeetCodeWSClient) Connect() error {
	log.Printf("[WebSocket] Connecting to LeetCode for problem: %s", c.slug)

	headers := http.Header{
		"Origin":          {"https://leetcode.cn"},
		"User-Agent":      {"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
		"Accept-Language": {"en-US,en;q=0.9"},
	}

	conn, resp, err := websocket.DefaultDialer.Dial(c.url, headers)
	if err != nil {
		log.Printf("[WebSocket] Failed to connect to %s: %v", c.slug, err)
		if resp != nil {
			log.Printf("[WebSocket] Response status: %d", resp.StatusCode)
		}
		return err
	}

	c.mu.Lock()
	c.conn = conn
	c.connected = true
	c.mu.Unlock()

	log.Printf("[WebSocket] Connected successfully to %s", c.slug)

	// Send subscription message to start receiving data
	if err := c.sendSubscription(); err != nil {
		log.Printf("[WebSocket] Failed to send subscription for %s: %v", c.slug, err)
	}

	// Start reading messages
	go c.readMessages()

	return nil
}

// sendSubscription sends the initial subscription message
func (c *LeetCodeWSClient) sendSubscription() error {
	// LeetCode collaboration WebSocket expects a connection message
	// The protocol usually requires sending a subscribe or ping message
	subscriptionMsg := map[string]interface{}{
		"type": "subscribe",
		"data": map[string]interface{}{},
	}

	jsonData, err := json.Marshal(subscriptionMsg)
	if err != nil {
		return err
	}

	return c.conn.WriteMessage(websocket.TextMessage, jsonData)
}

// readMessages continuously reads messages from the WebSocket
func (c *LeetCodeWSClient) readMessages() {
	log.Printf("[WebSocket] Started reading messages for %s", c.slug)
	messageCount := 0

	for {
		c.mu.RLock()
		conn := c.conn
		c.mu.RUnlock()

		if conn == nil {
			log.Printf("[WebSocket] Connection nil for %s, exiting read loop", c.slug)
			return
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			c.mu.Lock()
			c.connected = false
			c.mu.Unlock()
			if c.onError != nil {
				c.onError(err)
			}
			log.Printf("[WebSocket] Error reading message for %s: %v (total messages received: %d)", c.slug, err, messageCount)
			return
		}

		messageCount++
		if messageCount <= 3 {
			log.Printf("[WebSocket] Received message #%d for %s: %s", messageCount, c.slug, string(message))
		}

		if c.onMessage != nil {
			c.onMessage(message)
		}
	}
}

// Send sends a message to the WebSocket
func (c *LeetCodeWSClient) Send(messageType string, data interface{}) error {
	c.mu.RLock()
	conn := c.conn
	connected := c.connected
	c.mu.RUnlock()

	if !connected || conn == nil {
		return nil
	}

	msg := WSMessage{
		Type: messageType,
		Data: data,
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return conn.WriteMessage(websocket.TextMessage, jsonData)
}

// Close closes the WebSocket connection
func (c *LeetCodeWSClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.connected = false
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// IsConnected returns the connection status
func (c *LeetCodeWSClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// Reconnect attempts to reconnect with exponential backoff
func (c *LeetCodeWSClient) Reconnect(maxRetries int) {
	for i := 0; i < maxRetries; i++ {
		waitTime := time.Duration(1<<uint(i)) * time.Second
		if waitTime > 30*time.Second {
			waitTime = 30 * time.Second
		}

		time.Sleep(waitTime)

		log.Printf("Reconnecting (attempt %d/%d)...", i+1, maxRetries)
		if err := c.Connect(); err == nil {
			log.Println("Reconnected successfully")
			return
		}
	}
	log.Println("Max reconnection attempts reached")
}

// generateWSURL returns the WebSocket URL for the problem
func (c *LeetCodeWSClient) generateWSURL() string {
	return "wss://collaboration-ws.leetcode.cn/problems/" + c.slug
}
