import React, { useState, useEffect, useCallback } from 'react';
import { DatePicker, Radio, Button, Spin, Empty, message } from 'antd';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { SITE_COLORS, CHART_CONFIG } from './statistics/chartTheme';
import { ChartPanel } from './dataPage/ChartPanel';

const { RangePicker } = DatePicker;

type Granularity = 'minute' | 'hour' | 'day';

interface DataPoint {
  timestamp: string;
  cn: number;
  com: number;
  total: number;
  rawTimestamp: Date;
}

interface AggregateData {
  granularity: Granularity;
  start_time: string;
  end_time: string;
  points: number;
  data: Array<{
    timestamp: string;
    total: number;
  }>;
}

interface AggregateDataPoint {
  timestamp: string;
  total: number;
}

const TotalOnlineAggregateChart: React.FC = () => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>('hour');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const end = dateRange?.[1] || dayjs();
      const start = dateRange?.[0] || dayjs().subtract(7, 'days');

      // Validate max 1 year range
      if (end.diff(start, 'days') > 365) {
        message.error('时间范围不能超过1年');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        granularity,
        start: start.toISOString(),
        end: end.toISOString(),
      });

      // Fetch all three sites in parallel
      const [cnRes, comRes, unifiedRes] = await Promise.all([
        fetch(`/api/total-online-aggregate?${params}&site=cn`),
        fetch(`/api/total-online-aggregate?${params}&site=com`),
        fetch(`/api/total-online-aggregate?${params}&site=unified`),
      ]);

      if (!cnRes.ok || !comRes.ok || !unifiedRes.ok) {
        throw new Error('HTTP error');
      }

      const cnData: { code: number; data?: AggregateData } = await cnRes.json();
      const comData: { code: number; data?: AggregateData } = await comRes.json();
      const unifiedData: { code: number; data?: AggregateData } = await unifiedRes.json();

      if (cnData.code === 200 && comData.code === 200 && unifiedData.code === 200) {
        // Create a map to merge data by timestamp
        const dataMap = new Map<string, { cn: number; com: number; total: number; rawTimestamp: Date }>();
        
        const processPoints = (points: AggregateDataPoint[] | undefined, key: 'cn' | 'com' | 'total') => {
          if (!points) return;
          points.forEach((point) => {
            const formattedTs = formatTimestamp(point.timestamp, granularity);
            const existing = dataMap.get(formattedTs) || { cn: 0, com: 0, total: 0, rawTimestamp: new Date(point.timestamp) };
            existing[key] = point.total;
            dataMap.set(formattedTs, existing);
          });
        };

        processPoints(cnData.data?.data, 'cn');
        processPoints(comData.data?.data, 'com');
        processPoints(unifiedData.data?.data, 'total');

        // Convert map to array and sort by timestamp
        const chartData = Array.from(dataMap.entries())
          .map(([timestamp, values]) => ({
            timestamp,
            ...values,
          }))
          .sort((a, b) => a.rawTimestamp.getTime() - b.rawTimestamp.getTime());

        setData(chartData);
      } else {
        throw new Error('数据格式错误');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [granularity, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatTimestamp = (timestamp: string, granularity: Granularity): string => {
    const date = new Date(timestamp);
    switch (granularity) {
      case 'minute':
        return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      case 'hour':
        return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit' });
      case 'day':
        return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      default:
        return timestamp;
    }
  };

  const getMaxDate = () => dayjs();
  const getMinDate = () => dayjs().subtract(1, 'year');

  const disabledDate = (current: dayjs.Dayjs) => {
    return current && (current > getMaxDate() || current < getMinDate());
  };

  // Preset ranges
  const ranges = {
    '最近24小时': [dayjs().subtract(1, 'day'), dayjs()],
    '最近7天': [dayjs().subtract(7, 'days'), dayjs()],
    '最近30天': [dayjs().subtract(30, 'days'), dayjs()],
    '最近3个月': [dayjs().subtract(3, 'months'), dayjs()],
    '最近1年': [dayjs().subtract(1, 'year'), dayjs()],
  };

  return (
    <ChartPanel
      title="总在线人数趋势"
      desc="三个站点在线人数随时间的变化趋势，可切换分钟 / 小时 / 天粒度"
      height={340}
      extra={
        <>
          <Radio.Group
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
            size="small"
            options={[
              { label: '分钟', value: 'minute' },
              { label: '小时', value: 'hour' },
              { label: '天', value: 'day' },
            ]}
          />
          <RangePicker
            showTime={granularity === 'minute'}
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            disabledDate={disabledDate}
            maxDate={getMaxDate()}
            minDate={getMinDate()}
            presets={Object.entries(ranges).map(([label, range]) => ({ label, value: range as [dayjs.Dayjs, dayjs.Dayjs] }))}
            style={{ width: 300 }}
            size="small"
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} size="small" loading={loading}>
            刷新
          </Button>
        </>
      }
    >
      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '124px auto' }} />
      ) : data.length === 0 ? (
        <Empty description="暂无数据" style={{ margin: '96px 0' }} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 24, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCN" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SITE_COLORS.cn} stopOpacity={0.22} />
                <stop offset="95%" stopColor={SITE_COLORS.cn} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCOM" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SITE_COLORS.com} stopOpacity={0.22} />
                <stop offset="95%" stopColor={SITE_COLORS.com} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SITE_COLORS.total} stopOpacity={0.22} />
                <stop offset="95%" stopColor={SITE_COLORS.total} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={CHART_CONFIG.gridStrokeDasharray} stroke={CHART_CONFIG.gridStroke} vertical={false} />
            <XAxis
              dataKey="timestamp"
              tick={CHART_CONFIG.axisTick}
              tickMargin={10}
              minTickGap={30}
              stroke={CHART_CONFIG.axisStroke}
            />
            <YAxis
              tick={CHART_CONFIG.axisTick}
              tickFormatter={(value) => value.toLocaleString()}
              stroke={CHART_CONFIG.axisStroke}
            />
            <Tooltip
              contentStyle={CHART_CONFIG.tooltipStyle}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { cn: '中文站', com: '国际站', total: '全球总在线' };
                return [value.toLocaleString() + ' 人', labels[name] || name];
              }}
            />
            <Legend wrapperStyle={CHART_CONFIG.legendStyle} />
            <Area
              type="monotone"
              dataKey="cn"
              name="中文站"
              stroke={SITE_COLORS.cn}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCN)"
              animationDuration={500}
            />
            <Area
              type="monotone"
              dataKey="com"
              name="国际站"
              stroke={SITE_COLORS.com}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCOM)"
              animationDuration={500}
            />
            <Area
              type="monotone"
              dataKey="total"
              name="全球总在线"
              stroke={SITE_COLORS.total}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorTotal)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
};

export default TotalOnlineAggregateChart;
