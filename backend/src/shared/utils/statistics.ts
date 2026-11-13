/**
 * Pure statistical utility functions used by market analytics,
 * valuation, and forecasting modules.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}
export function percentileChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/** Simple linear regression — returns slope and intercept. */
export function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const avgY = sumY / n;
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - avgY, 2), 0);
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

export function rentalYield(annualRent: number, propertyValue: number): number {
  if (propertyValue === 0) return 0;
  return (annualRent / propertyValue) * 100;
}

/** IQR-based outlier detection */
export function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter((v) => v >= lower && v <= upper);
}

/** Calculate percentile value */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
}

/** Calculate correlation coefficient between two arrays */
export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const meanX = mean(x);
  const meanY = mean(y);

  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i]! - meanY), 0);
  const denomX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  const denomY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));

  if (denomX === 0 || denomY === 0) return 0;
  return numerator / (denomX * denomY);
}

/** Calculate moving average */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 0 || window > values.length) return values;

  const result = [];
  for (let i = window - 1; i < values.length; i++) {
    const windowValues = values.slice(i - window + 1, i + 1);
    result.push(mean(windowValues));
  }
  return result;
}

/** Calculate exponential moving average */
export function exponentialMovingAverage(values: number[], alpha: number = 0.1): number[] {
  if (values.length === 0) return [];

  const result = [values[0]!];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i]! + (1 - alpha) * result[i - 1]!);
  }
  return result;
}

/** Calculate variance */
export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
}

/** Calculate coefficient of variation */
export function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return (standardDeviation(values) / avg) * 100;
}

/** Exponential smoothing for forecasting */
export function exponentialSmoothing(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return values;

  const result = [values[0]!];
  for (let i = 1; i < values.length; i++) {
    const smoothed = alpha * values[i]! + (1 - alpha) * result[i - 1]!;
    result.push(smoothed);
  }
  return result;
}

/** Calculate trend direction and strength */
export function calculateTrend(values: number[]): {
  direction: 'bullish' | 'bearish' | 'stable';
  strength: number;
  slope: number;
} {
  if (values.length < 2) {
    return { direction: 'stable', strength: 0, slope: 0 };
  }

  const points = values.map((y, x) => ({ x, y }));
  const { slope } = linearRegression(points);

  const avg = mean(values);
  const normalizedSlope = avg !== 0 ? slope / avg : 0;

  let direction: 'bullish' | 'bearish' | 'stable';
  if (normalizedSlope > 0.01) {
    direction = 'bullish';
  } else if (normalizedSlope < -0.01) {
    direction = 'bearish';
  } else {
    direction = 'stable';
  }

  const strength = Math.min(1, Math.abs(normalizedSlope) * 10);

  return { direction, strength, slope };
}

/** Predict future values based on trend */
export function predictFuture(
  values: number[],
  periods: number,
  method: 'linear' | 'exponential' = 'linear'
): number[] {
  if (values.length < 2) {
    return Array(periods).fill(values[0] ?? 0);
  }

  const points = values.map((y, x) => ({ x, y }));
  const { slope, intercept } = linearRegression(points);

  const predictions: number[] = [];
  const lastX = values.length - 1;

  for (let i = 1; i <= periods; i++) {
    const x = lastX + i;
    let predicted: number;

    if (method === 'linear') {
      predicted = slope * x + intercept;
    } else {
      const growthRate = (values[values.length - 1]! - values[0]!) / values.length / values[0]!;
      predicted = values[values.length - 1]! * Math.pow(1 + growthRate, i);
    }

    predictions.push(Math.max(0, predicted));
  }

  return predictions;
}

/** Calculate simple moving average crossover for signals */
export function movingAverageCrossover(
  values: number[],
  shortPeriod: number = 5,
  longPeriod: number = 20
): Array<{ x: number; signal: 'buy' | 'sell' | 'hold' }> {
  if (values.length < longPeriod) return [];

  const shortMA = movingAverage(values, shortPeriod);
  const longMA = movingAverage(values, longPeriod);

  const signals: Array<{ x: number; signal: 'buy' | 'sell' | 'hold' }> = [];

  for (let i = longPeriod - 1; i < values.length; i++) {
    const shortIdx = i - longPeriod + shortPeriod;
    const longIdx = i - longPeriod + longPeriod;

    if (shortIdx < 0 || longIdx < 0 || shortIdx >= shortMA.length || longIdx >= longMA.length) {
      continue;
    }

    const prevShort = shortMA[shortIdx - 1] ?? 0;
    const prevLong = longMA[longIdx - 1] ?? 0;
    const currShort = shortMA[shortIdx] ?? 0;
    const currLong = longMA[longIdx] ?? 0;

    let signal: 'buy' | 'sell' | 'hold' = 'hold';

    if (prevShort <= prevLong && currShort > currLong) {
      signal = 'buy';
    } else if (prevShort >= prevLong && currShort < currLong) {
      signal = 'sell';
    }

    signals.push({ x: i, signal });
  }

  return signals;
}

/** Calculate RSI (Relative Strength Index) */
export function calculateRSI(values: number[], period: number = 14): number[] {
  if (values.length < period + 1) return [];

  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    changes.push(values[i]! - values[i - 1]!);
  }

  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i]! > 0) avgGain += changes[i]!;
    else avgLoss += Math.abs(changes[i]!);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i]! > 0 ? changes[i]! : 0;
    const loss = changes[i]! < 0 ? Math.abs(changes[i]!) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return rsi;
}

/** Calculate Bollinger Bands */
export function bollingerBands(
  values: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = movingAverage(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < values.length; i++) {
    const windowValues = values.slice(i - period + 1, i + 1);
    const std = standardDeviation(windowValues);
    const ma = middle[i - period + 1] ?? 0;

    upper.push(ma + stdDevMultiplier * std);
    lower.push(ma - stdDevMultiplier * std);
  }

  return { upper, middle, lower };
}
