import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  refreshRate: number; // seconds
  showDifficulty: boolean;
  showAcceptance: boolean;
  defaultSort: string;
  pageSize: number;
  historyProblemId: string | null;
  historyTimeRangePreset: '24h' | '7d' | '1m' | '6m' | '1y' | 'custom';
  historyTimeRange: string | null; // 仅 custom 时保存的绝对时间范围
}

const defaultPreferences: UserPreferences = {
  theme: 'auto',
  refreshRate: 30,
  showDifficulty: true,
  showAcceptance: true,
  defaultSort: 'online_count',
  pageSize: 20,
  historyProblemId: null,
  // 默认用相对时间：每次打开页面按“当前时间”重新计算，避免把几天前的
  // 绝对区间一直存下来（那会看到一段早已过期的数据，国际站全为 0）。
  historyTimeRangePreset: '24h',
  historyTimeRange: null,
};

interface PreferencesContextType {
  preferences: UserPreferences;
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetPreferences: () => void;
  isDarkMode: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('leetcode-dashboard-preferences');
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
  });

  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('leetcode-dashboard-preferences', JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    const checkDarkMode = () => {
      if (preferences.theme === 'dark') {
        setIsDarkMode(true);
      } else if (preferences.theme === 'light') {
        setIsDarkMode(false);
      } else {
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    checkDarkMode();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => mediaQuery.removeEventListener('change', checkDarkMode);
  }, [preferences.theme]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const setPreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  return (
    <PreferencesContext.Provider value={{ preferences, setPreference, resetPreferences, isDarkMode }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
};
