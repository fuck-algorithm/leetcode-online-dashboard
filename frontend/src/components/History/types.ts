export interface Stats {
  max: { cn: number; com: number; total: number };
  min: { cn: number; com: number; total: number };
  avg: { cn: number; com: number; total: number };
  current: { cn: number; com: number; total: number };
}

export interface ChartDataPoint {
  time: string;
  countCN: number;
  // null 表示该时段没有国际站采集数据（不是 0 人），曲线会在此断开
  countCOM: number | null;
  countTotal: number;
  fullTime: string;
}

export interface HourAverageDataPoint {
  time: string;
  avgCountCN: number;
  avgCountCOM: number;
  sampleCount: number;
}
