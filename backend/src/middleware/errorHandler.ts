import { Request, Response, NextFunction } from 'express';

import { AppError, ValidationError } from '../shared/utils/errors';
import { logger } from '../shared/utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;

  if (err instanceof ValidationError) {
    res.status(422).json({
      success: false,
      message: err.message,
      errors: err.fields,
      requestId,
    });
    return;
  }

  // Malformed JSON bodies are the client's mistake, not a server fault.
  // body-parser rejects them (including a bare `null`) with a SyntaxError.
  const parseError = err as Error & { status?: number; body?: unknown };
  if (parseError instanceof SyntaxError && parseError.status === 400 && 'body' in parseError) {
    logger.warn({ msg: 'Malformed JSON body', requestId });
    res.status(400).json({
      success: false,
      message: 'Request body is not valid JSON',
      requestId,
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ msg: err.message, requestId, stack: err.stack });
    } else {
      logger.warn({ msg: err.message, requestId, statusCode: err.statusCode });
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      requestId,
    });
    return;
  }

  // Unhandled errors
  logger.error({ msg: 'Unhandled error', error: err.message, stack: err.stack, requestId });
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    requestId,
  });
}
