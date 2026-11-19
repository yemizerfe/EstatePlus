import { prisma } from '../../../infrastructure/database/prisma';
import { ValidationError } from '../../../shared/utils/errors';

export function isYearMonthPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) > 0;
}

export function uploadedRowsFromMetadata(
  metadata: unknown,
): Array<Record<string, unknown>> | null {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    return null;
  }

  const rows = (metadata as Record<string, unknown>)['uploadedRows'];
  if (!Array.isArray(rows)) return null;

  return rows.map((row, index) => {
    if (!row || Array.isArray(row) || typeof row !== 'object') {
      throw new ValidationError(`Uploaded row ${index + 1} is not a record`);
    }
    return row as Record<string, unknown>;
  });
}

export async function loadUploadedRows(
  sourceId: string,
): Promise<Array<Record<string, unknown>>> {
  const source = await prisma.dataSource.findUnique({
    where: { id: sourceId },
    select: { metadata: true },
  });
  if (!source) {
    throw new ValidationError(`Uploaded data source not found: ${sourceId}`);
  }
  const rows = uploadedRowsFromMetadata(source.metadata);
  if (!rows) throw new ValidationError('The uploaded data source has no persisted rows');
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function uploadedValue(row: Record<string, unknown>, ...headers: string[]): unknown {
  const wanted = new Set(headers.map(normalizeHeader));
  const entry = Object.entries(row).find(([header]) => wanted.has(normalizeHeader(header)));
  return entry?.[1];
}

export function uploadedText(
  row: Record<string, unknown>,
  ...headers: string[]
): string | null {
  const value = uploadedValue(row, ...headers);
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function uploadedNumber(
  row: Record<string, unknown>,
  ...headers: string[]
): number | null {
  const value = uploadedValue(row, ...headers);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function uploadedDate(
  row: Record<string, unknown>,
  ...headers: string[]
): Date | null {
  const value = uploadedValue(row, ...headers);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const text = value.trim();
  const normalized = /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
