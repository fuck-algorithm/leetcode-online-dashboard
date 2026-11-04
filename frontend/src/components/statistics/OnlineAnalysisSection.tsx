import React from 'react';
import { LineChartOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Problem } from '../../types';
import {
  getOnlineDistribution,
  getDifficultyOnlineData,
  getPositionOnlineData,
  getDifficultyScatterData,
  getRecentlyActive
} from './dataUtils';
import { SITE_COLORS, LC_COLORS, CHART_CONFIG } from './chartTheme';
import { DocSection } from '../docs/DocSection';
import { ChartGrid, ChartPanel, CHART_UI } from '../dataPage/ChartPanel';

interface OnlineAnalysisSectionProps {
  problems: Problem[];
}

const axisTick = CHART_CONFIG.axisTick;
const legendStyle = CHART_CONFIG.legendStyle;
const cursorStyle = { fill: 'rgba(212, 160, 23, 0.06)' };

const OnlineAnalysisSection: React.FC<OnlineAnalysisSectionProps> = ({ problems }) => {
  const onlineDistribution = getOnlineDistribution(problems);
  const difficultyOnlineData = getDifficultyOnlineData(problems);
  const positionOnlineData = getPositionOnlineData(problems);
  const difficultyScatterData = getDifficultyScatterData(problems);
  const recentlyActive = getRecentlyActive(problems);

  return (
    <DocSection
      id="stat-online"
      title="在线深度分析"
      icon={<LineChartOutlined />}
      desc="在线人数区间、难度与题目的关联特征"
    >
      <ChartGrid columns={3}>
        <ChartPanel
          title="在线人数区间分布"
          desc="按在线人数区间统计题目数量，了解整体分布"
          height={280}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={onlineDistribution} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
              <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
              <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} formatter={(value) => [`${value} 题`, '题目数']} />
              <Bar dataKey="count" fill={LC_COLORS.primary} radius={CHART_CONFIG.barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="难度与平均在线人数"
          desc="不同难度题目的平均在线人数，对比三个站点"
          height={280}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={difficultyOnlineData} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
              <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
              <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="avgCN" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
              <Bar dataKey="avgCOM" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
              <Bar dataKey="avgTotal" name="总数" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="前 20 题在线人数"
          desc="按 Hot 100 顺序展示前 20 题的三站在线人数"
          height={280}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={positionOnlineData} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
              <XAxis dataKey="position" interval={2} stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
              <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="cn" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
              <Bar dataKey="com" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
              <Bar dataKey="total" name="总数" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </ChartGrid>

      <div className="lc-doc-subtitle" style={{ marginTop: 18 }}>关联与活跃度</div>

      <ChartGrid columns={2}>
        <ChartPanel
          title="难度与在线人数散点"
          desc="每道题按难度展开，观察难度与在线人数是否存在明显规律"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 18, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
              <XAxis
                dataKey="difficultyValue"
                type="number"
                domain={[0.5, 3.5]}
                ticks={[1, 2, 3]}
                tickFormatter={(v) => v === 1 ? 'Easy' : v === 2 ? 'Medium' : 'Hard'}
                stroke={CHART_CONFIG.axisStroke}
                tick={axisTick}
                tickMargin={8}
              />
              <YAxis dataKey="online" name="在线人数" stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <ZAxis range={[45, 45]} />
              <Tooltip
                contentStyle={CHART_UI.tooltip}
                cursor={{ strokeDasharray: '3 3', stroke: CHART_CONFIG.axisStroke }}
                formatter={(value, name) => {
                  if (name === 'difficultyValue') return [value === 1 ? 'Easy' : value === 2 ? 'Medium' : 'Hard', '难度'];
                  if (name === 'online') return [`${value} 人`, '在线人数'];
                  return [value, name];
                }}
              />
              <Scatter data={difficultyScatterData} fill={LC_COLORS.primary} fillOpacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="最近活跃题目 Top 10"
          desc="按最后更新时间排序的 10 道题目及其当前在线人数"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recentlyActive} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} horizontal={false} />
              <XAxis type="number" stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <YAxis dataKey="name" type="category" width={118} stroke={CHART_CONFIG.axisStroke} tick={{ ...axisTick, width: 110 }} />
              <Tooltip
                contentStyle={CHART_UI.tooltip}
                cursor={cursorStyle}
                formatter={(value) => [`${value} 人`, '在线人数']}
              />
              <Bar dataKey="online" fill={LC_COLORS.hard} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </ChartGrid>
    </DocSection>
  );
};

export default OnlineAnalysisSection;
