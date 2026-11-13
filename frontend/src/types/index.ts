// User Types
export type UserRole = 'admin' | 'analyst' | 'property_owner' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';

// Property Types
export type PropertyType = 'APARTMENT' | 'VILLA' | 'CONDOMINIUM' | 'OFFICE' | 'RETAIL' | 'WAREHOUSE' | 'LAND';
export type PropertyCondition = 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_RENOVATION';
export type PropertyStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SOLD'
  | 'RENTED'
  | 'UNDER_CONTRACT'
  | 'ARCHIVED';

// Economic Indicator Types
export type EconomicIndicatorType = 
  | 'INFLATION'
  | 'INTEREST_RATES'
  | 'GDP_GROWTH'
  | 'UNEMPLOYMENT'
  | 'CONSTRUCTION_COSTS'
  | 'MORTGAGE_RATES'
  | 'EXCHANGE_RATES'
  | 'CONSUMER_CONFIDENCE'
  | 'HOUSING_STARTS'
  | 'BUILDING_PERMITS'
  | 'RETAIL_SALES'
  | 'INDUSTRIAL_PRODUCTION'
  | 'PPI'
  | 'CPI'
  | 'WAGE_GROWTH'
  | 'POPULATION_GROWTH'
  | 'MIGRATION'
  | 'INFRASTRUCTURE_SPENDING'
  | 'TAX_RATES'
  | 'REGULATION_INDEX';

// Forecast Types
export type ForecastType = 'property' | 'rental' | 'market';
export type ForecastModel = 'linear' | 'exponential' | 'moving_average' | 'ensemble';

// Scenario Types
export type ScenarioType = 
  | 'ECONOMIC_SHOCK'
  | 'MARKET_SHIFT'
  | 'POLICY_CHANGE'
  | 'LOCAL_DEVELOPMENT'
  | 'INFRASTRUCTURE'
  | 'DEMOGRAPHIC_CHANGE';

// Notification Types
export type NotificationType = 
  | 'property_saved'
  | 'property_price_alert'
  | 'market_update'
  | 'scenario_result'
  | 'forecast_update'
  | 'new_listing'
  | 'scheduled_status_change'
  | 'bulk_import_complete';

// Import Job Types
export type ImportJobType = 
  | 'PROPERTY'
  | 'MARKET_DATA'
  | 'ECONOMIC_DATA'
  | 'NEIGHBORHOOD_DATA'
  | 'IMAGE_PROCESSING'
  | 'BULK_OPERATION'
  | 'DATA_VALIDATION'
  | 'EXPORT';

// Report Types
export type ReportType = 
  | 'MARKET_ANALYSIS'
  | 'PROPERTY_VALUATION'
  | 'INVESTMENT_RECOMMENDATION'
  | 'FORECAST_REPORT'
  | 'SCENARIO_ANALYSIS'
  | 'ECONOMIC_INDICATORS'
  | 'NEIGHBORHOOD_PROFILE'
  | 'PORTFOLIO_SUMMARY'
  | 'COMPLIANCE_REPORT'
  | 'AUDIT_REPORT';

// Import Job Status
export type ImportJobStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// Amenity Types
export type AmenityType = 
  | 'SCHOOL'
  | 'HOSPITAL'
  | 'CLINIC'
  | 'PHARMACY'
  | 'SHOPPING_MALL'
  | 'GROCERY_STORE'
  | 'RESTAURANT'
  | 'CAFE'
  | 'BANK'
  | 'ATM'
  | 'POST_OFFICE'
  | 'LIBRARY'
  | 'PARK'
  | 'PLAYGROUND'
  | 'GYM'
  | 'POOL'
  | 'BUS_STATION'
  | 'TRAIN_STATION'
  | 'TAXI_STAND'
  | 'PARKING'
  | 'SECURITY'
  | 'WI_FI'
  | 'GENERATOR'
  | 'WATER_SUPPLY'
  | 'ELECTRICITY';

export interface NeighborhoodStats {
  neighborhood: { id: string; name: string; slug: string };
  avgPrice: number;
  medianPrice: number;
  pricePerSqm: number;
  avgRent: number;
  rentalYield: number;
  priceGrowth: number;
  activeListings: number;
  supplyLevel: 'low' | 'medium' | 'high';
  demandIndicator: 'low' | 'medium' | 'high';
  calculatedAt: string;
}

export interface MarketStats {
  period: string;
  avgPrice: number;
  medianPrice: number;
  pricePerSqm: number;
  avgRentalPrice: number;
  rentalYield: number;
  priceGrowth: number;
  rentGrowth: number;
  activeListings: number;
  calculatedAt: string;
}

export interface PriceTrend {
  period: string;
  avgPrice: number | null;
  medianPrice: number | null;
  avgRentalPrice: number | null;
  priceGrowth: number | null;
  activeListings: number | null;
}

export interface Valuation {
  id: string;
  propertyId: string;
  estimatedValue: number;
  askingPrice: number;
  priceDifference: number;
  priceDifferencePct: number;
  comparableCount: number;
  confidenceScore: number | null;
  rentalYield: number | null;
  grossYield: number | null;
  priceStatus: 'above_market' | 'below_market' | 'fair';
  comparables: Property[];
  calculatedAt: string;
}

// Core Interfaces
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl: string | null;
  phone: string | null;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Property {
  id: string;
  title: string;
  description: string | null;
  propertyType: PropertyType;
  condition: PropertyCondition;
  neighborhoodId: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  sizeSqm: number;
  bedrooms: number;
  bathrooms: number;
  askingPrice: number;
  rentalPrice: number | null;
  listingDate: string;
  status: PropertyStatus;
  ownerId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  neighborhood: Neighborhood;
  owner: User;
  /** Primary photo, when one has been uploaded. */
  images?: Array<{ imageUrl: string }>;
}

export interface PropertyCreationData {
  title: string;
  description?: string;
  propertyType: PropertyType;
  condition: PropertyCondition;
  neighborhoodId: string;
  address: string;
  latitude?: number;
  longitude?: number;
  sizeSqm: number;
  bedrooms: number;
  bathrooms: number;
  askingPrice: number;
  rentalPrice?: number;
  listingDate: string;
}

export interface PropertyUpdateData {
  title?: string;
  description?: string;
  condition?: PropertyCondition;
  sizeSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  askingPrice?: number;
  rentalPrice?: number;
}

export interface PropertySearchQuery {
  page?: number;
  limit?: number;
  neighborhoodId?: string;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  bedrooms?: number;
  search?: string;
  ownedBy?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PropertySearchResponse {
  properties: Property[];
  meta: PaginationMeta;
}

export interface PropertyStatusTransition {
  fromStatus: PropertyStatus;
  toStatus: PropertyStatus;
  reason?: string;
  scheduledDate?: string;
}

export interface PropertyStatistics {
  totalProperties: number;
  activeProperties: number;
  soldProperties: number;
  rentedProperties: number;
  totalValue: number;
  averagePrice: number;
  averageSize: number;
  byType: Array<{ type: PropertyType; count: number; averagePrice: number }>;
  byStatus: Array<{ status: PropertyStatus; count: number; percentage: number }>;
  byNeighborhood: Array<{ neighborhoodId: string; neighborhoodName: string; count: number; averagePrice: number }>;
}

export interface PropertyLifecycleHistory {
  id: string;
  propertyId: string;
  fromStatus: PropertyStatus;
  toStatus: PropertyStatus;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

// Neighborhood Interfaces
export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  city: string;
  description: string | null;
  population: number | null;
  averageIncome: number | null;
  latitude: number | null;
  longitude: number | null;
  walkScore: number | null;
  safetyRating: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NeighborhoodSearchQuery {
  page?: number;
  limit?: number;
  city?: string;
  search?: string;
  minPopulation?: number;
  maxPopulation?: number;
  minIncome?: number;
  maxIncome?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface NeighborhoodSearchResponse {
  neighborhoods: Neighborhood[];
  meta: PaginationMeta;
}

export interface NeighborhoodStatistics {
  neighborhoodId: string;
  propertyCount: number;
  averagePrice: number;
  averageRent: number;
  rentalYield: number;
  priceGrowth: number;
  populationDensity: number | null;
  crimeRate: number | null;
  trafficIndex: number | null;
  airQualityIndex: number | null;
  walkabilityScore: number | null;
  livabilityScore: number | null;
  updatedAt: string;
}

export interface Amenity {
  id: string;
  neighborhoodId: string;
  amenityType: AmenityType;
  name: string;
  address: string | null;
  distanceMeters: number | null;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Market Interfaces
export interface MarketStatistics {
  city: string;
  period: string;
  averagePrice: number;
  medianPrice: number;
  pricePerSqm: number;
  averageRentalPrice: number;
  rentalYield: number;
  priceGrowth: number;
  rentGrowth: number;
  activeListings: number;
  daysOnMarket: number;
  saleToListingRatio: number;
  calculatedAt: string;
}

export interface MarketTrend {
  period: string;
  averagePrice: number;
  medianPrice: number;
  pricePerSqm: number;
  averageRentalPrice: number;
  activeListings: number;
  priceGrowth: number;
}

export interface MarketSegment {
  segment: string;
  propertyType: PropertyType;
  neighborhoodId: string;
  averagePrice: number;
  medianPrice: number;
  pricePerSqm: number;
  volume: number;
  growthRate: number;
  liquidityScore: number;
}

export interface MarketComparison {
  comparisonId: string;
  base: { type: string; id: string; name: string };
  comparedWith: Array<{ type: string; id: string; name: string; value: number; differencePct: number }>;
  metric: string;
  timeframe: string;
}

export interface MarketVolumeAnalysis {
  period: string;
  totalVolume: number;
  averageVolume: number;
  volumeGrowth: number;
  byType: Array<{ type: PropertyType; volume: number; percentage: number }>;
  byNeighborhood: Array<{ neighborhoodId: string; neighborhoodName: string; volume: number; percentage: number }>;
}

export interface MarketPerformanceMetrics {
  period: string;
  roi: number;
  capRate: number;
  cashOnCashReturn: number;
  internalRateOfReturn: number;
  netOperatingIncome: number;
  debtCoverageRatio: number;
  vacancyRate: number;
  occupancyRate: number;
}

// Forecasting Interfaces
export interface Forecast {
  id: string;
  forecastType: ForecastType;
  model: ForecastModel;
  baseValue: number;
  forecastMonths: number;
  confidenceInterval: [number, number];
  forecastData: ForecastPoint[];
  historicalData: ForecastPoint[];
  rSquared: number | null;
  mape: number | null;
  generatedBy: string;
  generatedAt: string;
}

export interface ForecastPoint {
  month: string;
  value: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
}

export interface ForecastQuery {
  propertyId?: string;
  neighborhoodId?: string;
  propertyType?: PropertyType;
  forecastType: ForecastType;
  forecastMonths: number;
  model?: ForecastModel;
}

export interface ForecastResponse {
  forecast: Forecast;
  recommendations: InvestmentRecommendation[];
  marketOutlook: MarketOutlook;
}

export interface InvestmentRecommendation {
  recommendation: 'BUY' | 'HOLD' | 'SELL' | 'RENT';
  confidenceScore: number;
  reasons: string[];
  expectedReturn: number;
  timeHorizon: string;
  risks: string[];
}

export interface ForecastComparison {
  model: ForecastModel;
  forecast: Forecast;
  accuracy: number;
  confidence: number;
  advantages: string[];
  disadvantages: string[];
}

export interface MarketOutlook {
  outlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidenceScore: number;
  keyDrivers: string[];
  risks: string[];
  timeline: string;
  recommendations: string[];
}

// Economic Indicators Interfaces
export interface EconomicIndicator {
  id: string;
  indicatorType: EconomicIndicatorType;
  value: number;
  unit: string;
  recordedAt: string;
  source: string | null;
  sourceUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EconomicIndicatorQuery {
  page?: number;
  limit?: number;
  months?: number;
  indicatorType?: EconomicIndicatorType;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EconomicIndicatorTrend {
  period: string;
  value: number;
  change: number;
  changePct: number;
  volatility: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface EconomicImpactAnalysis {
  propertyType: PropertyType;
  indicators: Array<{
    indicatorType: EconomicIndicatorType;
    correlation: number;
    impact: number;
    significance: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  overallImpact: number;
  recommendations: string[];
}

export interface EconomicCorrelation {
  indicator1: EconomicIndicatorType;
  indicator2: EconomicIndicatorType;
  correlation: number;
  significance: string;
  timeframe: string;
}// Scenarios Interfaces
export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  scenarioType: ScenarioType;
  parameters: ScenarioParameter[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface ScenarioParameter {
  indicator: string;
  changePct: number;
  changeType: 'increase' | 'decrease';
  weight?: number;
}

export interface ScenarioQuery {
  page?: number;
  limit?: number;
  scenarioType?: ScenarioType;
  createdBy?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ScenarioAnalysis {
  scenarioId: string;
  priceImpactPct: number;
  rentalImpactPct: number;
  demandImpact: string;
  supplyImpact: string;
  breakdown: Array<{
    indicator: EconomicIndicatorType;
    changePct: number;
    priceImpact: number;
    rentalImpact: number;
  }>;
  assumptions: { model: string; disclaimer: string };
  aiExplanation: string | null;
  calculatedAt: string;
}

export interface SensitivityAnalysis {
  scenarioId: string;
  sensitivityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  priceImpactRange: [number, number];
  rentalImpactRange: [number, number];
  confidenceScore: number;
  recommendations: string[];
}

export interface RiskAssessment {
  scenarioId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: Array<{ factor: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; probability: number }>;
  mitigationStrategies: string[];
  overallRiskScore: number;
}

export interface InvestmentImplications {
  scenarioId: string;
  implications: Array<{
    propertyType: PropertyType;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'AVOID';
    confidenceScore: number;
    reasoning: string[];
  }>;
  timeline: string;
  keyTakeaways: string[];
}

export interface ScenarioComparison {
  scenarios: Array<{
    scenarioId: string;
    scenarioName: string;
    scenarioType: ScenarioType;
    priceImpact: number;
    rentalImpact: number;
    riskScore: number;
  }>;
  bestScenario: string;
  worstScenario: string;
  summary: string;
}

// Import Job Interfaces
export interface ImportJob {
  id: string;
  jobType: ImportJobType;
  status: ImportJobStatus;
  sourceType: 'csv' | 'json' | 'excel' | 'api';
  sourceUrl: string | null;
  fileName: string | null;
  recordsProcessed: number;
  recordsTotal: number;
  errorsCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ImportJobQuery {
  page?: number;
  limit?: number;
  jobType?: ImportJobType;
  status?: ImportJobStatus;
  createdBy?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ImportJobStatistics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  processingJobs: number;
  totalRecordsProcessed: number;
  averageProcessingTime: number;
  byType: Array<{ type: ImportJobType; count: number; successRate: number }>;
  byStatus: Array<{ status: ImportJobStatus; count: number; percentage: number }>;
}

export interface ImportValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: Array<{ record: number; field: string; error: string; value: any }>;
  warnings: Array<{ record: number; field: string; warning: string; value: any }>;
}

export interface ImportProgress {
  jobId: string;
  status: ImportJobStatus;
  progress: number;
  currentStage: string;
  estimatedCompletion: string | null;
  recordsProcessed: number;
  recordsTotal: number;
}

// Report Interfaces
export interface Report {
  id: string;
  title: string;
  reportType: ReportType;
  status: 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  parameters: Record<string, any>;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  fileSize: number | null;
}

export interface ReportQuery {
  page?: number;
  limit?: number;
  reportType?: ReportType;
  status?: string;
  generatedBy?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReportGenerationOptions {
  format: 'pdf' | 'excel' | 'csv' | 'html';
  includeCharts: boolean;
  includeData: boolean;
  recipientEmails: string[];
}

export interface ReportStatistics {
  totalReports: number;
  completedReports: number;
  failedReports: number;
  averageGenerationTime: number;
  byType: Array<{ type: ReportType; count: number; averageTime: number }>;
  byStatus: Array<{ status: string; count: number; percentage: number }>;
}

export interface ReportTemplate {
  id: string;
  name: string;
  reportType: ReportType;
  template: Record<string, any>;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Audit Interfaces
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditStatistics {
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
  byAction: Array<{ action: string; count: number; percentage: number }>;
  byResource: Array<{ resource: string; count: number; percentage: number }>;
  byUser: Array<{ userId: string; userName: string; count: number; percentage: number }>;
  peakHour: string;
  averageDaily: number;
}

export interface AuditTrail {
  id: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
  user: { id: string; name: string; email: string };
}

export interface UserActivitySummary {
  userId: string;
  userName: string;
  totalActions: number;
  actionsToday: number;
  actionsThisWeek: number;
  actionsThisMonth: number;
  mostFrequentAction: string;
  mostAccessedResource: string;
  lastActivity: string;
  activityByHour: Record<string, number>;
  activityByDay: Record<string, number>;
}

export interface ComplianceReport {
  period: string;
  totalActions: number;
  compliantActions: number;
  nonCompliantActions: number;
  complianceRate: number;
  byPolicy: Array<{ policy: string; compliant: number; nonCompliant: number; rate: number }>;
  byUser: Array<{ userId: string; userName: string; compliant: number; nonCompliant: number; rate: number }>;
  recommendations: string[];
}

export interface SuspiciousActivityReport {
  detectedAt: string;
  suspiciousActivities: Array<{
    userId: string;
    userName: string;
    activity: string;
    frequency: number;
    timeframe: string;
    riskScore: number;
    details: Record<string, any>;
  }>;
  totalSuspicious: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  recommendations: string[];
}

// Notification Interfaces
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read: boolean;
  userId: string;
  createdAt: string;
  readAt: string | null;
}

// Saved Properties Interfaces
export interface SavedProperty {
  id: string;
  propertyId: string;
  userId: string;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  property: Property;
}

// AI Interfaces
export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIAnalysis {
  id: string;
  analysisType: string;
  input: Record<string, any>;
  output: Record<string, any>;
  confidence: number;
  generatedAt: string;
}

// Pagination and Response Interfaces
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
  errors?: { field: string; message: string }[];
}
