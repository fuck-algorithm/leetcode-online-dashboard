package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// SiteType represents the LeetCode site (cn or com)
type SiteType string

const (
	SiteCN  SiteType = "cn"
	SiteCOM SiteType = "com"
)

// LeetCodeWSClient represents a WebSocket client for LeetCode
type LeetCodeWSClient struct {
	conn      *websocket.Conn
	url       string
	slug      string
	site      SiteType
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

// NewLeetCodeWSClient creates a new WebSocket client for a specific site (cn or com)
func NewLeetCodeWSClient(problemSlug string, site SiteType, onMessage func([]byte), onError func(error)) *LeetCodeWSClient {
	var wsURL string
	if site == SiteCOM {
		wsURL = "wss://collaboration-ws.leetcode.com/problems/" + problemSlug
	} else {
		wsURL = "wss://collaboration-ws.leetcode.cn/problems/" + problemSlug
	}

	return &LeetCodeWSClient{
		url:       wsURL,
		slug:      problemSlug,
		site:      site,
		onMessage: onMessage,
		onError:   onError,
	}
}

// GetSite returns the site type of this client
func (c *LeetCodeWSClient) GetSite() SiteType {
	return c.site
}

// Connect establishes the WebSocket connection and sends subscription message
func (c *LeetCodeWSClient) Connect() error {
	log.Printf("[WebSocket] Connecting to LeetCode [%s] for problem: %s", c.site, c.slug)

	var origin string
	var referer string
	if c.site == SiteCOM {
		origin = "https://leetcode.com"
		referer = "https://leetcode.com/problems/" + c.slug + "/"
	} else {
		origin = "https://leetcode.cn"
		referer = "https://leetcode.cn/problems/" + c.slug + "/"
	}

	headers := http.Header{
		"Origin":          {origin},
		"Referer":         {referer},
		"User-Agent":      {"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
		"Accept-Language": {"en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7"},
		"Accept":          {"*/*"},
		"Cache-Control":   {"no-cache"},
		"Pragma":          {"no-cache"},
	}

	// 创建自定义的 dialer，配置代理和 TLS
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 30 * time.Second
	dialer.EnableCompression = true
	
	// 配置代理支持 - 读取 HTTP_PROXY/HTTPS_PROXY 环境变量
	if c.site == SiteCOM {
		dialer.Proxy = http.ProxyFromEnvironment
		log.Printf("[WebSocket] Using proxy from environment for %s [%s]", c.slug, c.site)
	}

	conn, resp, err := dialer.Dial(c.url, headers)
	if err != nil {
		log.Printf("[WebSocket] Failed to connect to %s [%s]: %v", c.slug, c.site, err)
		if resp != nil {
			log.Printf("[WebSocket] Response status: %d", resp.StatusCode)
			log.Printf("[WebSocket] Response headers: %v", resp.Header)
		}
		return err
	}

	c.mu.Lock()
	c.conn = conn
	c.connected = true
	c.mu.Unlock()

	log.Printf("[WebSocket] Connected successfully to [%s] %s", c.site, c.slug)

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
	log.Printf("[WebSocket] Started reading messages for [%s] %s", c.site, c.slug)
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
			log.Printf("[WebSocket] Error reading message from [%s] %s: %v (total messages received: %d)", c.site, c.slug, err, messageCount)
			return
		}

		messageCount++
		if messageCount <= 3 {
			log.Printf("[WebSocket] Received message #%d from [%s] %s: %s", messageCount, c.site, c.slug, string(message))
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

// generateWSURL returns the WebSocket URL for the problem based on site
func (c *LeetCodeWSClient) generateWSURL() string {
	if c.site == SiteCOM {
		return "wss://collaboration-ws.leetcode.com/problems/" + c.slug
	}
	return "wss://collaboration-ws.leetcode.cn/problems/" + c.slug
}
