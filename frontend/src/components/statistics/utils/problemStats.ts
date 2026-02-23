import { Problem } from '../../../types';

// 付费/免费分布
export const getPremiumData = (problems: Problem[]) => [
  { name: '免费', value: problems.filter(p => !p.paid_only).length, color: '#52c41a' },
  { name: '付费', value: problems.filter(p => p.paid_only).length, color: '#ff4d4f' },
];

// 付费/免费 vs 平均在线人数
export const getPremiumOnlineData = (problems: Problem[]) => {
  const calc = (paidOnly: boolean) => {
    const filtered = problems.filter(p => paidOnly ? p.paid_only : !p.paid_only);
    if (filtered.length === 0) return { avgCN: 0, avgCOM: 0, avgTotal: 0, count: 0 };
    const sum = filtered.reduce((acc, p) => ({
      cn: acc.cn + (p.online_count_cn || 0),
      com: acc.com + (p.online_count_com || 0),
      total: acc.total + p.online_count,
    }), { cn: 0, com: 0, total: 0 });
    return {
      avgCN: Math.round(sum.cn / filtered.length),
      avgCOM: Math.round(sum.com / filtered.length),
      avgTotal: Math.round(sum.total / filtered.length),
      count: filtered.length,
    };
  };
  return [
    { name: '免费', ...calc(false) },
    { name: '付费', ...calc(true) },
  ];
};

// 通过率分布分析
export const getAcceptanceDistribution = (problems: Problem[]) => [
  { range: '0-20%', count: problems.filter(p => (p.acceptance || 0) <= 0.2).length },
  { range: '21-40%', count: problems.filter(p => (p.acceptance || 0) > 0.2 && (p.acceptance || 0) <= 0.4).length },
  { range: '41-60%', count: problems.filter(p => (p.acceptance || 0) > 0.4 && (p.acceptance || 0) <= 0.6).length },
  { range: '61-80%', count: problems.filter(p => (p.acceptance || 0) > 0.6 && (p.acceptance || 0) <= 0.8).length },
  { range: '81-100%', count: problems.filter(p => (p.acceptance || 0) > 0.8).length },
];

// 标题长度分布
export const getTitleLengthData = (problems: Problem[]) => [
  { range: '短(1-10)', count: problems.filter(p => p.title.length <= 10).length },
  { range: '中(11-20)', count: problems.filter(p => p.title.length > 10 && p.title.length <= 20).length },
  { range: '长(21-30)', count: problems.filter(p => p.title.length > 20 && p.title.length <= 30).length },
  { range: '超长(31+)', count: problems.filter(p => p.title.length > 30).length },
];

// 中文标题可用性分析
export const getCnTitleData = (problems: Problem[]) => [
  { name: '有中文标题', value: problems.filter(p => p.title_cn && p.title_cn.length > 0).length, color: '#52c41a' },
  { name: '无中文标题', value: problems.filter(p => !p.title_cn || p.title_cn.length === 0).length, color: '#ff4d4f' },
];
