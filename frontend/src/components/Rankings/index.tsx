import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input, Select, Skeleton, Button, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ClockCircleOutlined,
  DashboardOutlined,
  FilterOutlined,
  FireOutlined,
  LineChartOutlined,
  OrderedListOutlined,
  ReloadOutlined,
  SearchOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Problem } from '../../types';
import { fetchHot100 } from '../../api';
import { getFromIndexedDB, setToIndexedDB, STORAGE_KEYS } from '../../utils/indexedDB';
import { WSProblem, SortField, SortOrder, formatSlug } from './types';
import { useColumns } from './useColumns';
import LastUpdated from './LastUpdated';
import { DocLayout } from '../docs/DocLayout';
import { DocSection, DocNote } from '../docs/DocSection';
import { StatRow, StatTile } from '../dataPage/ChartPanel';
import '../dataPage/DataPage.css';
import '../Rankings.css';

const totalOf = (p: Problem) => p.online_count_total || p.online_count || 0;

/** API 返回 ISO 时间串，WebSocket 返回秒级时间戳，这里统一成毫秒取最大值 */
function newestTimestamp(items: Array<{ last_updated?: string | number }>): number {
  return items.reduce((max, item) => {
    const raw = item.last_updated;
    const ts = typeof raw === 'number' ? raw * 1000 : Date.parse(String(raw ?? ''));
    return Number.isFinite(ts) && ts > max ? ts : max;
  }, 0);
}

const Rankings: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [filtered, setFiltered] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortOrder, setSortOrder] = useState<SortOrder>('descend');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const navigate = useNavigate();

  // HTTP API fallback
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const savedSortField = await getFromIndexedDB<SortField>(STORAGE_KEYS.RANKINGS_SORT_FIELD);
        const savedSortOrder = await getFromIndexedDB<SortOrder>(STORAGE_KEYS.RANKINGS_SORT_ORDER);
        if (savedSortField) setSortField(savedSortField);
        if (savedSortOrder) setSortOrder(savedSortOrder);

        const problemsData = await fetchHot100();
        if (problemsData && problemsData.length > 0) {
          const formattedProblems = problemsData.map((p: any) => ({
            id: p.id || p.frontend_id,
            frontend_id: p.id || p.frontend_id,
            slug: p.slug,
            title: p.title_cn || p.title || formatSlug(p.slug),
            difficulty: p.difficulty || 'Medium',
            acceptance: p.acceptance || 0,
            online_count: p.online_count || 0,
            online_count_cn: p.online_count_cn || 0,
            online_count_com: p.online_count_com || 0,
            online_count_total: p.online_count_total || p.online_count || 0,
            last_updated: p.last_updated || new Date().toISOString(),
            topic_tags: p.topic_tags || [],
          }));
          setProblems(formattedProblems);
          const newest = newestTimestamp(formattedProblems);
          if (newest > 0) setLastUpdatedAt(newest);
          setLoading(false);
          setInitialLoaded(true);
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };

    fetchInitialData();
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timeout);
  }, []);

  // WebSocket
  useWebSocket((data) => {
    if (data.type === 'batch_update' && data.problems) {
      const wsProblems: WSProblem[] = data.problems;
      const newest = newestTimestamp(wsProblems);
      setLastUpdatedAt(prev => Math.max(prev ?? 0, newest || Date.now()));

      const updates = new Map<string, WSProblem>();
      const changed = new Set<string>();
      wsProblems.forEach(p => {
        const id = String(p.id || p.frontend_id || '');
        updates.set(id, p);
      });

      setProblems(prevProblems => {
        if (prevProblems.length === 0) {
          return wsProblems.map(p => ({
            id: String(p.id || p.frontend_id || ''),
            frontend_id: String(p.id || p.frontend_id || ''),
            slug: p.slug,
            title: p.title_cn || p.title || formatSlug(p.slug),
            difficulty: (p.difficulty as 'Easy' | 'Medium' | 'Hard') || 'Medium',
            acceptance: 0,
            online_count: p.online_count,
            online_count_cn: p.online_count_cn || 0,
            online_count_com: p.online_count_com || 0,
            online_count_total: p.online_count_total || p.online_count || 0,
            last_updated: new Date(p.last_updated * 1000).toISOString(),
            topic_tags: p.topic_tags || [],
          }));
        }

        return prevProblems.map(problem => {
          const update = updates.get(String(problem.id));
          if (update) {
            const oldTotal = problem.online_count_total || problem.online_count || 0;
            const newTotal = update.online_count_total || update.online_count || 0;
            if (oldTotal !== newTotal) changed.add(String(problem.id));
            return {
              ...problem,
              online_count: update.online_count,
              online_count_cn: update.online_count_cn || 0,
              online_count_com: update.online_count_com || 0,
              online_count_total: newTotal,
              last_updated: new Date(update.last_updated * 1000).toISOString(),
            };
          }
          return problem;
        });
      });

      if (changed.size > 0) {
        setFlashIds(changed);
        window.setTimeout(() => setFlashIds(new Set()), 900);
      }
      setLoading(false);
      setInitialLoaded(true);
    }
  });

  const sortProblems = useCallback((probs: Problem[]) => {
    return [...probs].sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'cn':
          aVal = a.online_count_cn || 0;
          bVal = b.online_count_cn || 0;
          break;
        case 'com':
          aVal = a.online_count_com || 0;
          bVal = b.online_count_com || 0;
          break;
        case 'total':
        default:
          aVal = totalOf(a);
          bVal = totalOf(b);
          break;
      }
      return sortOrder === 'ascend' ? aVal - bVal : bVal - aVal;
    });
  }, [sortField, sortOrder]);

  const filteredProblems = useMemo(() => {
    let result = [...problems];
    if (searchText) {
      result = result.filter(p =>
        p.title.toLowerCase().includes(searchText.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    if (difficultyFilter !== 'all') {
      result = result.filter(p => p.difficulty?.toLowerCase() === difficultyFilter.toLowerCase());
    }
    if (selectedTags.length > 0) {
      result = result.filter(p =>
        selectedTags.every(tag => p.topic_tags?.includes(tag))
      );
    }
    return sortProblems(result);
  }, [problems, searchText, difficultyFilter, selectedTags, sortProblems]);

  useEffect(() => {
    setFiltered(filteredProblems);
  }, [filteredProblems]);

  // 排序偏好写入 IndexedDB，下次打开保持上次选择
  useEffect(() => {
    if (!initialLoaded) return;
    setToIndexedDB(STORAGE_KEYS.RANKINGS_SORT_FIELD, sortField);
    setToIndexedDB(STORAGE_KEYS.RANKINGS_SORT_ORDER, sortOrder);
  }, [sortField, sortOrder, initialLoaded]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortOrder(prev => prev === 'descend' ? 'ascend' : 'descend');
    } else {
      setSortField(field);
      setSortOrder('descend');
    }
  }, [sortField]);

  const handleNavigate = useCallback((problemId: string) => {
    navigate(`/history?problemId=${problemId}`);
  }, [navigate]);

  const handleReset = useCallback(() => {
    setSearchText('');
    setDifficultyFilter('all');
    setSelectedTags([]);
    setSortField('total');
    setSortOrder('descend');
  }, []);

  const columns = useColumns({
    selectedTags,
    sortField,
    sortOrder,
    onSort: handleSort,
    onTagClick: handleTagClick,
    onNavigate: handleNavigate,
    flashIds,
  });

  const rowClassName = useCallback((record: Problem, index: number) => {
    const top = index < 3 ? ` ranking-row--top${index + 1}` : '';
    const flash = flashIds.has(String(record.id)) ? ' ranking-row--flash' : '';
    return `ranking-row${top}${flash}`;
  }, [flashIds]);

  const cnOnline = problems.reduce((sum, p) => sum + (p.online_count_cn || 0), 0);
  const comOnline = problems.reduce((sum, p) => sum + (p.online_count_com || 0), 0);
  const totalOnline = problems.reduce((sum, p) => sum + totalOf(p), 0);
  const avgOnline = problems.length ? Math.round(totalOnline / problems.length) : 0;
  const hottest = useMemo(() => {
    if (problems.length === 0) return null;
    return problems.reduce((best, p) => (totalOf(p) > totalOf(best) ? p : best), problems[0]);
  }, [problems]);

  return (
    <DocLayout
      wide
      showSidebar={false}
      title="排行榜"
      subtitle="LeetCode Hot 100 中文站 / 国际站实时在线人数排行"
      icon={<TrophyOutlined />}
    >
      {loading && !initialLoaded ? (
        <DocSection id="rankings-overview" title="实时概览" icon={<DashboardOutlined />}>
          <Skeleton active paragraph={{ rows: 12 }} />
        </DocSection>
      ) : (
        <>
          <DocSection
            id="rankings-overview"
            title="实时概览"
            icon={<DashboardOutlined />}
            extra={
              <div className="rankings-overview-extra">
                <span className="rankings-overview-hint">WebSocket 实时推送，人数变化时对应行会短暂高亮</span>
                <LastUpdated timestamp={lastUpdatedAt} />
              </div>
            }
          >
            <StatRow>
              <StatTile
                icon={<TrophyOutlined />}
                label="监控题目"
                value={problems.length}
                hint="LeetCode Hot 100"
              />
              <StatTile
                tone="cn"
                icon={<LineChartOutlined />}
                label="中文站在线"
                value={cnOnline.toLocaleString()}
                hint="leetcode.cn"
              />
              <StatTile
                tone="com"
                icon={<FireOutlined />}
                label="国际站在线"
                value={comOnline.toLocaleString()}
                hint="leetcode.com"
              />
              <StatTile
                tone="total"
                icon={<ClockCircleOutlined />}
                label="汇总在线"
                value={totalOnline.toLocaleString()}
                hint={`平均每题 ${avgOnline.toLocaleString()} 人`}
              />
            </StatRow>

            {hottest && (
              <DocNote type="info">
                当前最热题目：
                <button
                  type="button"
                  className="rankings-hot-link"
                  onClick={() => handleNavigate(String(hottest.id))}
                >
                  {hottest.title}
                </button>
                （{totalOf(hottest).toLocaleString()} 人在线）。点击任意行可查看该题的历史趋势。
              </DocNote>
            )}
          </DocSection>

          <DocSection
            id="rankings-filters"
            title="筛选与排序"
            icon={<FilterOutlined />}
            desc={`显示 ${filtered.length} / ${problems.length} 题`}
          >
            <div className="rankings-toolbar">
              <Input
                className="rankings-search"
                placeholder="搜索题目名称或 slug"
                allowClear
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 260 }}
              />

              <div className="rankings-toolbar-group">
                <span className="rankings-toolbar-label">难度</span>
                <Select
                  value={difficultyFilter}
                  onChange={setDifficultyFilter}
                  style={{ width: 108 }}
                  options={[
                    { value: 'all', label: '全部' },
                    { value: 'Easy', label: '简单' },
                    { value: 'Medium', label: '中等' },
                    { value: 'Hard', label: '困难' },
                  ]}
                />
              </div>

              <div className="rankings-toolbar-group">
                <span className="rankings-toolbar-label">排序</span>
                <Select
                  value={sortField}
                  onChange={(value) => setSortField(value)}
                  style={{ width: 108 }}
                  options={[
                    { value: 'total', label: '汇总在线' },
                    { value: 'cn', label: '中文站在线' },
                    { value: 'com', label: '国际站在线' },
                  ]}
                />
                <Select
                  value={sortOrder}
                  onChange={(value) => setSortOrder(value)}
                  style={{ width: 84 }}
                  options={[
                    { value: 'descend', label: '降序' },
                    { value: 'ascend', label: '升序' },
                  ]}
                />
              </div>

              <Button className="rankings-reset" icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </div>

            {selectedTags.length > 0 && (
              <div className="rankings-selected-tags">
                <span className="rankings-toolbar-label">已选标签</span>
                {selectedTags.map(tag => (
                  <span key={tag} className="ranking-tag is-selected rankings-selected-tag">
                    {tag}
                    <button
                      type="button"
                      className="rankings-selected-tag-remove"
                      aria-label={`移除 ${tag}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTags(prev => prev.filter(t => t !== tag));
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <Button type="link" size="small" onClick={() => setSelectedTags([])}>
                  清除全部
                </Button>
              </div>
            )}
          </DocSection>

          <DocSection
            id="rankings-list"
            title="完整榜单"
            icon={<OrderedListOutlined />}
            desc={`共 ${filtered.length} 题 · 点击表头排序 · 点击行查看历史`}
          >
            <Table
              className="lc-rankings-table"
              dataSource={filtered}
              columns={columns}
              rowKey="id"
              scroll={{ x: 'max-content' }}
              pagination={false}
              size="small"
              rowClassName={rowClassName}
              onRow={(record: Problem) => ({
                onClick: () => handleNavigate(String(record.id)),
                style: { cursor: 'pointer' }
              })}
            />
          </DocSection>
        </>
      )}
    </DocLayout>
  );
};

export default Rankings;
