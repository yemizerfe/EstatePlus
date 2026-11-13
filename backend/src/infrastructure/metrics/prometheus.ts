import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();
register.setDefaultLabels({ app: 'realestate-backend' });
collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total Redis cache hits',
  labelNames: ['key_prefix'],
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total Redis cache misses',
  labelNames: ['key_prefix'],
  registers: [register],
});

export const importJobsTotal = new Counter({
  name: 'import_jobs_total',
  help: 'Total import jobs processed',
  labelNames: ['status'],
  registers: [register],
});

export const kafkaEventsPublished = new Counter({
  name: 'kafka_events_published_total',
  help: 'Total Kafka events published',
  labelNames: ['topic', 'event_type'],
  registers: [register],
});
