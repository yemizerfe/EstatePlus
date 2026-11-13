import { Router, Request, Response } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { logger } from '../../shared/utils/logger';

import { AdminLevel } from './adapters/admin-boundaries.adapter';
import { OsmFeatureGroup } from './adapters/osm-overpass.adapter';
import { externalSourcesService } from './external-sources.service';
import { INTEGRATION_REGISTRY } from '../integrations/source-registry';

const router = Router();

/**
 * External data sources API.
 *
 * All endpoints require authentication. Sync/import endpoints additionally
 * require the analyst/admin `data-sources:update` permission; read endpoints
 * require `data-sources:read`.
 *
 * Sources covered (per integration plan):
 *  1. BinaSmart MCP          → /api/v1/bina (separate module)
 *  2. NBE statistics         → POST /nbe/sync (page probe), POST /nbe/import-csv (reliable path)
 *  3. CBE exchange rates     → POST /cbe/sync, GET /exchange-rates
 *  4. ESS CPI / inflation    → POST /ess/sync (report discovery), POST /ess/import-csv
 *  5. OSM Overpass amenities → POST /osm/sync
 *  6. Admin boundaries       → POST /boundaries/sync, GET /boundaries
 *  7. Open data (HDX; data.gov.et unreachable) → GET /open-data/search
 *  8. World Bank Open Data   → POST /world-bank/sync, GET /macro-indicators
 */

// GET /status — registry + what each adapter can actually do today.
router.get('/status', authenticate, requirePermission('data-sources:read'), (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      sources: INTEGRATION_REGISTRY.filter((s) =>
        [
          'binasmart',
          'cbe_exchange',
          'nbe_indicators',
          'ess_cpi',
          'osm_amenities',
          'admin_boundaries',
          'open_data_portal',
          'world_bank',
        ].includes(s.id),
      ),
    },
  });
});

// ── CBE ────────────────────────────────────────────────────────────────
router.post(
  '/cbe/sync',
  authenticate,
  requirePermission('data-sources:update'),
  async (req: Request, res: Response) => {
    const summary = await externalSourcesService.syncCbeExchangeRates(
      typeof req.body?.date === 'string' ? req.body.date : undefined,
    );
    res.json({ success: summary.errors.length === 0 || summary.saved > 0, data: summary });
  },
);

// ── NBE ────────────────────────────────────────────────────────────────
router.post(
  '/nbe/sync',
  authenticate,
  requirePermission('data-sources:update'),
  async (_req: Request, res: Response) => {
    const summary = await externalSourcesService.syncNbeReference();
    res.json({ success: true, data: summary });
  },
);

router.post(
  '/nbe/import-csv',
  authenticate,
  requirePermission('data-sources:update'),
  async (req: Request, res: Response) => {
    const csv = req.body?.csv;
    if (typeof csv !== 'string' || csv.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Body must contain { csv } with NBE rows: date,currency,buying,selling' });
      return;
    }
    try {
      const summary = await externalSourcesService.importNbeCsv(csv);
      res.json({ success: true, data: summary });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'NBE CSV import failed' });
    }
  },
);

// ── ESS ────────────────────────────────────────────────────────────────
router.post(
  '/ess/sync',
  authenticate,
  requirePermission('data-sources:update'),
  async (_req: Request, res: Response) => {
    const summary = await externalSourcesService.syncEssReports();
    res.json({ success: true, data: summary });
  },
);

router.post(
  '/ess/import-csv',
  authenticate,
  requirePermission('data-sources:update'),
  async (req: Request, res: Response) => {
    const csv = req.body?.csv;
    if (typeof csv !== 'string' || csv.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Body must contain { csv } with ESS rows: date,indicator,value[,unit,notes]' });
      return;
    }
    try {
      const summary = await externalSourcesService.importEssCpiCsv(csv);
      res.json({ success: true, data: summary });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'ESS CSV import failed' });
    }
  },
);

// ── World Bank ─────────────────────────────────────────────────────────
router.post(
  '/world-bank/sync',
  authenticate,
  requirePermission('data-sources:update'),
  async (req: Request, res: Response) => {
    const summary = await externalSourcesService.syncWorldBank(
      typeof req.body?.dateRange === 'string' ? req.body.dateRange : undefined,
    );
    res.json({ success: summary.errors.length === 0 || summary.saved > 0, data: summary });
  },
);

router.get(
  '/macro-indicators',
  authenticate,
  requirePermission('data-sources:read'),
  async (req: Request, res: Response) => {
    const code = typeof req.query.indicatorCode === 'string' ? req.query.indicatorCode : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const data = await externalSourcesService.getMacroIndicators(code, limit);
    res.json({ success: true, data });
  },
);

// ── OSM Overpass ───────────────────────────────────────────────────────
router.post(
  '/osm/sync',
  authenticate,
  requirePermission('data-sources:update'),
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const groups = Array.isArray(body.groups) ? (body.groups as OsmFeatureGroup[]) : undefined;
      const bbox = Array.isArray(body.bbox) && body.bbox.length === 4 ? (body.bbox as [number, number, number, number]) : undefined;
      const summary = await externalSourcesService.syncOsmAmenities({
        neighborhoodId: typeof body.neighborhoodId === 'string' ? body.neighborhoodId : undefined,
        bbox,
        groups,
        radiusMeters: typeof body.radiusMeters === 'number' ? body.radiusMeters : undefined,
      });
      res.json({ success: summary.errors.length === 0 || summary.saved > 0, data: summary });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'OSM sync failed' });
    }
  },
);

// ── Administrative boundaries ──────────────────────────────────────────
router.post(
  '/boundaries/sync',
  authenticate,
  requirePermission('data-sources:update'),
  async (req: Request, res: Response) => {
    const level = (typeof req.body?.level === 'string' ? req.body.level : 'ADM1') as AdminLevel;
    if (!['ADM1', 'ADM2', 'ADM3'].includes(level)) {
      res.status(400).json({ success: false, message: 'level must be ADM1, ADM2 or ADM3' });
      return;
    }
    const summary = await externalSourcesService.syncAdminBoundaries(level);
    res.json({ success: summary.errors.length === 0 || summary.saved > 0, data: summary });
  },
);

router.get(
  '/boundaries',
  authenticate,
  requirePermission('data-sources:read'),
  async (req: Request, res: Response) => {
    const level = typeof req.query.adminLevel === 'string' ? req.query.adminLevel : 'ADM1';
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = await externalSourcesService.getBoundaries(level, limit);
    res.json({ success: true, data });
  },
);

// ── Exchange rates read API ────────────────────────────────────────────
router.get(
  '/exchange-rates',
  authenticate,
  requirePermission('data-sources:read'),
  async (req: Request, res: Response) => {
    const currency = typeof req.query.currency === 'string' ? req.query.currency : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const data = await externalSourcesService.getExchangeRates(currency, limit);
    res.json({ success: true, data });
  },
);

// ── Open data discovery (HDX; data.gov.et unreachable) ─────────────────
router.get(
  '/open-data/search',
  authenticate,
  requirePermission('data-sources:read'),
  async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const rows = req.query.rows ? Number(req.query.rows) : 10;
    try {
      const result = await externalSourcesService.searchOpenData(query, rows);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ msg: 'Open data search failed', error });
      res.status(502).json({ success: false, message: error instanceof Error ? error.message : 'Open data search failed' });
    }
  },
);

export default router;
