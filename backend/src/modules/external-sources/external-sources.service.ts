import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../shared/utils/logger';

import { AdminLevel, adminBoundariesAdapter } from './adapters/admin-boundaries.adapter';
import { cbeExchangeAdapter, NormalizedExchangeRate } from './adapters/cbe-exchange.adapter';
import { essCpiAdapter, EssCpiObservation } from './adapters/ess-cpi.adapter';
import { NbeRateRow, nbeAdapter } from './adapters/nbe.adapter';
import { OsmFeatureGroup, osmOverpassAdapter } from './adapters/osm-overpass.adapter';
import { openDataPortalAdapter, OpenDataset } from './adapters/open-data-portal.adapter';
import { worldBankAdapter, WORLD_BANK_INDICATORS } from './adapters/world-bank.adapter';

/**
 * Orchestration layer for the eight external data sources. Each sync:
 *  - fetches from the real source (no fabricated data),
 *  - upserts into the appropriate table,
 *  - returns an honest summary (counts + per-source notes/errors).
 */

export interface SyncSummary {
  source: string;
  fetched: number;
  saved: number;
  skipped: number;
  errors: string[];
  note?: string;
  syncedAt: string;
}

export class ExternalSourcesService {
  // ── CBE exchange rates ────────────────────────────────────────────────
  async syncCbeExchangeRates(date?: string): Promise<SyncSummary> {
    const errors: string[] = [];
    let fetched = 0;
    let saved = 0;
    try {
      const rates = await cbeExchangeAdapter.fetchDailyRates(date);
      fetched = rates.length;
      for (const rate of rates) {
        try {
          await this.upsertExchangeRate(rate);
          saved++;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    return {
      source: 'cbe_exchange',
      fetched,
      saved,
      skipped: fetched - saved,
      errors,
      note:
        errors.length > 0 && saved === 0
          ? 'CBE endpoint did not return data (may be unreachable from this network or a non-business day). No substitute rate source is used.'
          : undefined,
      syncedAt: new Date().toISOString(),
    };
  }

  // ── NBE official reference ────────────────────────────────────────────
  async syncNbeReference(): Promise<SyncSummary> {
    const probe = await nbeAdapter.fetchReferencePage();
    let saved = 0;
    for (const row of probe.rows) {
      try {
        await prisma.exchangeRate.upsert({
          where: {
            rateDate_currency_source: {
              rateDate: row.rateDate,
              currency: row.currency,
              source: 'NBE',
            },
          },
          update: { cashBuying: row.buying, cashSelling: row.selling, fetchedAt: new Date() },
          create: {
            rateDate: row.rateDate,
            currency: row.currency,
            baseCurrency: 'ETB',
            cashBuying: row.buying,
            cashSelling: row.selling,
            source: 'NBE',
            sourceUrl: row.sourceUrl,
          },
        });
        saved++;
      } catch (err) {
        logger.warn({ msg: 'NBE row save failed', error: String(err) });
      }
    }
    return {
      source: 'nbe_indicators',
      fetched: probe.rows.length,
      saved,
      skipped: 0,
      errors: probe.reachable ? [] : ['NBE page unreachable'],
      note: probe.note,
      syncedAt: new Date().toISOString(),
    };
  }

  /** Manual CSV import of NBE published rates (the supported NBE path). */
  async importNbeCsv(csvText: string): Promise<SyncSummary> {
    const rows: NbeRateRow[] = nbeAdapter.parseReferenceCsv(csvText);
    let saved = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        await prisma.exchangeRate.upsert({
          where: {
            rateDate_currency_source: {
              rateDate: row.rateDate,
              currency: row.currency,
              source: 'NBE',
            },
          },
          update: { cashBuying: row.buying, cashSelling: row.selling, fetchedAt: new Date() },
          create: {
            rateDate: row.rateDate,
            currency: row.currency,
            baseCurrency: 'ETB',
            cashBuying: row.buying,
            cashSelling: row.selling,
            source: 'NBE',
            sourceUrl: row.sourceUrl,
          },
        });
        saved++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    return { source: 'nbe_indicators', fetched: rows.length, saved, skipped: 0, errors, syncedAt: new Date().toISOString() };
  }

  // ── ESS CPI / inflation ───────────────────────────────────────────────
  async syncEssReports(): Promise<SyncSummary> {
    const probe = await essCpiAdapter.fetchLatestReports();
    return {
      source: 'ess_cpi',
      fetched: probe.reports.length,
      saved: 0,
      skipped: 0,
      errors: probe.reachable ? [] : ['ESS price page unreachable'],
      note: `${probe.note} Official reports: ${probe.reports.map((r) => r.title).slice(0, 5).join(' | ')}`,
      syncedAt: new Date().toISOString(),
    };
  }

  /** Manual CSV import of official ESS CPI/inflation figures. */
  async importEssCpiCsv(csvText: string): Promise<SyncSummary> {
    const observations: EssCpiObservation[] = essCpiAdapter.parseCpiCsv(csvText);
    let saved = 0;
    const errors: string[] = [];
    for (const obs of observations) {
      try {
        const indicatorType = obs.indicator === 'inflation' ? 'INFLATION_RATE' : 'CONSUMER_PRICE_INDEX';
        await prisma.economicIndicator.upsert({
          where: {
            indicatorType_recordedAt: { indicatorType: indicatorType as any, recordedAt: obs.recordedAt },
          },
          update: { value: obs.value, notes: obs.notes, sourceUrl: obs.sourceUrl, source: 'ESS' },
          create: {
            indicatorType: indicatorType as any,
            value: obs.value,
            recordedAt: obs.recordedAt,
            unit: obs.unit,
            source: 'ESS',
            sourceUrl: obs.sourceUrl,
            notes: obs.notes,
          },
        });
        saved++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    return { source: 'ess_cpi', fetched: observations.length, saved, skipped: 0, errors, syncedAt: new Date().toISOString() };
  }

  // ── World Bank macro indicators ───────────────────────────────────────
  async syncWorldBank(dateRange?: string): Promise<SyncSummary> {
    const range = dateRange ?? `${new Date().getFullYear() - 30}:${new Date().getFullYear()}`;
    const observations = await worldBankAdapter.fetchAll(range);
    let saved = 0;
    const errors: string[] = [];
    for (const obs of observations) {
      try {
        await prisma.macroIndicator.upsert({
          where: {
            indicatorCode_year_country: {
              indicatorCode: obs.indicatorCode,
              year: obs.year,
              country: obs.country,
            },
          },
          update: { value: obs.value, unit: obs.unit, fetchedAt: new Date() },
          create: {
            indicatorCode: obs.indicatorCode,
            indicatorName: obs.indicatorName,
            country: obs.country,
            year: obs.year,
            value: obs.value,
            unit: obs.unit,
            source: 'World Bank Open Data',
            sourceUrl: obs.sourceUrl,
          },
        });
        saved++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    return {
      source: 'world_bank',
      fetched: observations.length,
      saved,
      skipped: 0,
      errors,
      note: `Indicators: ${Object.keys(WORLD_BANK_INDICATORS).join(', ')}. Missing years stay missing (never zero-filled).`,
      syncedAt: new Date().toISOString(),
    };
  }

  // ── OSM Overpass amenities ────────────────────────────────────────────
  async syncOsmAmenities(params: {
    neighborhoodId?: string;
    bbox?: [number, number, number, number];
    groups?: OsmFeatureGroup[];
    radiusMeters?: number;
  }): Promise<SyncSummary> {
    let bbox = params.bbox;
    let neighborhoodId = params.neighborhoodId;

    if (neighborhoodId && !bbox) {
      const neighborhood = await prisma.neighborhood.findUnique({ where: { id: neighborhoodId } });
      if (!neighborhood?.centerLat || !neighborhood?.centerLng) {
        throw new Error('Neighborhood not found or has no center coordinates (centerLat/centerLng)');
      }
      const lat = Number(neighborhood.centerLat);
      const lng = Number(neighborhood.centerLng);
      const radius = (params.radiusMeters ?? 2000) / 111000; // deg ≈ km/111
      bbox = [lat - radius, lng - radius, lat + radius, lng + radius];
    }
    if (!bbox) throw new Error('Provide neighborhoodId (with center coords) or bbox [s,w,n,e]');

    const features = await osmOverpassAdapter.queryAmenities({ bbox, groups: params.groups });
    let saved = 0;
    const errors: string[] = [];

    for (const feature of features) {
      if (feature.lat == null || feature.lon == null) continue; // geometry-less road segments
      try {
        const amenityType = this.mapOsmToAmenityType(feature);
        const name = feature.name ?? `${feature.group}-${feature.osmType}/${feature.osmId}`;

        let distance: number | undefined;
        if (neighborhoodId) {
          const neighborhood = await prisma.neighborhood.findUnique({ where: { id: neighborhoodId } });
          if (neighborhood?.centerLat && neighborhood?.centerLng) {
            distance = osmOverpassAdapter.distanceMeters(
              Number(neighborhood.centerLat),
              Number(neighborhood.centerLng),
              feature.lat,
              feature.lon,
            );
          }
        }

        const existing = await prisma.neighborhoodAmenity.findFirst({
          where: {
            name,
            ...(neighborhoodId ? { neighborhoodId } : {}),
            metadata: { path: ['osmId'], equals: `${feature.osmType}/${feature.osmId}` },
          },
        });
        const data = {
          amenityType,
          name,
          latitude: feature.lat,
          longitude: feature.lon,
          distance,
          verified: false, // OSM data is community-maintained; not presented as verified
          metadata: {
            osmId: `${feature.osmType}/${feature.osmId}`,
            group: feature.group,
            tags: feature.tags,
            source: 'OpenStreetMap via Overpass',
          },
        };
        if (existing) {
          await prisma.neighborhoodAmenity.update({ where: { id: existing.id }, data });
        } else if (neighborhoodId) {
          await prisma.neighborhoodAmenity.create({ data: { neighborhoodId, ...data } });
        } else {
          // Without a neighborhood anchor we skip persistence but count the fetch,
          // since amenities must belong to a neighborhood in this schema.
          continue;
        }
        saved++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    return {
      source: 'osm_amenities',
      fetched: features.length,
      saved,
      skipped: features.length - saved,
      errors,
      note: 'OpenStreetMap data is community-maintained; amenities are stored unverified and attributed to OSM/Overpass.',
      syncedAt: new Date().toISOString(),
    };
  }

  // ── Administrative boundaries (geoBoundaries) ─────────────────────────
  async syncAdminBoundaries(level: AdminLevel = 'ADM1'): Promise<SyncSummary> {
    let saved = 0;
    const errors: string[] = [];
    const { featureCount, metadata } = await adminBoundariesAdapter.downloadFeatures(level, async (feature, featureMetadata) => {
      try {
        await prisma.geographicBoundary.upsert({
          where: {
            country_adminLevel_name: { country: 'ETH', adminLevel: level, name: feature.name },
          },
          update: {
            geometry: feature.geometry as object,
            properties: feature.properties as object,
            sourceYear: featureMetadata.boundaryYearRepresented,
            license: featureMetadata.license,
            fetchedAt: new Date(),
          },
          create: {
            country: 'ETH',
            adminLevel: level,
            name: feature.name,
            geometry: feature.geometry as object,
            properties: feature.properties as object,
            source: 'geoBoundaries gbOpen',
            license: featureMetadata.license,
            sourceYear: featureMetadata.boundaryYearRepresented,
          },
        });
        saved++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    });
    return {
      source: 'admin_boundaries',
      fetched: featureCount,
      saved,
      skipped: featureCount - saved,
      errors,
      note: `geoBoundaries gbOpen ETH ${level} (CC BY 4.0), boundary year represented: ${metadata.boundaryYearRepresented ?? 'unknown'}.`,
      syncedAt: new Date().toISOString(),
    };
  }

  // ── Open data discovery (HDX; data.gov.et unreachable) ────────────────
  async searchOpenData(query: string, rows = 10): Promise<{ datasets: OpenDataset[]; portalNote: string }> {
    const portal = await openDataPortalAdapter.probeEthiopiaPortal();
    const datasets = await openDataPortalAdapter.searchEthiopiaDatasets(query, rows);
    return { datasets, portalNote: portal.note };
  }

  // ── Read APIs ─────────────────────────────────────────────────────────
  getExchangeRates(currency?: string, limit = 30) {
    return prisma.exchangeRate.findMany({
      where: currency ? { currency: currency.toUpperCase() } : undefined,
      orderBy: [{ rateDate: 'desc' }, { currency: 'asc' }],
      take: Math.min(limit, 200),
    });
  }

  getMacroIndicators(indicatorCode?: string, limit = 100) {
    return prisma.macroIndicator.findMany({
      where: indicatorCode ? { indicatorCode } : undefined,
      orderBy: [{ indicatorCode: 'asc' }, { year: 'desc' }],
      take: Math.min(limit, 500),
    });
  }

  getBoundaries(adminLevel: string, limit = 50) {
    return prisma.geographicBoundary.findMany({
      where: { adminLevel },
      orderBy: { name: 'asc' },
      take: Math.min(limit, 200),
      select: { id: true, name: true, adminLevel: true, sourceYear: true, license: true, fetchedAt: true, properties: true },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────
  private async upsertExchangeRate(rate: NormalizedExchangeRate): Promise<void> {
    await prisma.exchangeRate.upsert({
      where: {
        rateDate_currency_source: { rateDate: rate.rateDate, currency: rate.currency, source: rate.source },
      },
      update: {
        cashBuying: rate.cashBuying,
        cashSelling: rate.cashSelling,
        transactionalBuying: rate.transactionalBuying,
        transactionalSelling: rate.transactionalSelling,
        fetchedAt: new Date(),
      },
      create: {
        rateDate: rate.rateDate,
        currency: rate.currency,
        baseCurrency: rate.baseCurrency,
        cashBuying: rate.cashBuying,
        cashSelling: rate.cashSelling,
        transactionalBuying: rate.transactionalBuying,
        transactionalSelling: rate.transactionalSelling,
        source: rate.source,
        sourceUrl: rate.sourceUrl,
      },
    });
  }

  private mapOsmToAmenityType(feature: { group: OsmFeatureGroup; tags: Record<string, string> }): any {
    const { group, tags } = feature;
    if (group === 'schools') return 'SCHOOL';
    if (group === 'hospitals') {
      if (tags.amenity === 'clinic') return 'CLINIC';
      if (tags.amenity === 'pharmacy') return 'PHARMACY';
      return 'HOSPITAL';
    }
    if (group === 'parks') return 'PARK';
    if (group === 'transport') return 'PUBLIC_TRANSPORT';
    if (group === 'markets') return tags.shop === 'supermarket' ? 'SUPERMARKET' : 'MARKET';
    if (group === 'banks') return 'BANK';
    return 'OTHER'; // roads etc. — stored only when anchored to a neighborhood
  }
}

export const externalSourcesService = new ExternalSourcesService();
