import { mean, median, standardDeviation, percentileChange, linearRegression, rentalYield, removeOutliers } from '../../src/shared/utils/statistics';

describe('Statistics utilities', () => {
  describe('mean', () => {
    it('calculates mean correctly', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });
    it('returns 0 for empty array', () => {
      expect(mean([])).toBe(0);
    });
  });

  describe('median', () => {
    it('calculates median for odd length', () => {
      expect(median([1, 3, 5])).toBe(3);
    });
    it('calculates median for even length', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
    it('returns 0 for empty array', () => {
      expect(median([])).toBe(0);
    });
  });

  describe('standardDeviation', () => {
    it('calculates std dev correctly', () => {
      const sd = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(sd).toBeCloseTo(2.138, 3);
    });
    it('returns 0 for single element', () => {
      expect(standardDeviation([5])).toBe(0);
    });
  });

  describe('percentileChange', () => {
    it('calculates positive growth', () => {
      expect(percentileChange(110, 100)).toBe(10);
    });
    it('calculates negative growth', () => {
      expect(percentileChange(90, 100)).toBe(-10);
    });
    it('returns 0 for zero previous', () => {
      expect(percentileChange(100, 0)).toBe(0);
    });
  });

  describe('linearRegression', () => {
    it('fits a perfect line', () => {
      const pts = [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }];
      const { slope, intercept, r2 } = linearRegression(pts);
      expect(slope).toBeCloseTo(2, 5);
      expect(intercept).toBeCloseTo(0, 5);
      expect(r2).toBeCloseTo(1, 5);
    });
  });

  describe('rentalYield', () => {
    it('calculates yield correctly', () => {
      expect(rentalYield(12000, 100000)).toBe(12);
    });
    it('returns 0 for zero value', () => {
      expect(rentalYield(1000, 0)).toBe(0);
    });
  });

  describe('removeOutliers', () => {
    it('removes extreme values', () => {
      const values = [100, 110, 105, 108, 5000, 95, 102];
      const cleaned = removeOutliers(values);
      expect(cleaned).not.toContain(5000);
    });
    it('returns original for small arrays', () => {
      expect(removeOutliers([1, 2, 3])).toEqual([1, 2, 3]);
    });
  });
});
