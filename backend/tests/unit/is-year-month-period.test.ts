import { isYearMonthPeriod } from '../../src/modules/data-import/services/uploaded-row-data';

describe('isYearMonthPeriod', () => {
  it('accepts valid month periods', () => {
    expect(isYearMonthPeriod('2026-01')).toBe(true);
    expect(isYearMonthPeriod('2026-12')).toBe(true);
  });

  it('rejects invalid months and malformed periods', () => {
    expect(isYearMonthPeriod('2026-00')).toBe(false);
    expect(isYearMonthPeriod('2026-13')).toBe(false);
    expect(isYearMonthPeriod('0000-01')).toBe(false);
    expect(isYearMonthPeriod('2026-1')).toBe(false);
  });
});
