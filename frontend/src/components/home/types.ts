// WebSocket 推送的题目数据
export interface WSProblem {
  frontend_id: string;
  slug?: string;
  title?: string;
  title_cn?: string;
  online_count?: number;
  online_count_cn?: number;
  online_count_com?: number;
  last_updated?: number;
}

// 难度颜色映射
export const difficultyColors: Record<string, { bg: string; text: string; border: string }> = {
  'Easy': { bg: '#f6ffed', text: '#52c41a', border: '#b7eb8f' },
  'Medium': { bg: '#fff7e6', text: '#fa8c16', border: '#ffd591' },
  'Hard': { bg: '#fff2f0', text: '#f5222d', border: '#ffccc7' },
};

// 统计数据类型
export interface HomeStats {
  totalOnline: number;
  totalOnlineCN: number;
  totalOnlineCOM: number;
  totalProblems: number;
  hotProblem: {
    title: string;
    online_count: number;
    online_count_cn: number;
    online_count_com: number;
  } | null;
}

// 计算统计数据类型
export interface ComputedStats {
  totalOnline: number;
  avgOnline: number;
  maxOnline: number;
  minOnline: number;
  medianOnline: number;
  top10Percentage: number;
  activeProblems: number;
  veryActiveProblems: number;
}
