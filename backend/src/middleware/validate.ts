import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

import { ValidationError } from '../shared/utils/errors';

export function validate(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fields = errors.array().map((e) => ({
      field: e.type === 'field' ? (e as { path: string }).path : 'unknown',
      message: e.msg as string,
    }));
    throw new ValidationError('Validation failed', fields);
  }
  next();
}
