import pino from 'pino';

import { config } from '../../config';

export const logger = pino({
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  redact: {
    paths: ['password', 'token', 'accessToken', 'refreshToken', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  base: {
    service: 'realestate-backend',
    env: config.NODE_ENV,
  },
});

export type Logger = typeof logger;
