import React, { useState, useEffect, useMemo } from 'react';
import { Select, DatePicker, message, Table, Button, Space, Skeleton, Tabs, Spin } from 'antd';
import {
  DownloadOutlined,
  ExportOutlined,
  FilterOutlined,
  HistoryOutlined,
  LineChartOutlined,
  ReloadOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { fetchHot100, fetchOnlineCounts } from '../../api';
import { Problem, OnlineCount } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';
import dayjs from 'dayjs';
import { useChartData, useHourAverageData, useStats } from './useChartData';
import { StatCard } from './StatCard';
import { TrendChart, HourlyChart } from './Charts';
import { DocLayout, useDocNavigation, type DocAnchor } from '../docs/DocLayout';
import { DocSection, DocNote } from '../docs/DocSection';
import { ChartPanel } from '../dataPage/ChartPanel';
import '../dataPage/DataPage.css';
import '../History.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

type RangePreset = '24h' | '7d' | '1m' | '6m' | '1y' | 'custom';
type RelativePreset = Exclude<RangePreset, 'custom'>;

const HISTORY_ANCHORS: DocAnchor[] = [
  { key: 'history-filters', title: '筛选与概览' },
  { key: 'history-charts', title: '趋势图表' },
  { key: 'history-records', title: '详细数据' },
];

// 预设区间按“当前时间”实时计算，只保存预设名；只有手动选择日期时才保存绝对区间。
const PRESET_HOURS: Record<RelativePreset, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '1m': 24 * 30,
  '6m': 24 * 180,
  '1y': 24 * 365,
};

const buildPresetRange = (preset: RelativePreset): [dayjs.Dayjs, dayjs.Dayjs] => {
  const now = dayjs();
  return [now.subtract(PRESET_HOURS[preset], 'hour'), now];
};

const resolveInitialRange = (
  savedPreset: string | undefined,
  savedRange: string | null
): { preset: RangePreset; range: [dayjs.Dayjs, dayjs.Dayjs] } => {
  const isPreset = (value: string | undefined): value is RangePreset =>
    value === '24h' || value === '7d' || value === '1m' || value === '6m' || value === '1y' || value === 'custom';

  const preset = isPreset(savedPreset) ? savedPreset : '24h';
  if (preset === 'custom' && savedRange) {
    const [startStr, endStr] = savedRange.split(',');
    const start = dayjs(startStr);
    const end = dayjs(endStr);
    if (start.isValid() && end.isValid() && end.isAfter(start)) {
      return { preset: 'custom', range: [start, end] };
    }
  }
  const fallback: RelativePreset = preset === 'custom' ? '24h' : preset;
  return { preset: fallback, range: buildPresetRange(fallback) };
};

const History: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { preferences, setPreference } = usePreferences();
  const [problems, setProblems] = useState<Problem[]>([]);

  const problemIdFromUrl = searchParams.get('problemId');
  const initialProblem = problemIdFromUrl || preferences.historyProblemId;
  const [selectedProblem, setSelectedProblem] = useState<string | null>(initialProblem);

  const initialRange = useMemo(
    () => resolveInitialRange(preferences.historyTimeRangePreset, preferences.historyTimeRange),
    // 只在首次挂载时解析一次，之后由用户操作驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [rangePreset, setRangePreset] = useState<RangePreset>(initialRange.preset);
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(initialRange.range);

  const [historyData, setHistoryData] = useState<OnlineCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: preferences.pageSize || 10 });
  const [activeTab, setActiveTab] = useState('trend');

  const { activeAnchor, scrollTo } = useDocNavigation(HISTORY_ANCHORS);

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
    setPreference('historyTimeRangePreset', rangePreset);
    // 预设区间每次打开都要按当前时间重算，不能把今天的绝对时间冻结下来；
    // 只有手动选择的 custom 区间才保存具体起止时间。
    if (rangePreset === 'custom') {
      setPreference('historyTimeRange', `${timeRange[0].toISOString()},${timeRange[1].toISOString()}`);
    }
  }, [rangePreset, timeRange, setPreference]);

  const applyPreset = (preset: RelativePreset) => {
    setRangePreset(preset);
    setTimeRange(buildPresetRange(preset));
  };

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
          setRangePreset('24h');
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

  // 0 在这里表示“该时段没有国际站采集数据”，而不是真的没人。
  const firstComItem = historyData.find(item => (item.count_com || 0) > 0);
  const hasComGap = historyData.some(item => (item.count_com || 0) === 0);

  const headerActions = (
    <Space size={8}>
      <Button icon={<ReloadOutlined />} onClick={() => selectedProblem && loadHistory(selectedProblem)}>
        刷新
      </Button>
      <Button icon={<ExportOutlined />} onClick={() => handleExport('json')}>
        导出 JSON
      </Button>
      <Button icon={<DownloadOutlined />} onClick={() => handleExport('csv')}>
        导出 CSV
      </Button>
    </Space>
  );

  const difficultyColor = selectedProblemData?.difficulty?.toLowerCase() === 'easy'
    ? 'var(--lc-easy)'
    : selectedProblemData?.difficulty?.toLowerCase() === 'hard'
      ? 'var(--lc-hard)'
      : 'var(--lc-medium)';

  return (
    <DocLayout
      wide
      title="历史数据"
      subtitle="按题目查看中文站 / 国际站在线人数的历史变化"
      icon={<HistoryOutlined />}
      anchors={HISTORY_ANCHORS}
      activeAnchor={activeAnchor}
      onNavigate={scrollTo}
    >
      {loading ? (
        <>
          <DocSection id="history-filters" title="筛选与概览" icon={<FilterOutlined />}>
            <Skeleton active paragraph={{ rows: 3 }} />
          </DocSection>
          <DocSection id="history-charts" title="趋势图表" icon={<LineChartOutlined />}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </DocSection>
        </>
      ) : (
        <>
          <DocSection
            id="history-filters"
            title="筛选与概览"
            icon={<FilterOutlined />}
            extra={headerActions}
          >
            <div className="history-filter">
              <div className="history-filter-field">
                <label className="history-filter-label">选择题目</label>
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
              </div>

              <div className="history-filter-field history-filter-time">
                <label className="history-filter-label">时间范围</label>
                <div className="history-time-row">
                  <RangePicker
                    className="history-range-picker"
                    value={timeRange}
                    onChange={(dates) => {
                      if (dates) {
                        setRangePreset('custom');
                        setTimeRange(dates as [dayjs.Dayjs, dayjs.Dayjs]);
                      }
                    }}
                  />
                  <div className="history-presets">
                    <Button className={`history-preset${rangePreset === '24h' ? ' active' : ''}`} onClick={() => applyPreset('24h')}>24小时</Button>
                    <Button className={`history-preset${rangePreset === '7d' ? ' active' : ''}`} onClick={() => applyPreset('7d')}>7天</Button>
                    <Button className={`history-preset${rangePreset === '1m' ? ' active' : ''}`} onClick={() => applyPreset('1m')}>1月</Button>
                    <Button className={`history-preset${rangePreset === '6m' ? ' active' : ''}`} onClick={() => applyPreset('6m')}>半年</Button>
                    <Button className={`history-preset${rangePreset === '1y' ? ' active' : ''}`} onClick={() => applyPreset('1y')}>1年</Button>
                  </div>
                </div>
              </div>

              <div className="history-filter-field">
                <label className="history-filter-label">当前题目</label>
                <div
                  className="history-current-card"
                  title={selectedProblemData ? `[${selectedProblemData.frontend_id}] ${selectedProblemData.title_cn || selectedProblemData.title}` : undefined}
                >
                  {selectedProblemData ? (
                    <>
                      <span className="history-current-id">#{selectedProblemData.frontend_id}</span>
                      <span className="history-current-title">
                        {selectedProblemData.title_cn || selectedProblemData.title}
                      </span>
                      <span className="history-current-difficulty" style={{ background: difficultyColor }}>
                        {selectedProblemData.difficulty}
                      </span>
                    </>
                  ) : (
                    <span className="history-current-empty">未选择题目</span>
                  )}
                </div>
              </div>
            </div>

            {historyData.length > 0 && hasComGap && (
              <DocNote type="info">
                {firstComItem
                  ? `所选时间范围内部分时段没有国际站数据（0 表示未采集到，不代表没人）：本区间内国际站最早记录为 ${dayjs(firstComItem.timestamp).format('YYYY-MM-DD HH:mm')}，更早时段中文站数据正常。`
                  : '所选时间范围内没有国际站数据（0 表示未采集到，不代表没人）：国际站采集器可能未运行或被 Cloudflare 拦截，中文站数据正常。'}
              </DocNote>
            )}

            {selectedProblemData && (
              <div className="history-stat-row">
                <StatCard title="最高在线" values={stats.max} />
                <StatCard title="最低在线" values={stats.min} />
                <StatCard title="平均在线" values={stats.avg} />
                <StatCard title="当前在线" values={stats.current} />
              </div>
            )}
          </DocSection>

          <DocSection
            id="history-charts"
            title="趋势图表"
            icon={<LineChartOutlined />}
            desc={`${historyData.length} 个采样点`}
          >
            <Tabs
              className="lc-doc-tabs"
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'trend',
                  label: '时间趋势',
                  children: (
                    <ChartPanel
                      title="在线人数时间趋势"
                      desc="汇总为面积背景，中文站 / 国际站为实线。国际站曲线断点表示该时段未采集到数据。"
                      height={400}
                    >
                      {chartLoading ? <Spin style={{ display: 'block', margin: '150px auto' }} /> : <TrendChart data={chartData} />}
                    </ChartPanel>
                  ),
                },
                {
                  key: 'hourly',
                  label: '24小时活跃时段',
                  children: (
                    <ChartPanel
                      title="各小时平均在线人数"
                      desc="统计所选时间段内每天 24 小时的平均在线人数，展示刷题高峰时段。"
                      height={400}
                    >
                      {chartLoading ? <Spin style={{ display: 'block', margin: '150px auto' }} /> : <HourlyChart data={hourAverageData} />}
                    </ChartPanel>
                  ),
                },
              ]}
            />
          </DocSection>

          <DocSection
            id="history-records"
            title="详细数据"
            icon={<TableOutlined />}
            desc={`共 ${historyData.length} 条记录，按时间倒序`}
          >
            <Table
              className="lc-data-table"
              dataSource={historyData.slice().reverse()}
              // 后端聚合返回的桶无原始 id，用 timestamp 作行唯一键
              rowKey={(record) => record.timestamp}
              loading={chartLoading}
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
                { title: '序号', key: 'idx', width: 72, render: (_: unknown, __: OnlineCount, index: number) => index + 1 },
                {
                  title: '中文站',
                  key: 'cn',
                  width: 110,
                  render: (_: unknown, record: OnlineCount) => (
                    <span className="history-count history-count-cn">{record.count_cn || 0}</span>
                  ),
                },
                {
                  title: '国际站',
                  key: 'com',
                  width: 110,
                  render: (_: unknown, record: OnlineCount) => (
                    <span className="history-count history-count-com">{record.count_com || 0}</span>
                  ),
                },
                {
                  title: '汇总',
                  key: 'total',
                  width: 110,
                  render: (_: unknown, record: OnlineCount) => (
                    <span className="history-count history-count-total">
                      {(record.count_cn || 0) + (record.count_com || 0)}
                    </span>
                  ),
                },
                { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
              ]}
            />
          </DocSection>
        </>
      )}
    </DocLayout>
  );
};

export default History;
