import { Problem } from '../../../types';

// 难度分布数据
export const getDifficultyData = (problems: Problem[]) => [
  { name: 'Easy', value: problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length, color: '#52c41a' },
  { name: 'Medium', value: problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length, color: '#faad14' },
  { name: 'Hard', value: problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length, color: '#ff4d4f' },
];

// 难度与平均在线人数关系
export const getDifficultyOnlineData = (problems: Problem[]) => {
  const calc = (difficulty: string) => {
    const filtered = problems.filter(p => p.difficulty?.toUpperCase() === difficulty);
    if (filtered.length === 0) return { avgCN: 0, avgCOM: 0, avgTotal: 0 };
    const sum = filtered.reduce((acc, p) => ({
      cn: acc.cn + (p.online_count_cn || 0),
      com: acc.com + (p.online_count_com || 0),
      total: acc.total + p.online_count,
    }), { cn: 0, com: 0, total: 0 });
    return {
      avgCN: Math.round(sum.cn / filtered.length),
      avgCOM: Math.round(sum.com / filtered.length),
      avgTotal: Math.round(sum.total / filtered.length),
    };
  };
  return [
    { name: 'Easy', ...calc('EASY') },
    { name: 'Medium', ...calc('MEDIUM') },
    { name: 'Hard', ...calc('HARD') },
  ];
};

// 难度与通过率关系
export const getDifficultyAcceptanceData = (problems: Problem[]) => {
  const calc = (difficulty: string) => {
    const filtered = problems.filter(p => p.difficulty?.toUpperCase() === difficulty);
    return filtered.length > 0
      ? Math.round(filtered.reduce((sum, p) => sum + (p.acceptance || 0), 0) / filtered.length * 100)
      : 0;
  };
  return [
    { name: 'Easy', avgAcceptance: calc('EASY') },
    { name: 'Medium', avgAcceptance: calc('MEDIUM') },
    { name: 'Hard', avgAcceptance: calc('HARD') },
  ];
};

// 难度与标签数量关系
export const getDifficultyTagCountData = (problems: Problem[]) => {
  const calc = (difficulty: string) => {
    const filtered = problems.filter(p => p.difficulty?.toUpperCase() === difficulty);
    return filtered.length > 0
      ? Math.round(filtered.reduce((sum, p) => sum + (p.topic_tags?.length || 0), 0) / filtered.length * 10) / 10
      : 0;
  };
  return [
    { difficulty: 'Easy', avgTags: calc('EASY') },
    { difficulty: 'Medium', avgTags: calc('MEDIUM') },
    { difficulty: 'Hard', avgTags: calc('HARD') },
  ];
};

// 难度雷达图数据
export const getDifficultyRadarData = (problems: Problem[]) => {
  const diffOnline = getDifficultyOnlineData(problems);
  const diffAccept = getDifficultyAcceptanceData(problems);
  const diffTags = getDifficultyTagCountData(problems);
  return [
    { subject: '题目数量', Easy: problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length, Medium: problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length, Hard: problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length, fullMark: 100 },
    { subject: '平均在线(CN)', Easy: diffOnline[0]?.avgCN || 0, Medium: diffOnline[1]?.avgCN || 0, Hard: diffOnline[2]?.avgCN || 0, fullMark: 500 },
    { subject: '平均在线(COM)', Easy: diffOnline[0]?.avgCOM || 0, Medium: diffOnline[1]?.avgCOM || 0, Hard: diffOnline[2]?.avgCOM || 0, fullMark: 500 },
    { subject: '平均在线(总)', Easy: diffOnline[0]?.avgTotal || 0, Medium: diffOnline[1]?.avgTotal || 0, Hard: diffOnline[2]?.avgTotal || 0, fullMark: 500 },
    { subject: '平均通过率(%)', Easy: diffAccept[0]?.avgAcceptance || 0, Medium: diffAccept[1]?.avgAcceptance || 0, Hard: diffAccept[2]?.avgAcceptance || 0, fullMark: 100 },
    { subject: '平均标签数', Easy: diffTags[0]?.avgTags || 0, Medium: diffTags[1]?.avgTags || 0, Hard: diffTags[2]?.avgTags || 0, fullMark: 10 },
  ];
};

// 在线人数变异系数分析
export const getCvData = (problems: Problem[]) =>
  ['EASY', 'MEDIUM', 'HARD'].map(diff => {
    const group = problems.filter(p => p.difficulty?.toUpperCase() === diff);
    if (group.length === 0) return { difficulty: diff, cv: 0 };
    const mean = group.reduce((sum, p) => sum + p.online_count, 0) / group.length;
    const variance = group.reduce((sum, p) => sum + Math.pow(p.online_count - mean, 2), 0) / group.length;
    const std = Math.sqrt(variance);
    return { difficulty: diff, cv: mean > 0 ? Math.round((std / mean) * 100) : 0 };
  });

// 最近活跃题目的难度分布
export const getRecentDifficultyData = (problems: Problem[]) => {
  const recent = [...problems]
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, 20);
  return [
    { name: 'Easy', value: recent.filter(p => p.difficulty?.toUpperCase() === 'EASY').length, color: '#52c41a' },
    { name: 'Medium', value: recent.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length, color: '#faad14' },
    { name: 'Hard', value: recent.filter(p => p.difficulty?.toUpperCase() === 'HARD').length, color: '#ff4d4f' },
  ];
};

// 难度与在线人数散点图数据
export const getDifficultyScatterData = (problems: Problem[]) =>
  problems.map(p => ({
    difficultyValue: p.difficulty?.toUpperCase() === 'EASY' ? 1 : p.difficulty?.toUpperCase() === 'MEDIUM' ? 2 : 3,
    online: p.online_count,
    title: p.title.slice(0, 15),
    difficulty: p.difficulty
  }));

// 在线人数区间与难度交叉分析
export const getOnlineRangeDifficultyData = (problems: Problem[]) => [
  { 
    range: '0-50人', 
    easy: problems.filter(p => p.online_count <= 50 && p.difficulty?.toUpperCase() === 'EASY').length,
    medium: problems.filter(p => p.online_count <= 50 && p.difficulty?.toUpperCase() === 'MEDIUM').length,
    hard: problems.filter(p => p.online_count <= 50 && p.difficulty?.toUpperCase() === 'HARD').length,
  },
  { 
    range: '51-100人', 
    easy: problems.filter(p => p.online_count > 50 && p.online_count <= 100 && p.difficulty?.toUpperCase() === 'EASY').length,
    medium: problems.filter(p => p.online_count > 50 && p.online_count <= 100 && p.difficulty?.toUpperCase() === 'MEDIUM').length,
    hard: problems.filter(p => p.online_count > 50 && p.online_count <= 100 && p.difficulty?.toUpperCase() === 'HARD').length,
  },
  { 
    range: '101-200人', 
    easy: problems.filter(p => p.online_count > 100 && p.online_count <= 200 && p.difficulty?.toUpperCase() === 'EASY').length,
    medium: problems.filter(p => p.online_count > 100 && p.online_count <= 200 && p.difficulty?.toUpperCase() === 'MEDIUM').length,
    hard: problems.filter(p => p.online_count > 100 && p.online_count <= 200 && p.difficulty?.toUpperCase() === 'HARD').length,
  },
  { 
    range: '200+人', 
    easy: problems.filter(p => p.online_count > 200 && p.difficulty?.toUpperCase() === 'EASY').length,
    medium: problems.filter(p => p.online_count > 200 && p.difficulty?.toUpperCase() === 'MEDIUM').length,
    hard: problems.filter(p => p.online_count > 200 && p.difficulty?.toUpperCase() === 'HARD').length,
  },
];
