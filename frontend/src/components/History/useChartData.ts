import { useMemo } from 'react';
import dayjs from 'dayjs';
import { OnlineCount } from '../../types';
import { Stats, ChartDataPoint, HourAverageDataPoint } from './types';

export const useChartData = (
  historyData: OnlineCount[],
  timeRange: [dayjs.Dayjs, dayjs.Dayjs]
): ChartDataPoint[] => {
  // 后端已按时间范围过滤并按桶聚合（date_bin 等间隔，点数 ≤ ~730），
  // 这里只需 O(N) 单遍映射成图表点，无需再做逐分钟网格 + 最近点匹配（原实现 O(N×M)）。
  return useMemo(() => {
    if (historyData.length === 0) return [];

    return historyData.map(item => {
      const countCN = item.count_cn || 0;
      const countCOM = item.count_com || 0;
      return {
        time: dayjs(item.timestamp).format('MM-DD HH:mm'),
        countCN,
        countCOM,
        countTotal: item.count_total || countCN + countCOM,
        fullTime: item.timestamp,
      };
    });
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
  // 单遍统计 max/min/avg，避免 map + 展开运算符多次全数组遍历
  // （Math.max(...array) 在数据量很大时还有栈溢出风险）。
  return useMemo(() => {
    const empty: Stats = {
      max: { cn: 0, com: 0, total: 0 },
      min: { cn: 0, com: 0, total: 0 },
      avg: { cn: 0, com: 0, total: 0 },
      current: { cn: 0, com: 0, total: 0 },
    };
    if (historyData.length === 0) return empty;

    let maxCN = 0, maxCOM = 0, maxTotal = 0;
    let minCN = Infinity, minCOM = Infinity, minTotal = Infinity;
    let sumCN = 0, sumCOM = 0, sumTotal = 0;

    for (const h of historyData) {
      const cn = h.count_cn || 0;
      const com = h.count_com || 0;
      const total = h.count_total || cn + com;
      if (cn > maxCN) maxCN = cn;
      if (com > maxCOM) maxCOM = com;
      if (total > maxTotal) maxTotal = total;
      if (cn < minCN) minCN = cn;
      if (com < minCOM) minCOM = com;
      if (total < minTotal) minTotal = total;
      sumCN += cn;
      sumCOM += com;
      sumTotal += total;
    }

    const lastItem = historyData[historyData.length - 1];
    const n = historyData.length;

    return {
      max: { cn: maxCN, com: maxCOM, total: maxTotal },
      min: { cn: minCN === Infinity ? 0 : minCN, com: minCOM === Infinity ? 0 : minCOM, total: minTotal === Infinity ? 0 : minTotal },
      avg: {
        cn: Math.round(sumCN / n),
        com: Math.round(sumCOM / n),
        total: Math.round(sumTotal / n),
      },
      current: {
        cn: lastItem?.count_cn || 0,
        com: lastItem?.count_com || 0,
        total: lastItem?.count_total || (lastItem?.count_cn || 0) + (lastItem?.count_com || 0),
      },
    };
  }, [historyData]);
};
