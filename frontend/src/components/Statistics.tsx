import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Skeleton, message } from 'antd';
import { fetchHot100, fetchPeakOnlineTimes } from '../api';
import { Problem } from '../types';
import OverviewSection from './statistics/OverviewSection';
import OnlineAnalysisSection from './statistics/OnlineAnalysisSection';
import RankingSection from './statistics/RankingSection';
import AcceptanceStatsSection from './statistics/AcceptanceStatsSection';

const Statistics: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [, setPeaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [problemsData, peaksData] = await Promise.all([
        fetchHot100(),
        fetchPeakOnlineTimes().catch(() => []),
      ]);
      setProblems(problemsData);
      setPeaks(peaksData || []);
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: '0 8px' }}>
      <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <Col xs={24} sm={12} md={6} key={i}>
            <Card><Skeleton active paragraph={{ rows: 1 }} /></Card>
          </Col>
        ))}
      </Row>
      <Card style={{ marginBottom: 24 }}><Skeleton active paragraph={{ rows: 6 }} /></Card>
      <Row gutter={[16, 16]}>
        {[1, 2].map(i => (
          <Col xs={24} lg={12} key={i}>
            <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  return (
    <div style={{ padding: '0 8px' }}>
      <OverviewSection problems={problems} />
      <OnlineAnalysisSection problems={problems} />
      <RankingSection problems={problems} />
      <AcceptanceStatsSection problems={problems} />
    </div>
  );
};

export default Statistics;
