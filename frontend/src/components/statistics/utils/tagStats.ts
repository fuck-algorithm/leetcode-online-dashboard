import { Problem } from '../../../types';

// 热门标签统计
export const getTagStats = (problems: Problem[]) => {
  return problems.reduce((acc, problem) => {
    if (problem.topic_tags) {
      problem.topic_tags.forEach((tag: string) => {
        if (!acc[tag]) {
          acc[tag] = { count: 0, totalCN: 0, totalCOM: 0, totalOnline: 0 };
        }
        acc[tag].count += 1;
        acc[tag].totalCN += problem.online_count_cn || 0;
        acc[tag].totalCOM += problem.online_count_com || 0;
        acc[tag].totalOnline += problem.online_count;
      });
    }
    return acc;
  }, {} as Record<string, { count: number; totalCN: number; totalCOM: number; totalOnline: number }>);
};

// Top 标签
export const getTopTags = (problems: Problem[]) => {
  const tagStats = getTagStats(problems);
  return Object.entries(tagStats)
    .map(([name, stats]) => ({ 
      name, 
      count: stats.count, 
      avgCN: Math.round(stats.totalCN / stats.count),
      avgCOM: Math.round(stats.totalCOM / stats.count),
      avgTotal: Math.round(stats.totalOnline / stats.count)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

// 标签在线人数数据
export const getTagOnlineData = (problems: Problem[]) => {
  const tagStats = getTagStats(problems);
  return Object.entries(tagStats)
    .map(([name, stats]) => ({ 
      name, 
      avgCN: Math.round(stats.totalCN / stats.count),
      avgCOM: Math.round(stats.totalCOM / stats.count),
      avgTotal: Math.round(stats.totalOnline / stats.count)
    }))
    .sort((a, b) => b.avgTotal - a.avgTotal)
    .slice(0, 8);
};

// 标签数量分布统计
export const getTagCountDistribution = (problems: Problem[]) => [
  { range: '1-2个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 1 && (p.topic_tags?.length || 0) <= 2).length },
  { range: '3-4个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 3 && (p.topic_tags?.length || 0) <= 4).length },
  { range: '5-6个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 5 && (p.topic_tags?.length || 0) <= 6).length },
  { range: '7+个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 7).length },
];

// 高频标签组合
export const getTagCombinationStats = (problems: Problem[]) => {
  const combinations: Record<string, number> = {};
  problems.forEach(p => {
    const tags = p.topic_tags || [];
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i], tags[j]].sort().join(' + ');
        combinations[key] = (combinations[key] || 0) + 1;
      }
    }
  });
  return Object.entries(combinations)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
};

// 最活跃标签
export const getActiveTagsData = (problems: Problem[]) => {
  const tagStats = getTagStats(problems);
  return Object.entries(tagStats)
    .map(([name, stats]) => ({ 
      name, 
      avgCN: Math.round(stats.totalCN / stats.count),
      avgCOM: Math.round(stats.totalCOM / stats.count),
      avgTotal: Math.round(stats.totalOnline / stats.count),
      totalOnline: stats.totalOnline 
    }))
    .sort((a, b) => b.avgTotal - a.avgTotal)
    .slice(0, 10);
};

// 特定热门标签在线人数对比
export const getSpecificTagOnlineData = (problems: Problem[]) => {
  const specificTags = ['Array', 'String', 'Dynamic Programming', 'Hash Table', 'Tree', 'Math'];
  return specificTags.map(tag => {
    const tagProblems = problems.filter(p => p.topic_tags?.includes(tag));
    return {
      name: tag,
      avgCN: tagProblems.length > 0 ? Math.round(tagProblems.reduce((sum, p) => sum + (p.online_count_cn || 0), 0) / tagProblems.length) : 0,
      avgCOM: tagProblems.length > 0 ? Math.round(tagProblems.reduce((sum, p) => sum + (p.online_count_com || 0), 0) / tagProblems.length) : 0,
      avgTotal: tagProblems.length > 0 ? Math.round(tagProblems.reduce((sum, p) => sum + p.online_count, 0) / tagProblems.length) : 0,
      count: tagProblems.length,
    };
  }).filter(t => t.count > 0).sort((a, b) => b.avgTotal - a.avgTotal);
};
