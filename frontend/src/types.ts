// Types for the LeetCode Dashboard

export interface Problem {
  id?: string;
  frontend_id: string;
  slug: string;
  title: string;
  title_cn?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acceptance?: number;
  tags?: string[];
  online_count: number;
  online_count_cn?: number;
  online_count_com?: number;
  online_count_total?: number;
  last_updated: string;
  paid_only?: boolean;
  topic_tags?: string[];
}

export interface OnlineCount {
  id: number;
  frontend_id: string;
  count: number;
  count_cn?: number;
  count_com?: number;
  count_total?: number;
  timestamp: string;
}

export interface Hot100Item {
  rank: number;
  problem: Problem;
}

export interface Stats {
  totalProblems: number;
  totalOnline: number;
  topProblem: Problem | null;
  averageOnline: number;
}
