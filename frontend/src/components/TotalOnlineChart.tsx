import React, { useEffect, useState, useCallback } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { Spin, Empty } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';

interface DataPoint {
  timestamp: string;
  total: number;
}

interface TotalOnlineChartProps {
  refreshInterval?: number; // in milliseconds, default 60000 (1 minute)
}

const TotalOnlineChart: React.FC<TotalOnlineChartProps> = ({ 
  refreshInterval = 60000 
}) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/total-online-history?hours=24');
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('API接口暂不可用（本地开发环境）');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API返回格式错误');
      }
      
      const text = await response.text();
      if (!text) {
        throw new Error('API返回空数据');
      }
      
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error('API返回格式错误');
      }
      
      if (result.code === 200 && result.data) {
        // Transform data for chart - 后端返回的数据在result.data中
        const dataArray = result.data.data || result.data;
        const chartData = dataArray.map((point: any) => ({
          timestamp: new Date(point.timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }),
          total: point.total,
          rawTimestamp: new Date(point.timestamp)
        }));
        setData(chartData);
        setError(null);
      } else {
        throw new Error(result.msg || 'Invalid data format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Set up interval for auto-refresh
    const interval = setInterval(fetchData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#fff',
          padding: '12px 16px',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#262626' }}>
            {label}
          </p>
          <p style={{ margin: 0, color: '#FFA116', fontWeight: 700, fontSize: 16 }}>
            {payload[0].value.toLocaleString()} 人
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ 
        height: 300, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" tip="加载数据中..." />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty 
          description={error || "暂无数据"} 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  // Calculate statistics - 过滤掉0值（服务重启时可能产生的无效数据）
  const maxOnline = Math.max(...data.map(d => d.total));
  const nonZeroData = data.filter(d => d.total > 0);
  const minOnline = nonZeroData.length > 0 ? Math.min(...nonZeroData.map(d => d.total)) : 0;
  const avgOnline = Math.round(data.reduce((sum, d) => sum + d.total, 0) / data.length);

  return (
    <div>
      {/* Statistics cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 16, 
        marginBottom: 24 
      }}>
        <div style={{
          background: '#FFA116',
          padding: 16,
          borderRadius: 0,
          color: '#fff'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>最高在线</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{maxOnline.toLocaleString()}</div>
        </div>
        <div style={{
          background: '#FFB84D',
          padding: 16,
          borderRadius: 0,
          color: '#fff'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>平均在线</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{avgOnline.toLocaleString()}</div>
        </div>
        <div style={{
          background: '#FF8C00',
          padding: 16,
          borderRadius: 0,
          color: '#fff'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>最低在线</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{minOnline.toLocaleString()}</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFA116" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#FFA116" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#8c8c8c"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#e8e8e8' }}
              minTickGap={30}
            />
            <YAxis 
              stroke="#8c8c8c"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#e8e8e8' }}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#FFA116"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorTotal)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div style={{ 
        marginTop: 16, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: 8,
        fontSize: 13,
        color: '#8c8c8c'
      }}>
        <LineChartOutlined style={{ color: '#FFA116' }} />
        <span>最近24小时总在线人数趋势（每分钟更新）</span>
      </div>
    </div>
  );
};

export default TotalOnlineChart;
