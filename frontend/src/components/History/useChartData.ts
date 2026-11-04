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
        // 历史聚合里 0 表示“没有采集到国际站数据”，用 null 让曲线断开，
        // 避免画成一条从有数据突然掉到 0 人的假趋势。
        countCOM: countCOM > 0 ? countCOM : null,
        countTotal: item.count_total || countCN + countCOM,
        fullTime: item.timestamp,
      };
    });
  }, [historyData, timeRange]);
};

export const useHourAverageData = (historyData: OnlineCount[]): HourAverageDataPoint[] => {
  return useMemo(() => {
    if (historyData.length === 0) return [];

    // CN / COM 分别统计各自的样本数：国际站缺失的时段是 0，不能拉低国际站均值。
    const hourGroups: {
      [key: number]: { totalCN: number; countCN: number; totalCOM: number; countCOM: number };
    } = {};

    for (let h = 0; h < 24; h++) {
      hourGroups[h] = { totalCN: 0, countCN: 0, totalCOM: 0, countCOM: 0 };
    }

    historyData.forEach(item => {
      const countCN = item.count_cn || 0;
      const countCOM = item.count_com || 0;
      const hour = dayjs(item.timestamp).hour();
      if (countCN > 0) {
        hourGroups[hour].totalCN += countCN;
        hourGroups[hour].countCN += 1;
      }
      if (countCOM > 0) {
        hourGroups[hour].totalCOM += countCOM;
        hourGroups[hour].countCOM += 1;
      }
    });

    const result = [];
    for (let h = 0; h < 24; h++) {
      const data = hourGroups[h];
      result.push({
        time: `${String(h).padStart(2, '0')}:00`,
        avgCountCN: data.countCN > 0 ? Math.round(data.totalCN / data.countCN) : 0,
        avgCountCOM: data.countCOM > 0 ? Math.round(data.totalCOM / data.countCOM) : 0,
        sampleCount: Math.max(data.countCN, data.countCOM),
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
    let cnSamples = 0, comSamples = 0;

    for (const h of historyData) {
      const cn = h.count_cn || 0;
      const com = h.count_com || 0;
      const total = h.count_total || cn + com;
      // 国际站 0 表示缺失，不参与最高/最低/平均计算
      if (cn > 0) {
        if (cn > maxCN) maxCN = cn;
        if (cn < minCN) minCN = cn;
        sumCN += cn;
        cnSamples += 1;
      }
      if (com > 0) {
        if (com > maxCOM) maxCOM = com;
        if (com < minCOM) minCOM = com;
        sumCOM += com;
        comSamples += 1;
      }
      if (total > maxTotal) maxTotal = total;
      if (total < minTotal) minTotal = total;
      sumTotal += total;
    }

    const lastItem = historyData[historyData.length - 1];
    const n = historyData.length;

    return {
      max: { cn: maxCN, com: maxCOM, total: maxTotal },
      min: { cn: minCN === Infinity ? 0 : minCN, com: minCOM === Infinity ? 0 : minCOM, total: minTotal === Infinity ? 0 : minTotal },
      avg: {
        cn: cnSamples > 0 ? Math.round(sumCN / cnSamples) : 0,
        com: comSamples > 0 ? Math.round(sumCOM / comSamples) : 0,
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
