import React from 'react';
import { Card, Row, Col } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { SectionTitle, CardTitle } from './shared';
import { Problem } from '../../types';
import { 
  getOnlineDistribution, 
  getDifficultyOnlineData, 
  getPositionOnlineData, 
  getDifficultyScatterData, 
  getRecentlyActive 
} from './dataUtils';
import { SITE_COLORS, LC_COLORS, CHART_CONFIG } from './chartTheme';

interface OnlineAnalysisSectionProps {
  problems: Problem[];
}

const OnlineAnalysisSection: React.FC<OnlineAnalysisSectionProps> = ({ problems }) => {
  const onlineDistribution = getOnlineDistribution(problems);
  const difficultyOnlineData = getDifficultyOnlineData(problems);
  const positionOnlineData = getPositionOnlineData(problems);
  const difficultyScatterData = getDifficultyScatterData(problems);
  const recentlyActive = getRecentlyActive(problems);

  return (
    <>
      <SectionTitle 
        title="📊 在线人数深度分析" 
        explanation="深入分析在线人数的分布特征，包括区间分布、散点分布和极值分析"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="在线人数区间分布" explanation="按在线人数区间统计题目数量，了解在线人数的整体分布" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={onlineDistribution}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value) => [`${value}题`, '题目数']} />
                <Bar dataKey="count" fill={LC_COLORS.primary} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="难度与平均在线人数（三站对比）" explanation="不同难度题目的平均在线人数对比" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={difficultyOnlineData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgCN" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="avgCOM" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="avgTotal" name="总数" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="前20题在线人数分布（三站对比）" explanation="展示前20道题目的在线人数分布情况" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={positionOnlineData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="position" interval={2} stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cn" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="com" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="total" name="总数" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <SectionTitle 
        title="🔗 深度关联分析" 
        explanation="探索标签与在线人数的关联、难度与在线人数的散点关系，发现热门标签和热门题目"
        style={{ marginTop: 24 }}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="难度与在线人数散点图" explanation="展示难度与在线人数的关系，观察是否有规律" />}>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="difficultyValue" name="难度" tickFormatter={(v) => v === 1 ? 'Easy' : v === 2 ? 'Medium' : 'Hard'} stroke={CHART_CONFIG.axisStroke} />
                <YAxis dataKey="online" name="在线人数" stroke={CHART_CONFIG.axisStroke} />
                <ZAxis range={[50, 50]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => {
                  if (name === 'difficultyValue') return [value === 1 ? 'Easy' : value === 2 ? 'Medium' : 'Hard', '难度'];
                  if (name === 'online') return [`${value}人`, '在线人数'];
                  return [value, name];
                }} />
                <Scatter data={difficultyScatterData} fill={LC_COLORS.primary} />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="最近活跃题目 (Top 10)" explanation="按最后更新时间排序的最近活跃题目" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={recentlyActive} layout="vertical">
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis type="number" stroke={CHART_CONFIG.axisStroke} />
                <YAxis dataKey="name" type="category" width={120} stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value, name) => [name === 'online' ? `${value}人` : value, name === 'online' ? '在线人数' : '时间']} />
                <Bar dataKey="online" fill={LC_COLORS.hard} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default OnlineAnalysisSection;
