import 'express-async-errors';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { checkDbHealth } from './infrastructure/database/prisma';
import { checkRedisHealth } from './infrastructure/redis/client';
import { checkRabbitHealth } from './infrastructure/rabbitmq/client';
import { register } from './infrastructure/metrics/prometheus';
import { errorHandler } from './middleware/errorHandler';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { globalRateLimiter, authRateLimiter } from './middleware/rateLimiter';
import { requestId } from './middleware/requestId';
import { logger } from './shared/utils/logger';

// Module routes
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import usersRoutes from './modules/users/users.routes';
import propertiesRoutes from './modules/properties/properties.routes';
import listingsRoutes from './modules/listings/listings.routes';
import savedPropertiesRoutes from './modules/saved-properties/saved-properties.routes';
import searchRoutes from './modules/search/search.routes';
import neighborhoodsRoutes from './modules/neighborhoods/neighborhoods.routes';
import marketRoutes from './modules/market/market.routes';
import valuationRoutes from './modules/valuation/valuation.routes';
import forecastingRoutes from './modules/forecasting/forecasting.routes';
import economicsRoutes from './modules/economics/economics.routes';
import reportsRoutes from './modules/reports/reports.routes';
import dataSourcesRoutes from './modules/data-sources/data-sources.routes';
import publicRoutes from './modules/public/public.routes';
import scenariosRoutes from './modules/scenarios/scenarios.routes';
import aiRoutes from './modules/ai/ai.routes';
import ingestionRoutes from './modules/ingestion/ingestion.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import inquiriesRoutes from './modules/inquiries/inquiries.routes';
import viewingsRoutes from './modules/viewings/viewings.routes';
import documentsRoutes from './modules/documents/documents.routes';
import dataImportRoutes from './modules/data-import/data-import.routes';
import auditRoutes from './modules/audit/audit.routes';
import binaRoutes from './modules/bina/bina-search.controller';
import externalSourcesRoutes from './modules/external-sources/external-sources.routes';

export function createApp() {
  const app = express();

  // ─── Security ────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // ─── Parsing & Compression ────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());

  // ─── Observability ───────────────────────────────────────
  app.use(requestId);
  app.use(pinoHttp({
    logger,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url?.split('?')[0],
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    customSuccessMessage: (req, res) => `${req.method} ${req.url?.split('?')[0]} → ${res.statusCode}`,
    redact: ['req.headers.authorization'],
  }));
  app.use(metricsMiddleware);

  // ─── Rate limiting ───────────────────────────────────────
  app.use(globalRateLimiter);

  // ─── Uploaded media ──────────────────────────────────────
  // Avatars are written to <cwd>/uploads/avatars by the auth service; they must
  // be reachable at the URL stored on the user record (/uploads/...).
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), {
      maxAge: '7d',
      fallthrough: true,
      index: false,
    }),
  );

  // ─── Health & Metrics ────────────────────────────────────
  app.get('/health', async (_req: Request, res: Response) => {
    const [db, redis, rabbit] = await Promise.all([
      checkDbHealth(),
      checkRedisHealth(),
      checkRabbitHealth(),
    ]);
    const status = db ? 'healthy' : 'degraded';
    res.status(db ? 200 : 503).json({
      status,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: { database: db, redis, rabbitmq: rabbit },
    });
  });

  app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // ─── API Routes ──────────────────────────────────────────
  const prefix = config.API_PREFIX;

  // Swagger API docs
  app.use(`${prefix}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'RealEstate IQ API Docs',
  }));

  // Public, read-only data for the marketing pages (no authentication).
  app.use(`${prefix}/public`, publicRoutes);

  app.use(`${prefix}/auth`, authRateLimiter, authRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/properties`, propertiesRoutes);
  app.use(`${prefix}/listings`, listingsRoutes);
  app.use(`${prefix}/saved-properties`, savedPropertiesRoutes);
  app.use(`${prefix}/search`, searchRoutes);
  app.use(`${prefix}/neighborhoods`, neighborhoodsRoutes);
  app.use(`${prefix}/market`, marketRoutes);
  app.use(`${prefix}/properties`, valuationRoutes);
  app.use(`${prefix}/forecasts`, forecastingRoutes);
  app.use(`${prefix}/economics`, economicsRoutes);
  app.use(`${prefix}/reports`, reportsRoutes);
  app.use(`${prefix}/data-sources`, dataSourcesRoutes);
  app.use(`${prefix}/scenarios`, scenariosRoutes);
  app.use(`${prefix}/ai`, aiRoutes);
  app.use(`${prefix}/ingestion`, ingestionRoutes);
  app.use(`${prefix}/notifications`, notificationsRoutes);
  // Owner workspace: buyer inquiries, property viewings, attached documents
  app.use(`${prefix}/inquiries`, inquiriesRoutes);
  app.use(`${prefix}/viewings`, viewingsRoutes);
  app.use(`${prefix}/documents`, documentsRoutes);
  app.use(`${prefix}/data-import`, dataImportRoutes);
  // BinaSmart MCP adapter — real controller (search/preview/import)
  app.use(`${prefix}/bina`, binaRoutes as unknown as express.RequestHandler);
  // External data sources: CBE, NBE, ESS, World Bank, OSM Overpass, admin
  // boundaries, open-data discovery (HDX), + status/read APIs.
  app.use(`${prefix}/external-sources`, externalSourcesRoutes);
  app.use(`${prefix}/audit`, auditRoutes);

  // Serve built frontend in production
  if (config.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../frontend/dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
    });
  } else if (config.NODE_ENV === 'development') {
    // Proxy SPA paths to Vite in dev so pages render without backend changes
    const http = require('http');
    app.use('/app', (req, res, next) => {
      const proxy = http.request({
        hostname: 'localhost',
        port: 5173,
        path: req.originalUrl,
        method: req.method,
        headers: req.headers,
      }, (proxyRes: import('http').IncomingMessage) => {
        res.statusCode = proxyRes.statusCode ?? 502;
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (key !== 'transfer-encoding' && value !== undefined) res.setHeader(key, value);
        }
        proxyRes.pipe(res);
      });
      proxy.on('error', () => next());
      req.pipe(proxy);
    });
  }

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
