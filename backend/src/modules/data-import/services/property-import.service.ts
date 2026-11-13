import { PropertyType, PropertyCondition, PropertyStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

import { prisma } from '../../../infrastructure/database/prisma';
import { logger } from '../../../shared/utils/logger';
import { PropertyImportJobPayload } from '../../../services/job-queue.service';
import { ValidationError, ProcessingError, getErrorMessage } from '../../../shared/utils/errors';

interface PropertyImportRecord {
  title: string;
  description?: string;
  propertyType: string;
  condition: string;
  price: number;
  /** Monthly rent when the row covers a rental listing as well as / instead of a sale. */
  rentalPrice?: number;
  /** Listing date from the file; defaults to the import date when absent. */
  listedAt?: Date;
  size?: number;
  bedrooms?: number;
  bathrooms?: number;
  address: string;
  neighborhoodName: string;
  ownerId?: string;
  images?: string[];
  amenities?: string[];
  coordinates?: { lat: number; lng: number };
  yearBuilt?: number;
  parkingSpaces?: number;
  hasGarden?: boolean;
  hasSecurity?: boolean;
  hasElevator?: boolean;
  floorNumber?: number;
  totalFloors?: number;
}

interface ImportResult {
  recordsReceived: number;
  recordsValid: number;
  recordsRejected: number;
  errors: any[];
  warnings: any[];
  importedIds: string[];
}

export class PropertyImportService {

  async importProperties(payload: PropertyImportJobPayload): Promise<ImportResult> {
    try {
      logger.info({ msg: 'Starting property import', jobId: payload.id });

      let records: PropertyImportRecord[] = [];

      // Parse data based on source
      if (payload.data) {
        // Rows arrive straight from a CSV/JSON upload, so run the same header
        // normalisation the file parser uses (asking_price → price, etc.).
        records = payload.data.map((row) => this.normalizeRecord(row));
      } else if (payload.fileName) {
        records = await this.parseFile(payload.fileName);
      } else if (payload.sourceId) {
        records = await this.fetchFromDataSource(payload.sourceId);
      } else {
        throw new ValidationError('No data source provided');
      }

      const result: ImportResult = {
        recordsReceived: records.length,
        recordsValid: 0,
        recordsRejected: 0,
        errors: [],
        warnings: [],
        importedIds: [],
      };

      // Process records in batches
      const batchSize = payload.options?.batchSize || 100;
      const validateOnly = payload.options?.validateOnly || false;
      const skipDuplicates = payload.options?.skipDuplicates || false;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const batchResult = await this.processBatch(
          batch, 
          i / batchSize + 1, 
          validateOnly,
          skipDuplicates,
          payload.userId
        );
        
        result.recordsValid += batchResult.valid;
        result.recordsRejected += batchResult.rejected;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.importedIds.push(...batchResult.importedIds);

        // Log progress
        logger.info({
          msg: `Processed batch ${i / batchSize + 1}`,
          jobId: payload.id,
          progress: `${Math.min(i + batchSize, records.length)}/${records.length}`,
        });
      }

      logger.info({ msg: 'Property import completed', jobId: payload.id, result });
      return result;

    } catch (error) {
      logger.error({ msg: 'Property import failed', jobId: payload.id, error });
      throw new ProcessingError(`Property import failed: ${getErrorMessage(error)}`);
    }
  }

  private async parseFile(fileName: string): Promise<PropertyImportRecord[]> {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'uploads', 'imports', fileName);

      if (!fs.existsSync(filePath)) {
        throw new ValidationError(`File not found: ${fileName}`);
      }

      const fileExtension = path.extname(fileName).toLowerCase();
      const fileContent = fs.readFileSync(filePath);

      switch (fileExtension) {
        case '.csv':
          return this.parseCsvData(fileContent);
        case '.json':
          return JSON.parse(fileContent.toString());
        case '.xlsx':
        case '.xls':
          return this.parseExcelData(fileContent);
        default:
          throw new ValidationError(`Unsupported file format: ${fileExtension}`);
      }
    } catch (error) {
      logger.error({ msg: 'Failed to parse file', fileName, error });
      throw error;
    }
  }

  private parseCsvData(content: Buffer): PropertyImportRecord[] {
    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
        cast_date: true,
      });

      return records.map((record: any) => this.normalizeRecord(record));
    } catch (error) {
      throw new ValidationError(`CSV parsing error: ${getErrorMessage(error)}`);
    }
  }

  private parseExcelData(content: Buffer): PropertyImportRecord[] {
    try {
      const workbook = XLSX.read(content, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      return jsonData.map((record: any) => this.normalizeRecord(record));
    } catch (error) {
      throw new ValidationError(`Excel parsing error: ${getErrorMessage(error)}`);
    }
  }

  private normalizeRecord(record: any): PropertyImportRecord {
    const pick = (...keys: string[]): string => {
      for (const key of keys) {
        const value = record[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          return String(value).trim();
        }
      }
      return '';
    };

    const neighborhoodRaw = pick('neighborhood', 'neighborhoodName', 'NEIGHBORHOOD', 'neighborhood_id', 'area');
    // A placeholder such as USE_ACTUAL_ID means the file has no real area name.
    const neighborhoodName = /^use[_-]?actual[_-]?id$/i.test(neighborhoodRaw) ? '' : neighborhoodRaw;

    const priceRaw = pick('asking_price', 'price', 'Price', 'PRICE', 'current_price', 'askingPrice');
    const rentRaw = pick('rental_price', 'monthly_rent', 'rent', 'rentalPrice');
    const listedRaw = pick('listing_date', 'listed_at', 'listedAt', 'date', 'period');
    const listedAt = listedRaw ? new Date(listedRaw) : undefined;

    return {
      title: pick('title', 'Title', 'TITLE', 'name'),
      description: pick('description', 'Description', 'DESCRIPTION') || undefined,
      propertyType: pick('property_type', 'propertyType', 'type') || 'APARTMENT',
      condition: pick('condition', 'Condition', 'CONDITION') || 'GOOD',
      price: parseFloat(priceRaw) || 0,
      rentalPrice: rentRaw ? parseFloat(rentRaw) || undefined : undefined,
      listedAt: listedAt && !Number.isNaN(listedAt.getTime()) ? listedAt : undefined,
      size: pick('size_sqm', 'sizeSqm', 'size', 'area_sqm') ? parseFloat(pick('size_sqm', 'sizeSqm', 'size', 'area_sqm')) : undefined,
      bedrooms: pick('bedrooms', 'beds') ? parseInt(pick('bedrooms', 'beds')) : undefined,
      bathrooms: pick('bathrooms', 'baths') ? parseInt(pick('bathrooms', 'baths')) : undefined,
      address: pick('address', 'Address', 'ADDRESS', 'location'),
      neighborhoodName,
      ownerId: record.ownerId || record.owner_id,
      images: record.images ? (Array.isArray(record.images) ? record.images : record.images.split(',')) : [],
      amenities: record.amenities ? (Array.isArray(record.amenities) ? record.amenities : record.amenities.split(',')) : [],
      coordinates: record.lat && record.lng ? { lat: parseFloat(record.lat), lng: parseFloat(record.lng) } : undefined,
      yearBuilt: record.yearBuilt ? parseInt(record.yearBuilt) : undefined,
      parkingSpaces: record.parkingSpaces ? parseInt(record.parkingSpaces) : undefined,
      hasGarden: record.hasGarden === 'true' || record.hasGarden === true,
      hasSecurity: record.hasSecurity === 'true' || record.hasSecurity === true,
      hasElevator: record.hasElevator === 'true' || record.hasElevator === true,
      floorNumber: record.floorNumber ? parseInt(record.floorNumber) : undefined,
      totalFloors: record.totalFloors ? parseInt(record.totalFloors) : undefined,
    };
  }

  private async fetchFromDataSource(sourceId: string): Promise<PropertyImportRecord[]> {
    try {
      const dataSource = await prisma.dataSource.findUnique({
        where: { id: sourceId },
      });

      if (!dataSource) {
        throw new ValidationError(`Data source not found: ${sourceId}`);
      }

      // Source-driven pulls are deliberately not implemented: this schema has
      // no per-source connection settings, and pulling listings automatically
      // requires an authorized feed. Upload a file (CSV/XLSX) or use the
      // BinaSmart search/import path instead of pretending a pull happened.
      throw new ProcessingError(
        `Source '${dataSource.name}' (${dataSource.sourceType}) has no configured pull; upload a CSV/XLSX file or use the BinaSmart import instead.`,
      );
    } catch (error) {
      logger.error({ msg: 'Failed to fetch from data source', sourceId, error });
      throw error;
    }
  }

  private async processBatch(
    records: PropertyImportRecord[],
    batchNumber: number,
    validateOnly: boolean,
    skipDuplicates: boolean,
    userId?: string
  ): Promise<{
    valid: number;
    rejected: number;
    errors: any[];
    warnings: any[];
    importedIds: string[];
  }> {
    const result: {
      valid: number;
      rejected: number;
      errors: Array<Record<string, unknown>>;
      warnings: Array<Record<string, unknown>>;
      importedIds: string[];
    } = {
      valid: 0,
      rejected: 0,
      errors: [],
      warnings: [],
      importedIds: [],
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordIndex = (batchNumber - 1) * 100 + i + 1;

      try {
        // Validate record
        const validationResult = await this.validateRecord(record, recordIndex);
        
        if (!validationResult.isValid) {
          result.rejected++;
          result.errors.push({
            record: recordIndex,
            errors: validationResult.errors,
            data: record,
          });
          continue;
        }

        // Check for warnings
        if (validationResult.warnings.length > 0) {
          result.warnings.push({
            record: recordIndex,
            warnings: validationResult.warnings,
            data: record,
          });
        }

        // Skip if validation only
        if (validateOnly) {
          result.valid++;
          continue;
        }

        // Check for duplicates
        if (skipDuplicates) {
          const exists = await this.checkDuplicate(record);
          if (exists) {
            result.warnings.push({
              record: recordIndex,
              warnings: ['Duplicate record skipped'],
              data: record,
            });
            result.valid++;
            continue;
          }
        }

        // Create property
        const propertyId = await this.createProperty(record, userId);
        result.importedIds.push(propertyId);
        result.valid++;

      } catch (error) {
        result.rejected++;
        result.errors.push({
          record: recordIndex,
          errors: [getErrorMessage(error)],
          data: record,
        });
      }
    }

    return result;
  }

  private async validateRecord(record: PropertyImportRecord, _recordIndex: number): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!record.title || record.title.trim().length === 0) {
      errors.push('Title is required');
    }
    // A row may describe a sale, a rental, or both; only a row with neither a
    // price nor a rent is unusable.
    if ((!record.price || record.price <= 0) && (!record.rentalPrice || record.rentalPrice <= 0)) {
      errors.push('A positive asking price or monthly rent is required');
    }
    if (!record.neighborhoodName || record.neighborhoodName.trim().length === 0) {
      warnings.push('No neighborhood supplied; the row will be imported under the city-wide record');
    }
    if (!record.address || record.address.trim().length === 0) {
      warnings.push('No address supplied; one will be derived from the neighborhood and title');
    }

    // Validate enums
    if (!Object.values(PropertyType).includes(record.propertyType.toUpperCase() as PropertyType)) {
      errors.push(`Invalid property type: ${record.propertyType}`);
    }
    if (!Object.values(PropertyCondition).includes(record.condition.toUpperCase() as PropertyCondition)) {
      errors.push(`Invalid condition: ${record.condition}`);
    }

    // Validate numeric fields
    if (record.size && (record.size <= 0 || record.size > 100000)) {
      warnings.push('Size seems unusually large or small');
    }
    if (record.bedrooms && (record.bedrooms < 0 || record.bedrooms > 20)) {
      warnings.push('Bedroom count seems unusual');
    }
    if (record.bathrooms && (record.bathrooms < 0 || record.bathrooms > 20)) {
      warnings.push('Bathroom count seems unusual');
    }
    if (record.yearBuilt && (record.yearBuilt < 1900 || record.yearBuilt > new Date().getFullYear() + 2)) {
      warnings.push('Year built seems unusual');
    }

    // Validate coordinates
    if (record.coordinates) {
      if (record.coordinates.lat < -90 || record.coordinates.lat > 90) {
        errors.push('Invalid latitude');
      }
      if (record.coordinates.lng < -180 || record.coordinates.lng > 180) {
        errors.push('Invalid longitude');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkDuplicate(record: PropertyImportRecord): Promise<boolean> {
    try {
      const existing = await prisma.property.findFirst({
        where: {
          AND: [
            { title: record.title },
            { address: record.address },
            { askingPrice: record.price },
          ],
        },
      });

      return existing !== null;
    } catch (error) {
      logger.error({ msg: 'Failed to check duplicate', error });
      return false;
    }
  }

  private async createProperty(record: PropertyImportRecord, userId?: string): Promise<string> {
    try {
      const neighborhoodName = record.neighborhoodName?.trim() || 'Addis Ababa';

      // Find or create neighborhood
      let neighborhood = await prisma.neighborhood.findFirst({
        where: { name: { equals: neighborhoodName, mode: 'insensitive' } },
      });

      if (!neighborhood) {
        const slug = neighborhoodName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        neighborhood =
          (await prisma.neighborhood.findFirst({ where: { slug } })) ??
          (await prisma.neighborhood.create({
            data: {
              name: neighborhoodName,
              slug: slug || `area-${Date.now()}`,
              city: 'Addis Ababa',
              isActive: true,
            },
          }));
      }

      // Imported rows always need an owner; fall back to the importing analyst
      // and then to any admin account so a valid CSV never fails on ownership.
      const ownerId =
        record.ownerId ||
        userId ||
        (
          await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          })
        )?.id;

      if (!ownerId) {
        throw new ValidationError('An owner (ownerId) or importing user is required');
      }

      const listedAt = record.listedAt ?? new Date();
      const address =
        record.address?.trim() || `${neighborhoodName}, Addis Ababa`;

      // Create property against the real schema (asking_price / size_sqm /
      // neighborhood_id / listing_date) and attach the address via Location.
      const property = await prisma.property.create({
        data: {
          title: record.title,
          description: record.description,
          propertyType: record.propertyType.toUpperCase() as PropertyType,
          condition: (record.condition?.toUpperCase() ?? 'GOOD') as PropertyCondition,
          // Analyst-uploaded inventory is reviewed data: publish it so the
          // public market pages and the listing tables can use it.
          status: PropertyStatus.APPROVED,
          askingPrice: record.price,
          sizeSqm: record.size ?? 0,
          bedrooms: record.bedrooms ?? 0,
          bathrooms: record.bathrooms ?? 0,
          neighborhoodId: neighborhood.id,
          address,
          latitude: record.coordinates?.lat ?? null,
          longitude: record.coordinates?.lng ?? null,
          listingDate: listedAt,
          ownerId,
        },
      });

      // Every imported property becomes a live listing, otherwise it would
      // never appear on any market page or price calculation.
      await prisma.listing.create({
        data: {
          propertyId: property.id,
          listingType:
            record.price && record.rentalPrice
              ? 'BOTH'
              : record.rentalPrice
                ? 'RENT'
                : 'SALE',
          currentPrice: record.price || record.rentalPrice || 0,
          originalPrice: record.price || record.rentalPrice || 0,
          rentalPrice: record.rentalPrice ?? null,
          status: 'ACTIVE',
          listedAt,
        },
      });

      // Create property images if provided
      if (record.images && record.images.length > 0) {
        await prisma.propertyImage.createMany({
          data: record.images.map((url, index) => ({
            propertyId: property.id,
            imageUrl: url,
            altText: `${record.title} - Image ${index + 1}`,
            isPrimary: index === 0,
            sortOrder: index,
          })),
        });
      }

      return property.id;

    } catch (error) {
      logger.error({ msg: 'Failed to create property', record, error });
      throw new ProcessingError(`Failed to create property: ${getErrorMessage(error)}`);
    }
  }
}