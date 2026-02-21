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
  last_updated: string;
  paid_only?: boolean;
  topic_tags?: string[];
}

export interface OnlineCount {
  id: number;
  frontend_id: string;
  count: number;
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
