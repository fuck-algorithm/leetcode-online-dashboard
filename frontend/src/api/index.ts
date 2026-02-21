import axios from 'axios';
import { Problem, OnlineCount } from '../types';

const API_BASE_URL = 'http://localhost:52106/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchProblems = async (): Promise<Problem[]> => {
  const response = await api.get('/problems');
  return response.data.data || response.data;
};

export const fetchHot100 = async (): Promise<Problem[]> => {
  const response = await api.get('/hot100');
  return response.data.data || response.data;
};

export const fetchOnlineCounts = async (problemId: string, limit: number = 100): Promise<OnlineCount[]> => {
  const response = await api.get(`/hot100/online-counts/${problemId}?limit=${limit}`);
  return response.data.data || response.data;
};

export const fetchLatestOnlineCounts = async (): Promise<OnlineCount[]> => {
  const response = await api.get('/hot100/online-counts/latest');
  return response.data.data || response.data;
};

export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  const response = await api.get('/health');
  return response.data;
};

// 获取峰值检测数据
export const fetchPeakOnlineTimes = async (): Promise<any> => {
  const response = await api.get('/peaks');
  return response.data.data || response.data;
};

// 获取统计数据
export const fetchStatistics = async (): Promise<any> => {
  const response = await api.get('/statistics');
  return response.data.data || response.data;
};

// 导出数据
export const exportData = async (format: 'json' | 'csv' = 'json', filters?: any): Promise<any> => {
  const params = new URLSearchParams({ format });
  if (filters?.problemId) params.append('problem_id', filters.problemId);
  if (filters?.startDate) params.append('start_date', filters.startDate);
  if (filters?.endDate) params.append('end_date', filters.endDate);
  
  const response = await api.get(`/export?${params.toString()}`);
  return response.data;
};

// 获取问题历史数据（用于图表）
export const fetchProblemHistory = async (problemId: string, hours: number = 24): Promise<OnlineCount[]> => {
  const response = await api.get(`/hot100/online-counts/${problemId}?hours=${hours}`);
  return response.data.data || response.data;
};

export default api;
