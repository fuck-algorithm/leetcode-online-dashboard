export interface Stats {
  max: { cn: number; com: number; total: number };
  min: { cn: number; com: number; total: number };
  avg: { cn: number; com: number; total: number };
  current: { cn: number; com: number; total: number };
}

export interface ChartDataPoint {
  time: string;
  countCN: number;
  countCOM: number;
  countTotal: number;
  fullTime: string;
}

export interface HourAverageDataPoint {
  time: string;
  avgCountCN: number;
  avgCountCOM: number;
  sampleCount: number;
}
