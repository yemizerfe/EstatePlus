import axios from 'axios';
import { AmenityType, StatisticType } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/utils/logger';
import { NeighborhoodDataImportJobPayload } from '../../../services/job-queue.service';
import { ValidationError, getErrorMessage } from '../../../shared/utils/errors';
import { externalSourcesService } from '../../external-sources/external-sources.service';
import {
  isYearMonthPeriod,
  loadUploadedRows,
  uploadedNumber,
  uploadedText,
} from './uploaded-row-data';

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
    if (payload.sourceId) {
      return this.importUploadedNeighborhoodData(payload);
    }

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

  private async importUploadedNeighborhoodData(
    payload: NeighborhoodDataImportJobPayload,
  ): Promise<ImportResult> {
    const rows = await loadUploadedRows(payload.sourceId!);
    const result: ImportResult = {
      recordsReceived: rows.length,
      recordsValid: 0,
      recordsRejected: 0,
      errors: [],
      warnings: [],
      neighborhoodsUpdated: [],
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      try {
        const name = uploadedText(row, 'neighborhoodName', 'neighborhood', 'name');
        if (!name) throw new ValidationError('Neighborhood name is required');

        const amenityName = uploadedText(row, 'amenityName');
        const amenityTypeText = uploadedText(row, 'amenityType');
        if (amenityName && !amenityTypeText) {
          throw new ValidationError('Amenity type is required when importing an amenity');
        }
        const amenityType = amenityTypeText
          ? amenityTypeText.toUpperCase().replace(/[\s-]+/g, '_') as AmenityType
          : null;
        if (amenityType && !Object.values(AmenityType).includes(amenityType)) {
          throw new ValidationError(`Invalid amenity type: ${amenityTypeText}`);
        }

        const statisticTypeText = uploadedText(row, 'statisticType');
        const statisticValue = uploadedNumber(row, 'statisticValue');
        if ((statisticTypeText && statisticValue === null) || (!statisticTypeText && statisticValue !== null)) {
          throw new ValidationError('Statistic type and numeric value must be provided together');
        }
        const statisticType = statisticTypeText
          ? statisticTypeText.toUpperCase().replace(/[\s-]+/g, '_') as StatisticType
          : null;
        if (statisticType && !Object.values(StatisticType).includes(statisticType)) {
          throw new ValidationError(`Invalid statistic type: ${statisticTypeText}`);
        }
        const period = uploadedText(row, 'period') ?? new Date().toISOString().slice(0, 7);
        if (statisticType && !isYearMonthPeriod(period)) {
          throw new ValidationError('Statistic period must use YYYY-MM format');
        }

        const city = uploadedText(row, 'city') ?? 'Addis Ababa';
        const existing = await prisma.neighborhood.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
          select: { id: true },
        });
        const latitude = uploadedNumber(row, 'centerLat', 'latitude', 'lat');
        const longitude = uploadedNumber(row, 'centerLng', 'longitude', 'lng');
        const subcity = uploadedText(row, 'subcity');
        const description = uploadedText(row, 'description');
        const distance = uploadedNumber(row, 'amenityDistance', 'distance');
        const rating = uploadedNumber(row, 'amenityRating', 'rating');
        const amenityLatitude = uploadedNumber(row, 'amenityLatitude');
        const amenityLongitude = uploadedNumber(row, 'amenityLongitude');
        if (latitude !== null && (latitude < -90 || latitude > 90)) {
          throw new ValidationError('Latitude must be between -90 and 90');
        }
        if (longitude !== null && (longitude < -180 || longitude > 180)) {
          throw new ValidationError('Longitude must be between -180 and 180');
        }
        if (amenityLatitude !== null && (amenityLatitude < -90 || amenityLatitude > 90)) {
          throw new ValidationError('Amenity latitude must be between -90 and 90');
        }
        if (amenityLongitude !== null && (amenityLongitude < -180 || amenityLongitude > 180)) {
          throw new ValidationError('Amenity longitude must be between -180 and 180');
        }
        if (distance !== null && distance < 0) {
          throw new ValidationError('Amenity distance cannot be negative');
        }
        if (rating !== null && (rating < 0 || rating > 5)) {
          throw new ValidationError('Amenity rating must be between 0 and 5');
        }

        const neighborhood = existing
          ? await prisma.neighborhood.update({
              where: { id: existing.id },
              data: {
                city,
                ...(subcity ? { subcity } : {}),
                ...(description ? { description } : {}),
                ...(latitude !== null ? { centerLat: latitude } : {}),
                ...(longitude !== null ? { centerLng: longitude } : {}),
                isActive: true,
              },
              select: { id: true },
            })
          : await prisma.neighborhood.create({
              data: {
                name,
                slug:
                  name
                    .normalize('NFKD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '') || `area-${Date.now()}-${index}`,
                city,
                subcity,
                description,
                centerLat: latitude,
                centerLng: longitude,
                isActive: true,
              },
              select: { id: true },
            });

        if (amenityName && amenityType) {
          const amenity = await prisma.neighborhoodAmenity.findFirst({
            where: { neighborhoodId: neighborhood.id, name: amenityName, amenityType },
            select: { id: true },
          });
          const data = {
            amenityType,
            name: amenityName,
            description: uploadedText(row, 'amenityDescription'),
            address: uploadedText(row, 'amenityAddress', 'address'),
            distance: distance === null ? null : Math.round(distance),
            rating,
            latitude: amenityLatitude,
            longitude: amenityLongitude,
            metadata: { source: 'Excel upload', sourceId: payload.sourceId },
          };
          if (amenity) {
            await prisma.neighborhoodAmenity.update({ where: { id: amenity.id }, data });
          } else {
            await prisma.neighborhoodAmenity.create({
              data: { neighborhoodId: neighborhood.id, ...data },
            });
          }
        }

        if (statisticType && statisticValue !== null) {
          await prisma.neighborhoodStatistic.upsert({
            where: {
              neighborhoodId_period_statisticType: {
                neighborhoodId: neighborhood.id,
                period,
                statisticType,
              },
            },
            update: {
              value: statisticValue,
              unit: uploadedText(row, 'statisticUnit', 'unit'),
              source: 'Excel upload',
              calculatedAt: new Date(),
            },
            create: {
              neighborhoodId: neighborhood.id,
              period,
              statisticType,
              value: statisticValue,
              unit: uploadedText(row, 'statisticUnit', 'unit'),
              source: 'Excel upload',
            },
          });
        }

        result.recordsValid += 1;
        if (!result.neighborhoodsUpdated.includes(neighborhood.id)) {
          result.neighborhoodsUpdated.push(neighborhood.id);
        }
      } catch (error) {
        result.recordsRejected += 1;
        result.errors.push({
          record: index + 1,
          errors: [getErrorMessage(error)],
        });
      }
    }

    logger.info({ msg: 'Uploaded neighborhood data import completed', jobId: payload.id, result });
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
