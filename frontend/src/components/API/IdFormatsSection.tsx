import React from 'react';
import { Card, Typography, Row, Col, Badge, Alert } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { CodeBlock } from './CodeBlocks';

const { Title, Paragraph, Text } = Typography;

interface IdFormatsSectionProps {
  baseUrl: string;
}

export const IdFormatsSection: React.FC<IdFormatsSectionProps> = ({ baseUrl }) => {
  return (
    <section id="id-formats" style={{ marginBottom: 60 }}>
      <Card bordered={false}>
        <Title level={3}><LinkOutlined /> 题目ID格式</Title>
        <Paragraph>
          所有涉及题目标识的 API 都支持两种格式，您可以随意选择最方便的格式：
        </Paragraph>

        <Row gutter={[24, 24]}>
          <Col span={12}>
            <Card 
              title={<><Badge count="1" style={{ backgroundColor: '#52c41a' }} /> 数字格式</>} 
              bordered={false}
              style={{ background: '#f6ffed' }}
            >
              <Paragraph>
                使用 LeetCode 题目的数字 ID，如 <Text code>1</Text>、<Text code>2</Text>、<Text code>3</Text>
              </Paragraph>
              <CodeBlock code={`# 获取题目1的历史数据
curl "${baseUrl}/api/hot100/online-counts/1"

# 导出题目15的数据
curl "${baseUrl}/api/export?problem_id=15"`} />
            </Card>
          </Col>
          <Col span={12}>
            <Card 
              title={<><Badge count="2" style={{ backgroundColor: '#1890ff' }} /> 英文Slug格式</>} 
              bordered={false}
              style={{ background: '#e6f7ff' }}
            >
              <Paragraph>
                使用题目的英文标识，如 <Text code>two-sum</Text>、<Text code>add-two-numbers</Text>
              </Paragraph>
              <CodeBlock code={`# 获取 two-sum 的历史数据
curl "${baseUrl}/api/hot100/online-counts/two-sum"

# 导出 two-sum 的数据
curl "${baseUrl}/api/export?problem_id=two-sum"`} />
            </Card>
          </Col>
        </Row>

        <Alert
          message="混合使用示例"
          description="同一个接口可以同时使用两种格式查询不同题目"
          type="success"
          showIcon
          style={{ marginTop: 24 }}
        />
      </Card>
    </section>
  );
};
