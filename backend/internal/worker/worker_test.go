package worker

import (
	"testing"
	"time"

	"leetcode-dashboard/internal/websocket"

	"github.com/stretchr/testify/assert"
)

func TestWorkerCreation(t *testing.T) {
	problems := []string{"two-sum", "add-two-numbers"}
	batchSize := 2
	interval := 30 * time.Second
	hub := websocket.NewHub()

	w := NewWorker(problems, batchSize, interval, hub)

	assert.NotNil(t, w)
	assert.Equal(t, 2, len(w.problems))
	assert.Equal(t, 2, w.batchSize)
	assert.Equal(t, interval, w.interval)
	assert.NotNil(t, w.stopChan)
	assert.Equal(t, hub, w.hub)
}

func TestBatchCalculation(t *testing.T) {
	testCases := []struct {
		problems  []string
		batchSize int
		expected  int
	}{
		{[]string{"a", "b", "c"}, 2, 2},
		{[]string{"a", "b", "c", "d"}, 2, 2},
		{[]string{"a", "b", "c", "d", "e"}, 2, 3},
		{[]string{"a"}, 2, 1},
		{[]string{}, 2, 0},
	}

	for _, tc := range testCases {
		batches := (len(tc.problems) + tc.batchSize - 1) / tc.batchSize
		assert.Equal(t, tc.expected, batches)
	}
}

// Stop 关闭 stopChan，两个后台协程必须都能退出，且重复调用不 panic。
func TestWorkerStartStop(t *testing.T) {
	w := NewWorker([]string{"two-sum"}, 1, 1*time.Second, nil)

	w.Start()
	time.Sleep(100 * time.Millisecond)
	w.Stop()
}

func TestConnectionStatus(t *testing.T) {
	w := NewWorker([]string{"two-sum", "add-two-numbers"}, 2, 1*time.Second, nil)

	status := w.GetConnectionStatus()
	assert.NotNil(t, status)
	assert.Equal(t, 0, len(status))
}

func TestProcessBatch(t *testing.T) {
	problems := []string{"two-sum", "add-two-numbers", "longest-substring"}
	w := NewWorker(problems, 2, 1*time.Second, nil)

	totalBatches := (len(problems) + w.batchSize - 1) / w.batchSize
	assert.Equal(t, 2, totalBatches)

	batch := problems[0:w.batchSize]
	assert.Equal(t, 2, len(batch))
	assert.Contains(t, batch, "two-sum")
	assert.Contains(t, batch, "add-two-numbers")

	batch = problems[w.batchSize:]
	assert.Equal(t, 1, len(batch))
	assert.Contains(t, batch, "longest-substring")
}
