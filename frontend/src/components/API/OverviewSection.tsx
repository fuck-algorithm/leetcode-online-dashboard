import React from 'react';
import {
  ApiOutlined,
  EyeOutlined,
  HistoryOutlined,
  BarChartOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { DocSection } from '../docs';

const features = [
  {
    icon: <EyeOutlined />,
    title: '实时监控',
    desc: '获取 Hot 100 所有题目的实时在线人数，数据每 30 秒自动更新，可用于实时监控面板、热度排行榜等应用。',
  },
  {
    icon: <HistoryOutlined />,
    title: '历史趋势',
    desc: '查询任意题目的历史在线人数数据，支持数量限制。可用于趋势分析、峰值检测、数据可视化等场景。',
  },
  {
    icon: <BarChartOutlined />,
    title: '统计分析',
    desc: '获取综合统计报告，包括总在线人数、难度分布、区间分布以及热门题目排行等多维度数据。',
  },
  {
    icon: <DownloadOutlined />,
    title: '数据导出',
    desc: '支持 JSON 和 CSV 格式导出历史数据，可按题目、日期范围筛选，便于离线分析、备份和第三方工具集成。',
  },
];

export const OverviewSection: React.FC = () => {
  return (
    <DocSection id="overview" title="概览" icon={<ApiOutlined />} desc="LeetCode Hot 100 REST API">
      <p className="lc-doc-text">
        实时获取 LeetCode Hot 100 题目的在线人数数据，支持历史趋势分析、数据导出和多种集成方案。
        所有端点返回统一的 <code>code / msg / data</code> 结构，并已开启 CORS。
      </p>

      <div className="lc-stat-grid">
        <div className="lc-stat">
          <div className="lc-stat-label">数据刷新</div>
          <div className="lc-stat-value">每 30 秒</div>
        </div>
        <div className="lc-stat">
          <div className="lc-stat-label">跨域</div>
          <div className="lc-stat-value">CORS 已启用</div>
        </div>
        <div className="lc-stat">
          <div className="lc-stat-label">数据格式</div>
          <div className="lc-stat-value">JSON + CSV</div>
        </div>
        <div className="lc-stat">
          <div className="lc-stat-label">接口数量</div>
          <div className="lc-stat-value">9 个端点</div>
        </div>
      </div>

      <div className="lc-doc-grid-2">
        {features.map((feature) => (
          <div key={feature.title} className="lc-doc-panel">
            <div className="lc-doc-panel-title">
              <span style={{ display: 'inline-flex', color: 'var(--lc-primary)' }}>{feature.icon}</span>
              {feature.title}
            </div>
            <p className="lc-doc-text" style={{ marginBottom: 0 }}>
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </DocSection>
  );
};
