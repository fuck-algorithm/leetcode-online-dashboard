import React from 'react';
import { Card, Typography, Table, Tag, Alert } from 'antd';
import { HeartOutlined } from '@ant-design/icons';
import { CodeBlock } from './CodeBlocks';

const { Title, Paragraph, Text } = Typography;

export const ErrorsSection: React.FC = () => {
  return (
    <section id="errors" style={{ marginBottom: 60 }}>
      <Card bordered={false}>
        <Title level={3}>错误处理</Title>
        <Paragraph>
          API 使用标准 HTTP 状态码，错误响应包含详细的错误信息：
        </Paragraph>

        <Table
          dataSource={[
            { code: 200, message: '请求成功', description: '正常返回数据' },
            { code: 400, message: '请求参数错误', description: '请求参数格式不正确或缺少必要参数' },
            { code: 404, message: '资源不存在', description: '题目不存在或 slug 错误' },
            { code: 500, message: '服务器内部错误', description: '服务器处理请求时发生错误' },
            { code: 503, message: '服务不可用', description: '数据库连接失败或其他服务异常' },
          ]}
          columns={[
            { title: '状态码', dataIndex: 'code', key: 'code', render: (code: number) => (
              <Tag color={code === 200 ? 'green' : code < 500 ? 'orange' : 'red'}>{code}</Tag>
            )},
            { title: '错误信息', dataIndex: 'message', key: 'message' },
            { title: '说明', dataIndex: 'description', key: 'description' },
          ]}
          pagination={false}
          size="small"
        />

        <Alert
          message="错误响应格式"
          description="所有错误响应都使用统一的 code/msg/data 格式"
          type="info"
          showIcon
          style={{ marginTop: 24 }}
        />
        <CodeBlock code={`{\n  "code": 404,\n  "msg": "Problem not found",\n  "data": null\n}`} language="json" />
      </Card>
    </section>
  );
};

export const ApiFooter: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
      <HeartOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
      <Text type="secondary">LeetCode Hot 100 Dashboard API - 为学习而生</Text>
    </div>
  );
};
