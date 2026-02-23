import { Problem } from '../../../types';

// 在线人数分布
export const getOnlineDistribution = (problems: Problem[]) => [
  { range: '0-50', count: problems.filter(p => p.online_count <= 50).length, cn: problems.filter(p => (p.online_count_cn || 0) <= 50).length, com: problems.filter(p => (p.online_count_com || 0) <= 50).length },
  { range: '51-100', count: problems.filter(p => p.online_count > 50 && p.online_count <= 100).length, cn: problems.filter(p => (p.online_count_cn || 0) > 50 && (p.online_count_cn || 0) <= 100).length, com: problems.filter(p => (p.online_count_com || 0) > 50 && (p.online_count_com || 0) <= 100).length },
  { range: '101-200', count: problems.filter(p => p.online_count > 100 && p.online_count <= 200).length, cn: problems.filter(p => (p.online_count_cn || 0) > 100 && (p.online_count_cn || 0) <= 200).length, com: problems.filter(p => (p.online_count_com || 0) > 100 && (p.online_count_com || 0) <= 200).length },
  { range: '201-500', count: problems.filter(p => p.online_count > 200 && p.online_count <= 500).length, cn: problems.filter(p => (p.online_count_cn || 0) > 200 && (p.online_count_cn || 0) <= 500).length, com: problems.filter(p => (p.online_count_com || 0) > 200 && (p.online_count_com || 0) <= 500).length },
  { range: '500+', count: problems.filter(p => p.online_count > 500).length, cn: problems.filter(p => (p.online_count_cn || 0) > 500).length, com: problems.filter(p => (p.online_count_com || 0) > 500).length },
];

// 统计值计算
export const getTotalOnlineCN = (problems: Problem[]) => problems.reduce((sum, p) => sum + (p.online_count_cn || 0), 0);
export const getTotalOnlineCOM = (problems: Problem[]) => problems.reduce((sum, p) => sum + (p.online_count_com || 0), 0);
export const getTotalOnline = (problems: Problem[]) => problems.reduce((sum, p) => sum + p.online_count, 0);

// 基尼系数计算
export const calculateGini = (values: number[]): number => {
  if (values.length === 0) return 0;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sum += Math.abs(values[i] - values[j]);
    }
  }
  return sum / (2 * n * n * mean);
};

// 头部集中度计算
export const calculateConcentration = (sorted: Problem[], key: 'online_count' | 'online_count_cn' | 'online_count_com') => {
  const total = sorted.reduce((sum, p) => sum + (key === 'online_count' ? p.online_count : (p[key] || 0)), 0);
  const top10 = sorted.slice(0, 10).reduce((sum, p) => sum + (key === 'online_count' ? p.online_count : (p[key] || 0)), 0);
  const top20 = sorted.slice(0, 20).reduce((sum, p) => sum + (key === 'online_count' ? p.online_count : (p[key] || 0)), 0);
  const top30 = sorted.slice(0, 30).reduce((sum, p) => sum + (key === 'online_count' ? p.online_count : (p[key] || 0)), 0);
  return {
    top10Percent: total > 0 ? Math.round((top10 / total) * 100 * 10) / 10 : 0,
    top20Percent: total > 0 ? Math.round((top20 / total) * 100 * 10) / 10 : 0,
    top30Percent: total > 0 ? Math.round((top30 / total) * 100 * 10) / 10 : 0,
  };
};

// 头部集中度数据
export const getHeadConcentrationData = (problems: Problem[]) => {
  const sortedByOnline = [...problems].sort((a, b) => b.online_count - a.online_count);
  const sortedByCN = [...problems].sort((a, b) => (b.online_count_cn || 0) - (a.online_count_cn || 0));
  const sortedByCOM = [...problems].sort((a, b) => (b.online_count_com || 0) - (a.online_count_com || 0));

  const concentrationTotal = calculateConcentration(sortedByOnline, 'online_count');
  const concentrationCN = calculateConcentration(sortedByCN, 'online_count_cn');
  const concentrationCOM = calculateConcentration(sortedByCOM, 'online_count_com');

  return [
    { name: 'Top 10题', cn: concentrationCN.top10Percent, com: concentrationCOM.top10Percent, total: concentrationTotal.top10Percent },
    { name: 'Top 20题', cn: concentrationCN.top20Percent, com: concentrationCOM.top20Percent, total: concentrationTotal.top20Percent },
    { name: 'Top 30题', cn: concentrationCN.top30Percent, com: concentrationCOM.top30Percent, total: concentrationTotal.top30Percent },
  ];
};

// 基尼系数数据
export const getGiniData = (problems: Problem[]) => ({
  giniTotal: calculateGini(problems.map(p => p.online_count)),
  giniCN: calculateGini(problems.map(p => p.online_count_cn || 0)),
  giniCOM: calculateGini(problems.map(p => p.online_count_com || 0)),
});

// 在线人数分位数分析
export const getPercentileData = (problems: Problem[]) => {
  const sorted = problems.map(p => p.online_count).sort((a, b) => a - b);
  const calc = (p: number) => sorted[Math.floor(sorted.length * p)] || 0;
  return [
    { name: 'P25', value: calc(0.25), color: '#52c41a' },
    { name: 'P50', value: calc(0.5), color: '#1890ff' },
    { name: 'P75', value: calc(0.75), color: '#faad14' },
    { name: 'P90', value: calc(0.9), color: '#ff4d4f' },
  ];
};

// 头部题目在线人数占比分析
export const getConcentrationData = (problems: Problem[]) => {
  const total = problems.reduce((sum, p) => sum + p.online_count, 0);
  const sorted = [...problems].sort((a, b) => b.online_count - a.online_count);
  const top5 = sorted.slice(0, 5);
  const top10 = sorted.slice(0, 10);
  const top20 = sorted.slice(0, 20);
  return [
    { name: 'Top 5', percentage: Math.round(top5.reduce((sum, p) => sum + p.online_count, 0) / total * 100), count: 5 },
    { name: 'Top 10', percentage: Math.round(top10.reduce((sum, p) => sum + p.online_count, 0) / total * 100), count: 10 },
    { name: 'Top 20', percentage: Math.round(top20.reduce((sum, p) => sum + p.online_count, 0) / total * 100), count: 20 },
    { name: '其他', percentage: 100 - Math.round(top20.reduce((sum, p) => sum + p.online_count, 0) / total * 100), count: problems.length - 20 },
  ];
};

// 在线人数标准差和方差
export const getVarianceData = (problems: Problem[]) => {
  const total = getTotalOnline(problems);
  const mean = problems.length > 0 ? total / problems.length : 0;
  const variance = problems.length > 0
    ? Math.round(problems.reduce((sum, p) => sum + Math.pow(p.online_count - mean, 2), 0) / problems.length)
    : 0;
  return { variance, stdDev: Math.round(Math.sqrt(variance)) };
};

// Top 10 热门题目
export const getTop10Data = (problems: Problem[]) => 
  [...problems]
    .sort((a, b) => b.online_count - a.online_count)
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), cn: p.online_count_cn || 0, com: p.online_count_com || 0, total: p.online_count }));

// 在线人数最高/最低题目
export const getHighestOnlineProblems = (problems: Problem[]) =>
  [...problems]
    .sort((a, b) => b.online_count - a.online_count)
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), online: p.online_count }));

export const getLowestOnlineProblems = (problems: Problem[]) =>
  [...problems]
    .sort((a, b) => a.online_count - b.online_count)
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), online: p.online_count }));
