import React from 'react';
import { Card, Typography, Divider, Row, Col, Statistic, Space } from 'antd';
import { 
  ApiOutlined, 
  ThunderboltOutlined, 
  GlobalOutlined, 
  FileTextOutlined,
  EyeOutlined,
  HistoryOutlined,
  BarChartOutlined,
  DownloadOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export const OverviewSection: React.FC = () => {
  return (
    <section id="overview" style={{ marginBottom: 60 }}>
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Space align="start" size="large">
          <div style={{ 
            width: 60, 
            height: 60, 
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ApiOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <div>
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              LeetCode Hot 100 API
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, margin: 0 }}>
              实时获取 LeetCode Hot 100 题目的在线人数数据，支持历史趋势分析、数据导出和多种集成方案
            </Paragraph>
          </div>
        </Space>

        <Divider style={{ margin: '24px 0' }} />

        <Row gutter={[24, 24]}>
          <Col span={8}>
            <Card bordered={false} style={{ background: '#f6ffed', borderLeft: '4px solid #52c41a' }}>
              <Statistic 
                title={<Text type="success"><ThunderboltOutlined /> 实时数据</Text>}
                value="30秒" 
                suffix="更新"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} style={{ background: '#e6f7ff', borderLeft: '4px solid #1890ff' }}>
              <Statistic 
                title={<Text style={{ color: '#1890ff' }}><GlobalOutlined /> 跨域支持</Text>}
                value="CORS" 
                suffix="已启用"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} style={{ background: '#fff7e6', borderLeft: '4px solid #fa8c16' }}>
              <Statistic 
                title={<Text style={{ color: '#fa8c16' }}><FileTextOutlined /> 数据格式</Text>}
                value="JSON" 
                suffix="+ CSV"
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 特性介绍 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card bordered={false}>
            <Title level={4}><EyeOutlined /> 实时监控</Title>
            <Paragraph>
              获取 Hot 100 所有题目的实时在线人数，数据每30秒自动更新。可用于构建实时监控面板、热度排行榜等应用。
            </Paragraph>
          </Card>
        </Col>
        <Col span={12}>
          <Card bordered={false}>
            <Title level={4}><HistoryOutlined /> 历史趋势</Title>
            <Paragraph>
              查询任意题目的历史在线人数数据，支持时间范围筛选。可用于趋势分析、峰值检测、数据可视化等场景。
            </Paragraph>
          </Card>
        </Col>
        <Col span={12}>
          <Card bordered={false}>
            <Title level={4}><BarChartOutlined /> 统计分析</Title>
            <Paragraph>
              获取完整的统计分析报告，包括难度分布、热门排行、在线人数区间分布等多维度数据分析。
            </Paragraph>
          </Card>
        </Col>
        <Col span={12}>
          <Card bordered={false}>
            <Title level={4}><DownloadOutlined /> 数据导出</Title>
            <Paragraph>
              支持 JSON 和 CSV 格式导出历史数据，可按题目、日期范围筛选。便于离线分析、备份和第三方工具集成。
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </section>
  );
};
