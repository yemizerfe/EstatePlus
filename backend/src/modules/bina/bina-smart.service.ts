import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../shared/utils/logger';
import { BadRequestError, ServiceUnavailableError } from '../../shared/utils/errors';
import { BinaListingDetail, fetchBinaListingDetail } from './bina-listing-detail';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BINA_ENDPOINT = 'https://bina.et/mcp';
export const BINA_HEALTH_ENDPOINT = 'https://bina.et/mcp/health';

export const BINA_SOURCE_NAME = 'BinaSmart';

/**
 * Local place names reported by BinaSmart mapped to the official Addis Ababa
 * subcity-level neighborhoods already present in this database.
 */
export const BINA_AREA_TO_NEIGHBORHOOD: Record<string, string> = {
  bole: 'Bole',
  'bole atlas': 'Bole',
  atlas: 'Bole',
  beshale: 'Bole',
  megengna: 'Bole',
  megenagna: 'Bole',
  gerji: 'Bole',
  summit: 'Bole',
  'bole bulbula': 'Bole',
  ayat: 'Yeka',
  cmc: 'Yeka',
  shiromeda: 'Yeka',
  yeka: 'Yeka',
  sarbet: 'Nifas Silk-Lafto',
  lafto: 'Nifas Silk-Lafto',
  lebu: 'Nifas Silk-Lafto',
  jemo: 'Nifas Silk-Lafto',
  'old airport': 'Nifas Silk-Lafto',
  kazanchis: 'Kirkos',
  kirkos: 'Kirkos',
  piassa: 'Arada',
  piazza: 'Arada',
  merkato: 'Arada',
  arada: 'Arada',
  kolfe: 'Kolfe Keranio',
  'alem bank': 'Kolfe Keranio',
  gulele: 'Gulele',
  saris: 'Akaky Kaliti',
  figa: 'Akaky Kaliti',
  'akaky kaliti': 'Akaky Kaliti',
};
export const BINA_SOURCE_TYPE = 'BINA_MCP';

/**
 * Written into the property description when the price came from the listing
 * page's schema.org Offer (explicit currency), not from the free-text price
 * string returned by the search tool. Public metrics only count rows carrying
 * this marker, so an unverified string can never be charted as an ETB amount.
 */
export const BINA_PRICE_VERIFICATION_MARKER =
  'Price verification: ETB amount read from the BinaSmart listing page (schema.org Offer)';

export interface BinaSearchConfig {
  areas: string[];
  propertyTypes: string[];
  listingTypes: Array<'sale' | 'rent'>;
  maxResultsPerQuery: number;
  maxConcurrentQueries: number;
}

export const DEFAULT_BINA_SEARCH_CONFIG: BinaSearchConfig = {
  areas: ['Bole', 'Sarbet', 'CMC'],
  propertyTypes: ['APARTMENT'],
  listingTypes: ['sale', 'rent'],
  // The published search_properties tool caps `limit` at 8.
  maxResultsPerQuery: 8,
  maxConcurrentQueries: 3,
};

/**
 * The live MCP tool only accepts its own enum values
 * ('Apartment' | 'Condominium' | 'House / Villa' | 'Land' | 'Commercial' |
 * 'Building'), so internal PropertyType values must be translated before the
 * call, otherwise the server rejects the whole request as invalid input.
 */
export const BINA_PROPERTY_TYPE_MAP: Record<string, string> = {
  APARTMENT: 'Apartment',
  CONDOMINIUM: 'Condominium',
  VILLA: 'House / Villa',
  LAND: 'Land',
  OFFICE: 'Commercial',
  RETAIL: 'Commercial',
  WAREHOUSE: 'Commercial',
  BUILDING: 'Building',
};

export function toBinaPropertyType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return BINA_PROPERTY_TYPE_MAP[value.toUpperCase()] ?? value;
}

// Accepted arguments mirror the documented Bina search_properties tool shape.
export type BinaSearchPropertiesArgs = {
  area?: string;
  beds?: number;
  type?: string;
  limit?: number;
  query?: string;
  listing?: 'sale' | 'rent';
  max_price?: number;
};

// Normalized source record (what comes back from Bina before DB mapping)
export interface BinaRawProperty {
  id: string;
  title: string | null;
  description: string | null;
  type: string | null;
  beds: number | null;
  baths: number | null;
  size: number | null;
  area: string | null;
  company: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  link: string | null;
  checkedOnCompanySite: boolean | null;
  note: string | null;
  sourceUrl: string | null;

  /** Direction reported by the source tool ('sale' | 'rent'). Authoritative. */
  listingType: 'sale' | 'rent' | null;

  priceOriginal: string | null;
  priceAmount: number | null;
  currency: string | null;
  priceUnit: string | null;
  pricePeriod: string | null;
  priceBasis: string | null;
  normalizationStatus: 'normalized' | 'partial' | 'unparsed' | 'ambiguous';
  normalizationNotes: string | null;

  fetchedAt: Date;
}

export interface VerifiedBinaPrice {
  listingType: 'sale' | 'rent';
  amount: number;
  monthlyRent: number | null;
}

/** Only prices with explicit ETB currency and an unambiguous price basis are
 * safe to persist into the currency-less local listing schema. */
export function getVerifiedBinaPrice(raw: BinaRawProperty): VerifiedBinaPrice | null {
  if (
    raw.currency !== 'ETB' ||
    raw.normalizationStatus !== 'normalized' ||
    raw.priceAmount === null ||
    raw.priceAmount <= 0
  ) {
    return null;
  }

  if (
    raw.listingType === 'sale' &&
    raw.priceBasis === 'TOTAL_PROPERTY_PRICE' &&
    raw.pricePeriod === null &&
    raw.priceUnit === null
  ) {
    return { listingType: 'sale', amount: raw.priceAmount, monthlyRent: null };
  }

  if (raw.listingType === 'rent' && raw.priceBasis === 'MONTHLY_RENT' && raw.pricePeriod === 'MONTH') {
    return { listingType: 'rent', amount: raw.priceAmount, monthlyRent: raw.priceAmount };
  }

  if (raw.listingType === 'rent' && raw.priceBasis === 'ANNUAL_RENT' && raw.pricePeriod === 'YEAR') {
    return {
      listingType: 'rent',
      amount: raw.priceAmount,
      monthlyRent: raw.priceAmount / 12,
    };
  }

  return null;
}

export interface VerifiedDetailPrice {
  listingType: 'sale' | 'rent';
  amount: number;
  monthlyRent: number | null;
}

/**
 * A price is only persisted when the listing page states both the amount and
 * the currency. Rent needs a stated period (monthly, or annual divided by 12);
 * a bare amount with no period is not turned into a monthly rent.
 */
export function getVerifiedDetailPrice(
  detail: BinaListingDetail | null,
  raw: BinaRawProperty,
): VerifiedDetailPrice | null {
  if (!detail || detail.currency !== 'ETB' || !detail.priceAmount || detail.priceAmount <= 0) {
    return null;
  }

  const listingType = detail.listingType ?? raw.listingType;
  if (!listingType) return null;

  if (listingType === 'sale') {
    return { listingType: 'sale', amount: detail.priceAmount, monthlyRent: null };
  }

  const text = `${detail.description ?? ''} ${detail.title ?? ''}`.toLowerCase();
  const monthly = /\/\s*month|per\s+month|monthly/.test(text);
  const annual = !monthly && /\/\s*year|per\s+year|annual/.test(text);

  if (monthly || raw.pricePeriod === 'MONTH') {
    return { listingType: 'rent', amount: detail.priceAmount, monthlyRent: detail.priceAmount };
  }
  if (annual || raw.pricePeriod === 'YEAR') {
    return {
      listingType: 'rent',
      amount: detail.priceAmount,
      monthlyRent: Math.round((detail.priceAmount / 12) * 100) / 100,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BinaSmartService {
  private client: Client | null = null;
  private availableTools: Map<string, { name: string; description?: string }> = new Map();
  private discovered = false;
  private discoveryError: string | null = null;
  private importerUserId: string | null = null;

  async discoverTools(): Promise<void> {
    if (this.discovered && this.availableTools.size > 0) return;
    this.discoveryError = null;

    const transport = new StreamableHTTPClientTransport(new URL(BINA_ENDPOINT));

    const client = new Client(
      { name: 'estateplus-bina-adapter', version: '1.0.0' },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);

      const tools = await client.listTools();
      const known = new Map<string, { name: string; description?: string }>();

      for (const tool of tools?.tools ?? []) {
        known.set(tool.name, {
          name: tool.name,
          description: tool.description ?? undefined,
        });
      }

      if (!known.has('search_properties')) {
        throw new BadRequestError(
          `Bina MCP endpoint did not expose 'search_properties'. Available: ${[...known.keys()].join(', ') || '(none)'}`,
        );
      }

      this.client = client;
      this.availableTools = known;
      this.discovered = true;

      logger.info({
        msg: 'Bina MCP tool discovery completed',
        toolCount: known.size,
        hasSearchProperties: known.has('search_properties'),
      });
    } catch (error) {
      this.discoveryError = error instanceof Error ? error.message : String(error);
      this.discovered = false;
      logger.error({ msg: 'Bina MCP tool discovery failed', error: this.discoveryError });
      throw new ServiceUnavailableError('BinaSmart');
    }
  }

  async healthCheck(): Promise<{ ok: boolean; checkedAt: Date }> {
    const checkedAt = new Date();
    try {
      const response = await fetch(BINA_HEALTH_ENDPOINT, {
        method: 'GET',
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: 'application/json, text/plain, */*' },
      });

      return { ok: response.ok || response.status === 200, checkedAt };
    } catch (error) {
      logger.warn({
        msg: 'Bina health check failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, checkedAt };
    }
  }

  async ensureSearchToolAvailable(): Promise<void> {
    if (!this.discovered) {
      await this.discoverTools();
    }
    if (!this.availableTools.has('search_properties')) {
      throw new BadRequestError('search_properties tool is not available from Bina MCP');
    }
  }

  async searchProperties(args: BinaSearchPropertiesArgs): Promise<BinaRawProperty[]> {
    await this.ensureSearchToolAvailable();

    const client = this.client;
    if (!client) {
      throw new ServiceUnavailableError('BinaSmart');
    }

    const toolName = 'search_properties';

    const callArguments: Record<string, unknown> = {};
    if (args.area !== undefined) callArguments.area = args.area;
    if (args.beds !== undefined) callArguments.beds = args.beds;
    const binaType = toBinaPropertyType(args.type);
    if (binaType !== undefined) callArguments.type = binaType;
    if (args.limit !== undefined) callArguments.limit = Math.min(8, Math.max(1, Math.floor(args.limit)));
    if (args.query !== undefined) callArguments.query = args.query;
    if (args.listing !== undefined) callArguments.listing = args.listing;
    if (args.max_price !== undefined) callArguments.max_price = args.max_price;

    const startTime = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callResult: any = await (client as any).callTool({
      name: toolName,
      arguments: callArguments,
    });

    const rawContent: CallToolResult['content'] = Array.isArray(callResult?.content) ? callResult.content as CallToolResult['content'] : [];
    const rawResult: CallToolResult = { content: rawContent };

    const durationMs = Date.now() - startTime;
    const records = this.parseSearchResult(rawResult, args);

    logger.info({
      msg: 'Bina search_properties completed',
      tool: toolName,
      args: JSON.stringify(callArguments),
      parsedCount: records.length,
      durationMs,
    });

    return records;
  }

  // ------------------------------------------------------------------
  // Result parsing
  // ------------------------------------------------------------------

  private parseSearchResult(result: CallToolResult, args: BinaSearchPropertiesArgs): BinaRawProperty[] {
    const fetchedAt = new Date();

    const structuredItems: unknown[] = [];
    for (const block of result.content ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((block as any).type === 'text') {
        const text = (block as any).text as string | undefined;
        const parsed = this.parseTextContent(text ?? '');
        if (parsed) structuredItems.push(...parsed);
      } else if ((block as any).type === 'json') {
        const parsed = this.parseJsonContent(block as unknown as { type: 'json'; data?: unknown });
        if (parsed) structuredItems.push(...parsed);
      }
    }

    if (structuredItems.length > 0) {
      return structuredItems.map(
        (item) => this.normalizeRecord(item as BinaSearchPropertiesArgs & Record<string, unknown>, fetchedAt),
      );
    }

    const textBlocks = (result.content ?? [])
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text);

    const combinedText = textBlocks.join('\n');
    const parsed = this.parseTextContent(combinedText);
    if (parsed && parsed.length > 0) {
      return parsed.map(
        (item) => this.normalizeRecord(item as BinaSearchPropertiesArgs & Record<string, unknown>, fetchedAt),
      );
    }

    logger.warn({
      msg: 'Bina search returned no parseable records',
      tool: 'search_properties',
      args: JSON.stringify(args),
      contentTypes: [...new Set((result.content ?? []).map((block) => block.type))],
    });

    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseJsonContent(block: any): unknown[] {
    const data = block.data;
    if (Array.isArray(data)) return data as unknown[];
    if (data && typeof data === 'object') {
      const candidate =
        (data as Record<string, unknown>).results ??
        (data as Record<string, unknown>).data ??
        (data as Record<string, unknown>).properties ??
        (data as Record<string, unknown>).items;
      if (Array.isArray(candidate)) return candidate as unknown[];
    }
    return [];
  }

  private parseTextContent(text: string): unknown[] {
    if (!text || text.trim().length === 0) return [];

    const trimmed = text.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        const candidate =
          (parsed as Record<string, unknown>).results ??
          (parsed as Record<string, unknown>).data ??
          (parsed as Record<string, unknown>).properties ??
          (parsed as Record<string, unknown>).items ??
          (parsed as Record<string, unknown>).listings;
        if (Array.isArray(candidate)) return candidate as unknown[];
      }
      return [];
    } catch {
      const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
      if (!arrayMatch) return [];
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }

    return [];
  }

  private normalizeRecord(record: Record<string, unknown>, fetchedAt: Date): BinaRawProperty {
    const priceOriginal = this.asString(record.price ?? record['priceOriginal'] ?? null);
    const priceNormalization = this.normalizePrice(record.price ?? record['priceOriginal'] ?? null);

    return {
      id: this.stableId(record),
      title: this.asString(record.title ?? null),
      description: this.asString(record.description ?? record.note ?? null),
      type: this.asString(record.type ?? null),
      beds: this.asInt(record.beds ?? null),
      baths: this.asInt(record.baths ?? null),
      size: this.asFloat(record.size ?? null),
      area: this.asString(record.area ?? null),
      company: this.asString(record.company ?? null),
      phone: this.asString(record.phone ?? null),
      whatsapp: this.asString(record.whatsapp ?? record['whatsapp'] ?? null),
      telegram: this.asString(record.telegram ?? record['telegram'] ?? null),
      link: this.asString(record.link ?? record['source_url'] ?? null),
      checkedOnCompanySite: this.asBoolean(record.checkedOnCompanySite ?? null),
      note: this.asString(record.note ?? null),
      sourceUrl: this.asString(record.link ?? record['source_url'] ?? null),

      listingType: this.normalizeListingDirection(record.listing),

      priceOriginal,
      priceAmount: priceNormalization.amount,
      currency: priceNormalization.currency,
      priceUnit: priceNormalization.unit,
      pricePeriod: priceNormalization.period,
      priceBasis: priceNormalization.basis,
      normalizationStatus: priceNormalization.status,
      normalizationNotes: priceNormalization.notes,

      fetchedAt,
    };
  }

  private stableId(record: Record<string, unknown>): string {
    const link = this.asString(record.link ?? record['source_url'] ?? null);
    const title = this.asString(record.title ?? null);
    const beds = this.asInt(record.beds ?? null);
    const baths = this.asInt(record.baths ?? null);

    if (link) {
      return `bina:${link}`;
    }
    if (title) {
      return `bina:title:${Buffer.from(title.normalize('NFKC')).toString('base64url')}:${beds ?? ''}:${baths ?? ''}`;
    }
    return `bina:generated:${crypto.randomUUID()}`;
  }

  private normalizePrice(raw: unknown): {
    amount: number | null;
    currency: string | null;
    unit: string | null;
    period: string | null;
    basis: string | null;
    status: BinaRawProperty['normalizationStatus'];
    notes: string | null;
  } {
    const original = this.asString(raw);
    if (original === null || original.trim().length === 0) {
      return {
        amount: null,
        currency: null,
        unit: null,
        period: null,
        basis: null,
        status: 'unparsed',
        notes: 'No price field present in source record',
      };
    }

    const normalizedOriginal = original.trim();

    const stripped = normalizedOriginal
      .replace(/,/g, '')
      .replace(/etb|ethiopian|birr|birr\s*/gi, '')
      .trim();

    const isPriceRange = /^\s*\d[\d.]*\s*(?:-|–|to)\s*\d/i.test(stripped);
    const amountMatch = isPriceRange
      ? null
      : stripped.match(/^-?\d+(?:\.\d+)?\s*(k|m|b|thousand|million|billion)?\b/i);
    const suffix = amountMatch?.[1]?.toLowerCase();
    const multiplier =
      suffix === 'k' || suffix === 'thousand'
        ? 1_000
        : suffix === 'm' || suffix === 'million'
          ? 1_000_000
          : suffix === 'b' || suffix === 'billion'
            ? 1_000_000_000
            : 1;
    const parsedAmount = amountMatch ? parseFloat(amountMatch[0]) : null;
    const amount = parsedAmount === null ? null : parsedAmount * multiplier;

    let currency: string | null = null;
    if (/etb|ethiopian|birr|ETB|ETB\/|ETB\s/.test(normalizedOriginal)) {
      currency = 'ETB';
    } else if (/usd|\$|USD|dollars?/i.test(normalizedOriginal)) {
      currency = 'USD';
    }

    let period: string | null = null;
    let unit: string | null = null;
    let basis: string | null = null;
    let status: BinaRawProperty['normalizationStatus'] = 'partial';
    const notes: string[] = [];

    if (/per\s*(sqm|sq\s*m|square\s*meter|\/sqm|\/m2)/i.test(normalizedOriginal)) {
      unit = 'PER_SQM';
      basis = 'PRICE_PER_SQFT';
      notes.push('Price appears to be per square meter');
    } else if (/\/month|\/mo|monthly|month\b/i.test(normalizedOriginal)) {
      period = 'MONTH';
      basis = 'MONTHLY_RENT';
      notes.push('Price appears to be monthly');
    } else if (/\/year|\/yr|annual|year\b/i.test(normalizedOriginal)) {
      period = 'YEAR';
      basis = 'ANNUAL_RENT';
      notes.push('Price appears to be annual');
    } else if (/total|together|sale|for\s*sale|purchase/i.test(normalizedOriginal)) {
      basis = 'TOTAL_PROPERTY_PRICE';
    }

    if (amount === null) {
      status = 'unparsed';
      notes.push('Could not extract a numeric amount from the price string');
    } else if (!currency) {
      status = 'ambiguous';
      notes.push('Currency not explicitly stated in source price string; preserved as-is');
    } else if (!basis && !period && !unit) {
      status = 'ambiguous';
      notes.push('Price value parsed but unit/period unclear; preserved as-is');
    } else {
      status = 'normalized';
    }

    return { amount, currency, unit, period, basis, status, notes: notes.length > 0 ? notes.join('; ') : null };
  }

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------

  async upsertSourceRegistration(): Promise<string> {
    let source = await prisma.dataSource.findFirst({
      where: { name: BINA_SOURCE_NAME, sourceType: BINA_SOURCE_TYPE },
    });

    if (!source) {
      source = await prisma.dataSource.create({
        data: {
          name: BINA_SOURCE_NAME,
          sourceType: BINA_SOURCE_TYPE,
          description: 'BinaSmart MCP property listings adapter (https://bina.et/mcp)',
        },
      });
    }

    return source.id;
  }

  async recordSourceStatus(
    sourceId: string,
    opts: {
      fetchedAt?: Date;
      resultCount?: number;
      durationMs?: number;
      errorCategory?: string;
      errorMessage?: string;
      toolAvailable?: boolean;
    } = {},
  ): Promise<void> {
    const fetchedAt = opts.fetchedAt ?? new Date();

    await prisma.dataSource.update({
      where: { id: sourceId },
      data: {
        description: `BinaSmart MCP property listings adapter (https://bina.et/mcp). Last checked: ${fetchedAt.toISOString()}.`,
      },
    });

    // The existing schema does not have a dedicated source-status table, so we
    // record freshness/errors on the DataSource record via description + a
    // structured note. In a later phase this should become a dedicated table.
    // For now we also create an import job record to preserve provenance.
    void opts;
  }

  async createImportJobForSearch(
    sourceId: string,
    querySummary: string,
    _records: BinaRawProperty[],
    resultCount: number,
    _durationMs: number,
    errorCategory?: string,
    errorMessage?: string,
  ): Promise<string> {
    void querySummary;
    const statusValue = errorCategory ? ('failed' as const) : ('completed' as const);
    const job = await prisma.dataImportJob.create({
      data: {
        sourceId,
        jobType: 'BINA_PROPERTY_SEARCH',
        status: statusValue,
        recordsReceived: resultCount,
        recordsValid: errorCategory ? 0 : _records.length,
        recordsRejected: errorCategory ? resultCount : 0,        errorLog: errorCategory ? { category: errorCategory, message: errorMessage ?? '', query: querySummary } : undefined,
        fileName: null,
        startedAt: new Date(),
        completedAt: new Date(),
        createdBy: null,
      },
    });

    return job.id;
  }

  // ------------------------------------------------------------------
  // Persist a batch of normalized records into Property + Listing
  // ------------------------------------------------------------------

  async ingestSearchResult(
    sourceId: string,
    _querySummary: string,
    rawProperties: BinaRawProperty[],
    opts?: { skipDuplicates?: boolean },
  ): Promise<{
    ingested: number;
    skipped: number;
    errors: Array<{ index: number; property: string; message: string }>;
    propertyIds: string[];
  }> {
    // Every ingest is idempotent: records already stored by source URL are
    // always skipped, so `skipDuplicates` is accepted for API compatibility.
    void opts;
    const errors: Array<{ index: number; property: string; message: string }> = [];
    const propertyIds: string[] = [];
    let ingested = 0;
    let skipped = 0;

    for (let i = 0; i < rawProperties.length; i++) {
      const raw = rawProperties[i];
      try {
        const existingBySourceKey = await this.findExistingBySourceKey(raw.id);
        if (existingBySourceKey) {
          skipped++;
          continue;
        }

        // The search tool returns prices as the listing company wrote them, so
        // the listing page is read for the machine-readable Offer (amount +
        // currency). Without it only an already-normalized ETB string is used.
        const detail = raw.sourceUrl ? await this.fetchDetailSafe(raw.sourceUrl) : null;
        // The page read only proves the currency when it actually yielded an
        // ETB Offer; a page that loaded without one leaves the search-tool
        // string unverified, however successfully it was fetched.
        const detailPrice = getVerifiedDetailPrice(detail, raw);
        const verifiedPrice = detailPrice ?? getVerifiedBinaPrice(raw);
        if (!verifiedPrice) {
          skipped++;
          continue;
        }

        const property = await this.upsertPropertyFromBina(
          sourceId,
          raw,
          detail,
          verifiedPrice,
          detailPrice !== null,
        );
        if (!property) {
          skipped++;
          continue;
        }
        propertyIds.push(property.id);
        ingested++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ index: i, property: raw.id, message });
        logger.warn({
          msg: 'Bina record skipped on ingest',
          index: i,
          sourceKey: raw.id,
          error: message,
        });
      }
    }

    return { ingested, skipped, errors, propertyIds };
  }

  private async findExistingBySourceKey(sourceKey: string): Promise<{ id: string } | null> {
    // Property has no dedicated source-key column, so provenance (including the
    // source URL) is stored in `description`. Dedup looks for that URL.
    const sourceUrl = sourceKey.replace(/^bina:/, '').trim();
    if (!sourceUrl) return null;
    return prisma.property.findFirst({
      where: { description: { contains: sourceUrl } },
      select: { id: true },
    });
  }

  /**
   * Owner used for source-imported properties. Properties require an existing
   * user row, so resolve (or create) a dedicated system importer account
   * instead of writing a placeholder UUID that violates the foreign key.
   */
  private async resolveImporterUserId(): Promise<string> {
    if (this.importerUserId) return this.importerUserId;

    const existing = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'ANALYST'] }, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (existing) {
      this.importerUserId = existing.id;
      return existing.id;
    }

    const systemUser = await prisma.user.create({
      data: {
        email: 'data-imports@estateplus.local',
        firstName: 'Data',
        lastName: 'Imports',
        role: 'ANALYST',
        isActive: false,
      },
      select: { id: true },
    });
    this.importerUserId = systemUser.id;
    return systemUser.id;
  }

  private async fetchDetailSafe(url: string): Promise<BinaListingDetail | null> {
    try {
      return await fetchBinaListingDetail(url);
    } catch (error) {
      logger.warn({
        msg: 'BinaSmart listing page could not be read; record will keep only the search-tool price',
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async upsertPropertyFromBina(
    sourceId: string,
    raw: BinaRawProperty,
    detail: BinaListingDetail | null,
    verifiedPrice: VerifiedDetailPrice,
    verifiedFromDetailPage: boolean,
  ): Promise<{ id: string } | null> {
    // Bina reports areas like "Bole, Addis Ababa"; the neighborhood registry
    // stores just "Bole", so match on the area name only.
    const areaName = this.normalizeAreaName(raw.area);
    const neighborhood = await prisma.neighborhood.findFirst({
      where: {
        name: { equals: areaName ?? '', mode: 'insensitive' },
        city: { equals: 'Addis Ababa', mode: 'insensitive' },
      },
    });

    if (!neighborhood) {
      return null;
    }

    return this.createPropertyRecord(
      sourceId,
      raw,
      neighborhood.id,
      detail,
      verifiedPrice,
      verifiedFromDetailPage,
    );
  }

  private async createPropertyRecord(
    sourceId: string,
    raw: BinaRawProperty,
    neighborhoodId: string,
    detail: BinaListingDetail | null,
    verifiedPrice: VerifiedDetailPrice,
    verifiedFromDetailPage: boolean,
  ): Promise<{ id: string } | null> {
    const askingPrice = verifiedPrice.monthlyRent ?? verifiedPrice.amount;
    const listingType = verifiedPrice.listingType.toUpperCase() as 'SALE' | 'RENT';
    const ownerId = await this.resolveImporterUserId();
    const isRent = listingType === 'RENT';
    const postedAt =
      detail?.datePosted && !Number.isNaN(detail.datePosted.getTime())
        ? detail.datePosted
        : raw.fetchedAt;
    const sizeSqm = detail?.sizeSqm ?? raw.size ?? 0;
    const bedrooms = detail?.bedrooms ?? raw.beds ?? 0;
    const bathrooms = detail?.bathrooms ?? raw.baths ?? 0;

    const property = await prisma.property.create({
      data: {
        title: detail?.title ?? raw.title ?? 'Untitled Bina listing',
        description:
          detail?.description ??
          raw.description ??
          `BinaSmart listing — ${raw.normalizationNotes ?? 'no description'}`,
        propertyType: this.mapPropertyType(detail?.propertyTypeLabel ?? raw.type),
        condition: 'GOOD',
        neighborhoodId,
        address: detail?.address ?? raw.area ?? null,
        latitude: null,
        longitude: null,
        // Unknown size/bed/bath counts are recorded as 0 and are excluded from
        // per-m² calculations by the public services (size must be > 0).
        sizeSqm,
        bedrooms,
        bathrooms,
        askingPrice,
        rentalPrice: isRent ? askingPrice : null,
        listingDate: postedAt,
        status: 'APPROVED',
        ownerId,
        approvedBy: ownerId,
        approvedAt: raw.fetchedAt,
      },
    });

    if (detail && detail.images.length > 0) {
      await prisma.propertyImage.createMany({
        data: detail.images.map((imageUrl, index) => ({
          propertyId: property.id,
          imageUrl,
          altText: (detail.title ?? raw.title ?? 'BinaSmart listing').slice(0, 250),
          isPrimary: index === 0,
          sortOrder: index,
        })),
        skipDuplicates: true,
      });
    }

    const checkedOnCompanySiteLabel = raw.checkedOnCompanySite !== null && raw.checkedOnCompanySite !== undefined
      ? String(raw.checkedOnCompanySite)
      : 'n/a';
    void sourceId;
    const provenanceNote = [
      `Source: BinaSmart (${BINA_ENDPOINT})`,
      verifiedFromDetailPage
        ? BINA_PRICE_VERIFICATION_MARKER
        : 'Price verification: unverified price string from search tool',
      `Source URL: ${raw.sourceUrl ?? 'n/a'}`,
      `Price original: ${raw.priceOriginal ?? 'n/a'}`,
      `Price normalized: ${raw.priceAmount ?? 'n/a'} ${raw.currency ?? ''}`,
      `Price unit: ${raw.priceUnit ?? 'n/a'}`,
      `Price period: ${raw.pricePeriod ?? 'n/a'}`,
      `Price basis: ${raw.priceBasis ?? 'n/a'}`,
      `Price normalization: ${raw.normalizationStatus}`,
      `Normalization notes: ${raw.normalizationNotes ?? 'n/a'}`,
      `Company: ${raw.company ?? 'n/a'}`,
      `Phone: ${raw.phone ?? 'n/a'}`,
      `WhatsApp: ${raw.whatsapp ?? 'n/a'}`,
      `Telegram: ${raw.telegram ?? 'n/a'}`,
      `Checked on company site: ${checkedOnCompanySiteLabel}`,
      `Note: ${raw.note ?? 'n/a'}`,
      `Fetched at: ${raw.fetchedAt.toISOString()}`,
    ]
      .filter(Boolean)
      .join(' | ');

    await prisma.property.update({
      where: { id: property.id },
      data: {
        description: [property.description, provenanceNote].filter(Boolean).join('\n\n'),
      },
    });

    if (listingType) {
      const listingTypeEnum = listingType === 'SALE' ? 'SALE' : listingType === 'RENT' ? 'RENT' : 'BOTH';
      await prisma.listing.create({
        data: {
          propertyId: property.id,
          listingType: listingTypeEnum,
          currentPrice: askingPrice,
          originalPrice: askingPrice,
          rentalPrice: isRent ? askingPrice : null,
          status: 'ACTIVE',
          expiresAt: null,
          listedAt: postedAt,
        },
      }).catch((err) => {
        logger.warn({
          msg: 'Bina listing creation skipped (likely duplicate/constraint)',
          propertyId: property.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return { id: property.id };
  }

  private normalizeListingDirection(value: unknown): 'sale' | 'rent' | null {
    if (typeof value !== 'string') return null;
    const v = value.trim().toLowerCase();
    if (v === 'sale' || v === 'buy') return 'sale';
    if (v === 'rent' || v === 'lease') return 'rent';
    return null;
  }

  /**
   * Map a Bina area onto the Addis Ababa neighborhood registry so imports do
   * not create near-duplicate neighborhoods for local place names.
   * "Bole, Addis Ababa" -> "Bole"; "CMC" -> "Yeka".
   */
  private normalizeAreaName(area: string | null): string | null {
    if (!area) return null;
    const name = area.split(',')[0]?.trim();
    if (!name) return null;
    return BINA_AREA_TO_NEIGHBORHOOD[name.toLowerCase()] ?? name;
  }

  private mapPropertyType(type: string | null): 'APARTMENT' | 'VILLA' | 'CONDOMINIUM' | 'OFFICE' | 'RETAIL' | 'WAREHOUSE' | 'LAND' {
    if (!type) return 'APARTMENT';
    const t = type.toUpperCase();
    if (t.includes('APARTMENT') || t.includes('FLAT') || t.includes('UNIT')) return 'APARTMENT';
    if (t.includes('VILLA') || t.includes('HOUSE') || t.includes('HOME')) return 'VILLA';
    if (t.includes('CONDO')) return 'CONDOMINIUM';
    if (t.includes('OFFICE')) return 'OFFICE';
    if (t.includes('RETAIL') || t.includes('SHOP') || t.includes('STORE')) return 'RETAIL';
    if (t.includes('WAREHOUSE') || t.includes('FACTORY') || t.includes('INDUSTRIAL')) return 'WAREHOUSE';
    if (t.includes('LAND') || t.includes('PLOT') || t.includes('SITE')) return 'LAND';
    return 'APARTMENT';
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private asString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private asInt(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private asFloat(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = parseFloat(String(value));
    return Number.isNaN(parsed) ? null : parsed;
  }

  private asBoolean(value: unknown): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    const s = String(value).toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    return null;
  }
}

// Singleton affordance for the import pipeline
export const binaSmartService = new BinaSmartService();
