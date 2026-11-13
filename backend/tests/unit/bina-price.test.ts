import { getVerifiedBinaPrice } from '../../src/modules/bina/bina-smart.service';
import type { BinaRawProperty } from '../../src/modules/bina/bina-smart.service';

const invalidPrices: Array<Partial<BinaRawProperty>> = [
  { currency: 'USD' },
  { normalizationStatus: 'ambiguous' },
  { priceBasis: 'PRICE_PER_SQFT' },
  { listingType: null },
];

const binaRecord = (overrides: Partial<BinaRawProperty> = {}): BinaRawProperty => ({
  id: 'bina:test',
  title: 'Test listing',
  description: null,
  type: 'Apartment',
  beds: 2,
  baths: 1,
  size: 80,
  area: 'Bole, Addis Ababa',
  company: null,
  phone: null,
  whatsapp: null,
  telegram: null,
  link: null,
  checkedOnCompanySite: null,
  note: null,
  sourceUrl: null,
  listingType: 'sale',
  priceOriginal: '2,000,000 ETB total sale',
  priceAmount: 2_000_000,
  currency: 'ETB',
  priceUnit: null,
  pricePeriod: null,
  priceBasis: 'TOTAL_PROPERTY_PRICE',
  normalizationStatus: 'normalized',
  normalizationNotes: null,
  fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('getVerifiedBinaPrice', () => {
  it('accepts explicit, normalized ETB sale prices', () => {
    expect(getVerifiedBinaPrice(binaRecord())).toEqual({
      listingType: 'sale',
      amount: 2_000_000,
      monthlyRent: null,
    });
  });

  it('normalizes annual rent to a monthly amount', () => {
    expect(
      getVerifiedBinaPrice(
        binaRecord({
          listingType: 'rent',
          priceAmount: 120_000,
          pricePeriod: 'YEAR',
          priceBasis: 'ANNUAL_RENT',
        }),
      ),
    ).toEqual({ listingType: 'rent', amount: 120_000, monthlyRent: 10_000 });
  });

  it.each(invalidPrices)('rejects unclear or non-comparable prices: %j', (overrides) => {
    expect(getVerifiedBinaPrice(binaRecord(overrides))).toBeNull();
  });
});
