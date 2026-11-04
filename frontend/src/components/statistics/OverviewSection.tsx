import React from 'react';
import {
  ChromeOutlined,
  DashboardOutlined,
  FundOutlined,
  GlobalOutlined,
  PieChartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
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
import { LC_COLORS, SITE_COLORS, DIFFICULTY_COLORS, CHART_CONFIG } from './chartTheme';
import { DocSection } from '../docs/DocSection';
import { ChartGrid, ChartPanel, StatRow, StatTile, CHART_UI } from '../dataPage/ChartPanel';

interface OverviewSectionProps {
  problems: Problem[];
}

const axisTick = CHART_CONFIG.axisTick;
const legendStyle = CHART_CONFIG.legendStyle;

const OverviewSection: React.FC<OverviewSectionProps> = ({ problems }) => {
  const difficultyData = getDifficultyData(problems);
  const onlineDistribution = getOnlineDistribution(problems);
  const headConcentrationData = getHeadConcentrationData(problems);
  const paretoData = getParetoData(problems);
  const { giniTotal, giniCN, giniCOM } = getGiniData(problems);
  const totalOnlineCN = getTotalOnlineCN(problems);
  const totalOnlineCOM = getTotalOnlineCOM(problems);
  const totalOnline = getTotalOnline(problems);

  const giniRows = [
    { label: '中文站', value: giniCN, color: SITE_COLORS.cn },
    { label: '国际站', value: giniCOM, color: SITE_COLORS.com },
    { label: '全球', value: giniTotal, color: SITE_COLORS.total },
  ];

  return (
    <>
      <DocSection
        id="stat-overview"
        title="总体概览"
        icon={<DashboardOutlined />}
        desc="当前 Hot 100 各站点在线人数与总趋势"
      >
        <StatRow>
          <StatTile
            tone="cn"
            icon={<ChromeOutlined />}
            label="中文站在线"
            value={totalOnlineCN.toLocaleString()}
            hint="leetcode.cn"
          />
          <StatTile
            tone="com"
            icon={<GlobalOutlined />}
            label="国际站在线"
            value={totalOnlineCOM.toLocaleString()}
            hint="leetcode.com"
          />
          <StatTile
            tone="total"
            icon={<TeamOutlined />}
            label="全球总在线"
            value={totalOnline.toLocaleString()}
            hint="中文站 + 国际站"
          />
        </StatRow>

        <TotalOnlineAggregateChart />
      </DocSection>

      <DocSection
        id="stat-distribution"
        title="分布分析"
        icon={<PieChartOutlined />}
        desc="题目难度构成与在线人数区间分布"
      >
        <ChartGrid columns={2}>
          <ChartPanel
            title="难度分布"
            desc="Easy / Medium / Hard 三种难度的题目数量占比"
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={difficultyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill={DIFFICULTY_COLORS.easy} />
                  <Cell fill={DIFFICULTY_COLORS.medium} />
                  <Cell fill={DIFFICULTY_COLORS.hard} />
                </Pie>
                <Tooltip contentStyle={CHART_UI.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="在线人数分布（三站对比）"
            desc="不同在线人数区间的题目数量，对比中文站、国际站与总数"
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={onlineDistribution} margin={{ top: 4, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
                <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
                <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
                <Tooltip contentStyle={CHART_UI.tooltip} cursor={{ fill: 'rgba(212, 160, 23, 0.06)' }} />
                <Legend wrapperStyle={legendStyle} />
                <Bar dataKey="cn" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="com" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="count" name="总数" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </ChartGrid>
      </DocSection>

      <DocSection
        id="stat-concentration"
        title="头部集中度"
        icon={<FundOutlined />}
        desc="在线人数是否集中在少数热门题目"
      >
        <ChartGrid columns={3}>
          <ChartPanel
            title="头部题目占比"
            desc="Top 10 / 20 / 30 题目在线人数占总在线人数的百分比"
            height={270}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={headConcentrationData} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
                <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
                <Tooltip contentStyle={CHART_UI.tooltip} cursor={{ fill: 'rgba(212, 160, 23, 0.06)' }} formatter={(value: number) => [`${value}%`, '占比']} />
                <Legend wrapperStyle={legendStyle} />
                <Bar dataKey="cn" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="com" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
                <Bar dataKey="total" name="全球" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="帕累托分析"
            desc="前 30 题累计在线人数占比，用于验证二八定律"
            height={270}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paretoData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
                <XAxis dataKey="rank" label={{ value: '题目排名', position: 'insideBottom', offset: -2, fontSize: 11, fill: CHART_UI.tick }} stroke={CHART_CONFIG.axisStroke} tick={axisTick} interval={4} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
                <Tooltip
                  contentStyle={CHART_UI.tooltip}
                  formatter={(value: number, name: string) => {
                    if (name === 'cumulative') return [`${value}%`, '累计占比'];
                    return [value, '在线人数'];
                  }}
                />
                <Area type="monotone" dataKey="cumulative" stroke={LC_COLORS.primary} fill={LC_COLORS.primary} fillOpacity={CHART_CONFIG.areaOpacity} strokeWidth={2} name="累计占比" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="基尼系数"
            desc="衡量在线人数分布的不均匀程度，0 = 完全均匀，1 = 完全集中"
            height={270}
          >
            <div className="lc-gini-list">
              {giniRows.map((row) => (
                <div className="lc-gini-row" key={row.label}>
                  <div className="lc-gini-line">
                    <span className="lc-gini-name">{row.label}</span>
                    <span className="lc-gini-value">{row.value.toFixed(3)}</span>
                  </div>
                  <div className="lc-gini-track">
                    <div className="lc-gini-fill" style={{ width: `${Math.min(row.value * 100, 100)}%`, background: row.color }} />
                  </div>
                </div>
              ))}
              <div className="lc-gini-note">0 = 完全均匀，1 = 完全集中</div>
            </div>
          </ChartPanel>
        </ChartGrid>
      </DocSection>
    </>
  );
};

export default OverviewSection;
