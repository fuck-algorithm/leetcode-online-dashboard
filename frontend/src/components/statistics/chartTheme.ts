/**
 * 图表配色主题 - 与网站LeetCode风格保持一致
 * 基于App.css中定义的CSS变量
 */

// LeetCode主题色
export const LC_COLORS = {
  // 主色调 - 黄色
  primary: '#d4a017',
  primaryHover: '#e5b025',
  primaryLight: 'rgba(212, 160, 23, 0.15)',
  
  // 难度颜色
  easy: '#4a9c6d',
  easyLight: 'rgba(74, 156, 109, 0.15)',
  medium: '#d4a017',
  mediumLight: 'rgba(212, 160, 23, 0.15)',
  hard: '#c75b5b',
  hardLight: 'rgba(199, 91, 91, 0.15)',
  
  // 在线人数相关
  online: '#4a9c6d',
  onlineLight: 'rgba(74, 156, 109, 0.15)',
  
  // 站点颜色 - 使用协调的配色方案
  cn: '#d4a017',      // 中文站 - 黄色（主色）
  com: '#2c7bb0',     // 国际站 - 蓝色（链接色）
  total: '#4a9c6d',   // 总数 - 绿色（在线色）
  
  // 站点颜色（浅色背景）
  cnLight: 'rgba(212, 160, 23, 0.2)',
  comLight: 'rgba(44, 123, 176, 0.2)',
  totalLight: 'rgba(74, 156, 109, 0.2)',
  
  // 中性色
  textPrimary: '#2c2c2c',
  textSecondary: '#4a4a4a',
  textMuted: '#6b6b6b',
  border: '#d0ccc0',
  bgDark: '#f5f0e1',
  bgCard: '#ffffff',
  bgHover: '#ebe8dc',
};

// 难度饼图颜色
export const DIFFICULTY_COLORS = {
  easy: LC_COLORS.easy,
  medium: LC_COLORS.medium,
  hard: LC_COLORS.hard,
};

// 站点对比图表颜色
export const SITE_COLORS = {
  cn: LC_COLORS.cn,
  com: LC_COLORS.com,
  total: LC_COLORS.total,
};

// 渐变色（用于卡片背景）
export const GRADIENTS = {
  cn: 'linear-gradient(135deg, #d4a017 0%, #e5b025 100%)',
  com: 'linear-gradient(135deg, #2c7bb0 0%, #3d8dc1 100%)',
  total: 'linear-gradient(135deg, #4a9c6d 0%, #5cb87a 100%)',
};

// 图表通用配置
export const CHART_CONFIG = {
  // 柱状图/面积图默认样式
  barRadius: [4, 4, 0, 0] as [number, number, number, number],
  areaOpacity: 0.3,
  
  // 网格线颜色（浅米色，不抢曲线）
  gridStroke: '#e6e2d6',
  gridStrokeDasharray: '3 3',

  // 坐标轴颜色
  axisStroke: '#8a867a',

  // Tooltip 轻量白底
  tooltipBg: '#ffffff',
  tooltipBorder: '#d0ccc0',
  tooltipStyle: {
    background: '#ffffff',
    border: '1px solid #d0ccc0',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    fontSize: 12,
    color: '#2c2c2c',
  },
  axisTick: { fontSize: 11.5, fill: '#6b6b6b' },
  legendStyle: { fontSize: 12, color: '#4a4a4a' },
};
