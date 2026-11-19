import { prisma } from '../infrastructure/database/prisma';
import { bootstrapReferenceData } from './reference-data';

/**
 * Optional command-line entrypoint for applying reference data manually.
 * Normal API startup also calls bootstrapReferenceData after connecting.
 */
bootstrapReferenceData()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('[bootstrap] reference data import failed:', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
