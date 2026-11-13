import { apiClient } from './client';

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DataSourceJob {
  id: string;
  status: ImportStatus;
  recordsReceived: number;
  recordsValid: number;
  recordsRejected: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface DataSourceJobDetail extends DataSourceJob {
  jobType: string;
  fileName: string | null;
  errorLog: string | null;
}

export interface DataSourceCreator {
  id: string;
  name: string;
  email: string;
}

export interface DataSourceRecord {
  id: string;
  name: string;
  sourceType: string;
  description: string | null;
  creator: DataSourceCreator | null;
  recentJobs: DataSourceJob[];
  createdAt: string;
}

export interface DataSourceDetail
  extends Omit<DataSourceRecord, 'creator' | 'recentJobs'> {
  creator: { id: string; firstName: string; lastName: string; email: string } | null;
  importJobs: DataSourceJobDetail[];
}

export interface DataSourcePage {
  dataSources: DataSourceRecord[];
  total: number;
  page: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface DataSourceStats {
  totalSources: number;
  sourcesByType: Record<string, number>;
  recentJobsCount: number;
  successfulJobsCount: number;
  successRate: number;
}

export interface DataSourcesQuery {
  page?: number;
  limit?: number;
  sourceType?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DataSourceInput {
  name: string;
  sourceType: string;
  description?: string;
}

export async function getDataSources(
  params: DataSourcesQuery = {},
): Promise<DataSourcePage> {
  const { data } = await apiClient.get<{ data: DataSourcePage }>('/data-sources', { params });
  return data.data;
}

export async function getDataSourceStats(): Promise<DataSourceStats> {
  const { data } = await apiClient.get<{ data: DataSourceStats }>('/data-sources/stats');
  return data.data;
}

export async function getDataSource(id: string): Promise<DataSourceDetail> {
  const { data } = await apiClient.get<{ data: DataSourceDetail }>(`/data-sources/${id}`);
  return data.data;
}

export async function createDataSource(input: DataSourceInput): Promise<DataSourceDetail> {
  const { data } = await apiClient.post<{ data: DataSourceDetail }>('/data-sources', input);
  return data.data;
}

export async function updateDataSource(
  id: string,
  input: Partial<DataSourceInput>,
): Promise<DataSourceDetail> {
  const { data } = await apiClient.patch<{ data: DataSourceDetail }>(`/data-sources/${id}`, input);
  return data.data;
}

export async function deleteDataSource(id: string): Promise<void> {
  await apiClient.delete(`/data-sources/${id}`);
}
