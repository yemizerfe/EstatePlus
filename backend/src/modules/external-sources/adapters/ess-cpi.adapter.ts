import axios from 'axios';

import { logger } from '../../../shared/utils/logger';
import { parse as parseCsv } from 'csv-parse/sync';

/**
 * Ethiopian Statistical Service (ESS, formerly CSA) — CPI & inflation.
 *
 * Verified 2026-10: ESS publishes monthly CPI reports as HTML/download pages
 * (HTTP 200 on https://ess.gov.et/price/); no documented JSON/CSV API.
 *
 * Strategy (honest, no pretend API):
 *  1. `fetchLatestReports()` — probes the official price page and extracts the
 *     list of linked CPI report pages (title + URL) so the app can point
 *     analysts at the official source. Values are NOT scraped from PDFs.
 *  2. `parseCpiCsv()` — controlled manual CSV import for analysts who copy
 *     figures from the official report (columns:
 *     date,indicator,value[,unit,notes]). indicator ∈ inflation | cpi.
 */

export const ESS_PRICE_PAGE = 'https://ess.gov.et/price/';
export const ESS_DOWNLOADS_PAGE = 'https://ess.gov.et/re1/?wpdm_category=0&wpdm_start_date=&wpdm_end_date=';

export interface EssReportLink {
  title: string;
  url: string;
}

export interface EssCpiObservation {
  indicator: 'inflation' | 'cpi';
  recordedAt: Date;
  value: number;
  unit: string;
  notes?: string;
  sourceUrl: string;
}

export class EssCpiAdapter {
  /** Probe the official reports listing and extract CPI report links. */
  async fetchLatestReports(limit = 10): Promise<{ reachable: boolean; reports: EssReportLink[]; note: string }> {
    try {
      // The /price/ landing page has no download anchors; the reports listing
      // at /re1/ publishes the actual /download/consumer-price-index-*/ pages.
      const response = await axios.get(ESS_DOWNLOADS_PAGE, {
        timeout: 25000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EstatePlus/1.0; data-integration)',
          Accept: 'text/html',
        },
        responseType: 'text',
      });

      const html = String(response.data ?? '');
      const links: EssReportLink[] = [];
      const re = /<a[^>]+href="([^"]*\/download\/[^"]*)"[^>]*>([^<]{5,160})<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(html)) !== null) {
        const url = match[1].startsWith('http') ? match[1] : `https://ess.gov.et${match[1]}`;
        const title = match[2].trim();
        if (!links.some((l) => l.url === url)) links.push({ title, url });
      }

      // CPI reports first — they are what this adapter exists for.
      links.sort((a, b) => {
        const aCpi = /consumer-price|cpi/i.test(a.url + a.title) ? 0 : 1;
        const bCpi = /consumer-price|cpi/i.test(b.url + b.title) ? 0 : 1;
        return aCpi - bCpi;
      });
      const reports = links.slice(0, limit);
      const cpiCount = reports.filter((l) => /consumer-price|cpi/i.test(l.url + l.title)).length;

      return {
        reachable: true,
        reports,
        note:
          reports.length > 0
            ? `Found ${reports.length} official report links on the ESS reports listing (${cpiCount} CPI). Figures are imported via the manual CSV path.`
            : 'ESS reports listing reachable but no report links matched the expected pattern.',
      };
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      logger.warn({ msg: 'ESS reports listing probe failed', status, error: String(error) });
      return {
        reachable: false,
        reports: [],
        note: 'ESS reports listing could not be fetched. Manual CSV import remains available.',
      };
    }
  }

  /**
   * Parse an analyst-uploaded CSV of official ESS figures.
   * Expected headers: date,indicator,value[,unit,notes]
   *   indicator: "inflation" (annual %) or "cpi" (index)
   */
  parseCpiCsv(csvText: string, sourceUrl = ESS_PRICE_PAGE): EssCpiObservation[] {
    const parsed: Array<Record<string, string>> = parseCsv(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const out: EssCpiObservation[] = [];
    const errors: string[] = [];

    parsed.forEach((record, index) => {
      const lower: Record<string, string> = {};
      for (const [k, v] of Object.entries(record)) lower[k.toLowerCase()] = String(v ?? '').trim();

      const date = new Date(lower.date ?? lower.period ?? '');
      const indicatorRaw = (lower.indicator ?? '').toLowerCase();
      const value = parseFloat(lower.value ?? '');

      if (isNaN(date.getTime())) {
        errors.push(`row ${index + 2}: invalid date`);
        return;
      }
      const indicator: EssCpiObservation['indicator'] | null =
        indicatorRaw.startsWith('inflation') || indicatorRaw === 'cpi_inflation'
          ? 'inflation'
          : indicatorRaw.startsWith('cpi') || indicatorRaw === 'index'
            ? 'cpi'
            : null;
      if (!indicator) {
        errors.push(`row ${index + 2}: indicator must be "inflation" or "cpi"`);
        return;
      }
      if (!Number.isFinite(value)) {
        errors.push(`row ${index + 2}: value is not a number`);
        return;
      }

      out.push({
        indicator,
        recordedAt: date,
        value,
        unit: lower.unit || (indicator === 'inflation' ? 'percentage' : 'index'),
        notes: lower.notes || undefined,
        sourceUrl,
      });
    });

    if (out.length === 0) {
      throw new Error(
        `ESS CSV contained no usable rows. Expected headers: date,indicator,value. ` +
          (errors.length > 0 ? `Issues: ${errors.slice(0, 5).join('; ')}` : ''),
      );
    }
    return out;
  }
}

export const essCpiAdapter = new EssCpiAdapter();
