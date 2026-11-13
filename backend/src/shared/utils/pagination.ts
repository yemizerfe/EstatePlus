import { PaginationQuery } from '../types';

export interface ParsedPagination {
  page: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function parsePagination(
  query: PaginationQuery,
  defaultSortBy = 'created_at',
): ParsedPagination {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const sortBy = query.sortBy ?? defaultSortBy;

  return { page, limit, offset, sortBy, sortOrder };
}
