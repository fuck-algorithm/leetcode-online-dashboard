import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, message, Divider, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { fetchHot100, fetchPeakOnlineTimes } from '../api';
import { Problem } from '../types';

const { Title } = Typography;

const Statistics: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [, setPeaks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [problemsData, peaksData] = await Promise.all([
        fetchHot100(),
        fetchPeakOnlineTimes().catch(() => []),
      ]);
      setProblems(problemsData);
      setPeaks(peaksData || []);
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 难度分布数据
  const difficultyData = [
    { name: 'Easy', value: problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length, color: '#52c41a' },
    { name: 'Medium', value: problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length, color: '#faad14' },
    { name: 'Hard', value: problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length, color: '#ff4d4f' },
  ];

  // 付费/免费分布
  const premiumData = [
    { name: '免费', value: problems.filter(p => !p.paid_only).length, color: '#52c41a' },
    { name: '付费', value: problems.filter(p => p.paid_only).length, color: '#ff4d4f' },
  ];

  // 难度与平均在线人数关系
  const difficultyOnlineData = [
    { 
      name: 'Easy', 
      avgOnline: problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').reduce((sum, p) => sum + p.online_count, 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length)
        : 0 
    },
    { 
      name: 'Medium', 
      avgOnline: problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').reduce((sum, p) => sum + p.online_count, 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length)
        : 0 
    },
    { 
      name: 'Hard', 
      avgOnline: problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').reduce((sum, p) => sum + p.online_count, 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length)
        : 0 
    },
  ];

  // 热门标签统计
  const tagStats = problems.reduce((acc, problem) => {
    if (problem.topic_tags) {
      problem.topic_tags.forEach((tag: string) => {
        if (!acc[tag]) {
          acc[tag] = { count: 0, totalOnline: 0 };
        }
        acc[tag].count += 1;
        acc[tag].totalOnline += problem.online_count;
      });
    }
    return acc;
  }, {} as Record<string, { count: number; totalOnline: number }>);

  const topTags = Object.entries(tagStats)
    .map(([name, stats]) => ({ name, count: stats.count, avgOnline: Math.round(stats.totalOnline / stats.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 题目位置与在线人数关系（前20题）
  const positionOnlineData = problems
    .slice(0, 20)
    .map((p, index) => ({ 
      position: `${index + 1}`, 
      online: p.online_count,
      title: p.title.slice(0, 10)
    }));

  // 在线人数分布
  const onlineDistribution = [
    { range: '0-50', count: problems.filter(p => p.online_count <= 50).length },
    { range: '51-100', count: problems.filter(p => p.online_count > 50 && p.online_count <= 100).length },
    { range: '101-200', count: problems.filter(p => p.online_count > 100 && p.online_count <= 200).length },
    { range: '201-500', count: problems.filter(p => p.online_count > 200 && p.online_count <= 500).length },
    { range: '500+', count: problems.filter(p => p.online_count > 500).length },
  ];

  // Top 10 热门题目
  const top10Data = problems
    .slice()
    .sort((a, b) => b.online_count - a.online_count)
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), online: p.online_count }));

  // 标签与平均在线人数关系 (Top 8)
  const tagOnlineData = Object.entries(tagStats)
    .map(([name, stats]) => ({ name, avgOnline: Math.round(stats.totalOnline / stats.count) }))
    .sort((a, b) => b.avgOnline - a.avgOnline)
    .slice(0, 8);

  // 难度与在线人数散点图数据（用于替代通过率散点图）
  const difficultyScatterData = problems.map(p => ({
    difficultyValue: p.difficulty?.toUpperCase() === 'EASY' ? 1 : p.difficulty?.toUpperCase() === 'MEDIUM' ? 2 : 3,
    online: p.online_count,
    title: p.title.slice(0, 15),
    difficulty: p.difficulty
  }));

  // 最近活跃题目 (按最后更新时间排序，取前10)
  const recentlyActive = problems
    .slice()
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), lastUpdated: p.last_updated, online: p.online_count }));

  // 在线人数极值分析
  const highestOnlineProblems = problems
    .slice()
    .sort((a, b) => b.online_count - a.online_count)
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), online: p.online_count }));

  const lowestOnlineProblems = problems
    .slice()
    .sort((a, b) => a.online_count - b.online_count)
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), online: p.online_count }));

  // 题目位置与在线人数散点图数据（全部100题）
  const positionScatterData = problems.map((p, index) => ({
    position: index + 1,
    online: p.online_count,
    title: p.title.slice(0, 15),
    difficulty: p.difficulty
  }));

  // 在线人数区间与难度交叉分析
  const onlineRangeDifficultyData = [
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

  // 题目编号分组统计（每20题一组）
  const idGroupData = [
    { range: '1-20题', avgOnline: problems.slice(0, 20).length > 0 ? Math.round(problems.slice(0, 20).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(0, 20).length) : 0, total: problems.slice(0, 20).reduce((sum, p) => sum + p.online_count, 0) },
    { range: '21-40题', avgOnline: problems.slice(20, 40).length > 0 ? Math.round(problems.slice(20, 40).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(20, 40).length) : 0, total: problems.slice(20, 40).reduce((sum, p) => sum + p.online_count, 0) },
    { range: '41-60题', avgOnline: problems.slice(40, 60).length > 0 ? Math.round(problems.slice(40, 60).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(40, 60).length) : 0, total: problems.slice(40, 60).reduce((sum, p) => sum + p.online_count, 0) },
    { range: '61-80题', avgOnline: problems.slice(60, 80).length > 0 ? Math.round(problems.slice(60, 80).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(60, 80).length) : 0, total: problems.slice(60, 80).reduce((sum, p) => sum + p.online_count, 0) },
    { range: '81-100题', avgOnline: problems.slice(80, 100).length > 0 ? Math.round(problems.slice(80, 100).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(80, 100).length) : 0, total: problems.slice(80, 100).reduce((sum, p) => sum + p.online_count, 0) },
  ];

  // 标签数量分布统计
  const tagCountDistribution = [
    { range: '1-2个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 1 && (p.topic_tags?.length || 0) <= 2).length },
    { range: '3-4个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 3 && (p.topic_tags?.length || 0) <= 4).length },
    { range: '5-6个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 5 && (p.topic_tags?.length || 0) <= 6).length },
    { range: '7+个标签', count: problems.filter(p => (p.topic_tags?.length || 0) >= 7).length },
  ];

  // 更新时间段分布（按小时）
  const updateHourDistribution = (() => {
    const hours = Array(24).fill(0);
    problems.forEach(p => {
      const hour = new Date(p.last_updated).getHours();
      hours[hour]++;
    });
    return hours.map((count, hour) => ({ hour: `${hour}:00`, count })).filter(h => h.count > 0);
  })();

  // 1. 通过率分布分析
  const acceptanceDistribution = [
    { range: '0-20%', count: problems.filter(p => (p.acceptance || 0) <= 0.2).length },
    { range: '21-40%', count: problems.filter(p => (p.acceptance || 0) > 0.2 && (p.acceptance || 0) <= 0.4).length },
    { range: '41-60%', count: problems.filter(p => (p.acceptance || 0) > 0.4 && (p.acceptance || 0) <= 0.6).length },
    { range: '61-80%', count: problems.filter(p => (p.acceptance || 0) > 0.6 && (p.acceptance || 0) <= 0.8).length },
    { range: '81-100%', count: problems.filter(p => (p.acceptance || 0) > 0.8).length },
  ];

  // 2. 难度与通过率关系
  const difficultyAcceptanceData = [
    {
      name: 'Easy',
      avgAcceptance: problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').reduce((sum, p) => sum + (p.acceptance || 0), 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length * 100)
        : 0
    },
    {
      name: 'Medium',
      avgAcceptance: problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').reduce((sum, p) => sum + (p.acceptance || 0), 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length * 100)
        : 0
    },
    {
      name: 'Hard',
      avgAcceptance: problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').reduce((sum, p) => sum + (p.acceptance || 0), 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length * 100)
        : 0
    },
  ];

  // 3. 付费/免费 vs 平均在线人数
  const premiumOnlineData = [
    {
      name: '免费',
      avgOnline: problems.filter(p => !p.paid_only).length > 0
        ? Math.round(problems.filter(p => !p.paid_only).reduce((sum, p) => sum + p.online_count, 0) / problems.filter(p => !p.paid_only).length)
        : 0,
      count: problems.filter(p => !p.paid_only).length
    },
    {
      name: '付费',
      avgOnline: problems.filter(p => p.paid_only).length > 0
        ? Math.round(problems.filter(p => p.paid_only).reduce((sum, p) => sum + p.online_count, 0) / problems.filter(p => p.paid_only).length)
        : 0,
      count: problems.filter(p => p.paid_only).length
    },
  ];

  // 4. 每10题分组统计
  const idGroup10Data = Array.from({ length: 10 }, (_, i) => {
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

  // 5. 在线人数分位数分析
  const sortedOnline = problems.map(p => p.online_count).sort((a, b) => a - b);
  const percentile25 = sortedOnline[Math.floor(sortedOnline.length * 0.25)] || 0;
  const percentile50 = sortedOnline[Math.floor(sortedOnline.length * 0.5)] || 0;
  const percentile75 = sortedOnline[Math.floor(sortedOnline.length * 0.75)] || 0;
  const percentile90 = sortedOnline[Math.floor(sortedOnline.length * 0.9)] || 0;

  const percentileData = [
    { name: 'P25', value: percentile25, color: '#52c41a' },
    { name: 'P50', value: percentile50, color: '#1890ff' },
    { name: 'P75', value: percentile75, color: '#faad14' },
    { name: 'P90', value: percentile90, color: '#ff4d4f' },
  ];

  // 6. 头部题目在线人数占比分析
  const totalOnline = problems.reduce((sum, p) => sum + p.online_count, 0);
  const top5Online = problems.slice().sort((a, b) => b.online_count - a.online_count).slice(0, 5);
  const top10Online = problems.slice().sort((a, b) => b.online_count - a.online_count).slice(0, 10);
  const top20Online = problems.slice().sort((a, b) => b.online_count - a.online_count).slice(0, 20);

  const concentrationData = [
    { name: 'Top 5', percentage: Math.round(top5Online.reduce((sum, p) => sum + p.online_count, 0) / totalOnline * 100), count: 5 },
    { name: 'Top 10', percentage: Math.round(top10Online.reduce((sum, p) => sum + p.online_count, 0) / totalOnline * 100), count: 10 },
    { name: 'Top 20', percentage: Math.round(top20Online.reduce((sum, p) => sum + p.online_count, 0) / totalOnline * 100), count: 20 },
    { name: '其他', percentage: 100 - Math.round(top20Online.reduce((sum, p) => sum + p.online_count, 0) / totalOnline * 100), count: problems.length - 20 },
  ];

  // 7. 最近活跃题目的难度分布
  const recentProblems = problems.slice().sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()).slice(0, 20);
  const recentDifficultyData = [
    { name: 'Easy', value: recentProblems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length, color: '#52c41a' },
    { name: 'Medium', value: recentProblems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length, color: '#faad14' },
    { name: 'Hard', value: recentProblems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length, color: '#ff4d4f' },
  ];

  // 8. 更新日期分布（按天）
  const updateDateDistribution = (() => {
    const dateMap: Record<string, number> = {};
    problems.forEach(p => {
      const date = new Date(p.last_updated).toLocaleDateString('zh-CN');
      dateMap[date] = (dateMap[date] || 0) + 1;
    });
    return Object.entries(dateMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);
  })();

  // 9. 工作日vs周末更新分布
  const weekdayWeekendData = (() => {
    let weekday = 0;
    let weekend = 0;
    problems.forEach(p => {
      const day = new Date(p.last_updated).getDay();
      if (day === 0 || day === 6) {
        weekend++;
      } else {
        weekday++;
      }
    });
    return [
      { name: '工作日', value: weekday, color: '#1890ff' },
      { name: '周末', value: weekend, color: '#eb2f96' },
    ];
  })();

  // 10. 高频标签组合（取出现次数最多的前5个两两组合）
  const tagCombinationStats = (() => {
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
  })();

  // 11. 难度与标签数量关系
  const difficultyTagCountData = [
    {
      difficulty: 'Easy',
      avgTags: problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').reduce((sum, p) => sum + (p.topic_tags?.length || 0), 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length * 10) / 10
        : 0
    },
    {
      difficulty: 'Medium',
      avgTags: problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').reduce((sum, p) => sum + (p.topic_tags?.length || 0), 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length * 10) / 10
        : 0
    },
    {
      difficulty: 'Hard',
      avgTags: problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length > 0
        ? Math.round(problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').reduce((sum, p) => sum + (p.topic_tags?.length || 0), 0) / problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length * 10) / 10
        : 0
    },
  ];

  // 12. 在线人数标准差和方差
  const onlineMeanForVariance = problems.length > 0 ? totalOnline / problems.length : 0;
  const variance = problems.length > 0
    ? Math.round(problems.reduce((sum, p) => sum + Math.pow(p.online_count - onlineMeanForVariance, 2), 0) / problems.length)
    : 0;
  const stdDev = Math.round(Math.sqrt(variance));

  // 13. 标题长度分布
  const titleLengthData = [
    { range: '短(1-10)', count: problems.filter(p => p.title.length <= 10).length },
    { range: '中(11-20)', count: problems.filter(p => p.title.length > 10 && p.title.length <= 20).length },
    { range: '长(21-30)', count: problems.filter(p => p.title.length > 20 && p.title.length <= 30).length },
    { range: '超长(31+)', count: problems.filter(p => p.title.length > 30).length },
  ];

  // 14. 中文标题可用性分析
  const cnTitleData = [
    { name: '有中文标题', value: problems.filter(p => p.title_cn && p.title_cn.length > 0).length, color: '#52c41a' },
    { name: '无中文标题', value: problems.filter(p => !p.title_cn || p.title_cn.length === 0).length, color: '#ff4d4f' },
  ];

  // 15. 在线人数趋势（按题目位置分组平均）
  const onlineTrendData = Array.from({ length: 10 }, (_, i) => {
    const start = i * 10;
    const end = start + 10;
    const group = problems.slice(start, end);
    return {
      position: `${start + 1}-${end}`,
      avgOnline: group.length > 0 ? Math.round(group.reduce((sum, p) => sum + p.online_count, 0) / group.length) : 0,
    };
  });

  // 16. 特定热门标签在线人数对比
  const specificTags = ['Array', 'String', 'Dynamic Programming', 'Hash Table', 'Tree', 'Math'];
  const specificTagOnlineData = specificTags.map(tag => {
    const tagProblems = problems.filter(p => p.topic_tags?.includes(tag));
    return {
      name: tag,
      avgOnline: tagProblems.length > 0 ? Math.round(tagProblems.reduce((sum, p) => sum + p.online_count, 0) / tagProblems.length) : 0,
      count: tagProblems.length,
    };
  }).filter(t => t.count > 0).sort((a, b) => b.avgOnline - a.avgOnline);

  // 17. 难度雷达图数据
  const difficultyRadarData = [
    { subject: '题目数量', Easy: problems.filter(p => p.difficulty?.toUpperCase() === 'EASY').length, Medium: problems.filter(p => p.difficulty?.toUpperCase() === 'MEDIUM').length, Hard: problems.filter(p => p.difficulty?.toUpperCase() === 'HARD').length, fullMark: 100 },
    { subject: '平均在线', Easy: difficultyOnlineData[0]?.avgOnline || 0, Medium: difficultyOnlineData[1]?.avgOnline || 0, Hard: difficultyOnlineData[2]?.avgOnline || 0, fullMark: 500 },
    { subject: '平均通过率(%)', Easy: difficultyAcceptanceData[0]?.avgAcceptance || 0, Medium: difficultyAcceptanceData[1]?.avgAcceptance || 0, Hard: difficultyAcceptanceData[2]?.avgAcceptance || 0, fullMark: 100 },
    { subject: '平均标签数', Easy: difficultyTagCountData[0]?.avgTags || 0, Medium: difficultyTagCountData[1]?.avgTags || 0, Hard: difficultyTagCountData[2]?.avgTags || 0, fullMark: 10 },
  ];

  // 18. 在线人数变异系数分析（按难度）
  const cvData = ['EASY', 'MEDIUM', 'HARD'].map(diff => {
    const group = problems.filter(p => p.difficulty?.toUpperCase() === diff);
    if (group.length === 0) return { difficulty: diff, cv: 0 };
    const mean = group.reduce((sum, p) => sum + p.online_count, 0) / group.length;
    const variance = group.reduce((sum, p) => sum + Math.pow(p.online_count - mean, 2), 0) / group.length;
    const std = Math.sqrt(variance);
    return { difficulty: diff, cv: mean > 0 ? Math.round((std / mean) * 100) : 0 };
  });

  // 19. 最活跃标签（按平均在线人数）
  const activeTagsData = Object.entries(tagStats)
    .map(([name, stats]) => ({ name, avgOnline: Math.round(stats.totalOnline / stats.count), totalOnline: stats.totalOnline }))
    .sort((a, b) => b.avgOnline - a.avgOnline)
    .slice(0, 10);

  // 20. 题目编号与在线人数相关性分析（分段统计）
  const idCorrelationData = [
    { range: '1-25', correlation: problems.slice(0, 25).length > 0 ? Math.round(problems.slice(0, 25).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(0, 25).length) : 0 },
    { range: '26-50', correlation: problems.slice(25, 50).length > 0 ? Math.round(problems.slice(25, 50).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(25, 50).length) : 0 },
    { range: '51-75', correlation: problems.slice(50, 75).length > 0 ? Math.round(problems.slice(50, 75).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(50, 75).length) : 0 },
    { range: '76-100', correlation: problems.slice(75, 100).length > 0 ? Math.round(problems.slice(75, 100).reduce((sum, p) => sum + p.online_count, 0) / problems.slice(75, 100).length) : 0 },
  ];

  // 计算统计值
  const avgOnline = problems.length > 0 ? Math.round(totalOnline / problems.length) : 0;
  const maxOnline = problems.length > 0 ? Math.max(...problems.map(p => p.online_count)) : 0;
  const minOnline = problems.length > 0 ? Math.min(...problems.map(p => p.online_count)) : 0;

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div style={{ padding: '0 8px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>📊 总体概览</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ textAlign: 'center', background: 'linear-gradient(135deg, #1890ff 0%, #52c41a 100%)', border: 'none' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>总在线人数</span>} value={totalOnline} valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ textAlign: 'center', background: 'linear-gradient(135deg, #ff6b6b 0%, #ff9f43 100%)', border: 'none' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>平均每题在线</span>} value={avgOnline} valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ textAlign: 'center', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', border: 'none' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>最高在线人数</span>} value={maxOnline} valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ textAlign: 'center', background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', border: 'none' }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>最低在线人数</span>} value={minOnline} valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }} />
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>📈 分布分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="难度分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={difficultyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {difficultyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="在线人数分布">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={onlineDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#1677ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>📊 在线人数深度分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="在线人数区间分布">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={onlineDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}题`, '题目数']} />
                <Bar dataKey="count" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="难度与平均在线人数">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={difficultyOnlineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Bar dataKey="avgOnline" fill="#13c2c2" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="前20题在线人数分布">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={positionOnlineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" interval={2} />
                <YAxis />
                <Tooltip formatter={(value, _name, props) => [`${value}人`, props.payload.title]} />
                <Bar dataKey="online" fill="#fa8c16" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>🏷️ 难度与标签分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="付费/免费分布">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={premiumData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {premiumData.map((entry, index) => (
                    <Cell key={`cell-premium-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="难度与平均在线人数">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={difficultyOnlineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Bar dataKey="avgOnline" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Top 10 热门标签">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topTags} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value, name) => [name === 'count' ? `${value}题` : `${value}人`, name === 'count' ? '题目数' : '平均在线']} />
                <Bar dataKey="count" fill="#13c2c2" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>🔗 深度关联分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="标签平均在线人数 (Top 8)">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tagOnlineData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Bar dataKey="avgOnline" fill="#eb2f96" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="难度与在线人数散点图">
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="difficultyValue" name="难度" tickFormatter={(v) => v === 1 ? 'Easy' : v === 2 ? 'Medium' : 'Hard'} />
                <YAxis dataKey="online" name="在线人数" />
                <ZAxis range={[50, 50]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => {
                  if (name === 'difficultyValue') return [value === 1 ? 'Easy' : value === 2 ? 'Medium' : 'Hard', '难度'];
                  if (name === 'online') return [`${value}人`, '在线人数'];
                  return [value, name];
                }} />
                <Scatter data={difficultyScatterData} fill="#1677ff" />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="最近活跃题目 (Top 10)">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={recentlyActive} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value, name) => [name === 'online' ? `${value}人` : value, name === 'online' ? '在线人数' : '时间']} />
                <Bar dataKey="online" fill="#f5222d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>🏆 题目排行与极值分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="在线人数最高 Top 10">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={highestOnlineProblems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value) => [`${value}人`, '在线人数']} />
                <Bar dataKey="online" fill="#52c41a" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="在线人数最低 Top 10">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={lowestOnlineProblems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value) => [`${value}人`, '在线人数']} />
                <Bar dataKey="online" fill="#ff4d4f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="题目位置与在线人数散点图">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" name="题目位置" />
                <YAxis dataKey="online" name="在线人数" />
                <ZAxis range={[30, 30]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name, _props) => {
                  if (name === 'position') return [`#${value}`, '题目位置'];
                  if (name === 'online') return [`${value}人`, '在线人数'];
                  return [value, name];
                }} />
                <Scatter data={positionScatterData} fill="#13c2c2" />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>📊 进阶统计</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="在线人数区间与难度交叉分析">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={onlineRangeDifficultyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="easy" name="Easy" stackId="a" fill="#52c41a" />
                <Bar dataKey="medium" name="Medium" stackId="a" fill="#faad14" />
                <Bar dataKey="hard" name="Hard" stackId="a" fill="#ff4d4f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Top 10 热门题目">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10Data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value) => [`${value}人`, '在线人数']} />
                <Bar dataKey="online" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>🎯 通过率与难度深度分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="通过率分布">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={acceptanceDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}题`, '题目数']} />
                <Bar dataKey="count" fill="#52c41a" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="难度与平均通过率">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={difficultyAcceptanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, '平均通过率']} />
                <Bar dataKey="avgAcceptance" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="付费/免费平均在线对比">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={premiumOnlineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Bar dataKey="avgOnline" fill="#eb2f96" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>📊 在线人数统计特征分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <Card title="在线人数分位数">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={percentileData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '在线人数']} />
                <Bar dataKey="value" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title="在线人数集中度">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={concentrationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="percentage"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {concentrationData.map((_entry, index) => (
                    <Cell key={`cell-conc-${index}`} fill={['#ff4d4f', '#faad14', '#1890ff', '#52c41a'][index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, '占比']} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title="在线人数离散程度">
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Statistic title="方差" value={variance} suffix="人²" valueStyle={{ color: '#1890ff', fontSize: 24 }} />
              <Divider style={{ margin: '16px 0' }} />
              <Statistic title="标准差" value={stdDev} suffix="人" valueStyle={{ color: '#52c41a', fontSize: 24 }} />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title="变异系数 (按难度)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cvData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="difficulty" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, '变异系数']} />
                <Bar dataKey="cv" fill="#faad14" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>📈 题目分组与趋势分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="每10题分组统计（平均在线人数）">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={idGroup10Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Area type="monotone" dataKey="avgOnline" stroke="#1890ff" fill="#1890ff" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="在线人数趋势（按题目位置）">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={onlineTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Line type="monotone" dataKey="avgOnline" stroke="#52c41a" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>🔖 标签与元数据分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="高频标签组合 (Top 8)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tagCombinationStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value) => [`${value}次`, '出现次数']} />
                <Bar dataKey="count" fill="#13c2c2" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="难度与平均标签数量">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={difficultyTagCountData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="difficulty" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}个`, '平均标签数']} />
                <Bar dataKey="avgTags" fill="#eb2f96" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="特定热门标签在线人数">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={specificTagOnlineData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value, name) => [name === 'avgOnline' ? `${value}人` : `${value}题`, name === 'avgOnline' ? '平均在线' : '题目数']} />
                <Bar dataKey="avgOnline" fill="#faad14" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>⏰ 更新模式与时间分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="更新日期分布 (最近10天)">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={updateDateDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}题`, '更新数']} />
                <Bar dataKey="count" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="工作日 vs 周末更新">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={weekdayWeekendData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {weekdayWeekendData.map((entry, index) => (
                    <Cell key={`cell-ww-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="最近活跃题目的难度分布">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={recentDifficultyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {recentDifficultyData.map((entry, index) => (
                    <Cell key={`cell-rd-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>📝 题目属性与质量分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="标题长度分布">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={titleLengthData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ range, count }) => `${range}: ${count}`}
                >
                  <Cell fill="#52c41a" />
                  <Cell fill="#1890ff" />
                  <Cell fill="#faad14" />
                  <Cell fill="#ff4d4f" />
                </Pie>
                <Tooltip formatter={(value) => [`${value}题`, '数量']} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="中文标题可用性">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={cnTitleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {cnTitleData.map((entry, index) => (
                    <Cell key={`cell-cn-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="最活跃标签 (按平均在线)">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={activeTagsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Bar dataKey="avgOnline" fill="#13c2c2" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>🎨 综合雷达分析</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="难度维度雷达图">
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={difficultyRadarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis />
                <Radar name="Easy" dataKey="Easy" stroke="#52c41a" fill="#52c41a" fillOpacity={0.3} />
                <Radar name="Medium" dataKey="Medium" stroke="#faad14" fill="#faad14" fillOpacity={0.3} />
                <Radar name="Hard" dataKey="Hard" stroke="#ff4d4f" fill="#ff4d4f" fillOpacity={0.3} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="题号段与在线人数相关性">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={idCorrelationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Bar dataKey="correlation" fill="#eb2f96" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>� 额外洞察（原始分析）</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="题目编号分组平均在线人数">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={idGroupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}人`, '平均在线']} />
                <Bar dataKey="avgOnline" fill="#13c2c2" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="标签数量分布">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tagCountDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}题`, '题目数']} />
                <Bar dataKey="count" fill="#eb2f96" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="更新时间段分布">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={updateHourDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}题`, '更新数']} />
                <Bar dataKey="count" fill="#faad14" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />
      <Title level={4} style={{ marginBottom: 16 }}>�📋 综合概览统计</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <Card>
            <Statistic title="总题数" value={problems.length} suffix="题" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card>
            <Statistic title="免费题目" value={problems.filter(p => !p.paid_only).length} suffix="题" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card>
            <Statistic title="付费题目" value={problems.filter(p => p.paid_only).length} suffix="题" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card>
            <Statistic title="有中文标题" value={problems.filter(p => p.title_cn).length} suffix="题" valueStyle={{ color: '#13c2c2' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Statistics;
