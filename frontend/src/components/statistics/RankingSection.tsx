import React from 'react';
import { Card, Row, Col } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { SectionTitle, CardTitle } from './shared';
import { Problem } from '../../types';
import { 
  getHighestOnlineProblems, 
  getLowestOnlineProblems, 
  getPositionScatterData, 
  getOnlineRangeDifficultyData, 
  getTop10Data 
} from './dataUtils';
import { SITE_COLORS, LC_COLORS, DIFFICULTY_COLORS, CHART_CONFIG } from './chartTheme';

interface RankingSectionProps {
  problems: Problem[];
}

const RankingSection: React.FC<RankingSectionProps> = ({ problems }) => {
  const highestOnlineProblems = getHighestOnlineProblems(problems);
  const lowestOnlineProblems = getLowestOnlineProblems(problems);
  const positionScatterData = getPositionScatterData(problems);
  const onlineRangeDifficultyData = getOnlineRangeDifficultyData(problems);
  const top10Data = getTop10Data(problems);

  return (
    <>
      <SectionTitle 
        title="🏆 题目排行与极值分析" 
        explanation="展示在线人数最高的Top 10题目、最近活跃题目，以及在线人数的极值情况"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="在线人数最高 Top 10" explanation="当前在线人数最多的10道题目" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={highestOnlineProblems} layout="vertical">
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis type="number" stroke={CHART_CONFIG.axisStroke} />
                <YAxis dataKey="name" type="category" width={120} stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value) => [`${value}人`, '在线人数']} />
                <Bar dataKey="online" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="在线人数最低 Top 10" explanation="当前在线人数最少的10道题目" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={lowestOnlineProblems} layout="vertical">
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis type="number" stroke={CHART_CONFIG.axisStroke} />
                <YAxis dataKey="name" type="category" width={120} stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value) => [`${value}人`, '在线人数']} />
                <Bar dataKey="online" fill={LC_COLORS.hard} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="题目位置与在线人数散点图" explanation="展示题目编号位置与在线人数的关系" />}>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="position" name="题目位置" stroke={CHART_CONFIG.axisStroke} />
                <YAxis dataKey="online" name="在线人数" stroke={CHART_CONFIG.axisStroke} />
                <ZAxis range={[30, 30]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name, _props) => {
                  if (name === 'position') return [`#${value}`, '题目位置'];
                  if (name === 'online') return [`${value}人`, '在线人数'];
                  return [value, name];
                }} />
                <Scatter data={positionScatterData} fill={LC_COLORS.primary} />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <SectionTitle 
        title="📊 进阶统计" 
        explanation="交叉分析在线人数区间与难度的关系，探索不同维度之间的关联性"
        style={{ marginTop: 24 }}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<CardTitle title="在线人数区间与难度交叉分析" explanation="分析不同在线人数区间内各难度题目的分布" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={onlineRangeDifficultyData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip />
                <Bar dataKey="easy" name="Easy" stackId="a" fill={DIFFICULTY_COLORS.easy} />
                <Bar dataKey="medium" name="Medium" stackId="a" fill={DIFFICULTY_COLORS.medium} />
                <Bar dataKey="hard" name="Hard" stackId="a" fill={DIFFICULTY_COLORS.hard} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<CardTitle title="Top 10 热门题目（三站对比）" explanation="当前最热门的10道题目，对比三站数据" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10Data} layout="vertical">
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis type="number" stroke={CHART_CONFIG.axisStroke} />
                <YAxis dataKey="name" type="category" width={120} stroke={CHART_CONFIG.axisStroke} />
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
    </>
  );
};

export default RankingSection;
