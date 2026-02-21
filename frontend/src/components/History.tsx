import React, { useState, useEffect, useMemo } from 'react';
import { Card, Select, DatePicker, Spin, message, Table, Button, Space, Row, Col } from 'antd';
import { Tabs } from 'antd';
const { TabPane } = Tabs;
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { fetchHot100, fetchOnlineCounts, exportData } from '../api';
import { Problem, OnlineCount } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import dayjs from 'dayjs';
import './History.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

const History: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { preferences, setPreference } = usePreferences();
  const [problems, setProblems] = useState<Problem[]>([]);
  
  // 使用持久化的值作为初始值，URL参数优先
  const problemIdFromUrl = searchParams.get('problemId');
  const initialProblem = problemIdFromUrl || preferences.historyProblemId;
  const [selectedProblem, setSelectedProblem] = useState<string | null>(initialProblem);
  
  // 解析持久化的时间范围，默认为24小时
  const initialTimeRange: [dayjs.Dayjs, dayjs.Dayjs] = preferences.historyTimeRange 
    ? [dayjs(preferences.historyTimeRange.split(',')[0]), dayjs(preferences.historyTimeRange.split(',')[1])] as [dayjs.Dayjs, dayjs.Dayjs]
    : [dayjs().subtract(24, 'hour'), dayjs()];
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(initialTimeRange);
  
  const [historyData, setHistoryData] = useState<OnlineCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: preferences.pageSize || 10 });
  const [activeTab, setActiveTab] = useState('trend');

  useEffect(() => {
    loadProblems();
  }, []);

  useEffect(() => {
    // 切换题目或时间范围时，重置分页到第一页
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [selectedProblem, timeRange]);

  // 保存用户选择的题目和时间范围到preferences
  useEffect(() => {
    if (selectedProblem) {
      setPreference('historyProblemId', selectedProblem);
    }
  }, [selectedProblem, setPreference]);

  useEffect(() => {
    const timeRangeStr = `${timeRange[0].toISOString()},${timeRange[1].toISOString()}`;
    setPreference('historyTimeRange', timeRangeStr);
  }, [timeRange, setPreference]);

  useEffect(() => {
    // 当选中题目时，自动加载历史数据
    if (selectedProblem) {
      loadHistory(selectedProblem);
    }
  }, [selectedProblem]);

  const loadProblems = async () => {
    try {
      const data = await fetchHot100();
      setProblems(data);
      
      // 优先使用 URL 参数中的 problemId，其次使用持久化的值，最后使用第一个题目
      const problemIdFromUrl = searchParams.get('problemId');
      const persistedProblemId = preferences.historyProblemId;
      
      if (problemIdFromUrl && data.some(p => String(p.frontend_id) === problemIdFromUrl)) {
        setSelectedProblem(problemIdFromUrl);
      } else if (persistedProblemId && data.some(p => String(p.frontend_id) === persistedProblemId)) {
        setSelectedProblem(persistedProblemId);
      } else if (data.length > 0) {
        setSelectedProblem(data[0].frontend_id);
      }
    } catch (error) {
      message.error('加载题目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (problemId: string) => {
    setChartLoading(true);
    try {
      const hours = timeRange ? timeRange[1].diff(timeRange[0], 'hour') : 24;
      const data = await fetchOnlineCounts(problemId, Math.min(hours * 2, 1000));
      setHistoryData(data);
    } catch (error) {
      message.error('加载历史数据失败');
    } finally {
      setChartLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const filters = {
        problemId: selectedProblem,
        startDate: timeRange?.[0].format('YYYY-MM-DD'),
        endDate: timeRange?.[1].format('YYYY-MM-DD'),
      };
      const data = await exportData(format, filters);
      
      // 下载文件
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `problem_${selectedProblem}_history.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const selectedProblemData = problems.find(p => p.frontend_id === selectedProblem);

  // 24小时平均在线人数统计（按分钟聚合）
  const hourlyAverageData = useMemo(() => {
    if (historyData.length === 0) return [];
    
    // 按分钟分组统计
    const minuteGroups: { [key: string]: { total: number; count: number } } = {};
    
    // 初始化24小时所有分钟
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const timeKey = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        minuteGroups[timeKey] = { total: 0, count: 0 };
      }
    }
    
    // 聚合历史数据
    historyData.forEach(item => {
      const itemTime = dayjs(item.timestamp);
      const timeKey = itemTime.format('HH:mm');
      if (minuteGroups[timeKey]) {
        minuteGroups[timeKey].total += item.count;
        minuteGroups[timeKey].count += 1;
      }
    });
    
    // 计算平均值并转换为数组
    const result = Object.entries(minuteGroups)
      .map(([time, data]) => ({
        time,
        avgCount: data.count > 0 ? Math.round(data.total / data.count) : 0,
        sampleCount: data.count,
      }))
      .filter(item => item.sampleCount > 0); // 只显示有数据的时间点
    
    return result;
  }, [historyData]);
  const chartData = useMemo(() => {
    if (historyData.length === 0) return [];
    
    const result = [];
    const [start, end] = timeRange;
    const startTime = start.startOf('minute');
    const endTime = end.endOf('minute');
    
    // 计算合适的间隔（根据数据范围动态调整）
    const totalMinutes = endTime.diff(startTime, 'minute');
    // 分钟级精度：≤48小时用1分钟，>7天用60分钟，中间用10分钟
    const interval = totalMinutes > 7 * 24 * 60 ? 60 : totalMinutes > 2 * 24 * 60 ? 10 : 1;
    const matchWindow = Math.max(1, Math.floor(interval / 2)); // 匹配窗口为间隔的一半
    
    for (let t = startTime; t.isBefore(endTime) || t.isSame(endTime); t = t.add(interval, 'minute')) {
      const currentTime = t.valueOf();
      let count = 0;
      let found = false;
      
      // 查找该时间点前后matchWindow分钟内的实际数据
      for (const item of historyData) {
        const itemTime = dayjs(item.timestamp).valueOf();
        const diffMinutes = Math.abs(itemTime - currentTime) / (1000 * 60);
        
        // 只有找到在精确时间窗口内的数据点才使用，否则为0
        if (diffMinutes <= matchWindow) {
          count = item.count;
          found = true;
          break;
        }
      }
      
      // 如果没有找到数据点，显示为0（而不是连接前后数据）
      result.push({
        time: t.format('MM-DD HH:mm'),
        count: found ? count : 0,
        fullTime: t.toISOString(),
      });
    }
    
    return result;
  }, [historyData]);

  const minuteAverageData = useMemo(() => {
    // 每10分钟一个点，减少数据密度
    const hourlyData = hourlyAverageData;
    if (hourlyData.length === 0) return [];
    
    // 按10分钟聚合
    const tenMinuteGroups: { [key: string]: { total: number; count: number } } = {};
    
    hourlyData.forEach(item => {
      const [hour, minute] = item.time.split(':').map(Number);
      const tenMinSlot = `${String(hour).padStart(2, '0')}:${String(Math.floor(minute / 10) * 10).padStart(2, '0')}`;
      
      if (!tenMinuteGroups[tenMinSlot]) {
        tenMinuteGroups[tenMinSlot] = { total: 0, count: 0 };
      }
      tenMinuteGroups[tenMinSlot].total += item.avgCount;
      tenMinuteGroups[tenMinSlot].count += 1;
    });
    
    return Object.entries(tenMinuteGroups)
      .map(([time, data]) => ({
        time,
        avgCount: Math.round(data.total / data.count),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [hourlyAverageData]);

  // 统计数据
  const stats = historyData.length > 0 ? {
    max: Math.max(...historyData.map(h => h.count)),
    min: Math.min(...historyData.map(h => h.count)),
    avg: Math.round(historyData.reduce((s, h) => s + h.count, 0) / historyData.length),
    current: historyData[historyData.length - 1]?.count || 0,
  } : { max: 0, min: 0, avg: 0, current: 0 };

  const getDifficultyClass = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'lc-difficulty lc-difficulty-easy';
      case 'Medium': return 'lc-difficulty lc-difficulty-medium';
      case 'Hard': return 'lc-difficulty lc-difficulty-hard';
      default: return 'lc-difficulty lc-difficulty-medium';
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void getDifficultyClass;

  if (loading) return <Spin size="large" className="lc-loading" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Card 
        className="lc-card"
        title={<span style={{ color: '#fff' }}>历史数据查看</span>}
        extra={
          <Space>
            <Button className="lc-btn" icon={<ReloadOutlined />} onClick={() => selectedProblem && loadHistory(selectedProblem)}>
              刷新
            </Button>
            <Button className="lc-btn" icon={<ExportOutlined />} onClick={() => handleExport('json')}>
              导出JSON
            </Button>
            <Button className="lc-btn" icon={<ExportOutlined />} onClick={() => handleExport('csv')}>
              导出CSV
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12} md={6}>
            <label style={{ marginRight: 8, fontWeight: 500, color: 'var(--lc-text-secondary)' }}>选择题目:</label>
            <Select
              showSearch
              className="history-select"
              popupClassName="history-select-dropdown"
              style={{ width: '100%' }}
              value={selectedProblem}
              onChange={setSelectedProblem}
              placeholder="选择要查看的题目"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {problems.map(p => (
                <Option key={p.frontend_id} value={p.frontend_id}>[{p.frontend_id}] {p.title} ({p.online_count}人在线)</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={10}>
            <label style={{ marginRight: 8, fontWeight: 500, color: 'var(--lc-text-secondary)' }}>时间范围:</label>
            <Space.Compact style={{ width: '100%' }}>
              <RangePicker
                style={{ flex: 1, minWidth: 180 }}
                value={timeRange}
                onChange={(dates) => dates && setTimeRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              />
              <Button onClick={() => setTimeRange([dayjs().subtract(24, 'hour'), dayjs()])}>24小时</Button>
              <Button onClick={() => setTimeRange([dayjs().subtract(7, 'day'), dayjs()])}>7天</Button>
              <Button onClick={() => setTimeRange([dayjs().subtract(1, 'month'), dayjs()])}>1月</Button>
              <Button onClick={() => setTimeRange([dayjs().subtract(6, 'month'), dayjs()])}>半年</Button>
              <Button onClick={() => setTimeRange([dayjs().subtract(1, 'year'), dayjs()])}>1年</Button>
            </Space.Compact>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              height: '100%',
              paddingTop: 24
            }}>
              {selectedProblemData && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 14px',
                  background: 'var(--lc-bg-card)',
                  border: '1px solid var(--lc-border)',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ color: 'var(--lc-text-secondary)', fontSize: 13 }}>当前题目:</span>
                  <span style={{ fontWeight: 500, color: 'var(--lc-text-primary)' }}>
                    {selectedProblemData.title}
                  </span>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: 11, 
                    fontWeight: 600,
                    background: selectedProblemData.difficulty?.toLowerCase() === 'easy' ? 'var(--lc-easy)' : 
                                selectedProblemData.difficulty?.toLowerCase() === 'hard' ? 'var(--lc-hard)' : 'var(--lc-medium)',
                    color: 'white'
                  }}>
                    {selectedProblemData.difficulty}
                  </span>
                </div>
              )}
            </div>
          </Col>
        </Row>

        {selectedProblemData && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card className="lc-card" size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--lc-text-secondary)' }}>最高在线</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#2cbb5d' }}>{stats.max}</div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="lc-card" size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--lc-text-secondary)' }}>最低在线</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff375f' }}>{stats.min}</div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="lc-card" size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--lc-text-secondary)' }}>平均在线</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ffa116' }}>{stats.avg}</div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="lc-card" size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--lc-text-secondary)' }}>当前在线</div>
                  <div className="lc-online-badge" style={{ justifyContent: 'center', marginTop: 4 }}>{stats.current}</div>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Card>

      <Card className="lc-card" title={<span style={{ color: '#fff' }}>数据图表</span>} style={{ marginTop: 16 }} loading={chartLoading}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="时间趋势" key="trend">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3e3e3e" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#b0b0b0' }} stroke="#3e3e3e" interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#b0b0b0' }} stroke="#3e3e3e" />
                <Tooltip contentStyle={{ background: '#282828', border: '1px solid #3e3e3e', color: '#fff' }} />
                <Legend wrapperStyle={{ color: '#fff' }} />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="在线人数" 
                  stroke="#ffa116" 
                  fill="#ffa116" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </TabPane>
          <TabPane tab="24小时活跃时段" key="hourly">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={minuteAverageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3e3e3e" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 11, fill: '#b0b0b0' }} 
                  stroke="#3e3e3e" 
                  interval={5}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: '#b0b0b0' }} stroke="#3e3e3e" />
                <Tooltip 
                  contentStyle={{ background: '#282828', border: '1px solid #3e3e3e', color: '#fff' }}
                  formatter={(value: number) => [`${value}人`, '平均在线']}
                />
                <Bar dataKey="avgCount" name="平均在线人数" fill="#ffa116" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'center', color: 'var(--lc-text-secondary)', fontSize: 12, marginTop: 8 }}>
              统计所选时间段内每天24小时各分钟的平均在线人数，展示刷题高峰时段
            </div>
          </TabPane>
        </Tabs>
      </Card>

      <Card className="lc-card lc-table" title={<span style={{ color: '#fff' }}>详细数据</span>} style={{ marginTop: 16 }}>
        <Table
          dataSource={historyData.slice().reverse()}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize });
              setPreference('pageSize', pageSize);
            },
            onShowSizeChange: (_current, size) => {
              setPagination({ current: 1, pageSize: size });
              setPreference('pageSize', size);
            },
          }}
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
            { title: '在线人数', dataIndex: 'count', key: 'count', width: 120 },
            { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
          ]}
        />
      </Card>
    </div>
  );
};

export default History;
