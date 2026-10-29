import { useMemo } from 'react';
import { Button } from 'antd';
import { Link } from 'react-router-dom';
import { EyeOutlined } from '@ant-design/icons';
import { Problem } from '../../types';
import { SortField, SortOrder, getDifficultyClass, getRankStyle } from './types';
import { OnlineCountBadge } from './OnlineCountBadge';

interface UseColumnsProps {
  selectedTags: string[];
  sortField: SortField;
  sortOrder: SortOrder;
  onTagClick: (tag: string) => void;
  onNavigate: (problemId: string) => void;
  flashIds?: Set<string>;
}

export const useColumns = ({ 
  selectedTags, 
  sortField, 
  sortOrder, 
  onTagClick,
  onNavigate,
  flashIds
}: UseColumnsProps) => {
  const renderSortableHeader = (title: string, field: SortField) => {
    const isActive = sortField === field;
    const isAscend = isActive && sortOrder === 'ascend';
    const isDescend = isActive && sortOrder === 'descend';
    
    return (
      <div 
        onClick={() => {}}
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

  return useMemo(() => [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
      fixed: 'left' as const,
      render: (_: any, _record: Problem, index: number) => (
        <span style={getRankStyle(index + 1)}>#{index + 1}</span>
      ),
    },
    {
      title: '题目',
      dataIndex: 'title',
      key: 'title',
      width: 280,
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
                    onTagClick(tag);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: selectedTags.includes(tag) ? '#FFD700' : 'linear-gradient(135deg, #f5f7fa 0%, #e4e7f1 100%)',
                    color: selectedTags.includes(tag) ? '#333' : '#5a6c7d',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedTags.includes(tag) 
                      ? '0 1px 3px rgba(0, 0, 0, 0.2)' 
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                    border: selectedTags.includes(tag) 
                      ? '1px solid #E6C200' 
                      : '1px solid #d1d5db',
                    lineHeight: '1.2',
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
      width: 70,
      align: 'center' as const,
      render: (diff: string) => (
        <span className={getDifficultyClass(diff)}>
          <span className="lc-difficulty-dot"></span>
          {diff}
        </span>
      ),
    },
    {
      title: () => renderSortableHeader('中文站（leetcode.cn）', 'cn'),
      dataIndex: 'online_count_cn',
      key: 'online_count_cn',
      width: 115,
      align: 'center' as const,
      render: (count: number, record: Problem) => (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 4,
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://leetcode.cn/problems/${record.slug}`, '_blank');
          }}
        >
          <span style={{ fontSize: '14px' }}>🇨🇳</span>
          <OnlineCountBadge count={count || 0} flash={flashIds?.has(String(record.id))} />
        </div>
      ),
    },
    {
      title: () => renderSortableHeader('国际站（leetcode.com）', 'com'),
      dataIndex: 'online_count_com',
      key: 'online_count_com',
      width: 115,
      align: 'center' as const,
      render: (count: number, record: Problem) => (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 4,
            cursor: 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://leetcode.com/problems/${record.slug}`, '_blank');
          }}
        >
          <span style={{ fontSize: '14px' }}>🇺🇸</span>
          <OnlineCountBadge count={count || 0} flash={flashIds?.has(String(record.id))} />
        </div>
      ),
    },
    {
      title: () => renderSortableHeader('在线人数汇总（中文站、国际站）', 'total'),
      dataIndex: 'online_count_total',
      key: 'online_count_total',
      width: 120,
      align: 'center' as const,
      render: (count: number, record: Problem) => <OnlineCountBadge count={count || record.online_count || 0} />,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: Problem) => (
        <Button 
          type="link" 
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onNavigate(String(record.id))}
        >
          查看详情
        </Button>
      ),
    },
  ], [selectedTags, sortField, sortOrder, onTagClick, onNavigate, flashIds]);
};
