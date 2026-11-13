import { apiClient } from './client';

export interface PropertyDocument {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  propertyId?: string;
  propertyTitle?: string;
  createdAt: string;
}

export async function fetchDocuments(): Promise<PropertyDocument[]> {
  const { data } = await apiClient.get<{ data: PropertyDocument[] }>('/documents');
  return data.data ?? [];
}

export async function uploadDocument(
  file: File,
  opts: { category: string; name?: string; propertyId?: string },
): Promise<PropertyDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', opts.category);
  if (opts.name?.trim()) form.append('name', opts.name.trim());
  if (opts.propertyId) form.append('propertyId', opts.propertyId);

  const { data } = await apiClient.post<{ data: PropertyDocument }>('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data.data!;
}

/** Raw bytes for preview (inline) or download. */
export async function fetchDocumentBlob(id: string, inline = false): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/documents/${id}/download`, {
    params: inline ? { inline: 1 } : {},
    responseType: 'blob',
    timeout: 60000,
  });
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}
