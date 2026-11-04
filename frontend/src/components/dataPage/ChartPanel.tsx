import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

interface ChartPanelProps {
  title: string;
  /** 指标解释，显示在问号提示里。 */
  desc?: string;
  /** 标题栏右侧控件（时间粒度、刷新等）。 */
  extra?: React.ReactNode;
  /** 图表区域高度，默认 300px。 */
  height?: number;
  children: React.ReactNode;
}

/** 数据页图表容器：白底扁平卡片，标题栏浅米色，与文档页面板一致。 */
export const ChartPanel: React.FC<ChartPanelProps> = ({ title, desc, extra, height = 300, children }) => (
  <div className="lc-chart-panel">
    <div className="lc-chart-panel-head">
      <span className="lc-chart-panel-title">
        {title}
        {desc && (
          <Tooltip title={desc}>
            <QuestionCircleOutlined className="lc-chart-panel-help" />
          </Tooltip>
        )}
      </span>
      {extra && <div className="lc-chart-panel-extra">{extra}</div>}
    </div>
    <div className="lc-chart-panel-body" style={{ height }}>
      {children}
    </div>
  </div>
);

interface ChartGridProps {
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}

/** 图表栅格：统一间距，列数随窗口宽度自适应。 */
export const ChartGrid: React.FC<ChartGridProps> = ({ columns = 2, children }) => (
  <div className={`lc-chart-grid lc-chart-grid-${columns}`}>{children}</div>
);

type StatTone = 'cn' | 'com' | 'total' | 'neutral';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: StatTone;
}

/** 概览数字块：左侧色条 + 米色底，不使用渐变大卡片。 */
export const StatTile: React.FC<StatTileProps> = ({ label, value, hint, icon, tone = 'neutral' }) => (
  <div className={`lc-stat-tile lc-stat-tile-${tone}`}>
    <div className="lc-stat-tile-head">
      {icon && <span className="lc-stat-tile-icon">{icon}</span>}
      <span className="lc-stat-tile-label">{label}</span>
    </div>
    <div className="lc-stat-tile-value">{value}</div>
    {hint && <div className="lc-stat-tile-hint">{hint}</div>}
  </div>
);

export const StatRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="lc-stat-row">{children}</div>
);

/** 通用浅色图表主题，避免每个图表各写一套深色 tooltip。 */
export const CHART_UI = {
  grid: '#e6e2d6',
  axis: '#8a867a',
  tick: '#6b6b6b',
  tooltip: {
    background: '#ffffff',
    border: '1px solid #d0ccc0',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    fontSize: 12,
    color: '#2c2c2c',
  },
  legend: {
    fontSize: 12,
    color: '#4a4a4a',
  },
};
