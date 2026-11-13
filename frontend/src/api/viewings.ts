import { apiClient } from './client';

export type ViewingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export interface Viewing {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  scheduledAt: string;
  status: ViewingStatus;
  notes?: string;
  createdAt: string;
}

export interface ViewingStats {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface CreateViewingInput {
  propertyId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  scheduledAt: string;
  notes?: string;
}

export async function fetchViewings(
  params: { status?: ViewingStatus; search?: string } = {},
): Promise<Viewing[]> {
  const { data } = await apiClient.get<{ data: Viewing[] }>('/viewings', {
    params: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      limit: 100,
    },
  });
  return data.data ?? [];
}

export async function fetchViewingStats(): Promise<ViewingStats> {
  const { data } = await apiClient.get<{ data: ViewingStats }>('/viewings/stats');
  return data.data!;
}

export async function createViewing(input: CreateViewingInput): Promise<Viewing> {
  const { data } = await apiClient.post<{ data: Viewing }>('/viewings', input);
  return data.data!;
}

export async function updateViewing(
  id: string,
  input: { status?: ViewingStatus; scheduledAt?: string; notes?: string },
): Promise<Viewing> {
  const { data } = await apiClient.patch<{ data: Viewing }>(`/viewings/${id}`, input);
  return data.data!;
}
