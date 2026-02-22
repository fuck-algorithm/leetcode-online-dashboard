package config

import (
	"sync"
)

// FeatureFlag manages feature toggles
type FeatureFlag struct {
	enabled map[string]bool
	mu      sync.RWMutex
}

var (
	featureFlagInstance *FeatureFlag
	featureFlagOnce     sync.Once
)

// GetFeatureFlag returns the singleton feature flag instance
func GetFeatureFlag() *FeatureFlag {
	featureFlagOnce.Do(func() {
		featureFlagInstance = &FeatureFlag{
			enabled: map[string]bool{
				"dark_mode":         true,
				"redis_cache":       false,
				"rate_limiting":     true,
				"data_export":       true,
				"peak_detection":    false,
				"weekly_reports":    false,
				"favorites":         true,
				"share_links":       false,
				"analytics":         false,
				"admin_panel":       false,
			},
		}
	})
	return featureFlagInstance
}

// IsEnabled checks if a feature is enabled
func (f *FeatureFlag) IsEnabled(feature string) bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.enabled[feature]
}

// Enable enables a feature
func (f *FeatureFlag) Enable(feature string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.enabled[feature] = true
}

// Disable disables a feature
func (f *FeatureFlag) Disable(feature string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.enabled[feature] = false
}

// Toggle toggles a feature
func (f *FeatureFlag) Toggle(feature string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.enabled[feature] = !f.enabled[feature]
	return f.enabled[feature]
}

// GetAll returns all feature flags
func (f *FeatureFlag) GetAll() map[string]bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	
	// Return a copy
	result := make(map[string]bool)
	for k, v := range f.enabled {
		result[k] = v
	}
	return result
}

// Set sets a feature flag value
func (f *FeatureFlag) Set(feature string, enabled bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.enabled[feature] = enabled
}
