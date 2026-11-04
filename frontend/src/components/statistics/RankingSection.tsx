import React from 'react';
import { TrophyOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Problem } from '../../types';
import {
  getHighestOnlineProblems,
  getLowestOnlineProblems,
  getPositionScatterData,
  getOnlineRangeDifficultyData,
  getTop10Data
} from './dataUtils';
import { SITE_COLORS, LC_COLORS, DIFFICULTY_COLORS, CHART_CONFIG } from './chartTheme';
import { DocSection } from '../docs/DocSection';
import { ChartGrid, ChartPanel, CHART_UI } from '../dataPage/ChartPanel';

interface RankingSectionProps {
  problems: Problem[];
}

const axisTick = CHART_CONFIG.axisTick;
const legendStyle = CHART_CONFIG.legendStyle;
const cursorStyle = { fill: 'rgba(212, 160, 23, 0.06)' };
const categoryTick = { ...axisTick, width: 108 };

const RankingSection: React.FC<RankingSectionProps> = ({ problems }) => {
  const highestOnlineProblems = getHighestOnlineProblems(problems);
  const lowestOnlineProblems = getLowestOnlineProblems(problems);
  const positionScatterData = getPositionScatterData(problems);
  const onlineRangeDifficultyData = getOnlineRangeDifficultyData(problems);
  const top10Data = getTop10Data(problems);

  return (
    <DocSection
      id="stat-ranking"
      title="题目排行与进阶"
      icon={<TrophyOutlined />}
      desc="在线人数极值、题目位置与难度交叉分布"
    >
      <ChartGrid columns={3}>
        <ChartPanel
          title="在线人数最高 Top 10"
          desc="当前在线人数最多的 10 道题目"
          height={290}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={highestOnlineProblems} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} horizontal={false} />
              <XAxis type="number" stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <YAxis dataKey="name" type="category" width={118} stroke={CHART_CONFIG.axisStroke} tick={categoryTick} />
              <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} formatter={(value) => [`${value} 人`, '在线人数']} />
              <Bar dataKey="online" fill={SITE_COLORS.total} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="在线人数最低 Top 10"
          desc="当前在线人数最少的 10 道题目"
          height={290}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lowestOnlineProblems} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} horizontal={false} />
              <XAxis type="number" stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <YAxis dataKey="name" type="category" width={118} stroke={CHART_CONFIG.axisStroke} tick={categoryTick} />
              <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} formatter={(value) => [`${value} 人`, '在线人数']} />
              <Bar dataKey="online" fill={LC_COLORS.hard} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="题目位置与在线人数"
          desc="题目编号位置与当前在线人数的散点关系"
          height={290}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} />
              <XAxis dataKey="position" name="题目位置" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
              <YAxis dataKey="online" name="在线人数" stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <ZAxis range={[30, 30]} />
              <Tooltip
                contentStyle={CHART_UI.tooltip}
                cursor={{ strokeDasharray: '3 3', stroke: CHART_CONFIG.axisStroke }}
                formatter={(value, name) => {
                  if (name === 'position') return [`#${value}`, '题目位置'];
                  if (name === 'online') return [`${value} 人`, '在线人数'];
                  return [value, name];
                }}
              />
              <Scatter data={positionScatterData} fill={LC_COLORS.primary} fillOpacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartPanel>
      </ChartGrid>

      <div className="lc-doc-subtitle" style={{ marginTop: 18 }}>进阶统计</div>

      <ChartGrid columns={2}>
        <ChartPanel
          title="在线人数区间与难度交叉"
          desc="不同在线人数区间内 Easy / Medium / Hard 题目的堆叠分布"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={onlineRangeDifficultyData} margin={{ top: 4, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
              <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
              <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="easy" name="Easy" stackId="a" fill={DIFFICULTY_COLORS.easy} />
              <Bar dataKey="medium" name="Medium" stackId="a" fill={DIFFICULTY_COLORS.medium} />
              <Bar dataKey="hard" name="Hard" stackId="a" fill={DIFFICULTY_COLORS.hard} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Top 10 热门题目（三站对比）"
          desc="当前最热门的 10 道题目在中文站、国际站的在线人数"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10Data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} horizontal={false} />
              <XAxis type="number" stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
              <YAxis dataKey="name" type="category" width={118} stroke={CHART_CONFIG.axisStroke} tick={categoryTick} />
              <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="cn" name="中文站" fill={SITE_COLORS.cn} radius={CHART_CONFIG.barRadius} />
              <Bar dataKey="com" name="国际站" fill={SITE_COLORS.com} radius={CHART_CONFIG.barRadius} />
              <Bar dataKey="total" name="总数" fill={SITE_COLORS.total} radius={CHART_CONFIG.barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </ChartGrid>
    </DocSection>
  );
};

export default RankingSection;
