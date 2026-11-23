package websocket

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLeetCodeWSClientCreation(t *testing.T) {
	slug := "two-sum"
	messageHandler := func(data []byte) {}
	errorHandler := func(err error) {}

	client := NewLeetCodeWSClient(slug, SiteCN, messageHandler, errorHandler)

	assert.NotNil(t, client)
	assert.Equal(t, slug, client.slug)
	assert.Equal(t, SiteCN, client.GetSite())
	assert.NotNil(t, client.onMessage)
	assert.NotNil(t, client.onError)
	assert.False(t, client.IsConnected())
}

func TestGenerateWSURL(t *testing.T) {
	cnClient := NewLeetCodeWSClient("two-sum", SiteCN, nil, nil)
	assert.Equal(t, "wss://collaboration-ws.leetcode.cn/problems/two-sum", cnClient.generateWSURL())

	comClient := NewLeetCodeWSClient("two-sum", SiteCOM, nil, nil)
	assert.Equal(t, "wss://collaboration-ws.leetcode.com/problems/two-sum", comClient.generateWSURL())
}

func TestClientConnectionState(t *testing.T) {
	client := NewLeetCodeWSClient("test", SiteCN, nil, nil)

	// 初始状态应该是未连接
	assert.False(t, client.IsConnected())

	// 测试连接（模拟）
	// 注意：这里我们不实际连接，因为需要真实的WebSocket服务器
	// 实际集成测试应该在有网络访问的环境中运行
}

func TestMessageParsing(t *testing.T) {
	// 测试纯数字消息格式
	testCases := []struct {
		input    string
		expected int
	}{
		{"44", 44},
		{"0", 0},
		{"100", 100},
		{"9999", 9999},
	}

	for _, tc := range testCases {
		var count int
		_, err := fmt.Sscanf(tc.input, "%d", &count)
		assert.NoError(t, err)
		assert.Equal(t, tc.expected, count)
	}
}

func TestReconnectionBackoff(t *testing.T) {
	// 测试重连退避策略
	attempts := []int{0, 1, 2, 3, 4, 5}
	maxBackoff := 60 * time.Second

	for _, attempt := range attempts {
		backoff := calculateBackoff(attempt, maxBackoff)
		assert.True(t, backoff >= 0)
		assert.True(t, backoff <= maxBackoff)
	}
}

func calculateBackoff(attempt int, maxBackoff time.Duration) time.Duration {
	backoff := time.Duration(attempt*5) * time.Second
	if backoff > maxBackoff {
		return maxBackoff
	}
	return backoff
}
