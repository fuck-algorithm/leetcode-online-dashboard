import React from 'react';
import { Card, Row, Col, Statistic, Divider } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { SectionTitle, CardTitle } from './shared';
import { Problem } from '../../types';
import { 
  getAcceptanceDistribution, 
  getDifficultyAcceptanceData, 
  getPremiumOnlineData, 
  getPercentileData, 
  getConcentrationData, 
  getVarianceData, 
  getCvData 
} from './dataUtils';
import { SITE_COLORS, LC_COLORS, CHART_CONFIG } from './chartTheme';

interface AcceptanceStatsSectionProps {
  problems: Problem[];
}

const AcceptanceStatsSection: React.FC<AcceptanceStatsSectionProps> = ({ problems }) => {
  const acceptanceDistribution = getAcceptanceDistribution(problems);
  const difficultyAcceptanceData = getDifficultyAcceptanceData(problems);
  const premiumOnlineData = getPremiumOnlineData(problems);
  const percentileData = getPercentileData(problems);
  const concentrationData = getConcentrationData(problems);
  const { variance, stdDev } = getVarianceData(problems);
  const cvData = getCvData(problems);

  return (
    <>
      <SectionTitle 
        title="🎯 通过率与难度深度分析" 
        explanation="分析题目通过率分布、付费/免费平均在线对比，探索通过率与在线人数的关系"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="通过率分布" explanation="展示不同通过率区间的题目数量分布" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={acceptanceDistribution}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value) => [`${value}题`, '题目数']} />
                <Bar dataKey="count" fill={LC_COLORS.easy} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="难度与平均通过率" explanation="不同难度题目的平均通过率" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={difficultyAcceptanceData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value) => [`${value}%`, '平均通过率']} />
                <Bar dataKey="avgAcceptance" fill={LC_COLORS.primary} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="付费/免费平均在线对比（三站）" explanation="付费和免费题目的平均在线人数对比" />}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={premiumOnlineData}>
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
      </Row>

      <SectionTitle 
        title="📊 在线人数统计特征分析" 
        explanation="展示在线人数的分位数、分布偏度等统计特征，帮助理解在线人数的整体分布形态"
        style={{ marginTop: 24 }}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <Card title={<CardTitle title="在线人数分位数" explanation="展示在线人数的P25/P50/P75/P90等分位数" />}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={percentileData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value) => [`${value}人`, '在线人数']} />
                <Bar dataKey="value" fill={LC_COLORS.primary} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title={<CardTitle title="在线人数集中度" explanation="展示在线人数集中在哪些区间" />}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={concentrationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="percentage"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {concentrationData.map((_, index) => (
                  <Cell key={`cell-conc-${index}`} fill={[LC_COLORS.hard, LC_COLORS.medium, LC_COLORS.primary, LC_COLORS.easy][index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, '占比']} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title={<CardTitle title="在线人数离散程度" explanation="通过方差、标准差衡量在线人数的离散程度" />}>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Statistic title="方差" value={variance} suffix="人²" valueStyle={{ color: LC_COLORS.primary, fontSize: 24 }} />
              <Divider style={{ margin: '16px 0' }} />
              <Statistic title="标准差" value={stdDev} suffix="人" valueStyle={{ color: LC_COLORS.easy, fontSize: 24 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title={<CardTitle title="变异系数 (按难度)" explanation="各难度在线人数的变异系数，衡量相对离散程度" />}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cvData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="difficulty" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value) => [`${value}%`, '变异系数']} />
                <Bar dataKey="cv" fill={LC_COLORS.medium} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default AcceptanceStatsSection;
