import axios from 'axios';

import { logger } from '../../../shared/utils/logger';

/**
 * World Bank Indicators API v2 — Ethiopia. Verified live, no API key.
 *   GET https://api.worldbank.org/v2/country/ETH/indicator/{CODE}?format=json&date=YYYY:YYYY
 *
 * Response: [ {page,pages,total,...}, [ {indicator, country, date, value, unit} ] ]
 * `value` may be null for missing years — those are dropped, never zero-filled.
 */

export const WORLD_BANK_BASE = 'https://api.worldbank.org/v2/country/ETH/indicator';

/** Indicators EstatePlus tracks for historical/macro context. */
export const WORLD_BANK_INDICATORS: Record<string, string> = {
  'SP.POP.TOTL': 'Population, total',
  'NY.GDP.MKTP.CD': 'GDP (current US$)',
  'SP.URB.TOTL.IN.ZS': 'Urban population (% of total)',
  'NY.GDP.MKTP.KD.ZG': 'GDP growth (annual %)',
  'FP.CPI.TOTL.ZG': 'Inflation, consumer prices (annual %)',
};

export interface WorldBankObservation {
  indicatorCode: string;
  indicatorName: string;
  country: string;
  year: number;
  value: number;
  unit?: string;
  sourceUrl: string;
}

export class WorldBankAdapter {
  async fetchIndicator(indicatorCode: string, dateRange: string): Promise<WorldBankObservation[]> {
    const name = WORLD_BANK_INDICATORS[indicatorCode] ?? indicatorCode;
    const url = `${WORLD_BANK_BASE}/${indicatorCode}?format=json&date=${dateRange}&per_page=100`;

    // Public instances occasionally drop slow requests; one retry keeps the
    // sync useful without hammering the API.
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 30000,
          headers: { Accept: 'application/json', 'User-Agent': 'EstatePlus/1.0 (data-integration)' },
        });

        const payload = response.data;
        const observations: any[] = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];

        const out: WorldBankObservation[] = [];
        for (const obs of observations) {
          if (obs?.value == null) continue; // missing year ≠ zero
          const year = parseInt(String(obs.date), 10);
          if (!Number.isFinite(year)) continue;
          out.push({
            indicatorCode,
            indicatorName: obs.indicator?.value ?? name,
            country: 'ETH',
            year,
            value: Number(obs.value),
            unit: obs.unit || undefined,
            sourceUrl: url,
          });
        }

        logger.info({ msg: 'World Bank indicator fetched', indicatorCode, observations: out.length, attempt });
        return out;
      } catch (error) {
        lastError = error;
        logger.warn({
          msg: 'World Bank fetch attempt failed',
          indicatorCode,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
        if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async fetchAll(dateRange: string): Promise<WorldBankObservation[]> {
    const results: WorldBankObservation[] = [];
    for (const code of Object.keys(WORLD_BANK_INDICATORS)) {
      try {
        results.push(...(await this.fetchIndicator(code, dateRange)));
      } catch (err) {
        logger.warn({
          msg: 'World Bank indicator fetch failed; continuing with the rest',
          indicatorCode: code,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }
}

export const worldBankAdapter = new WorldBankAdapter();
