import { Problem } from '../../../types';

// 题目位置与在线人数关系
export const getPositionOnlineData = (problems: Problem[]) =>
  problems.slice(0, 20).map((p, index) => ({ 
    position: `${index + 1}`, 
    cn: p.online_count_cn || 0,
    com: p.online_count_com || 0,
    total: p.online_count,
    title: p.title.slice(0, 10)
  }));

// 题目位置与在线人数散点图数据
export const getPositionScatterData = (problems: Problem[]) =>
  problems.map((p, index) => ({
    position: index + 1,
    online: p.online_count,
    title: p.title.slice(0, 15),
    difficulty: p.difficulty
  }));

// 题目编号分组统计（每20题一组）
export const getIdGroupData = (problems: Problem[]) => {
  const calcGroup = (start: number, end: number) => {
    const group = problems.slice(start, end);
    return {
      avgOnline: group.length > 0 ? Math.round(group.reduce((sum, p) => sum + p.online_count, 0) / group.length) : 0,
      total: group.reduce((sum, p) => sum + p.online_count, 0),
    };
  };
  return [
    { range: '1-20题', ...calcGroup(0, 20) },
    { range: '21-40题', ...calcGroup(20, 40) },
    { range: '41-60题', ...calcGroup(40, 60) },
    { range: '61-80题', ...calcGroup(60, 80) },
    { range: '81-100题', ...calcGroup(80, 100) },
  ];
};

// 每10题分组统计
export const getIdGroup10Data = (problems: Problem[]) =>
  Array.from({ length: 10 }, (_, i) => {
    const start = i * 10;
    const end = start + 10;
    const group = problems.slice(start, end);
    return {
      range: `${start + 1}-${end}题`,
      avgOnline: group.length > 0 ? Math.round(group.reduce((sum, p) => sum + p.online_count, 0) / group.length) : 0,
      total: group.reduce((sum, p) => sum + p.online_count, 0),
      easyCount: group.filter(p => p.difficulty?.toUpperCase() === 'EASY').length,
      mediumCount: group.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length,
      hardCount: group.filter(p => p.difficulty?.toUpperCase() === 'HARD').length,
    };
  });

// 在线人数趋势
export const getOnlineTrendData = (problems: Problem[]) =>
  Array.from({ length: 10 }, (_, i) => {
    const start = i * 10;
    const end = start + 10;
    const group = problems.slice(start, end);
    return {
      position: `${start + 1}-${end}`,
      avgOnline: group.length > 0 ? Math.round(group.reduce((sum, p) => sum + p.online_count, 0) / group.length) : 0,
    };
  });

// 题目编号与在线人数相关性分析
export const getIdCorrelationData = (problems: Problem[]) => {
  const calc = (start: number, end: number) => {
    const group = problems.slice(start, end);
    return group.length > 0 ? Math.round(group.reduce((sum, p) => sum + p.online_count, 0) / group.length) : 0;
  };
  return [
    { range: '1-25', correlation: calc(0, 25) },
    { range: '26-50', correlation: calc(25, 50) },
    { range: '51-75', correlation: calc(50, 75) },
    { range: '76-100', correlation: calc(75, 100) },
  ];
};

// 帕累托分析数据
export const getParetoData = (problems: Problem[]) => {
  const sorted = [...problems].sort((a, b) => b.online_count - a.online_count);
  const total = problems.reduce((sum, item) => sum + item.online_count, 0);
  return sorted.slice(0, 30).map((p, index) => {
    const cumSum = sorted.slice(0, index + 1).reduce((sum, item) => sum + item.online_count, 0);
    return {
      rank: index + 1,
      title: p.title.slice(0, 10),
      online: p.online_count,
      cumulative: total > 0 ? Math.round((cumSum / total) * 100) : 0,
    };
  });
};
