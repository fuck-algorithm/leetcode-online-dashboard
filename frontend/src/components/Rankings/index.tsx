import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Input, Select, Space, Skeleton, Button, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import { TrophyOutlined } from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Problem } from '../../types';
import { fetchHot100 } from '../../api';
import { getFromIndexedDB, STORAGE_KEYS } from '../../utils/indexedDB';
import { WSProblem, SortField, SortOrder, formatSlug } from './types';
import { useColumns } from './useColumns';
import '../Rankings.css';

const { Search } = Input;
const { Option } = Select;

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
  
  const navigate = useNavigate();
  const tableWrapperRef = React.useRef<HTMLDivElement>(null);

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
      const updates = new Map<string, WSProblem>();
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
            return {
              ...problem,
              online_count: update.online_count,
              online_count_cn: update.online_count_cn || 0,
              online_count_com: update.online_count_com || 0,
              online_count_total: update.online_count_total || update.online_count || 0,
              last_updated: new Date(update.last_updated * 1000).toISOString(),
            };
          }
          return problem;
        });
      });
      
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
          aVal = a.online_count_total || a.online_count || 0;
          bVal = b.online_count_total || b.online_count || 0;
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

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const handleNavigate = useCallback((problemId: string) => {
    navigate(`/history?problemId=${problemId}`);
  }, [navigate]);

  const columns = useColumns({
    selectedTags,
    sortField,
    sortOrder,
    onTagClick: handleTagClick,
    onNavigate: handleNavigate,
  });

  const rowClassName = useCallback((record: Problem) => {
    return `ranking-row ranking-row-${record.id}`;
  }, []);

  if (loading && !initialLoaded) {
    return (
      <Card className="lc-card" title={<span><TrophyOutlined /> 题目排行榜</span>}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    );
  }

  return (
    <div>
      <Card 
        className="lc-card"
        title={<span><TrophyOutlined /> 题目排行榜</span>}
        extra={
          <Space>
            {selectedTags.length > 0 && (
              <span style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap'
              }}>
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding: '2px 8px',
                      background: '#FFD700',
                      color: '#333',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                  >
                    {tag}
                    <span
                      style={{
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        padding: '0 2px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTags(prev => prev.filter(t => t !== tag));
                      }}
                    >
                      ×
                    </span>
                  </span>
                ))}
                <Button
                  type="link"
                  size="small"
                  style={{ color: '#999', padding: '0 4px', fontSize: '12px' }}
                  onClick={() => setSelectedTags([])}
                >
                  清除全部
                </Button>
              </span>
            )}
            <Search
              placeholder="搜索题目..."
              allowClear
              onSearch={setSearchText}
              onChange={e => setSearchText(e.target.value)}
              className="rankings-search"
              style={{ width: 320 }}
            />
            <Select 
              defaultValue="all" 
              style={{ width: 100, background: 'var(--lc-bg-hover)', border: '1px solid var(--lc-border)', borderRadius: '6px' }}
              onChange={setDifficultyFilter}
            >
              <Option value="all">全部</Option>
              <Option value="Easy">简单</Option>
              <Option value="Medium">中等</Option>
              <Option value="Hard">困难</Option>
            </Select>
          </Space>
        }
      >
        <div ref={tableWrapperRef}>
          <Table 
            className="lc-table lc-rankings-table"
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
        </div>
      </Card>
    </div>
  );
};

export default Rankings;
