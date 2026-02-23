import { Problem } from '../../../types';

// 最近活跃题目
export const getRecentlyActive = (problems: Problem[]) =>
  [...problems]
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, 10)
    .map(p => ({ name: p.title.slice(0, 15), lastUpdated: p.last_updated, online: p.online_count }));

// 更新时间段分布
export const getUpdateHourDistribution = (problems: Problem[]) => {
  const hours = Array(24).fill(0);
  problems.forEach(p => {
    const hour = new Date(p.last_updated).getHours();
    hours[hour]++;
  });
  return hours.map((count, hour) => ({ hour: `${hour}:00`, count })).filter(h => h.count > 0);
};

// 更新日期分布
export const getUpdateDateDistribution = (problems: Problem[]) => {
  const dateMap: Record<string, number> = {};
  problems.forEach(p => {
    const date = new Date(p.last_updated).toLocaleDateString('zh-CN');
    dateMap[date] = (dateMap[date] || 0) + 1;
  });
  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10);
};

// 工作日vs周末更新分布
export const getWeekdayWeekendData = (problems: Problem[]) => {
  let weekday = 0;
  let weekend = 0;
  problems.forEach(p => {
    const day = new Date(p.last_updated).getDay();
    if (day === 0 || day === 6) weekend++;
    else weekday++;
  });
  return [
    { name: '工作日', value: weekday, color: '#1890ff' },
    { name: '周末', value: weekend, color: '#eb2f96' },
  ];
};
