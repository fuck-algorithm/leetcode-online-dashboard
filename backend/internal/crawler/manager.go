package crawler

import (
	"sync"

	"leetcode-dashboard/internal/websocket"
)

// ClientKey represents a unique key for a problem-site combination
type ClientKey struct {
	Slug string
	Site websocket.SiteType
}

// String returns the string representation of the key
func (k ClientKey) String() string {
	return k.Slug + "-" + string(k.Site)
}

// Manager manages WebSocket connections for dual-site crawling
type Manager struct {
	clients   map[ClientKey]*websocket.LeetCodeWSClient
	problems  []string
	mu        sync.RWMutex
	batchSize int
}

// NewManager creates a new crawler manager instance
func NewManager(problems []string, batchSize int) *Manager {
	return &Manager{
		clients:   make(map[ClientKey]*websocket.LeetCodeWSClient),
		problems:  problems,
		batchSize: batchSize,
	}
}

// GetClient returns a client for a specific problem and site
func (m *Manager) GetClient(slug string, site websocket.SiteType) (*websocket.LeetCodeWSClient, bool) {
	key := ClientKey{Slug: slug, Site: site}
	m.mu.RLock()
	defer m.mu.RUnlock()
	client, ok := m.clients[key]
	return client, ok
}

// SetClient sets a client for a specific problem and site
func (m *Manager) SetClient(slug string, site websocket.SiteType, client *websocket.LeetCodeWSClient) {
	key := ClientKey{Slug: slug, Site: site}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clients[key] = client
}

// RemoveClient removes a client for a specific problem and site
func (m *Manager) RemoveClient(slug string, site websocket.SiteType) {
	key := ClientKey{Slug: slug, Site: site}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.clients, key)
}

// GetAllClients returns a copy of all clients
func (m *Manager) GetAllClients() map[ClientKey]*websocket.LeetCodeWSClient {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	result := make(map[ClientKey]*websocket.LeetCodeWSClient)
	for k, v := range m.clients {
		result[k] = v
	}
	return result
}

// GetProblems returns the list of problems
func (m *Manager) GetProblems() []string {
	return m.problems
}

// GetBatchSize returns the batch size
func (m *Manager) GetBatchSize() int {
	return m.batchSize
}

// CloseAll closes all WebSocket connections
func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	for key, client := range m.clients {
		client.Close()
		delete(m.clients, key)
	}
}
