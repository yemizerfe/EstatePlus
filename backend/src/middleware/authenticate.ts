import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config';
import { JwtPayload, AuthenticatedRequest } from '../shared/types';
import { UnauthorizedError } from '../shared/utils/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  // 1. Try Authorization header (Bearer token)
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // 2. Fall back to HTTP-only cookie
  if (!token) {
    token = (req as Request & { cookies?: Record<string, string> }).cookies?.access_token;
  }

  if (!token) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
