import { apiClient } from './client';

// ─── Property moderation ─────────────────────────────────────────────────────

export type ReviewableStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminApprovalProperty {
  id: string;
  title: string;
  description: string | null;
  propertyType: string;
  status: ReviewableStatus;
  address: string | null;
  neighborhood: string | null;
  sizeSqm: number;
  bedrooms: number;
  bathrooms: number;
  askingPrice: number;
  submittedAt: string;
  owner: { name: string; email: string };
  images: string[];
}

export interface AdminApprovalQueue {
  properties: AdminApprovalProperty[];
  total: number;
  page: number;
  pages: number;
  counts: { pending: number; approved: number; rejected: number; total: number };
}

export interface ApprovalQuery {
  status?: ReviewableStatus;
  search?: string;
  page?: number;
  limit?: number;
}

const PAGE_SIZE = 20;

export async function getPropertyApprovalQueue(query: ApprovalQuery = {}): Promise<AdminApprovalQueue> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.search?.trim()) params.set('search', query.search.trim());
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? PAGE_SIZE));

  const { data } = await apiClient.get<{ data: AdminApprovalQueue }>(
    `/admin/properties?${params.toString()}`,
  );
  return data.data;
}

export interface ReviewPropertyInput {
  decision: 'approve' | 'reject';
  reason?: string;
}

export async function reviewProperty(
  id: string,
  input: ReviewPropertyInput,
): Promise<{ id: string; status: ReviewableStatus; reason: string | null }> {
  const { data } = await apiClient.patch<{
    data: { id: string; status: ReviewableStatus; reason: string | null };
  }>(`/admin/properties/${id}/review`, input);
  return data.data;
}

// ─── Integration sync ────────────────────────────────────────────────────────

export interface SyncSummary {
  source: string;
  fetched: number;
  saved: number;
  skipped: number;
  errors: string[];
  note?: string;
  syncedAt: string;
}

/**
 * Every registry id that the backend can sync on demand, with the endpoint that
 * performs it. Sources without an adapter are absent rather than faked.
 */
const SYNC_ENDPOINTS: Record<string, { path: string; body?: Record<string, unknown> }> = {
  cbe_exchange: { path: '/external-sources/cbe/sync' },
  nbe_indicators: { path: '/external-sources/nbe/sync' },
  ess_cpi: { path: '/external-sources/ess/sync' },
  osm_amenities: { path: '/external-sources/osm/sync' },
  admin_boundaries: { path: '/external-sources/boundaries/sync', body: { level: 'ADM1' } },
  world_bank: { path: '/external-sources/world-bank/sync' },
};

export function canSyncIntegration(sourceId: string): boolean {
  return Boolean(SYNC_ENDPOINTS[sourceId]);
}

export async function syncIntegration(sourceId: string): Promise<SyncSummary> {
  const endpoint = SYNC_ENDPOINTS[sourceId];
  if (!endpoint) {
    throw new Error('This source has no on-demand sync.');
  }
  const { data } = await apiClient.post<{ data: SyncSummary }>(endpoint.path, endpoint.body ?? {});
  return data.data;
}
