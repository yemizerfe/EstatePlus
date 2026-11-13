// Application constants

// RabbitMQ Queue Names
export const RABBITMQ_QUEUES = {
  PROPERTY_IMPORT: 'property_import',
  MARKET_DATA_IMPORT: 'market_data_import',
  ECONOMIC_DATA_IMPORT: 'economic_data_import',
  NEIGHBORHOOD_DATA_IMPORT: 'neighborhood_data_import',
  IMAGE_PROCESSING: 'image_processing',
  EMAIL_NOTIFICATIONS: 'email_notifications',
  DATA_VALIDATION: 'data_validation',
  BULK_OPERATIONS: 'bulk_operations',
} as const;

// Kafka topics (event streams)
export const KAFKA_TOPICS = {
  PROPERTY_EVENTS: 'property.events',
  MARKET_EVENTS: 'market.events',
  ECONOMIC_EVENTS: 'economic.events',
  FORECAST_EVENTS: 'forecast.events',
  NOTIFICATION_EVENTS: 'notification.events',
} as const;

// Job Types
export const JOB_TYPES = {
  PROPERTY_IMPORT: 'PROPERTY_IMPORT',
  MARKET_DATA_IMPORT: 'MARKET_DATA_IMPORT',
  ECONOMIC_DATA_IMPORT: 'ECONOMIC_DATA_IMPORT',
  NEIGHBORHOOD_DATA_IMPORT: 'NEIGHBORHOOD_DATA_IMPORT',
  IMAGE_PROCESSING: 'IMAGE_PROCESSING',
  EMAIL_NOTIFICATION: 'EMAIL_NOTIFICATION',
  DATA_VALIDATION: 'DATA_VALIDATION',
  BULK_OPERATION: 'BULK_OPERATION',
} as const;

// Job Status
export const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// Job Priority
export const JOB_PRIORITY = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 15,
} as const;

// Data Source Types
export const DATA_SOURCE_TYPES = {
  CSV: 'CSV',
  JSON: 'JSON',
  XML: 'XML',
  API: 'API',
  WEB_SCRAPING: 'WEB_SCRAPING',
  DATABASE: 'DATABASE',
  EXCEL: 'EXCEL',
} as const;

// Import Status
export const IMPORT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
} as const;

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
} as const;

// Cache Keys
export const CACHE_KEYS = {
  MARKET_STATS: (neighborhoodId?: string, propertyType?: string, period?: string) =>
    `market:stats:${neighborhoodId ?? 'all'}:${propertyType ?? 'all'}:${period ?? 'latest'}`,
  NEIGHBORHOOD_DATA: 'neighborhood:data',
  NEIGHBORHOOD_LIST: 'neighborhood:list',
  NEIGHBORHOOD_STATS: (id: string) => `neighborhood:stats:${id}`,
  PROPERTY_SEARCH: 'property:search',
  PROPERTY_DETAIL: (id: string) => `property:${id}`,
  ECONOMIC_INDICATORS: (type?: string) => `economics:indicators:${type ?? 'all'}`,
  USER_PERMISSIONS: 'user:permissions',
  FORECAST: (area: string, type: string) => `forecast:${area}:${type}`,
  MARKET_TRENDS: (area: string) => `market:trends:${area}`,
} as const;

// Cache TTL (seconds)
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  AVATAR_MAX_SIZE: 2 * 1024 * 1024, // 2MB
} as const;

// Rate limiting
export const RATE_LIMITS = {
  AUTH: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
  API: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  UPLOAD: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 uploads per hour
} as const;

// Audit log actions
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  VIEW: 'VIEW',
} as const;

export type JobType = keyof typeof JOB_TYPES;
export type JobStatus = keyof typeof JOB_STATUS;
export type DataSourceType = keyof typeof DATA_SOURCE_TYPES;
export type ImportStatus = keyof typeof IMPORT_STATUS;
export type ErrorCode = keyof typeof ERROR_CODES;