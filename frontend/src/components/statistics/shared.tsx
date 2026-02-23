import React from 'react';
import { Typography, Tooltip as AntTooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;

// 带问号提示的标题组件
export const SectionTitle: React.FC<{ title: string; explanation: string; style?: React.CSSProperties }> = ({ title, explanation, style }) => (
  <Title level={4} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, ...style }}>
    {title}
    <AntTooltip title={explanation}>
      <QuestionCircleOutlined style={{ color: '#999', fontSize: 16, cursor: 'help' }} />
    </AntTooltip>
  </Title>
);

// 带问号提示的卡片标题组件
export const CardTitle: React.FC<{ title: string; explanation: string }> = ({ title, explanation }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {title}
    <AntTooltip title={explanation}>
      <QuestionCircleOutlined style={{ color: '#999', fontSize: 14, cursor: 'help' }} />
    </AntTooltip>
  </span>
);
