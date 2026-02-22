package worker

import (
	"log"
	"time"
)

// AlertManager 告警管理器
type AlertManager struct {
	alertCount   int
	lastAlert    time.Time
	enabled      bool
	webhookURL   string
}

// NewAlertManager 创建新的告警管理器
func NewAlertManager(webhookURL string) *AlertManager {
	return &AlertManager{
		enabled:    webhookURL != "",
		webhookURL: webhookURL,
		lastAlert:  time.Time{},
	}
}

// AlertConnectionFailure 发送连接失败告警
func (a *AlertManager) AlertConnectionFailure(slug string, err error) {
	if !a.enabled {
		return
	}

	// 防止告警洪泛
	if time.Since(a.lastAlert) < 5*time.Minute {
		return
	}

	a.alertCount++
	a.lastAlert = time.Now()

	log.Printf("[ALERT] Connection failed for %s: %v", slug, err)
	// TODO: 发送告警到webhook
}

// AlertHighLoad 发送高负载告警
func (a *AlertManager) AlertHighLoad(problemID string, count int) {
	if !a.enabled {
		return
	}

	if count > 1000 {
		log.Printf("[ALERT] High load detected for %s: %d users online", problemID, count)
	}
}
