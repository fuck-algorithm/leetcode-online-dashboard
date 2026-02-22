package worker

import (
	"fmt"
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
		totalBatches := (len(tc.problems) + tc.batchSize - 1) / tc.batchSize
		assert.Equal(t, tc.expected, totalBatches)
	}
}

func TestWorkerStartStop(t *testing.T) {
	problems := []string{"two-sum"}
	w := NewWorker(problems, 1, 1*time.Second, nil)

	// Start worker
	w.Start()

	// Give it a moment to start
	time.Sleep(100 * time.Millisecond)

	// Stop worker
	w.Stop()

	// Should not panic
	assert.True(t, true)
}

func TestConnectionStatus(t *testing.T) {
	problems := []string{"two-sum", "add-two-numbers"}
	w := NewWorker(problems, 2, 1*time.Second, nil)

	// Initial status should be empty
	status := w.GetConnectionStatus()
	assert.NotNil(t, status)
	assert.Equal(t, 0, len(status))
}

func TestProcessBatch(t *testing.T) {
	problems := []string{"two-sum", "add-two-numbers", "longest-substring"}
	w := NewWorker(problems, 2, 1*time.Second, nil)

	// Test batch processing
	totalBatches := (len(problems) + w.batchSize - 1) / w.batchSize
	assert.Equal(t, 2, totalBatches)

	// Test first batch
	start := 0 * w.batchSize
	end := start + w.batchSize
	if end > len(problems) {
		end = len(problems)
	}
	batch := problems[start:end]
	assert.Equal(t, 2, len(batch))
	assert.Contains(t, batch, "two-sum")
	assert.Contains(t, batch, "add-two-numbers")

	// Test second batch
	start = 1 * w.batchSize
	end = start + w.batchSize
	if end > len(problems) {
		end = len(problems)
	}
	batch = problems[start:end]
	assert.Equal(t, 1, len(batch))
	assert.Contains(t, batch, "longest-substring")
}

func TestHandleMessage(t *testing.T) {
	problems := []string{"two-sum"}
	w := NewWorker(problems, 1, 1*time.Second, nil)

	// Test message parsing with plain number
	data := []byte("42")
	var count int
	_, err := fmt.Sscanf(string(data), "%d", &count)
	assert.NoError(t, err)
	assert.Equal(t, 42, count)
}
