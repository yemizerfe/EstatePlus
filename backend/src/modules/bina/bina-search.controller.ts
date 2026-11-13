import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { body } from 'express-validator';
import { sendSuccess, sendError } from '../../shared/utils/response';
import {
  binaSmartService,
  BinaSearchPropertiesArgs,
  DEFAULT_BINA_SEARCH_CONFIG,
  BinaSmartService,
} from './bina-smart.service';
import { BadRequestError } from '../../shared/utils/errors';

// Reusable service instance for testability
function getService(): BinaSmartService {
  return binaSmartService;
}

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/v1/bina/search
//
// Authenticated + authorized endpoint that:
//  1. Ensures the Bina MCP tool `search_properties` is discoverable.
//  2. Runs one configured search (area + type + listing) with bounded limits.
//  3. Parses + normalizes prices with provenance.
//  4. Persists results into Property + Listing with source attribution.
//  5. Returns the ingested records plus provenance metadata.
// ---------------------------------------------------------------------------

router.post(
  '/search',
  authenticate,
  requirePermission('IMPORT_DATA'),
  [
    // Allow callers to override the default config for a single search.
    body('area').optional().isString().isLength({ max: 150 }),
    body('propertyType').optional().isString().isLength({ max: 50 }),
    body('listingType').optional().isIn(['sale', 'rent']),
    body('maxResults').optional().isInt({ min: 1, max: 200 }),
    body('skipDuplicates').optional().isBoolean(),
    validate,
  ],
  async (req: Request, res: Response) => {
      const service = getService();

    // ---- Build search args from config + request overrides ----
    const config = DEFAULT_BINA_SEARCH_CONFIG;

    // Use request overrides when provided, otherwise fall back to the first
    // configured area/type/listing.
    const area = (req.body.area ?? config.areas[0]) ?? 'Bole';
    const propertyType = req.body.propertyType ?? config.propertyTypes[0] ?? 'APARTMENT';
    const listingType = (req.body.listingType ?? config.listingTypes[0]) ?? 'sale';
    const maxResults = Math.min(req.body.maxResults ?? config.maxResultsPerQuery, 200);
    const skipDuplicates = req.body.skipDuplicates ?? false;

    if (!config.areas.includes(area)) {
      throw new BadRequestError(`Area not in configured search list: ${area}`);
    }
    if (!config.propertyTypes.includes(propertyType)) {
      throw new BadRequestError(`Property type not in configured search list: ${propertyType}`);
    }
    if (!config.listingTypes.includes(listingType)) {
      throw new BadRequestError(`Listing type not in configured search list: ${listingType}`);
    }

    const searchArgs: BinaSearchPropertiesArgs = {
      area,
      type: propertyType,
      listing: listingType,
      limit: maxResults,
      // Note: per spec we do not invent pagination/date/geo filters beyond the
      // documented arguments.
    };

    const querySummary = `area=${area}, type=${propertyType}, listing=${listingType}, limit=${maxResults}`;

    // ---- Discover tools if needed ----
    try {
      await service.discoverTools();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      loggerError('Bina tool discovery failed before search', { error: message });
      return sendError(res, 'BinaSmart MCP unavailable: tool discovery failed', 503);
    }

    // ---- Search ----
    let rawProperties;
    try {
      rawProperties = await service.searchProperties(searchArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      loggerError('Bina search_properties call failed', { error: message, args: searchArgs });
      return sendError(res, 'BinaSmart MCP search failed', 503);
    }

    if (!rawProperties || rawProperties.length === 0) {
      return sendSuccess(res, {
        source: 'BinaSmart',
        query: searchArgs,
        resultCount: 0,
        ingestedCount: 0,
        records: [],
        provenance: { sourceName: 'BinaSmart', sourceUrl: 'https://bina.et/mcp' },
        warning: 'No parseable records returned by the source for this query.',
      });
    }

    // ---- Persist ----
    const sourceId = await service.upsertSourceRegistration();

    const ingestResult = await service.ingestSearchResult(sourceId, querySummary, rawProperties, {
      skipDuplicates,
    });

    // ---- Record provenance job ----
    try {
      await service.createImportJobForSearch(
        sourceId,
        querySummary,
        rawProperties,
        rawProperties.length,
        0,
      );
    } catch (error) {
      // Non-fatal: the records are already persisted; just log the provenance gap.
      loggerError('Bina import job record failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // ---- Return----
    return sendSuccess(res, {
      source: 'BinaSmart',
      query: searchArgs,
      resultCount: rawProperties.length,
      ingestedCount: ingestResult.ingested,
      skippedCount: ingestResult.skipped,
      errors: ingestResult.errors,
      records: rawProperties.map((raw, idx) => ({
        sourceKey: raw.id,
        title: raw.title,
        description: raw.description,
        type: raw.type,
        beds: raw.beds,
        baths: raw.baths,
        size: raw.size,
        area: raw.area,
        company: raw.company,
        phone: raw.phone,
        whatsapp: raw.whatsapp,
        telegram: raw.telegram,
        link: raw.link,
        checkedOnCompanySite: raw.checkedOnCompanySite,
        note: raw.note,
        sourceUrl: raw.sourceUrl,
        price: {
          original: raw.priceOriginal,
          amount: raw.priceAmount,
          currency: raw.currency,
          unit: raw.priceUnit,
          period: raw.pricePeriod,
          basis: raw.priceBasis,
          normalizationStatus: raw.normalizationStatus,
          notes: raw.normalizationNotes,
        },
        fetchedAt: raw.fetchedAt.toISOString(),
        // Internal IDs only returned to authorized callers
        propertyId: ingestResult.propertyIds[idx] ?? null,
      })),
      provenance: {
        sourceName: 'BinaSmart',
        sourceType: 'BINA_MCP',
        sourceUrl: 'https://bina.et/mcp',
        dataSourceId: sourceId,
        querySummary,
        fetchedAt: new Date().toISOString(),
        priceNormalizationRule:
          'Original price preserved verbatim; numeric amount + currency/unit/period extracted heuristically only when explicitly present in the source string; ambiguous or missing currency is NOT assumed to be ETB.',
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/bina/health
//
// Lightweight, unauthenticated probe so the frontend/admin can see whether the
// adapter can currently reach the MCP endpoint.
// ---------------------------------------------------------------------------

router.get('/health', async (_req: Request, res: Response) => {
  const service = getService();

  let discovered = false;
  let searchToolAvailable = false;
  let discoveryError: string | null = null;
  try {
    if (!service['discovered']) {
      await service.discoverTools();
    }
    discovered = service['discovered'];
    searchToolAvailable = service['availableTools'].has('search_properties');
  } catch (error) {
    discoveryError = error instanceof Error ? error.message : String(error);
  }

  const health = await service.healthCheck();

  return sendSuccess(res, {
    endpoint: 'https://bina.et/mcp',
    healthCheck: {
      ok: health.ok,
      checkedAt: health.checkedAt.toISOString(),
    },
    toolDiscovery: {
      discovered,
      searchToolAvailable,
      discoveryError,
      availableTools: discovered ? [...service['availableTools'].keys()] : [],
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/bina/ingest
//
// Authorized endpoint to re-ingest a prior search result (e.g. after schema
// changes). Accepts a JSON body of normalized Bina records.
// ---------------------------------------------------------------------------

router.post(
  '/ingest',
  authenticate,
  requirePermission('IMPORT_DATA'),
  [
    body('records').isArray({ min: 1 }),
    body('records.*.sourceKey').isString(),
    body('records.*.title').optional().isString(),
    body('records.*.description').optional().isString(),
    body('records.*.type').optional().isString(),
    body('records.*.beds').optional().isInt({ min: 0 }),
    body('records.*.baths').optional().isInt({ min: 0 }),
    body('records.*.size').optional().isFloat({ min: 0 }),
    body('records.*.area').optional().isString(),
    body('records.*.company').optional().isString(),
    body('records.*.link').optional().isString(),
    body('records.*.priceOriginal').optional().isString(),
    body('records.*.priceAmount').optional().isFloat({ min: 0 }),
    body('records.*.currency').optional().isString(),
    body('records.*.priceUnit').optional().isString(),
    body('records.*.pricePeriod').optional().isString(),
    body('records.*.priceBasis').optional().isString(),
    body('records.*.normalizationStatus')
      .optional()
      .isIn(['normalized', 'partial', 'unparsed', 'ambiguous']),
    body('records.*.normalizationNotes').optional().isString(),
    validate,
  ],
  async (req: Request, res: Response) => {
    const service = getService();
    const sourceId = await service.upsertSourceRegistration();

    const rawProperties: Parameters<BinaSmartService['ingestSearchResult']>[2] = (req.body.records as Array<{
      sourceKey: string;
      title?: string;
      description?: string;
      type?: string;
      beds?: number;
      baths?: number;
      size?: number;
      area?: string;
      company?: string;
      link?: string;
      priceOriginal?: string;
      priceAmount?: number;
      currency?: string;
      priceUnit?: string;
      pricePeriod?: string;
      priceBasis?: string;
      normalizationStatus?: 'normalized' | 'partial' | 'unparsed' | 'ambiguous';
      normalizationNotes?: string;
    }>).map((r) => ({
      id: r.sourceKey,
      title: r.title ?? null,
      description: r.description ?? null,
      type: r.type ?? null,
      beds: r.beds ?? null,
      baths: r.baths ?? null,
      size: r.size ?? null,
      area: r.area ?? null,
      company: r.company ?? null,
      phone: null,
      whatsapp: null,
      telegram: null,
      link: r.link ?? null,
      checkedOnCompanySite: null,
      note: null,
      sourceUrl: r.link ?? null,
      listingType: null,
      priceOriginal: r.priceOriginal ?? null,
      priceAmount: r.priceAmount ?? null,
      currency: r.currency ?? null,
      priceUnit: r.priceUnit ?? null,
      pricePeriod: r.pricePeriod ?? null,
      priceBasis: r.priceBasis ?? null,
      normalizationStatus: r.normalizationStatus ?? 'unparsed',
      normalizationNotes: r.normalizationNotes ?? null,
      fetchedAt: new Date(),
    }));

    const ingestResult = await service.ingestSearchResult(sourceId, 'manual re-ingest', rawProperties);

    return sendSuccess(res, {
      ingestedCount: ingestResult.ingested,
      skippedCount: ingestResult.skipped,
      errors: ingestResult.errors,
    });
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { logger } from '../../shared/utils/logger';

function loggerError(msg: string, details: Record<string, unknown>): void {
  logger.error({ msg, ...details });
}

export default router;
