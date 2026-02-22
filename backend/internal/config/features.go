package config

import (
	"encoding/json"
	"os"
)

// FeatureFlags 功能开关
type FeatureFlags struct {
	EnableDarkMode       bool `json:"enable_dark_mode"`
	EnableRealtimeUpdate bool `json:"enable_realtime_update"`
	EnableMockData       bool `json:"enable_mock_data"`
	EnableAnalytics      bool `json:"enable_analytics"`
	EnableAlerts         bool `json:"enable_alerts"`
}

// DefaultFeatureFlags 返回默认功能开关
func DefaultFeatureFlags() *FeatureFlags {
	return &FeatureFlags{
		EnableDarkMode:       true,
		EnableRealtimeUpdate: true,
		EnableMockData:       false,
		EnableAnalytics:      false,
		EnableAlerts:         true,
	}
}

// LoadFeatureFlags 从文件加载功能开关
func LoadFeatureFlags(path string) (*FeatureFlags, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return DefaultFeatureFlags(), nil
	}

	var flags FeatureFlags
	if err := json.Unmarshal(data, &flags); err != nil {
		return DefaultFeatureFlags(), err
	}

	return &flags, nil
}

// Save 保存功能开关到文件
func (f *FeatureFlags) Save(path string) error {
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// IsEnabled 检查功能是否启用
func (f *FeatureFlags) IsEnabled(feature string) bool {
	switch feature {
	case "dark_mode":
		return f.EnableDarkMode
	case "realtime_update":
		return f.EnableRealtimeUpdate
	case "mock_data":
		return f.EnableMockData
	case "analytics":
		return f.EnableAnalytics
	case "alerts":
		return f.EnableAlerts
	default:
		return false
	}
}
