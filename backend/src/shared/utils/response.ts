import { Response } from 'express';

import { ApiResponse, PaginationMeta } from '../types';

/**
 * Send a success envelope.
 *
 * Two call styles are supported so every module can stay readable:
 *   sendSuccess(res, data, 'Message')
 *   sendSuccess(res, data, 201, 'Message', meta)
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  meta?: PaginationMeta,
): void;
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode?: number,
  message?: string,
  meta?: PaginationMeta,
): void;
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusOrMessage: number | string = 200,
  messageOrMeta?: string | PaginationMeta,
  meta?: PaginationMeta,
): void {
  const statusCode = typeof statusOrMessage === 'number' ? statusOrMessage : 200;
  const message =
    typeof statusOrMessage === 'string'
      ? statusOrMessage
      : typeof messageOrMeta === 'string'
        ? messageOrMeta
        : undefined;
  const pagination =
    typeof messageOrMeta === 'object' && messageOrMeta !== null ? messageOrMeta : meta;

  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(pagination && { meta: pagination }),
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, 201, message ?? 'Resource created successfully');
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: { field: string; message: string }[],
): void {
  const response: ApiResponse = {
    success: false,
    message,
    ...(errors && { errors }),
  };
  res.status(statusCode).json(response);
}

export function sendNotFound(res: Response, resource = 'Resource'): void {
  sendError(res, `${resource} not found`, 404);
}

export function sendUnauthorized(res: Response, message = 'Unauthorized'): void {
  sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = 'Forbidden'): void {
  sendError(res, message, 403);
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
