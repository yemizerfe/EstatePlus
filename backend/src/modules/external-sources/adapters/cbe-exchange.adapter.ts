import axios from 'axios';

import { logger } from '../../../shared/utils/logger';

/**
 * Commercial Bank of Ethiopia — daily exchange rates.
 * Documented public JSON endpoint, no API key:
 *   GET https://combanketh.et/cbeapi/daily-exchange-rates/?_limit=1
 * Optional date filter: &Date=YYYY-MM-DD
 *
 * Documented response shape (casing may be upper or lower; we accept both):
 *   [{ Date, ExchangeRate: [{ cashBuying, cashSelling, transactionalBuying,
 *      transactionalSelling, currency: { CurrencyCode } }] }]
 */

export const CBE_ENDPOINT = 'https://combanketh.et/cbeapi/daily-exchange-rates/';

export interface NormalizedExchangeRate {
  rateDate: Date;
  currency: string;
  baseCurrency: 'ETB';
  cashBuying?: number;
  cashSelling?: number;
  transactionalBuying?: number;
  transactionalSelling?: number;
  source: 'CBE';
  sourceUrl: string;
}

export class CbeExchangeAdapter {
  /**
   * Fetch the latest (or a specific date's) published rates and normalize them.
   * Empty results on weekends/holidays are missing observations, not errors.
   */
  async fetchDailyRates(date?: string): Promise<NormalizedExchangeRate[]> {
    const url = new URL(CBE_ENDPOINT);
    // The collection is returned oldest-first and ignores `_limit` alone, so ask
    // for a descending sort as well and still pick the newest date locally.
    url.searchParams.set('_sort', 'Date:DESC');
    url.searchParams.set('_limit', '5');
    if (date) url.searchParams.set('Date', date);

    const response = await axios.get(url.toString(), {
      timeout: 20000,
      headers: { Accept: 'application/json', 'User-Agent': 'EstatePlus/1.0 (data-integration)' },
      // CBE occasionally resets slow TLS connections; one retry is enough for a
      // read-only public feed.
      validateStatus: (s) => s === 200,
    });

    const payload = response.data;
    const rows: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    if (rows.length === 0) {
      logger.info({ msg: 'CBE returned no rows (weekend/holiday = missing observation)', date });
      return [];
    }

    const out: NormalizedExchangeRate[] = [];
    for (const row of rows) {
      const rawDate = row.Date ?? row.date;
      const rateDate = this.parseDate(rawDate);
      if (!rateDate) continue;

      const rates: any[] = Array.isArray(row.ExchangeRate)
        ? row.ExchangeRate
        : Array.isArray(row.exchangeRate)
          ? row.exchangeRate
          : [];

      for (const rate of rates) {
        const currency = this.extractCurrencyCode(rate);
        if (!currency) continue;
        out.push({
          rateDate,
          currency,
          baseCurrency: 'ETB',
          cashBuying: this.num(rate.cashBuying),
          cashSelling: this.num(rate.cashSelling),
          transactionalBuying: this.num(rate.transactionalBuying),
          transactionalSelling: this.num(rate.transactionalSelling),
          source: 'CBE',
          sourceUrl: CBE_ENDPOINT,
        });
      }
    }

    // Never publish an older bulletin as if it were today's rate: keep only the
    // rows belonging to the newest date present in the response.
    const newest = out.reduce<Date | null>(
      (latest, row) => (!latest || row.rateDate > latest ? row.rateDate : latest),
      null,
    );
    const latestRows = newest
      ? out.filter((row) => row.rateDate.getTime() === newest.getTime())
      : out;

    logger.info({
      msg: 'CBE exchange rates fetched',
      rows: latestRows.length,
      date: newest ? newest.toISOString().slice(0, 10) : rawDateOf(rows),
    });
    return latestRows;
  }

  private parseDate(value: unknown): Date | null {
    if (value == null) return null;
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? null : d;
  }

  private extractCurrencyCode(rate: any): string | null {
    const code =
      rate?.currency?.CurrencyCode ??
      rate?.currency?.currencyCode ??
      rate?.currencyCode ??
      rate?.CurrencyCode ??
      (typeof rate?.currency === 'string' ? rate.currency : null);
    return typeof code === 'string' && code.trim().length > 0 ? code.trim().toUpperCase() : null;
  }

  private num(value: unknown): number | undefined {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(n) ? n : undefined;
  }
}

function rawDateOf(rows: any[]): string | undefined {
  return rows[0]?.Date ?? rows[0]?.date;
}

export const cbeExchangeAdapter = new CbeExchangeAdapter();
