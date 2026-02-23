import React from 'react';
import { Card, Typography, Alert, Divider, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { CodeBlock } from './CodeBlocks';

const { Title, Paragraph, Text } = Typography;

interface QuickStartSectionProps {
  baseUrl: string;
}

export const QuickStartSection: React.FC<QuickStartSectionProps> = ({ baseUrl }) => {
  return (
    <section id="quickstart" style={{ marginBottom: 60 }}>
      <Card bordered={false}>
        <Title level={3}><ThunderboltOutlined /> 快速开始</Title>
        
        <Alert
          message="基础 URL"
          description={
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text code copyable style={{ fontSize: 16, padding: '8px 16px' }}>
                {baseUrl}
              </Text>
              <Text type="secondary">所有 API 端点都基于此 URL</Text>
            </Space>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Title level={4}>第一步：健康检查</Title>
        <Paragraph>在开始之前，先调用健康检查接口确认服务可用：</Paragraph>
        <CodeBlock code={`curl "${baseUrl}/api/health"`} />
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          预期响应：<Text code>{'{"code":200,"msg":"success","data":{"status":"healthy","timestamp":"..."}}'}</Text>
        </Paragraph>

        <Divider />

        <Title level={4}>第二步：获取数据</Title>
        <Paragraph>获取 Hot 100 所有题目的实时在线人数：</Paragraph>
        <CodeBlock code={`curl "${baseUrl}/api/hot100" | jq '.[] | {id: .frontend_id, title: .title_cn, count: .online_count}'`} />
      </Card>
    </section>
  );
};
