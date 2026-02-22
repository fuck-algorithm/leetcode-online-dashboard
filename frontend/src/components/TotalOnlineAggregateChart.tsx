import React, { useState, useEffect, useCallback } from 'react';
import { Card, DatePicker, Radio, Button, Spin, Empty, message } from 'antd';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

type Granularity = 'minute' | 'hour' | 'day';

interface DataPoint {
  timestamp: string;
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

      const response = await fetch(`/api/total-online-aggregate?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { code: number; data?: AggregateData; msg?: string } = await response.json();

      if (result.code === 200 && result.data?.data) {
        const chartData = result.data.data.map((point) => ({
          timestamp: formatTimestamp(point.timestamp, granularity),
          total: point.total,
          rawTimestamp: new Date(point.timestamp),
        }));
        setData(chartData);
      } else {
        throw new Error(result.msg || '数据格式错误');
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
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>总在线人数趋势</span>
          
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
            style={{ width: 320 }}
            size="small"
          />
          
          <Button icon={<ReloadOutlined />} onClick={fetchData} size="small" loading={loading}>
            刷新
          </Button>
        </div>
      }
    >
      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />
      ) : data.length === 0 ? (
        <Empty description="暂无数据" style={{ margin: '40px 0' }} />
      ) : (
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFA116" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFA116" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 12 }}
                tickMargin={10}
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                formatter={(value: number) => [value.toLocaleString() + ' 人', '总在线人数']}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#FFA116"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTotal)"
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

export default TotalOnlineAggregateChart;
