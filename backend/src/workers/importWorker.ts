import type { Channel } from 'amqplib';
import { ConsumeMessage } from 'amqplib';

import { prisma } from '../infrastructure/database/prisma';
import { RABBITMQ_QUEUES } from '../shared/constants';
import { KAFKA_TOPICS } from '../shared/constants';
import { logger } from '../shared/utils/logger';

interface ImportRow {
  title?: string;
  property_type?: string;
  neighborhood?: string;
  size_sqm?: string;
  bedrooms?: string;
  bathrooms?: string;
  asking_price?: string;
  rental_price?: string;
  listing_date?: string;
  condition?: string;
  address?: string;
}

interface ImportJobPayload {
  jobId: string;
  jobType: string;
  payload: { rows: ImportRow[]; importType: string; userId: string };
}

const VALID_PROPERTY_TYPES = ['apartment', 'house', 'villa', 'commercial', 'land', 'office'];
const VALID_CONDITIONS = ['new', 'excellent', 'good', 'fair', 'needs_renovation'];

export async function handleImportJob(msg: ConsumeMessage, _channel: Channel): Promise<void> {
  const job = JSON.parse(msg.content.toString()) as ImportJobPayload;
  const { jobId } = job;
  const { rows } = job.payload as ImportJobPayload['payload'];

  await prisma.dataImportJob.update({
    where: { id: jobId },
    data: { status: 'processing', startedAt: new Date() },
  });

  let valid = 0;
  let rejected = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    void i;
    try {
      // Validate
      if (!row.title || !row.property_type || !row.neighborhood || !row.asking_price) {
        throw new Error('Missing required fields: title, property_type, neighborhood, asking_price');
      }
      if (!VALID_PROPERTY_TYPES.includes(row.property_type.toLowerCase())) {
        throw new Error(`Invalid property_type: ${row.property_type}`);
      }
      const condition = row.condition?.toLowerCase() ?? 'good';
      if (!VALID_CONDITIONS.includes(condition)) {
        throw new Error(`Invalid condition: ${condition}`);
      }

      const price = parseFloat(row.asking_price);
      if (isNaN(price) || price <= 0) throw new Error('Invalid asking_price');

      // Resolve neighborhood
      const neighborhood = await prisma.neighborhood.findFirst({
        where: { name: { contains: row.neighborhood, mode: 'insensitive' } },
      });
      if (!neighborhood) throw new Error(`Unknown neighborhood: ${row.neighborhood}`);

      const propertyTypeValue = row.property_type.toLowerCase();
      const conditionValue = condition;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.property.create({
        data: {
          title: row.title.trim(),
          propertyType: propertyTypeValue as any,
          condition: conditionValue as any,
          neighborhoodId: neighborhood.id,
          sizeSqm: parseFloat(row.size_sqm ?? '0') || 0,
          bedrooms: parseInt(row.bedrooms ?? '0') || 0,
          bathrooms: parseInt(row.bathrooms ?? '0') || 0,
          askingPrice: price,
          rentalPrice: row.rental_price ? parseFloat(row.rental_price) : null,
          listingDate: row.listing_date ? new Date(row.listing_date) : new Date(),
          address: row.address?.trim() ?? null,
          ownerId: '00000000-0000-0000-0000-000000000000',
        },
      });

      valid++;
    } catch (err) {
      rejected++;
      errors.push({ row: i + 1, reason: (err as Error).message });
    }
  }

  await prisma.dataImportJob.update({
    where: { id: jobId },
    data: {
      status: rejected === rows.length ? 'failed' : 'completed',
      recordsValid: valid,
      recordsRejected: rejected,
      errorLog: errors.length > 0 ? { errors: errors.slice(0, 100) } : undefined,
      completedAt: new Date(),
    },
  }  );
  void KAFKA_TOPICS.MARKET_EVENTS;


  logger.info({ msg: 'import.completed', jobId, valid, rejected, total: rows.length });
}

void RABBITMQ_QUEUES.PROPERTY_IMPORT;
export const IMPORT_QUEUE = RABBITMQ_QUEUES.PROPERTY_IMPORT;
