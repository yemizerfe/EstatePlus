import rateLimit from 'express-rate-limit';

import { config } from '../config';

export const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skipSuccessfulRequests: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Only failed attempts count: legitimate sign-ins from the same network
  // (offices, mobile carriers) must not exhaust the budget for everyone.
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts.' },
});

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'AI rate limit exceeded. Please wait.' },
});
