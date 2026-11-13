import { apiClient } from './client';

export interface ReportAuthor {
  id: string;
  name: string;
  email: string;
}

export interface MarketReport {
  id: string;
  title: string;
  description: string | null;
  period: string | null;
  neighborhoodIds: string[] | null;
  author: ReportAuthor;
  generatedAt: string;
  updatedAt: string;
}

export interface MarketReportDetail extends MarketReport {
  marketData: Record<string, unknown>;
  economicData: Record<string, unknown> | null;
  analysis: string | null;
  conclusions: string | null;
}

export interface ReportListQuery {
  authorId?: string;
  period?: string;
  neighborhood?: string;
  page?: number;
  limit?: number;
  sortBy?: 'generatedAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportList {
  reports: MarketReport[];
  total: number;
  page: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ReportCreateInput {
  title: string;
  description?: string;
  /** `YYYY-MM` */
  period?: string;
  neighborhoodIds?: string[];
  marketData?: Record<string, unknown>;
  economicData?: Record<string, unknown>;
  analysis?: string;
  conclusions?: string;
}

export async function getReports(query: ReportListQuery = {}): Promise<ReportList> {
  const { data } = await apiClient.get<{ data: ReportList }>('/reports', { params: query });
  return data.data;
}

export async function getReport(id: string): Promise<MarketReportDetail> {
  const { data } = await apiClient.get<{ data: MarketReportDetail }>(`/reports/${id}`);
  return data.data;
}

export async function createReport(input: ReportCreateInput): Promise<MarketReportDetail> {
  const { data } = await apiClient.post<{ data: MarketReportDetail }>('/reports', input);
  return data.data;
}

export async function updateReport(
  id: string,
  input: Partial<Omit<ReportCreateInput, 'title'>> & { title?: string },
): Promise<MarketReportDetail> {
  const { data } = await apiClient.put<{ data: MarketReportDetail }>(`/reports/${id}`, input);
  return data.data;
}

export async function deleteReport(id: string): Promise<void> {
  await apiClient.delete(`/reports/${id}`);
}
