import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { ChartDataPoint, HourAverageDataPoint } from './types';

interface TrendChartProps {
  data: ChartDataPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => (
  <ResponsiveContainer width="100%" height={400}>
    <AreaChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#3e3e3e" />
      <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#b0b0b0' }} stroke="#3e3e3e" interval="preserveStartEnd" />
      <YAxis tick={{ fill: '#b0b0b0' }} stroke="#3e3e3e" />
      <Tooltip 
        contentStyle={{ background: '#282828', border: '1px solid #3e3e3e', color: '#fff' }}
        formatter={(value: number, name: string) => {
          if (name === 'countCN') return [`${value}人`, '中文站'];
          if (name === 'countCOM') return [`${value}人`, '国际站'];
          if (name === 'countTotal') return [`${value}人`, '汇总'];
          return [value, name];
        }}
      />
      <Legend 
        wrapperStyle={{ color: '#fff' }}
        formatter={(value: string) => {
          if (value === 'countCN') return '中文站';
          if (value === 'countCOM') return '国际站';
          if (value === 'countTotal') return '汇总';
          return value;
        }}
      />
      <Area 
        type="monotone" 
        dataKey="countCN" 
        name="countCN"
        stroke="#ff4d4f" 
        fill="#ff4d4f" 
        fillOpacity={0.3}
      />
      <Area 
        type="monotone" 
        dataKey="countCOM" 
        name="countCOM"
        stroke="#1890ff" 
        fill="#1890ff" 
        fillOpacity={0.3}
      />
      <Area 
        type="monotone" 
        dataKey="countTotal" 
        name="countTotal"
        stroke="#ffa116" 
        fill="#ffa116" 
        fillOpacity={0.3}
      />
    </AreaChart>
  </ResponsiveContainer>
);

interface HourlyChartProps {
  data: HourAverageDataPoint[];
}

export const HourlyChart: React.FC<HourlyChartProps> = ({ data }) => (
  <>
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3e3e3e" />
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: 12, fill: '#b0b0b0' }} 
          stroke="#3e3e3e" 
        />
        <YAxis tick={{ fill: '#b0b0b0' }} stroke="#3e3e3e" />
        <Tooltip 
          contentStyle={{ background: '#282828', border: '1px solid #3e3e3e', color: '#fff' }}
          formatter={(value: number, name: string) => {
            if (name === 'avgCountCN') return [`${value}人`, '中文站平均'];
            if (name === 'avgCountCOM') return [`${value}人`, '国际站平均'];
            return [value, name];
          }}
        />
        <Legend 
          wrapperStyle={{ color: '#fff' }}
          formatter={(value: string) => {
            if (value === 'avgCountCN') return '中文站';
            if (value === 'avgCountCOM') return '国际站';
            return value;
          }}
        />
        <Bar dataKey="avgCountCN" name="avgCountCN" fill="#ff4d4f" />
        <Bar dataKey="avgCountCOM" name="avgCountCOM" fill="#1890ff" />
      </BarChart>
    </ResponsiveContainer>
    <div style={{ textAlign: 'center', color: 'var(--lc-text-secondary)', fontSize: 12, marginTop: 8 }}>
      统计所选时间段内每天24小时各小时的平均在线人数，展示刷题高峰时段（中文站 vs 国际站）
    </div>
  </>
);
