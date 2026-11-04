import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar } from 'recharts';
import { ChartDataPoint, HourAverageDataPoint } from './types';
import { SITE_COLORS } from '../statistics/chartTheme';
import { CHART_UI } from '../dataPage/ChartPanel';

const axisTick = { fontSize: 11.5, fill: CHART_UI.tick };
const legendStyle = { color: CHART_UI.legend.color, fontSize: CHART_UI.legend.fontSize };

interface TrendChartProps {
  data: ChartDataPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    {/* 汇总用浅色面积做背景，中文站/国际站用实线叠在上面：
        原来的三层面积填充互相遮挡，国际站曲线几乎看不见。 */}
    <ComposedChart data={data} margin={{ top: 8, right: 18, left: -6, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_UI.grid} vertical={false} />
      <XAxis dataKey="time" tick={axisTick} stroke={CHART_UI.axis} interval="preserveStartEnd" minTickGap={36} tickMargin={8} />
      <YAxis tick={axisTick} stroke={CHART_UI.axis} width={52} />
      <Tooltip
        contentStyle={CHART_UI.tooltip}
        formatter={(value: any, name: string) => {
          if (name === 'countCN') return [`${value} 人`, '中文站'];
          if (name === 'countCOM') return value === null ? ['无采集数据', '国际站'] : [`${value} 人`, '国际站'];
          if (name === 'countTotal') return [`${value} 人`, '汇总'];
          return [value, name];
        }}
      />
      <Legend
        wrapperStyle={legendStyle}
        formatter={(value: string) => {
          if (value === 'countCN') return '中文站';
          if (value === 'countCOM') return '国际站';
          if (value === 'countTotal') return '汇总';
          return value;
        }}
      />
      <Area
        type="monotone"
        dataKey="countTotal"
        name="countTotal"
        stroke={SITE_COLORS.total}
        fill={SITE_COLORS.total}
        fillOpacity={0.12}
        strokeWidth={2}
      />
      <Line
        type="monotone"
        dataKey="countCN"
        name="countCN"
        stroke={SITE_COLORS.cn}
        strokeWidth={2}
        dot={false}
        connectNulls
      />
      <Line
        type="monotone"
        dataKey="countCOM"
        name="countCOM"
        stroke={SITE_COLORS.com}
        strokeWidth={2}
        dot={false}
        connectNulls={false}
      />
    </ComposedChart>
  </ResponsiveContainer>
);

interface HourlyChartProps {
  data: HourAverageDataPoint[];
}

export const HourlyChart: React.FC<HourlyChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 8, right: 18, left: -6, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_UI.grid} vertical={false} />
      <XAxis dataKey="time" tick={axisTick} stroke={CHART_UI.axis} tickMargin={8} />
      <YAxis tick={axisTick} stroke={CHART_UI.axis} width={52} />
      <Tooltip
        contentStyle={CHART_UI.tooltip}
        formatter={(value: number, name: string) => {
          if (name === 'avgCountCN') return [`${value} 人`, '中文站平均'];
          if (name === 'avgCountCOM') return [`${value} 人`, '国际站平均'];
          return [value, name];
        }}
      />
      <Legend
        wrapperStyle={legendStyle}
        formatter={(value: string) => {
          if (value === 'avgCountCN') return '中文站';
          if (value === 'avgCountCOM') return '国际站';
          return value;
        }}
      />
      <Bar dataKey="avgCountCN" name="avgCountCN" fill={SITE_COLORS.cn} radius={[2, 2, 0, 0]} />
      <Bar dataKey="avgCountCOM" name="avgCountCOM" fill={SITE_COLORS.com} radius={[2, 2, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);
