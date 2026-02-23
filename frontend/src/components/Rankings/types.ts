import React from 'react';

export interface WSProblem {
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

export type SortField = 'cn' | 'com' | 'total';
export type SortOrder = 'ascend' | 'descend';

export const formatSlug = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getDifficultyClass = (difficulty: string): string => {
  const diff = difficulty.toLowerCase();
  switch (diff) {
    case 'easy': return 'lc-difficulty lc-difficulty-easy';
    case 'medium': return 'lc-difficulty lc-difficulty-medium';
    case 'hard': return 'lc-difficulty lc-difficulty-hard';
    default: return 'lc-difficulty lc-difficulty-medium';
  }
};

export const getRankStyle = (rank: number): React.CSSProperties => {
  if (rank === 1) return { color: '#d4a017', fontSize: 20, fontWeight: 'bold' };
  if (rank === 2) return { color: '#8c8c8c', fontSize: 18, fontWeight: 'bold' };
  if (rank === 3) return { color: '#b87333', fontSize: 16, fontWeight: 'bold' };
  return { color: '#4a4a4a', fontSize: 14 };
};
