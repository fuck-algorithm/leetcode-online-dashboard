import React from 'react';
import { AimOutlined, PercentageOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
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
import { DocSection } from '../docs/DocSection';
import { ChartGrid, ChartPanel, CHART_UI } from '../dataPage/ChartPanel';

interface AcceptanceStatsSectionProps {
  problems: Problem[];
}

const axisTick = CHART_CONFIG.axisTick;
const legendStyle = CHART_CONFIG.legendStyle;
const cursorStyle = { fill: 'rgba(212, 160, 23, 0.06)' };

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
      <DocSection
        id="stat-acceptance"
        title="通过率分析"
        icon={<PercentageOutlined />}
        desc="通过率分布、难度差异与付费题表现"
      >
        <ChartGrid columns={3}>
          <ChartPanel
            title="通过率分布"
            desc="不同通过率区间的题目数量分布"
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={acceptanceDistribution} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
                <XAxis dataKey="range" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
                <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
                <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} formatter={(value) => [`${value} 题`, '题目数']} />
                <Bar dataKey="count" fill={LC_COLORS.easy} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="难度与平均通过率"
            desc="不同难度题目的平均通过率"
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyAcceptanceData} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
                <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
                <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
                <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} formatter={(value) => [`${value}%`, '平均通过率']} />
                <Bar dataKey="avgAcceptance" fill={LC_COLORS.primary} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="付费 / 免费平均在线"
            desc="付费与免费题目的平均在线人数，对比三个站点"
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={premiumOnlineData} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
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
        </ChartGrid>
      </DocSection>

      <DocSection
        id="stat-features"
        title="统计特征"
        icon={<AimOutlined />}
        desc="在线人数的分位数、集中度与离散程度"
      >
        <ChartGrid columns={4}>
          <ChartPanel
            title="在线人数分位数"
            desc="P25 / P50 / P75 / P90 分位数"
            height={250}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={percentileData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
                <XAxis dataKey="name" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
                <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
                <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} formatter={(value) => [`${value} 人`, '在线人数']} />
                <Bar dataKey="value" fill={LC_COLORS.primary} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="在线人数集中度"
            desc="在线人数在 Top 5 / 10 / 20 与其他题目之间的占比"
            height={250}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={concentrationData}
                  cx="50%"
                  cy="48%"
                  innerRadius={36}
                  outerRadius={62}
                  paddingAngle={2}
                  dataKey="percentage"
                >
                  {concentrationData.map((_, index) => (
                    <Cell key={`cell-conc-${index}`} fill={[LC_COLORS.hard, LC_COLORS.medium, LC_COLORS.primary, LC_COLORS.easy][index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_UI.tooltip} formatter={(value) => [`${value}%`, '占比']} />
                <Legend wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="在线人数离散程度"
            desc="方差与标准差衡量在线人数的离散程度"
            height={250}
          >
            <div className="lc-metric-list">
              <div className="lc-metric-item">
                <span className="lc-metric-label">方差</span>
                <span className="lc-metric-value">{variance.toLocaleString()}<em>人²</em></span>
              </div>
              <div className="lc-metric-item">
                <span className="lc-metric-label">标准差</span>
                <span className="lc-metric-value">{stdDev.toLocaleString()}<em>人</em></span>
              </div>
            </div>
          </ChartPanel>

          <ChartPanel
            title="变异系数（按难度）"
            desc="各难度在线人数的变异系数，衡量相对离散程度"
            height={250}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cvData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
                <XAxis dataKey="difficulty" stroke={CHART_CONFIG.axisStroke} tick={axisTick} tickMargin={8} />
                <YAxis stroke={CHART_CONFIG.axisStroke} tick={axisTick} />
                <Tooltip contentStyle={CHART_UI.tooltip} cursor={cursorStyle} formatter={(value) => [`${value}%`, '变异系数']} />
                <Bar dataKey="cv" fill={LC_COLORS.medium} radius={CHART_CONFIG.barRadius} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </ChartGrid>
      </DocSection>
    </>
  );
};

export default AcceptanceStatsSection;
