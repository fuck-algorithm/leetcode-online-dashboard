import React, { useState, useEffect } from 'react';
import { Skeleton, message } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { fetchHot100, fetchPeakOnlineTimes } from '../api';
import { Problem } from '../types';
import OverviewSection from './statistics/OverviewSection';
import OnlineAnalysisSection from './statistics/OnlineAnalysisSection';
import RankingSection from './statistics/RankingSection';
import AcceptanceStatsSection from './statistics/AcceptanceStatsSection';
import { DocLayout, useDocNavigation, type DocAnchor } from './docs/DocLayout';
import { DocSection } from './docs/DocSection';
import './dataPage/DataPage.css';

const STATISTICS_ANCHORS: DocAnchor[] = [
  { key: 'stat-overview', title: '总体概览' },
  { key: 'stat-distribution', title: '分布分析' },
  { key: 'stat-concentration', title: '头部集中度' },
  { key: 'stat-online', title: '在线深度分析' },
  { key: 'stat-ranking', title: '题目排行与进阶' },
  { key: 'stat-acceptance', title: '通过率分析' },
  { key: 'stat-features', title: '统计特征' },
];

const Statistics: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [, setPeaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { activeAnchor, scrollTo } = useDocNavigation(STATISTICS_ANCHORS);

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

  return (
    <DocLayout
      wide
      title="统计分析"
      subtitle="Hot 100 在线人数与题目特征的多维度分析"
      icon={<BarChartOutlined />}
      anchors={STATISTICS_ANCHORS}
      activeAnchor={activeAnchor}
      onNavigate={scrollTo}
    >
      {loading ? (
        <>
          <DocSection id="stat-overview" title="总体概览" icon={<BarChartOutlined />}>
            <Skeleton active paragraph={{ rows: 3 }} />
            <Skeleton active paragraph={{ rows: 8 }} />
          </DocSection>
          <DocSection id="stat-distribution" title="分布分析" icon={<BarChartOutlined />}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </DocSection>
        </>
      ) : (
        <>
          <OverviewSection problems={problems} />
          <OnlineAnalysisSection problems={problems} />
          <RankingSection problems={problems} />
          <AcceptanceStatsSection problems={problems} />
        </>
      )}
    </DocLayout>
  );
};

export default Statistics;
