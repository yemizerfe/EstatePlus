import { Request } from 'express';

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'property_owner' | 'analyst' | 'admin';

export interface JwtPayload {
  sub: string;       // user id (standard JWT subject)
  id: string;        // same value as `sub`; used by route handlers
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Augment Express' Request so `req.user` is visible to every handler. Without
// this, handlers typed with AuthenticatedRequest are not assignable to
// Express' RequestHandler signature (the request parameter would be narrower).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Optional because @types/passport already declares `user?: Express.User`;
      // merged declarations must share the same modifier.
      user?: JwtPayload;
      requestId?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  /** Set by the requestId middleware; optional so handlers remain assignable to Express' RequestHandler. */
  requestId?: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
  errors?: ValidationError[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Properties ───────────────────────────────────────────────────────────────

export type PropertyType = 'apartment' | 'house' | 'villa' | 'commercial' | 'land' | 'office';
export type PropertyCondition = 'new' | 'excellent' | 'good' | 'fair' | 'needs_renovation';
export type ListingStatus = 'active' | 'inactive' | 'sold' | 'rented' | 'pending';

export interface Property {
  id: string;
  title: string;
  description?: string;
  propertyType: PropertyType;
  condition: PropertyCondition;
  neighborhoodId: string;
  locationId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  size: number;          // sqm
  bedrooms: number;
  bathrooms: number;
  askingPrice: number;   // ETB
  rentalPrice?: number;  // ETB/month
  listingDate: Date;
  status: ListingStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Market ───────────────────────────────────────────────────────────────────

export interface MarketStatistics {
  id: string;
  neighborhoodId?: string;
  propertyType?: PropertyType;
  period: string;          // YYYY-MM
  avgPrice: number;
  medianPrice: number;
  pricePerSqm: number;
  avgRentalPrice: number;
  rentalYield: number;
  priceGrowth: number;     // percentage vs previous period
  rentGrowth: number;
  activeListings: number;
  calculatedAt: Date;
}

// ─── Economics ────────────────────────────────────────────────────────────────

export type EconomicIndicatorType =
  | 'inflation'
  | 'interest_rate'
  | 'exchange_rate'
  | 'construction_cost';

export interface EconomicIndicator {
  id: string;
  indicatorType: EconomicIndicatorType;
  value: number;
  unit: string;
  recordedAt: Date;
  source?: string;
  notes?: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type DomainEventType =
  | 'PROPERTY_CREATED'
  | 'PROPERTY_UPDATED'
  | 'PROPERTY_STATUS_CHANGED'
  | 'PROPERTY_OWNERSHIP_TRANSFERRED'
  | 'PRICE_CHANGED'
  | 'LISTING_CREATED'
  | 'MARKET_DATA_IMPORTED'
  | 'MARKET_STATISTICS_UPDATED'
  | 'ECONOMIC_INDICATOR_UPDATED'
  | 'FORECAST_COMPLETED'
  | 'SCENARIO_COMPLETED'
  | 'NOTIFICATION_CREATED'
  | 'ANOMALY_DETECTED';

export interface DomainEvent<T = unknown> {
  eventType: DomainEventType;
  aggregateId: string;
  payload: T;
  occurredAt: string;
  correlationId?: string;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export type JobType =
  | 'IMPORT_CSV'
  | 'IMPORT_JSON'
  | 'GENERATE_REPORT'
  | 'CALCULATE_MARKET_STATS'
  | 'SEND_NOTIFICATION';

export interface Job<T = unknown> {
  jobId: string;
  jobType: JobType;
  payload: T;
  createdAt: string;
  attempts?: number;
}
