package worker

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewWorker(t *testing.T) {
	problems := []string{"two-sum", "add-two-numbers", "longest-substring"}
	batchSize := 10
	interval := 30 * time.Second

	worker := NewWorker(problems, batchSize, interval)

	assert.NotNil(t, worker)
	assert.Equal(t, len(problems), len(worker.problems))
	assert.Equal(t, batchSize, worker.batchSize)
	assert.Equal(t, interval, worker.interval)
	assert.NotNil(t, worker.clients)
	assert.NotNil(t, worker.stopChan)
}

func TestProcessBatches(t *testing.T) {
	problems := []string{"p1", "p2", "p3", "p4", "p5"}
	worker := NewWorker(problems, 2, 1*time.Second)

	// 测试批次计算
	totalBatches := (len(problems) + worker.batchSize - 1) / worker.batchSize
	assert.Equal(t, 3, totalBatches)

	// 测试批次分割
	batch0 := worker.problems[0:2]
	assert.Equal(t, []string{"p1", "p2"}, batch0)

	batch1 := worker.problems[2:4]
	assert.Equal(t, []string{"p3", "p4"}, batch1)

	batch2 := worker.problems[4:5]
	assert.Equal(t, []string{"p5"}, batch2)
}

func TestWorkerStartStop(t *testing.T) {
	problems := []string{"two-sum"}
	worker := NewWorker(problems, 10, 100*time.Millisecond)

	// 启动 worker
	worker.Start()
	time.Sleep(50 * time.Millisecond)

	// 验证 worker 正在运行
	assert.NotNil(t, worker.stopChan)

	// 停止 worker
	worker.Stop()

	// 验证可以安全停止（不 panic）
	assert.True(t, true)
}

func TestGetConnectionStatus(t *testing.T) {
	problems := []string{"two-sum", "add-two-numbers"}
	worker := NewWorker(problems, 10, 30*time.Second)

	// 初始状态应该没有连接
	status := worker.GetConnectionStatus()
	assert.NotNil(t, status)
	assert.Equal(t, 0, len(status))
}

func TestHandleMessage(t *testing.T) {
	worker := NewWorker([]string{"two-sum"}, 10, 30*time.Second)

	// 测试纯数字消息
	data := []byte("42")
	worker.handleMessage("two-sum", data)
	// 验证没有 panic

	// 测试 JSON 消息（备用格式）
	dataJSON := []byte(`{"count": 50}`)
	worker.handleMessage("two-sum", dataJSON)
	// 验证没有 panic

	// 测试无效消息
	dataInvalid := []byte("invalid")
	worker.handleMessage("two-sum", dataInvalid)
	// 验证没有 panic
}

func BenchmarkWorkerCreation(b *testing.B) {
	problems := make([]string, 100)
	for i := 0; i < 100; i++ {
		problems[i] = "problem-" + string(rune(i))
	}

	for i := 0; i < b.N; i++ {
		worker := NewWorker(problems, 10, 30*time.Second)
		_ = worker
	}
}
