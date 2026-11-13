import type { Prisma } from '@prisma/client';

import { BINA_PRICE_VERIFICATION_MARKER } from '../../modules/bina';

/** Provenance prefix written into `description` by the BinaSmart importer. */
export const BINA_PROVENANCE_PREFIX = 'Source: BinaSmart';

/**
 * A property record whose price may be read as Ethiopian birr.
 *
 * Locally created listings are always in ETB. Third-party imports are only in
 * ETB when the importer recorded that the source page stated the amount in
 * ETB; BinaSmart listings whose page published a bare number are captured for
 * reference but must never feed a birr median, average or listing card.
 *
 * Every service that aggregates `askingPrice`/`rentalPrice` should spread this
 * into its `where` clause so the rule cannot drift between pages.
 */
export function etbEligiblePropertyWhere(): Prisma.PropertyWhereInput {
  return {
    OR: [
      { description: null },
      { NOT: { description: { contains: BINA_PROVENANCE_PREFIX } } },
      { description: { contains: BINA_PRICE_VERIFICATION_MARKER } },
    ],
  };
}

/** Row-level twin of `etbEligiblePropertyWhere`, for already-loaded records. */
export function isEtbEligibleProperty(property: { description?: string | null }): boolean {
  const description = property.description ?? '';
  if (!description.includes(BINA_PROVENANCE_PREFIX)) return true;
  return description.includes(BINA_PRICE_VERIFICATION_MARKER);
}
