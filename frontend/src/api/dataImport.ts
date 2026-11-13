import { apiClient } from './client';
import type {
  ImportJob,
  ImportJobStatus,
  ImportJobType,
  ImportJobQuery,
  ImportJobStatistics,
  ImportValidationResult,
  ImportProgress
} from '../types';

export interface DataImportJobHistoryItem {
  id: string;
  jobType: string;
  status: string;
  recordsReceived: number;
  recordsValid: number;
  recordsRejected: number;
  errorLog: unknown;
  fileName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  source: { name: string; sourceType: string } | null;
}

export interface DataImportJobHistory {
  jobs: DataImportJobHistoryItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** Fetch the persisted job history shape returned by the backend. */
export async function getDataImportJobHistory(): Promise<DataImportJobHistory> {
  const { data } = await apiClient.get<{ data: DataImportJobHistory }>('/data-import/jobs');
  return data.data;
}

export interface CsvUploadResult {
  jobId: string;
  status: string;
  recordsReceived: number;
}

/**
 * Upload a CSV/JSON property file. The backend parses the rows, creates an
 * approved property plus its listing for every valid row and refreshes the
 * market statistics, so the data shows up on the public and analyst pages.
 */
export async function uploadPropertyCsv(
  file: File,
  importType: 'properties' | 'economics' = 'properties',
): Promise<CsvUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('importType', importType);
  const { data } = await apiClient.post<{ data: CsvUploadResult }>(
    '/ingestion/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

// Create import job
export async function createImportJob(jobData: {
  jobType: ImportJobType;
  sourceType: 'csv' | 'json' | 'excel' | 'api';
  sourceUrl?: string;
  file?: File;
  metadata?: Record<string, any>;
}): Promise<ImportJob> {
  const formData = new FormData();
  
  // Add basic fields
  formData.append('jobType', jobData.jobType);
  formData.append('sourceType', jobData.sourceType);
  
  if (jobData.sourceUrl) {
    formData.append('sourceUrl', jobData.sourceUrl);
  }
  
  if (jobData.metadata) {
    formData.append('metadata', JSON.stringify(jobData.metadata));
  }
  
  // Add file if provided
  if (jobData.file) {
    formData.append('file', jobData.file);
  }
  
  const { data } = await apiClient.post<{ data: ImportJob }>('/data-import/jobs', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return data.data!;
}

// Get import jobs
export async function getImportJobs(query?: ImportJobQuery): Promise<ImportJob[]> {
  const { data } = await apiClient.get<{ data: ImportJob[] }>('/data-import/jobs', { params: query });
  return data.data!;
}

// Get import job by ID
export async function getImportJob(id: string): Promise<ImportJob> {
  const { data } = await apiClient.get<{ data: ImportJob }>(`/data-import/jobs/${id}`);
  return data.data!;
}

// Cancel import job
export async function cancelImportJob(id: string): Promise<ImportJob> {
  const { data } = await apiClient.patch<{ data: ImportJob }>(`/data-import/jobs/${id}/cancel`);
  return data.data!;
}

// Retry import job
export async function retryImportJob(id: string): Promise<ImportJob> {
  const { data } = await apiClient.patch<{ data: ImportJob }>(`/data-import/jobs/${id}/retry`);
  return data.data!;
}

// Delete import job
export async function deleteImportJob(id: string): Promise<void> {
  await apiClient.delete(`/data-import/jobs/${id}`);
}

// Get import job progress
export async function getImportJobProgress(id: string): Promise<ImportProgress> {
  const { data } = await apiClient.get<{ data: ImportProgress }>(`/data-import/jobs/${id}/progress`);
  return data.data!;
}

// Get import job logs
export async function getImportJobLogs(id: string): Promise<string[]> {
  const { data } = await apiClient.get<{ data: string[] }>(`/data-import/jobs/${id}/logs`);
  return data.data!;
}

// Get import job statistics
export async function getImportJobStatistics(): Promise<ImportJobStatistics> {
  const { data } = await apiClient.get<{ data: ImportJobStatistics }>('/data-import/statistics');
  return data.data!;
}

// Validate import data
export async function validateImportData(validationData: {
  jobType: ImportJobType;
  data: any[];
  validationRules?: Record<string, any>;
}): Promise<ImportValidationResult> {
  const { data } = await apiClient.post<{ data: ImportValidationResult }>('/data-import/validate', validationData);
  return data.data!;
}

// Get import templates
export async function getImportTemplates(jobType?: ImportJobType): Promise<any[]> {
  const { data } = await apiClient.get<{ data: any[] }>('/data-import/templates', { 
    params: { jobType } 
  });
  return data.data!;
}

// Download import template
export async function downloadImportTemplate(jobType: ImportJobType, format: 'csv' | 'json' | 'excel'): Promise<Blob> {
  const response = await apiClient.get(`/data-import/templates/${jobType}/download`, {
    params: { format },
    responseType: 'blob',
  });
  
  return response.data;
}

// Get my import jobs
export async function getMyImportJobs(query?: ImportJobQuery): Promise<ImportJob[]> {
  const { data } = await apiClient.get<{ data: ImportJob[] }>('/data-import/jobs/my', { params: query });
  return data.data!;
}

// Bulk create import jobs
export async function bulkCreateImportJobs(jobsData: Array<{
  jobType: ImportJobType;
  sourceType: 'csv' | 'json' | 'excel' | 'api';
  sourceUrl?: string;
  metadata?: Record<string, any>;
}>): Promise<ImportJob[]> {
  const { data } = await apiClient.post<{ data: ImportJob[] }>('/data-import/jobs/bulk', { jobs: jobsData });
  return data.data!;
}

// Get import job types
export async function getImportJobTypes(): Promise<ImportJobType[]> {
  const { data } = await apiClient.get<{ data: ImportJobType[] }>('/data-import/job-types');
  return data.data!;
}

// Get import job statuses
export async function getImportJobStatuses(): Promise<ImportJobStatus[]> {
  const { data } = await apiClient.get<{ data: ImportJobStatus[] }>('/data-import/statuses');
  return data.data!;
}