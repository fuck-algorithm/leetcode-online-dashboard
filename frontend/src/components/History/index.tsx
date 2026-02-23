import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, message, Table, Button, Space, Row, Col, Skeleton, Tabs } from 'antd';
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { fetchHot100, fetchOnlineCounts } from '../../api';
import { Problem, OnlineCount } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';
import dayjs from 'dayjs';
import { useChartData, useHourAverageData, useStats } from './useChartData';
import { StatCard } from './StatCard';
import { TrendChart, HourlyChart } from './Charts';
import '../History.css';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

const History: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { preferences, setPreference } = usePreferences();
  const [problems, setProblems] = useState<Problem[]>([]);
  
  const problemIdFromUrl = searchParams.get('problemId');
  const initialProblem = problemIdFromUrl || preferences.historyProblemId;
  const [selectedProblem, setSelectedProblem] = useState<string | null>(initialProblem);
  
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
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [selectedProblem, timeRange]);

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
    if (selectedProblem) {
      loadHistory(selectedProblem);
    }
  }, [selectedProblem, timeRange]);

  const loadProblems = async () => {
    try {
      const data = await fetchHot100();
      setProblems(data);
      
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
      let startTime = timeRange?.[0].format('YYYY-MM-DD HH:mm:ss');
      let endTime = timeRange?.[1].format('YYYY-MM-DD HH:mm:ss');
      
      let data = await fetchOnlineCounts(problemId, 1000, startTime, endTime, 'all');
      
      if (data.length === 0) {
        const now = dayjs();
        const yesterday = now.subtract(24, 'hour');
        startTime = yesterday.format('YYYY-MM-DD HH:mm:ss');
        endTime = now.format('YYYY-MM-DD HH:mm:ss');
        
        data = await fetchOnlineCounts(problemId, 1000, startTime, endTime, 'all');
        
        if (data.length > 0) {
          setTimeRange([yesterday, now]);
        }
      }
      
      setHistoryData(data.map(item => ({
        ...item,
        count_total: item.count || (item.count_cn || 0) + (item.count_com || 0),
      })));
    } catch (error) {
      message.error('加载历史数据失败');
    } finally {
      setChartLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const exportDataWithSites = historyData.map(item => ({
        id: item.id,
        frontend_id: item.frontend_id,
        timestamp: item.timestamp,
        count_cn: item.count_cn || 0,
        count_com: item.count_com || 0,
        count_total: item.count_total || (item.count_cn || 0) + (item.count_com || 0),
      }));
      
      const blob = new Blob([JSON.stringify(exportDataWithSites, null, 2)], { type: format === 'json' ? 'application/json' : 'text/csv' });
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

  const chartData = useChartData(historyData, timeRange);
  const hourAverageData = useHourAverageData(historyData);
  const stats = useStats(historyData);

  if (loading) return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    </div>
  );

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
                String(option?.children || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {problems.map(p => (
                <Option key={p.frontend_id} value={p.frontend_id}>[{p.frontend_id}] {p.title_cn || p.title} ({p.online_count}人在线)</Option>
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
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="最高在线" values={stats.max} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="最低在线" values={stats.min} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="平均在线" values={stats.avg} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="当前在线" values={stats.current} />
            </Col>
          </Row>
        )}
      </Card>

      <Card className="lc-card" title={<span style={{ color: '#fff' }}>数据图表</span>} style={{ marginTop: 16 }} loading={chartLoading}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="时间趋势" key="trend">
            <TrendChart data={chartData} />
          </TabPane>
          <TabPane tab="24小时活跃时段" key="hourly">
            <HourlyChart data={hourAverageData} />
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
            { 
              title: '在线人数', 
              key: 'counts',
              width: 360,
              render: (_: unknown, record: OnlineCount) => (
                <Space size="middle">
                  <span style={{ color: '#ff4d4f' }}>中文站 {record.count_cn || 0}</span>
                  <span style={{ color: '#1890ff' }}>国际站 {record.count_com || 0}</span>
                  <span style={{ color: '#ffa116' }}>汇总 {(record.count_cn || 0) + (record.count_com || 0)}</span>
                </Space>
              )
            },
            { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
          ]}
        />
      </Card>
    </div>
  );
};

export default History;
