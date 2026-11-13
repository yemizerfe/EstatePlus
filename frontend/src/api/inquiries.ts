import { apiClient } from './client';

export type InquiryStatus = 'new' | 'responded' | 'closed';

export interface Inquiry {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  message: string;
  status: InquiryStatus;
  response?: string;
  createdAt: string;
  respondedAt?: string;
}

export interface InquiryStats {
  total: number;
  new: number;
  responded: number;
  closed: number;
}

export interface SendInquiryInput {
  propertyId: string;
  message: string;
  name?: string;
  email?: string;
  phone?: string;
}

/** Inquiries addressed to the signed-in owner's listings. */
export async function fetchInquiries(params: { status?: InquiryStatus; search?: string } = {}): Promise<Inquiry[]> {
  const { data } = await apiClient.get<{ data: Inquiry[] }>('/inquiries', {
    params: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      limit: 100,
    },
  });
  return data.data ?? [];
}

export async function fetchInquiryStats(): Promise<InquiryStats> {
  const { data } = await apiClient.get<{ data: InquiryStats }>('/inquiries/stats');
  return data.data!;
}

/** Message the owner of a listing. */
export async function sendInquiry(input: SendInquiryInput): Promise<Inquiry> {
  const { data } = await apiClient.post<{ data: Inquiry }>('/inquiries', input);
  return data.data!;
}

export async function updateInquiry(
  id: string,
  input: { status?: InquiryStatus; response?: string },
): Promise<Inquiry> {
  const { data } = await apiClient.patch<{ data: Inquiry }>(`/inquiries/${id}`, input);
  return data.data!;
}
