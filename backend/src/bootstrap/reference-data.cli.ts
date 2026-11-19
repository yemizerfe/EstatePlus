import { prisma } from '../infrastructure/database/prisma';
import { bootstrapReferenceData } from './reference-data';

/**
 * Runs before the API starts (see the CMD in backend/Dockerfile):
 * applies reference data to an empty production database and creates the
 * first admin account when ADMIN_EMAIL / ADMIN_PASSWORD are configured.
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
