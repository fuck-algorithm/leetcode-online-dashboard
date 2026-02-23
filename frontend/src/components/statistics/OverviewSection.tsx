import React from 'react';
import { Card, Row, Col, Statistic, Divider } from 'antd';
import { ChromeOutlined, GlobalOutlined, TeamOutlined } from '@ant-design/icons';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { SectionTitle, CardTitle } from './shared';
import { Problem } from '../../types';
import { 
  getDifficultyData, 
  getOnlineDistribution, 
  getHeadConcentrationData, 
  getParetoData, 
  getGiniData,
  getTotalOnlineCN,
  getTotalOnlineCOM,
  getTotalOnline
} from './dataUtils';
import TotalOnlineAggregateChart from '../TotalOnlineAggregateChart';
import { LC_COLORS, SITE_COLORS, DIFFICULTY_COLORS, GRADIENTS, CHART_CONFIG } from './chartTheme';

interface OverviewSectionProps {
  problems: Problem[];
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ problems }) => {
  const difficultyData = getDifficultyData(problems);
  const onlineDistribution = getOnlineDistribution(problems);
  const headConcentrationData = getHeadConcentrationData(problems);
  const paretoData = getParetoData(problems);
  const { giniTotal, giniCN, giniCOM } = getGiniData(problems);
  const totalOnlineCN = getTotalOnlineCN(problems);
  const totalOnlineCOM = getTotalOnlineCOM(problems);
  const totalOnline = getTotalOnline(problems);

  return (
    <>
      <SectionTitle 
        title="📊 总体概览" 
        explanation="展示中文站、国际站和全球总的在线人数统计，帮助快速了解当前刷题热度分布"
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ textAlign: 'center', background: GRADIENTS.cn, border: 'none' }}>
            <Statistic 
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>中文站在线</span>} 
              value={totalOnlineCN} 
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}
              prefix={<ChromeOutlined style={{ color: 'rgba(255,255,255,0.85)' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ textAlign: 'center', background: GRADIENTS.com, border: 'none' }}>
            <Statistic 
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>国际站在线</span>} 
              value={totalOnlineCOM} 
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}
              prefix={<GlobalOutlined style={{ color: 'rgba(255,255,255,0.85)' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ textAlign: 'center', background: GRADIENTS.total, border: 'none' }}>
            <Statistic 
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>全球总在线</span>} 
              value={totalOnline} 
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}
              prefix={<TeamOutlined style={{ color: 'rgba(255,255,255,0.85)' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <SectionTitle 
        title="📊 总在线人数趋势" 
        explanation="展示三个站点在线人数随时间的变化趋势，可选择不同时间粒度（分钟/小时/天）进行分析"
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <TotalOnlineAggregateChart />
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <SectionTitle 
        title="📈 分布分析" 
        explanation="分析题目难度分布和在线人数分布情况，了解不同区间在线人数的题目数量分布"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<CardTitle title="难度分布" explanation="展示Easy/Medium/Hard三种难度的题目数量占比" />}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={difficultyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill={DIFFICULTY_COLORS.easy} />
                  <Cell fill={DIFFICULTY_COLORS.medium} />
                  <Cell fill={DIFFICULTY_COLORS.hard} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<CardTitle title="在线人数分布（三站对比）" explanation="展示不同在线人数区间的题目数量分布，对比三站数据" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={onlineDistribution}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} />
                <YAxis stroke={CHART_CONFIG.axisStroke} />
                <Tooltip />
                <Legend />
                <Bar dataKey="cn" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="com" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="count" name="总数" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <SectionTitle 
        title="🎯 头部集中度分析" 
        explanation="分析在线人数是否集中在少数热门题目。头部占比越高、基尼系数越大，说明用户越集中在刷热门题目"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title={<CardTitle title="头部题目占比（三站对比）" explanation="Top 10/20/30题目在线人数占总人数的百分比，占比越高说明越集中" />}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={headConcentrationData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value: number) => [`${value}%`, '占比']} />
                <Legend />
                <Bar dataKey="cn" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="com" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="total" name="全球" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={<CardTitle title="帕累托分析（累计占比曲线）" explanation="展示前30题的累计在线人数占比，验证二八定律" />}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={paretoData}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
                <XAxis dataKey="rank" label={{ value: '题目排名', position: 'insideBottom', offset: -5 }} stroke={CHART_CONFIG.axisStroke} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke={CHART_CONFIG.axisStroke} />
                <Tooltip formatter={(value: number, name: string) => {
                  if (name === 'cumulative') return [`${value}%`, '累计占比'];
                  return [value, '在线人数'];
                }} />
                <Area type="monotone" dataKey="cumulative" stroke={LC_COLORS.primary} fill={LC_COLORS.primary} fillOpacity={CHART_CONFIG.areaOpacity} name="累计占比" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title={<CardTitle title="基尼系数（分布不均匀度）" explanation="衡量在线人数分布的不均匀程度，0=完全均匀，1=完全集中" />}>
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Statistic title="中文站" value={giniCN.toFixed(3)} valueStyle={{ color: SITE_COLORS.cn, fontSize: 24 }} />
              <Divider style={{ margin: '12px 0' }} />
              <Statistic title="国际站" value={giniCOM.toFixed(3)} valueStyle={{ color: SITE_COLORS.com, fontSize: 24 }} />
              <Divider style={{ margin: '12px 0' }} />
              <Statistic title="全球" value={giniTotal.toFixed(3)} valueStyle={{ color: SITE_COLORS.total, fontSize: 24 }} />
              <div style={{ marginTop: 16, fontSize: 12, color: LC_COLORS.textMuted }}>
                0=完全均匀，1=完全集中
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default OverviewSection;
