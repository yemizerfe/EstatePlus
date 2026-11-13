-- Forecast trend slopes are price changes per month, which overflow the former
-- numeric(12,6) (max 10^6) as soon as a series averages millions of birr.
ALTER TABLE "forecasts" ALTER COLUMN "trend_slope" TYPE numeric(18, 2);
