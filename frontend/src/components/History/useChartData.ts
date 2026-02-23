import { useMemo } from 'react';
import dayjs from 'dayjs';
import { OnlineCount } from '../../types';
import { Stats, ChartDataPoint, HourAverageDataPoint } from './types';

export const useChartData = (
  historyData: OnlineCount[],
  timeRange: [dayjs.Dayjs, dayjs.Dayjs]
): ChartDataPoint[] => {
  return useMemo(() => {
    if (historyData.length === 0) return [];
    
    const result = [];
    const [start, end] = timeRange;
    const startTime = start.startOf('minute');
    const endTime = end.endOf('minute');
    
    const totalMinutes = endTime.diff(startTime, 'minute');
    const interval = totalMinutes > 7 * 24 * 60 ? 60 : totalMinutes > 2 * 24 * 60 ? 10 : 1;
    const matchWindow = Math.max(2, interval);
    
    for (let t = startTime; t.isBefore(endTime) || t.isSame(endTime); t = t.add(interval, 'minute')) {
      const currentTime = t.valueOf();
      let countCN = 0, countCOM = 0, countTotal = 0;
      let minDiff = Infinity;
      
      for (const item of historyData) {
        const itemTime = dayjs(item.timestamp).valueOf();
        const diffMinutes = Math.abs(itemTime - currentTime) / (1000 * 60);
        
        if (diffMinutes <= matchWindow && diffMinutes < minDiff) {
          countCN = item.count_cn || 0;
          countCOM = item.count_com || 0;
          countTotal = item.count_total || countCN + countCOM;
          minDiff = diffMinutes;
        }
      }
      
      result.push({
        time: t.format('MM-DD HH:mm'),
        countCN,
        countCOM,
        countTotal,
        fullTime: t.toISOString(),
      });
    }
    
    return result;
  }, [historyData, timeRange]);
};

export const useHourAverageData = (historyData: OnlineCount[]): HourAverageDataPoint[] => {
  return useMemo(() => {
    if (historyData.length === 0) return [];
    
    const hourGroups: { [key: number]: { totalCN: number; totalCOM: number; count: number } } = {};
    
    for (let h = 0; h < 24; h++) {
      hourGroups[h] = { totalCN: 0, totalCOM: 0, count: 0 };
    }
    
    historyData.forEach(item => {
      const countCN = item.count_cn || 0;
      const countCOM = item.count_com || 0;
      if (countCN > 0 || countCOM > 0) {
        const hour = dayjs(item.timestamp).hour();
        hourGroups[hour].totalCN += countCN;
        hourGroups[hour].totalCOM += countCOM;
        hourGroups[hour].count += 1;
      }
    });
    
    const result = [];
    for (let h = 0; h < 24; h++) {
      const data = hourGroups[h];
      result.push({
        time: `${String(h).padStart(2, '0')}:00`,
        avgCountCN: data.count > 0 ? Math.round(data.totalCN / data.count) : 0,
        avgCountCOM: data.count > 0 ? Math.round(data.totalCOM / data.count) : 0,
        sampleCount: data.count,
      });
    }
    
    return result;
  }, [historyData]);
};

export const useStats = (historyData: OnlineCount[]): Stats => {
  return useMemo(() => {
    if (historyData.length === 0) {
      return { 
        max: { cn: 0, com: 0, total: 0 }, 
        min: { cn: 0, com: 0, total: 0 }, 
        avg: { cn: 0, com: 0, total: 0 }, 
        current: { cn: 0, com: 0, total: 0 } 
      };
    }
    
    const cnCounts = historyData.map(h => h.count_cn || 0);
    const comCounts = historyData.map(h => h.count_com || 0);
    const totalCounts = historyData.map(h => h.count_total || (h.count_cn || 0) + (h.count_com || 0));
    
    const lastItem = historyData[historyData.length - 1];
    
    return {
      max: {
        cn: Math.max(...cnCounts),
        com: Math.max(...comCounts),
        total: Math.max(...totalCounts),
      },
      min: {
        cn: Math.min(...cnCounts),
        com: Math.min(...comCounts),
        total: Math.min(...totalCounts),
      },
      avg: {
        cn: Math.round(cnCounts.reduce((s, c) => s + c, 0) / cnCounts.length),
        com: Math.round(comCounts.reduce((s, c) => s + c, 0) / comCounts.length),
        total: Math.round(totalCounts.reduce((s, c) => s + c, 0) / totalCounts.length),
      },
      current: {
        cn: lastItem?.count_cn || 0,
        com: lastItem?.count_com || 0,
        total: lastItem?.count_total || (lastItem?.count_cn || 0) + (lastItem?.count_com || 0),
      },
    };
  }, [historyData]);
};
