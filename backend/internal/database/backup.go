package database

import (
	"log"
	"os"
	"path/filepath"
	"time"
)

// BackupManager 数据库备份管理器
type BackupManager struct {
	dataDir  string
	backupDir string
	interval time.Duration
}

// NewBackupManager 创建新的备份管理器
func NewBackupManager(dataDir, backupDir string, interval time.Duration) *BackupManager {
	return &BackupManager{
		dataDir:   dataDir,
		backupDir: backupDir,
		interval:  interval,
	}
}

// Start 启动定期备份
func (b *BackupManager) Start() {
	go b.backupRoutine()
	log.Println("Database backup manager started")
}

// backupRoutine 备份循环
func (b *BackupManager) backupRoutine() {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	// 立即执行一次备份
	b.Backup()

	for range ticker.C {
		b.Backup()
	}
}

// Backup 执行备份
func (b *BackupManager) Backup() error {
	// 确保备份目录存在
	if err := os.MkdirAll(b.backupDir, 0755); err != nil {
		log.Printf("Failed to create backup directory: %v", err)
		return err
	}

	// 生成备份文件名
	timestamp := time.Now().Format("20060102_150405")
	backupFile := filepath.Join(b.backupDir, "dashboard_"+timestamp+".db")

	// 复制数据库文件
	dataFile := filepath.Join(b.dataDir, "dashboard.db")
	if err := copyFile(dataFile, backupFile); err != nil {
		log.Printf("Backup failed: %v", err)
		return err
	}

	log.Printf("Database backup created: %s", backupFile)
	return nil
}

// copyFile 复制文件
func copyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, input, 0644)
}

// CleanupOldBackups 清理旧备份（保留最近7天）
func (b *BackupManager) CleanupOldBackups() {
	cutoff := time.Now().AddDate(0, 0, -7)

	entries, err := os.ReadDir(b.backupDir)
	if err != nil {
		log.Printf("Failed to read backup directory: %v", err)
		return
	}

	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			path := filepath.Join(b.backupDir, entry.Name())
			if err := os.Remove(path); err == nil {
				log.Printf("Removed old backup: %s", entry.Name())
			}
		}
	}
}

// BackupToS3 备份到S3（预留接口）
func (b *BackupManager) BackupToS3(bucket, region string) error {
	// TODO: 实现S3备份
	log.Printf("S3 backup to %s/%s not yet implemented", region, bucket)
	return nil
}
