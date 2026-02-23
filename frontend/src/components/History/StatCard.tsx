import React from 'react';
import { Card, Tag } from 'antd';

interface StatCardProps {
  title: string;
  values: { cn: number; com: number; total: number };
}

export const StatCard: React.FC<StatCardProps> = ({ title, values }) => (
  <Card className="lc-card" size="small">
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: 'var(--lc-text-secondary)', marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <Tag color="red" style={{ margin: 0, fontSize: 11 }}>中文站</Tag>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ff4d4f', marginTop: 2 }}>{values.cn}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>国际站</Tag>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff', marginTop: 2 }}>{values.com}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>汇总</Tag>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ffa116', marginTop: 2 }}>{values.total}</div>
        </div>
      </div>
    </div>
  </Card>
);
