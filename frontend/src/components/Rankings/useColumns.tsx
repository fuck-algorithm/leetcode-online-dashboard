import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from 'antd';
import { Link } from 'react-router-dom';
import { EyeOutlined } from '@ant-design/icons';
import { Problem } from '../../types';
import { SortField, SortOrder, getDifficultyClass } from './types';
import { OnlineCountBadge } from './OnlineCountBadge';

interface UseColumnsProps {
  selectedTags: string[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onTagClick: (tag: string) => void;
  onNavigate: (problemId: string) => void;
  flashIds?: Set<string>;
}

export const useColumns = ({
  selectedTags,
  sortField,
  sortOrder,
  onSort,
  onTagClick,
  onNavigate,
  flashIds
}: UseColumnsProps) => {
  // 排序交互挂在表头单元格上，避免用 render 函数生成 title（Antd 会在隐藏的
  // measure row 里重复调用，产生不可见的按钮）。
  const sortableColumn = (title: string, field: SortField) => {
    const isActive = sortField === field;
    const onKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSort(field);
      }
    };

    return {
      title: (
        <span className={`ranking-sort-title${isActive ? ' is-active' : ''}`}>
          {title}
          <span className="ranking-sort-arrow">
            {isActive ? (sortOrder === 'ascend' ? '▲' : '▼') : '▲▼'}
          </span>
        </span>
      ),
      onHeaderCell: () => ({
        className: 'ranking-sort-col',
        onClick: () => onSort(field),
        onKeyDown,
        tabIndex: 0,
        role: 'button' as const,
        'aria-sort': isActive
          ? (sortOrder === 'ascend' ? 'ascending' as const : 'descending' as const)
          : 'none' as const,
      }),
    };
  };

  return useMemo(() => [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 64,
      align: 'center' as const,
      render: (_: any, _record: Problem, index: number) => (
        <span className={`ranking-rank${index < 3 ? ` ranking-rank--${index + 1}` : ''}`}>
          {index + 1}
        </span>
      ),
    },
    {
      title: '题目',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Problem) => {
        const tags = record.topic_tags || [];
        return (
          <div className="ranking-problem-cell">
            <Link
              to={`https://leetcode.cn/problems/${record.slug}`}
              target="_blank"
              className="ranking-problem-link"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="ranking-problem-id">{record.id}</span>
              <span className="ranking-problem-name">{text}</span>
            </Link>
            {tags.length > 0 && (
              <span className="ranking-tags" title={tags.join(' · ')}>
                {tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className={`ranking-tag${selectedTags.includes(tag) ? ' is-selected' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTagClick(tag);
                    }}
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > 3 && <span className="ranking-tag-more">+{tags.length - 3}</span>}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 86,
      align: 'center' as const,
      render: (diff: string) => (
        <span className={getDifficultyClass(diff)}>
          <span className="lc-difficulty-dot"></span>
          {diff}
        </span>
      ),
    },
    {
      ...sortableColumn('中文站', 'cn'),
      dataIndex: 'online_count_cn',
      key: 'online_count_cn',
      width: 104,
      align: 'center' as const,
      render: (count: number, record: Problem) => (
        <span
          className="ranking-count-cell"
          title="在 leetcode.cn 打开题目"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://leetcode.cn/problems/${record.slug}`, '_blank');
          }}
        >
          <OnlineCountBadge count={count || 0} tone="cn" flash={flashIds?.has(String(record.id))} />
        </span>
      ),
    },
    {
      ...sortableColumn('国际站', 'com'),
      dataIndex: 'online_count_com',
      key: 'online_count_com',
      width: 104,
      align: 'center' as const,
      render: (count: number, record: Problem) => (
        <span
          className="ranking-count-cell"
          title="在 leetcode.com 打开题目"
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://leetcode.com/problems/${record.slug}`, '_blank');
          }}
        >
          <OnlineCountBadge count={count || 0} tone="com" flash={flashIds?.has(String(record.id))} />
        </span>
      ),
    },
    {
      ...sortableColumn('汇总', 'total'),
      dataIndex: 'online_count_total',
      key: 'online_count_total',
      width: 110,
      align: 'center' as const,
      render: (count: number, record: Problem) => (
        <OnlineCountBadge
          count={count || record.online_count || 0}
          tone="total"
          flash={flashIds?.has(String(record.id))}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 92,
      align: 'center' as const,
      render: (_: any, record: Problem) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(String(record.id));
          }}
        >
          历史
        </Button>
      ),
    },
  ], [selectedTags, sortField, sortOrder, onSort, onTagClick, onNavigate, flashIds]);
};
