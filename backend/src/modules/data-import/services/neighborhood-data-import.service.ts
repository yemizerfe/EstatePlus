import axios from 'axios';
import { StatisticType } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/utils/logger';
import { NeighborhoodDataImportJobPayload } from '../../../services/job-queue.service';
import { ValidationError, getErrorMessage } from '../../../shared/utils/errors';
import { externalSourcesService } from '../../external-sources/external-sources.service';

/**
 * Neighborhood enrichment uses real sources only:
 *   • geographic  → OpenStreetMap Nominatim geocoding of the neighborhood name
 *                   (fills center_lat / center_lng so the map can plot it)
 *   • amenities   → OpenStreetMap Overpass via the external-sources adapter
 *   • statistics  → counts computed from amenities already stored in the DB
 *
 * Demographics (population, income) are published only as ESS/CSA reports with
 * no API, so that data type reports honestly instead of inventing numbers.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'EstatePlus/1.0 (neighborhood geocoding; contact: admin@estateplus.local)';

interface ImportResult {
  recordsReceived: number;
  recordsValid: number;
  recordsRejected: number;
  errors: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
  neighborhoodsUpdated: string[];
}

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export class NeighborhoodDataImportService {
  async importNeighborhoodData(payload: NeighborhoodDataImportJobPayload): Promise<ImportResult> {
    const result: ImportResult = {
      recordsReceived: 0,
      recordsValid: 0,
      recordsRejected: 0,
      errors: [],
      warnings: [],
      neighborhoodsUpdated: [],
    };

    const neighborhoods = await prisma.neighborhood.findMany({
      where: payload.neighborhoods?.length ? { id: { in: payload.neighborhoods } } : { isActive: true },
      select: { id: true, name: true, city: true, subcity: true, centerLat: true, centerLng: true },
    });

    if (neighborhoods.length === 0) {
      throw new ValidationError('No matching neighborhoods to enrich');
    }

    const dataTypes = payload.dataTypes.length > 0 ? payload.dataTypes : ['geographic', 'amenities', 'statistics'];

    logger.info({
      msg: 'Starting neighborhood enrichment from real sources',
      jobId: payload.id,
      dataTypes,
      neighborhoods: neighborhoods.length,
    });

    for (const dataType of dataTypes) {
      switch (dataType) {
        case 'geographic':
          await this.geocodeNeighborhoods(neighborhoods, result);
          break;
        case 'amenities':
          await this.syncAmenities(neighborhoods, result);
          break;
        case 'statistics':
          await this.computeStatistics(neighborhoods, result);
          break;
        case 'demographics':
          result.errors.push({
            dataType,
            error:
              'Population and household income are published only as ESS/CSA reports (no API). Import them as a controlled CSV/document instead of generating values.',
          });
          break;
        default:
          result.errors.push({ dataType, error: `Unsupported data type: ${dataType}` });
      }
    }

    result.neighborhoodsUpdated = [...new Set(result.neighborhoodsUpdated)];
    logger.info({ msg: 'Neighborhood enrichment completed', jobId: payload.id, result });
    return result;
  }

  // ── Geographic: real OSM geocoding ─────────────────────────────────────

  private async geocodeNeighborhoods(
    neighborhoods: Array<{ id: string; name: string; city: string; subcity: string | null; centerLat: unknown; centerLng: unknown }>,
    result: ImportResult,
  ): Promise<void> {
    for (const neighborhood of neighborhoods) {
      result.recordsReceived++;

      if (neighborhood.centerLat != null && neighborhood.centerLng != null) {
        result.warnings.push({
          neighborhood: neighborhood.name,
          warning: 'Already has center coordinates; kept as stored.',
        });
        continue;
      }

      try {
        const coords = await this.geocode(neighborhood.name, neighborhood.city);
        if (!coords) {
          result.recordsRejected++;
          result.errors.push({
            neighborhood: neighborhood.name,
            error: 'Nominatim returned no match; center coordinates left empty.',
          });
          continue;
        }

        await prisma.neighborhood.update({
          where: { id: neighborhood.id },
          data: {
            centerLat: coords.lat,
            centerLng: coords.lng,
            metadata: {
              geocode: {
                source: 'OpenStreetMap Nominatim',
                displayName: coords.displayName,
                fetchedAt: new Date().toISOString(),
              },
            },
          },
        });

        result.recordsValid++;
        result.neighborhoodsUpdated.push(neighborhood.id);
      } catch (error) {
        result.recordsRejected++;
        result.errors.push({ neighborhood: neighborhood.name, error: getErrorMessage(error) });
      }
    }
  }

  private async geocode(name: string, city: string): Promise<GeocodeResult | null> {
    // Nominatim asks for max 1 request/second and a descriptive User-Agent.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const response = await axios.get(NOMINATIM_URL, {
      params: {
        q: `${name}, ${city}, Ethiopia`,
        format: 'jsonv2',
        limit: 1,
        addressdetails: 0,
      },
      timeout: 20000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    const match = Array.isArray(response.data) ? response.data[0] : undefined;
    if (!match) return null;

    const lat = Number(match.lat);
    const lng = Number(match.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, displayName: String(match.display_name ?? name) };
  }

  // ── Amenities: real OSM Overpass ───────────────────────────────────────

  private async syncAmenities(
    neighborhoods: Array<{ id: string; name: string; centerLat?: unknown; centerLng?: unknown }>,
    result: ImportResult,
  ): Promise<void> {
    for (const neighborhood of neighborhoods) {
      // Amenities are anchored to a center point; geocode on demand.
      let centerLat = neighborhood.centerLat;
      let centerLng = neighborhood.centerLng;

      if (centerLat == null || centerLng == null) {
        try {
          const neighborhoodRow = await prisma.neighborhood.findUnique({
            where: { id: neighborhood.id },
            select: { name: true, city: true },
          });
          const coords = await this.geocode(neighborhoodRow?.name ?? neighborhood.name, neighborhoodRow?.city ?? 'Addis Ababa');
          if (!coords) {
            result.recordsRejected++;
            result.errors.push({
              neighborhood: neighborhood.name,
              error: 'No coordinates available and geocoding failed; OSM amenities skipped.',
            });
            continue;
          }
          await prisma.neighborhood.update({
            where: { id: neighborhood.id },
            data: { centerLat: coords.lat, centerLng: coords.lng },
          });
          centerLat = coords.lat;
          centerLng = coords.lng;
          result.neighborhoodsUpdated.push(neighborhood.id);
        } catch (error) {
          result.recordsRejected++;
          result.errors.push({ neighborhood: neighborhood.name, error: getErrorMessage(error) });
          continue;
        }
      }

      try {
        const summary = await externalSourcesService.syncOsmAmenities({
          neighborhoodId: neighborhood.id,
          radiusMeters: 2500,
        });
        result.recordsReceived += summary.fetched;
        result.recordsValid += summary.saved;
        result.recordsRejected += summary.skipped;
        if (summary.errors.length > 0) {
          result.warnings.push({
            neighborhood: neighborhood.name,
            warnings: summary.errors.slice(0, 3),
          });
        }
        result.neighborhoodsUpdated.push(neighborhood.id);
        // Be a good Overpass citizen between neighborhoods.
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        result.recordsRejected++;
        result.errors.push({ neighborhood: neighborhood.name, error: getErrorMessage(error) });
      }
    }
  }

  // ── Statistics: computed from stored amenities ─────────────────────────

  private async computeStatistics(
    neighborhoods: Array<{ id: string; name: string }>,
    result: ImportResult,
  ): Promise<void> {
    for (const neighborhood of neighborhoods) {
      try {
        const amenityCount = await prisma.neighborhoodAmenity.count({
          where: { neighborhoodId: neighborhood.id },
        });

        if (amenityCount === 0) {
          result.warnings.push({
            neighborhood: neighborhood.name,
            warning: 'No stored amenities yet; amenity-count statistic skipped (run the amenities import first).',
          });
          continue;
        }

        const period = new Date().toISOString().slice(0, 7);
        await prisma.neighborhoodStatistic.upsert({
          where: {
            neighborhoodId_period_statisticType: {
              neighborhoodId: neighborhood.id,
              period,
              statisticType: StatisticType.AMENITY_COUNT,
            },
          },
          update: {
            value: amenityCount,
            unit: 'count',
            source: 'OpenStreetMap via Overpass',
            calculatedAt: new Date(),
          },
          create: {
            neighborhoodId: neighborhood.id,
            period,
            statisticType: StatisticType.AMENITY_COUNT,
            value: amenityCount,
            unit: 'count',
            source: 'OpenStreetMap via Overpass',
          },
        });

        result.recordsReceived++;
        result.recordsValid++;
        result.neighborhoodsUpdated.push(neighborhood.id);
      } catch (error) {
        result.recordsRejected++;
        result.errors.push({ neighborhood: neighborhood.name, error: getErrorMessage(error) });
      }
    }
  }
}
