import React from 'react';
import { Row, Col } from 'antd';
import { 
  WifiOutlined, 
  LineChartOutlined, 
  TrophyOutlined,
  ThunderboltOutlined,
  AimOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { FeatureCard } from './FeatureCard';

export const FeaturesSection: React.FC = () => {
  return (
    <section style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, color: '#262626', marginBottom: 16 }}>
          核心功能
        </h2>
        <p style={{ fontSize: 18, color: '#8c8c8c', maxWidth: 600, margin: '0 auto' }}>
          WebSocket 实时数据推送，毫秒级延迟，全方位了解刷题趋势
        </p>
      </div>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={8}>
          <FeatureCard
            icon={<WifiOutlined />}
            title="实时监控"
            description="基于 WebSocket 的实时数据推送，毫秒级延迟推送，掌握最新刷题动态"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <FeatureCard
            icon={<LineChartOutlined />}
            title="趋势分析"
            description="查看每道题目的历史在线人数变化，发现题目热度的上升下降趋势"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <FeatureCard
            icon={<TrophyOutlined />}
            title="热门排行"
            description="按在线人数排序的实时排行榜，快速找到当前最受欢迎的算法题目"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <FeatureCard
            icon={<ThunderboltOutlined />}
            title="难度分布"
            description="按 Easy、Medium、Hard 分类统计，了解不同难度题目的受欢迎程度"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <FeatureCard
            icon={<AimOutlined />}
            title="精准定位"
            description="直接跳转到 LeetCode 题目页面，无缝衔接学习和练习体验"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <FeatureCard
            icon={<SafetyOutlined />}
            title="数据可靠"
            description="云端部署，7×24 小时不间断监控，确保数据的准确性和实时性"
          />
        </Col>
      </Row>
    </section>
  );
};
