import React from 'react';

interface StatCardProps {
  title: string;
  values: { cn: number; com: number; total: number };
}

/** 历史数据页的概览块：一个指标下并列 中文站 / 国际站 / 汇总。 */
export const StatCard: React.FC<StatCardProps> = ({ title, values }) => (
  <div className="history-stat">
    <div className="history-stat-title">{title}</div>
    <div className="history-stat-values">
      <div className="history-stat-item">
        <span className="history-stat-label">中文站</span>
        <span className="history-stat-value history-stat-cn">{values.cn.toLocaleString()}</span>
      </div>
      <div className="history-stat-item">
        <span className="history-stat-label">国际站</span>
        <span className="history-stat-value history-stat-com">{values.com.toLocaleString()}</span>
      </div>
      <div className="history-stat-item">
        <span className="history-stat-label">汇总</span>
        <span className="history-stat-value history-stat-total">{values.total.toLocaleString()}</span>
      </div>
    </div>
  </div>
);
