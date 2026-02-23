import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Table, Input, Select, Space, Skeleton, Button } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { TrophyOutlined, EyeOutlined } from '@ant-design/icons';
import { useWebSocket } from '../hooks/useWebSocket';
import { Problem } from '../types';
import { fetchHot100 } from '../api';
import './Rankings.css';

interface WSProblem {
  id?: string;
  frontend_id: string;
  slug: string;
  title: string;
  title_cn?: string;
  difficulty?: string;
  paid_only?: boolean;
  topic_tags?: string[];
  online_count: number;
  online_count_cn: number;
  online_count_com: number;
  online_count_total: number;
  last_updated: number;
}

const formatSlug = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const { Search } = Input;
const { Option } = Select;

type SortField = 'cn' | 'com' | 'total';
type SortOrder = 'ascend' | 'descend';

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

  // FLIP动画相关refs
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const prevPositions = useRef<Map<string, DOMRect>>(new Map());
  const rowElements = useRef<Map<string, HTMLElement>>(new Map());
  const isFirstUpdate = useRef(true);

  // 记录位置
  const recordPositions = useCallback(() => {
    const positions = new Map<string, DOMRect>();
    rowElements.current.forEach((element, key) => {
      positions.set(key, element.getBoundingClientRect());
    });
    return positions;
  }, []);

  // 应用FLIP动画
  const applyFlipAnimation = useCallback((prevPos: Map<string, DOMRect>) => {
    if (isFirstUpdate.current) {
      isFirstUpdate.current = false;
      return;
    }

    const animatedElements: { element: HTMLElement; deltaY: number }[] = [];

    rowElements.current.forEach((element, key) => {
      const prevRect = prevPos.get(key);
      if (prevRect) {
        const newRect = element.getBoundingClientRect();
        const deltaY = prevRect.top - newRect.top;
        if (Math.abs(deltaY) > 1) {
          animatedElements.push({ element, deltaY });
        }
      }
    });

    if (animatedElements.length === 0) return;

    animatedElements.forEach(({ element, deltaY }) => {
      element.style.transition = 'none';
      element.style.transform = `translateY(${deltaY}px)`;
    });

    tableWrapperRef.current?.offsetHeight;

    requestAnimationFrame(() => {
      animatedElements.forEach(({ element }) => {
        element.style.transition = 'transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1)';
        element.style.transform = 'translateY(0)';
      });

      setTimeout(() => {
        animatedElements.forEach(({ element }) => {
          element.style.transition = '';
          element.style.transform = '';
        });
      }, 400);
    });
  }, []);

  // 数据更新前记录位置
  useEffect(() => {
    if (!initialLoaded) return;
    prevPositions.current = recordPositions();
  }, [problems.map(p => p.id).join(','), initialLoaded, recordPositions]);

  // 数据更新后应用动画
  useEffect(() => {
    if (!initialLoaded) return;
    requestAnimationFrame(() => {
      applyFlipAnimation(prevPositions.current);
    });
  }, [filtered.map(p => p.id).join(','), initialLoaded, applyFlipAnimation]);

  // 收集行元素
  useEffect(() => {
    if (!tableWrapperRef.current) return;
    const rows = tableWrapperRef.current.querySelectorAll('.ant-table-row');
    rows.forEach((row) => {
      const rowElement = row as HTMLElement;
      const match = rowElement.className.match(/ranking-row-([\w-]+)/);
      if (match) {
        rowElements.current.set(match[1], rowElement);
      }
    });
  }, [filtered]);

  // HTTP API fallback
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
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

  // WebSocket - 合并数据而不是替换
  useWebSocket((data) => {
    if (data.type === 'batch_update' && data.problems) {
      const wsProblems: WSProblem[] = data.problems;
      
      // 创建更新映射表
      const updates = new Map<string, WSProblem>();
      wsProblems.forEach(p => {
        const id = String(p.id || p.frontend_id || '');
        updates.set(id, p);
      });
      
      // 合并：保留现有题目，只更新在线人数
      setProblems(prevProblems => {
        // 如果还没有数据，使用WebSocket数据（初始化时）
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
        
        // 合并现有数据和更新数据
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'ascend' ? 'descend' : 'ascend');
    } else {
      setSortField(field);
      setSortOrder('descend');
    }
  };

  const sortProblems = (problems: Problem[]) => {
    return [...problems].sort((a, b) => {
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
  };

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
    // 多标签筛选（AND关系：必须包含所有选中的标签）
    if (selectedTags.length > 0) {
      result = result.filter(p => 
        selectedTags.every(tag => p.topic_tags?.includes(tag))
      );
    }
    // Apply sorting
    result = sortProblems(result);
    return result;
  }, [problems, searchText, difficultyFilter, selectedTags, sortField, sortOrder]);

  useEffect(() => {
    setFiltered(filteredProblems);
  }, [filteredProblems]);

  const getDifficultyClass = (difficulty: string) => {
    const diff = difficulty.toLowerCase();
    switch (diff) {
      case 'easy': return 'lc-difficulty lc-difficulty-easy';
      case 'medium': return 'lc-difficulty lc-difficulty-medium';
      case 'hard': return 'lc-difficulty lc-difficulty-hard';
      default: return 'lc-difficulty lc-difficulty-medium';
    }
  };

  const getRankStyle = useCallback((rank: number) => {
    if (rank === 1) return { color: '#d4a017', fontSize: 20, fontWeight: 'bold' };
    if (rank === 2) return { color: '#8c8c8c', fontSize: 18, fontWeight: 'bold' };
    if (rank === 3) return { color: '#b87333', fontSize: 16, fontWeight: 'bold' };
    return { color: '#4a4a4a', fontSize: 14 };
  }, []);

  const rowClassName = useCallback((record: Problem) => {
    return `ranking-row ranking-row-${record.id}`;
  }, []);

  const renderSortableHeader = (title: string, field: SortField) => {
    const isActive = sortField === field;
    const isAscend = isActive && sortOrder === 'ascend';
    const isDescend = isActive && sortOrder === 'descend';
    
    return (
      <div 
        onClick={() => handleSort(field)}
        style={{ 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '4px'
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: '10px', color: isActive ? '#1890ff' : '#bfbfbf' }}>
          {isAscend ? '▲' : isDescend ? '▼' : '▲▼'}
        </span>
      </div>
    );
  };

  const renderOnlineCountBadge = (count: number) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        gap: 2,
        height: 16
      }}>
        {[1, 2, 3, 4].map((level) => {
          const threshold = level * 25;
          const isActive = count >= threshold;
          const height = level * 3 + 5;
          return (
            <div
              key={level}
              style={{
                width: 3,
                height: height,
                backgroundColor: isActive 
                  ? count >= 75 ? '#ff4d4f' : count >= 50 ? '#ff7a45' : '#52c41a'
                  : '#d9d9d9',
                borderRadius: 1,
                transition: 'all 0.3s ease'
              }}
            />
          );
        })}
      </div>
      <span className="lc-online-badge" style={{ marginLeft: 4 }}>
        {count.toLocaleString()}
      </span>
    </div>
  );

  const columns: any[] = useMemo(() => [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      fixed: 'left',
      render: (_: any, _record: Problem, index: number) => (
        <span style={getRankStyle(index + 1)}>#{index + 1}</span>
      ),
    },
    {
      title: '题目',
      dataIndex: 'title',
      key: 'title',
      width: 350,
      ellipsis: true,
      render: (text: string, record: Problem) => (
        <Link 
          to={`https://leetcode.cn/problems/${record.slug}`} 
          target="_blank"
          className="lc-problem-title"
          style={{ fontSize: 15, fontWeight: 500 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ 
            display: 'inline-block',
            background: 'var(--lc-primary)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            marginRight: '8px'
          }}>
            {record.id}
          </span>
          {text}
          {record.topic_tags && record.topic_tags.length > 0 && (
            <span style={{ marginLeft: '10px', display: 'inline-flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
              {record.topic_tags.map((tag, idx) => (
                <span
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedTags(prev => 
                      prev.includes(tag) 
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: selectedTags.includes(tag) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #f5f7fa 0%, #e4e7f1 100%)',
                    color: selectedTags.includes(tag) ? '#fff' : '#5a6c7d',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedTags.includes(tag) 
                      ? '0 2px 4px rgba(102, 126, 234, 0.3)' 
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                    border: selectedTags.includes(tag) 
                      ? 'none' 
                      : '1px solid #d1d5db',
                    lineHeight: '1.2',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedTags.includes(tag)) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #e4e7f1 0%, #d1d5db 100%)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedTags.includes(tag)) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #e4e7f1 100%)';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                    }
                  }}
                >
                  {tag}
                </span>
              ))}
            </span>
          )}
        </Link>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 80,
      align: 'center' as const,
      render: (diff: string) => (
        <span className={getDifficultyClass(diff)}>
          <span className="lc-difficulty-dot"></span>
          {diff}
        </span>
      ),
    },
    {
      title: () => renderSortableHeader('中文站', 'cn'),
      dataIndex: 'online_count_cn',
      key: 'online_count_cn',
      width: 120,
      align: 'center' as const,
      render: (count: number) => renderOnlineCountBadge(count || 0),
    },
    {
      title: () => renderSortableHeader('国际站', 'com'),
      dataIndex: 'online_count_com',
      key: 'online_count_com',
      width: 120,
      align: 'center' as const,
      render: (count: number) => renderOnlineCountBadge(count || 0),
    },
    {
      title: () => renderSortableHeader('汇总', 'total'),
      dataIndex: 'online_count_total',
      key: 'online_count_total',
      width: 120,
      align: 'center' as const,
      render: (count: number, record: Problem) => renderOnlineCountBadge(count || record.online_count || 0),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: Problem) => (
        <Button 
          type="link" 
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/history?problemId=${record.id}`)}
        >
          查看详情
        </Button>
      ),
    },
  ], [getRankStyle, selectedTags, sortField, sortOrder]);

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
                padding: '2px 8px', 
                background: 'var(--lc-primary)', 
                color: '#fff', 
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                标签: {selectedTags.join(' + ')}
                <Button 
                  type="link" 
                  size="small" 
                  style={{ color: '#fff', padding: '0 4px', fontSize: '12px' }}
                  onClick={() => setSelectedTags([])}
                >
                  ✕
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
            scroll={{ x: 900 }}
            pagination={false}
            size="small"
            rowClassName={rowClassName}
            onRow={(record: Problem) => ({
              onClick: () => {
                navigate(`/history?problemId=${record.id}`);
              },
              style: { cursor: 'pointer' }
            })}
          />
        </div>
      </Card>
    </div>
  );
};

export default Rankings;
