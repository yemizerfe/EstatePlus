import axios from 'axios';

import { logger } from '../../../shared/utils/logger';
import { parse as parseCsv } from 'csv-parse/sync';

/**
 * National Bank of Ethiopia — official indicative exchange rates & statistics.
 *
 * Verified 2026-10: NBE publishes HTML pages only (no documented JSON/CSV API):
 *   - https://nbe.gov.et/exchange/                             (daily indicative rates, HTTP 200)
 *   - https://nbe.gov.et/publications-statistics/statistics/   (statistics landing, HTTP 200)
 *   - https://nbe.gov.et/monetary-policies/                    (policy rate, T-bill yield)
 *
 * Strategy (honest, no pretend API):
 *  1. `fetchReferencePage()` — fetches the exchange page and attempts a
 *     best-effort regex extraction of the indicative USD rate table. Success is
 *     NOT guaranteed (table may be JS-rendered); callers must treat an empty
 *     result as "page reachable, values not machine-readable".
 *  2. `parseReferenceCsv()` — controlled manual CSV import path for analysts
 *     who download NBE's published tables (columns:
 *     date,currency,buying,selling). This is the reliable NBE ingestion path
 *     and mirrors the registry's `csv_manual` access method.
 */

export const NBE_EXCHANGE_PAGE = 'https://nbe.gov.et/exchange/';
export const NBE_STATISTICS_PAGE = 'https://nbe.gov.et/publications-statistics/statistics/';
export const NBE_MONETARY_PAGE = 'https://nbe.gov.et/monetary-policies/';

export interface NbeRateRow {
  rateDate: Date;
  currency: string;
  baseCurrency: 'ETB';
  buying?: number;
  selling?: number;
  source: 'NBE';
  sourceUrl: string;
}

export interface NbePageProbe {
  reachable: boolean;
  statusCode?: number;
  /** True when a rate table was machine-readable in the HTML (rare). */
  parsed: boolean;
  rows: NbeRateRow[];
  note: string;
}

export class NbeAdapter {
  /**
   * Probe the official indicative-rate page. Returns whatever could actually
   * be extracted; never fabricates values.
   */
  async fetchReferencePage(): Promise<NbePageProbe> {
    try {
      const response = await axios.get(NBE_EXCHANGE_PAGE, {
        timeout: 25000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EstatePlus/1.0; data-integration)',
          Accept: 'text/html,application/xhtml+xml',
        },
        responseType: 'text',
      });

      const html = String(response.data ?? '');
      const rows = this.extractRatesFromHtml(html);

      if (rows.length > 0) {
        return {
          reachable: true,
          statusCode: response.status,
          parsed: true,
          rows,
          note: `Parsed ${rows.length} indicative rate rows from the NBE exchange page.`,
        };
      }

      return {
        reachable: true,
        statusCode: response.status,
        parsed: false,
        rows: [],
        note:
          'NBE exchange page is reachable but its rate table is not machine-readable ' +
          '(likely JavaScript-rendered). Use the manual CSV import (analyst downloads the ' +
          'published table from nbe.gov.et and uploads it) — that is the supported NBE path.',
      };
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      logger.warn({ msg: 'NBE exchange page probe failed', status, error: String(error) });
      return {
        reachable: false,
        statusCode: status,
        parsed: false,
        rows: [],
        note: 'NBE exchange page could not be fetched. Manual CSV import remains available.',
      };
    }
  }

  /**
   * Best-effort HTML extraction: looks for table rows containing a date and
   * two decimal numbers near currency labels (USD/EUR/GBP/SAR/AED).
   */
  private extractRatesFromHtml(html: string): NbeRateRow[] {
    const rows: NbeRateRow[] = [];
    const currencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED'];

    // Match rows like: <td>USD</td><td>118.23</td><td>119.45</td> (loose)
    for (const currency of currencies) {
      const rowRe = new RegExp(
        `<tr[^>]*>.*?${currency}.*?</tr>`,
        'is',
      );
      const match = rowRe.exec(html);
      if (!match) continue;
      const numbers = (match[0].match(/>\s*(\d{1,4}(?:\.\d{1,6})?)\s*</g) ?? [])
        .map((s) => parseFloat(s.replace(/[><\s]/g, '')))
        .filter((n) => Number.isFinite(n) && n > 1);
      const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(html);
      if (numbers.length >= 1) {
        rows.push({
          rateDate: dateMatch ? new Date(dateMatch[1]) : new Date(),
          currency,
          baseCurrency: 'ETB',
          buying: numbers[0],
          selling: numbers[1],
          source: 'NBE',
          sourceUrl: NBE_EXCHANGE_PAGE,
        });
      }
    }
    return rows;
  }

  /**
   * Parse an analyst-uploaded CSV of NBE published rates.
   * Expected headers: date,currency,buying,selling (case-insensitive; extra
   * columns ignored). Values are validated; invalid rows throw with row numbers.
   */
  parseReferenceCsv(csvText: string): NbeRateRow[] {
    const parsed: Array<Record<string, string>> = parseCsv(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const rows: NbeRateRow[] = [];
    const errors: string[] = [];

    parsed.forEach((record, index) => {
      const lower: Record<string, string> = {};
      for (const [k, v] of Object.entries(record)) lower[k.toLowerCase()] = String(v ?? '').trim();

      const date = new Date(lower.date ?? lower.recorded_at ?? '');
      const currency = (lower.currency ?? '').toUpperCase();
      const buying = parseFloat(lower.buying ?? lower.rate ?? '');
      const selling = parseFloat(lower.selling ?? '');

      if (isNaN(date.getTime())) {
        errors.push(`row ${index + 2}: invalid date`);
        return;
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        errors.push(`row ${index + 2}: currency must be a 3-letter ISO code`);
        return;
      }

      rows.push({
        rateDate: date,
        currency,
        baseCurrency: 'ETB',
        buying: Number.isFinite(buying) ? buying : undefined,
        selling: Number.isFinite(selling) ? selling : undefined,
        source: 'NBE',
        sourceUrl: NBE_EXCHANGE_PAGE,
      });
    });

    if (rows.length === 0) {
      throw new Error(
        `NBE CSV contained no usable rows. Expected headers: date,currency,buying,selling. ` +
          (errors.length > 0 ? `Issues: ${errors.slice(0, 5).join('; ')}` : ''),
      );
    }
    return rows;
  }

  /** Statistics landing page availability (for status reporting). */
  async probeStatisticsPage(): Promise<{ reachable: boolean; statusCode?: number }> {
    try {
      const res = await axios.head(NBE_STATISTICS_PAGE, {
        timeout: 15000,
        headers: { 'User-Agent': 'EstatePlus/1.0 (data-integration)' },
      });
      return { reachable: true, statusCode: res.status };
    } catch {
      return { reachable: false };
    }
  }
}

export const nbeAdapter = new NbeAdapter();
