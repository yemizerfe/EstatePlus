import { apiClient } from './client';
import type {
  AuditLog,
  AuditLogQuery,
  AuditStatistics,
  AuditTrail,
  UserActivitySummary,
  ComplianceReport,
  SuspiciousActivityReport
} from '../types';

// Query audit logs
export async function queryAuditLogs(query: AuditLogQuery): Promise<{
  logs: AuditLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const { data } = await apiClient.get<{ data: AuditLog[]; meta: any }>('/audit', { params: query });
  return {
    logs: data.data!,
    meta: data.meta || {
      page: 1,
      limit: 20,
      total: data.data!.length,
      totalPages: 1
    }
  };
}

// Get audit log by ID
export async function getAuditLog(id: string): Promise<AuditLog> {
  const { data } = await apiClient.get<{ data: AuditLog }>(`/audit/${id}`);
  return data.data!;
}

// Get audit statistics
export async function getAuditStatistics(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<AuditStatistics> {
  const { data } = await apiClient.get<{ data: AuditStatistics }>('/audit/stats/summary', { params });
  return data.data!;
}

// Get audit trail for a resource
export async function getResourceAuditTrail(resource: string, resourceId: string): Promise<AuditTrail[]> {
  const { data } = await apiClient.get<{ data: AuditTrail[] }>(`/audit/trail/${resource}/${resourceId}`);
  return data.data!;
}

// Get user activity summary
export async function getUserActivitySummary(userId: string, params?: {
  days?: number;
}): Promise<UserActivitySummary> {
  const { data } = await apiClient.get<{ data: UserActivitySummary }>(`/audit/user/${userId}/activity`, { params });
  return data.data!;
}

// Export audit logs to CSV
export async function exportAuditLogs(query: AuditLogQuery): Promise<Blob> {
  const response = await apiClient.get('/audit/export', {
    params: query,
    responseType: 'blob',
  });
  
  return response.data;
}

// Detect suspicious activity
export async function detectSuspiciousActivity(params?: {
  threshold?: number;
  timeWindowMinutes?: number;
}): Promise<SuspiciousActivityReport> {
  const { data } = await apiClient.get<{ data: SuspiciousActivityReport }>('/audit/security/suspicious', { params });
  return data.data!;
}

// Get compliance report
export async function getComplianceReport(params: {
  startDate: string;
  endDate: string;
}): Promise<ComplianceReport> {
  const { data } = await apiClient.get<{ data: ComplianceReport }>('/audit/compliance/report', { params });
  return data.data!;
}

// Cleanup old audit logs
export async function cleanupOldAuditLogs(params?: {
  retentionDays?: number;
}): Promise<any> {
  const { data } = await apiClient.post<{ data: any }>('/audit/cleanup', params);
  return data.data!;
}

// Get audit log actions
export async function getAuditLogActions(): Promise<string[]> {
  const { data } = await apiClient.get<{ data: string[] }>('/audit/actions');
  return data.data!;
}

// Get audit log resources
export async function getAuditLogResources(): Promise<string[]> {
  const { data } = await apiClient.get<{ data: string[] }>('/audit/resources');
  return data.data!;
}

// Get audit dashboard
export async function getAuditDashboard(): Promise<any> {
  const { data } = await apiClient.get<{ data: any }>('/audit/dashboard');
  return data.data!;
}