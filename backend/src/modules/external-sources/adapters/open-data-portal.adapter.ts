import axios from 'axios';

import { logger } from '../../../shared/utils/logger';

/**
 * Ethiopian open data discovery.
 *
 * Verified 2026-10:
 *  - data.gov.et (Ethiopian Open Data Portal) does NOT resolve (DNS failure);
 *    it is treated as unavailable, not silently proxied.
 *  - HDX CKAN API (data.humdata.org) IS live and hosts Ethiopia government
 *    datasets (admin boundaries COD-AB, population, profiles, etc.):
 *      GET https://data.humdata.org/api/3/action/package_search?q=...&rows=N
 *    CKAN responses: { success, result: { count, results: [ {name, title,
 *    notes, resources: [ {name, format, url, size} ] } ] } }
 *
 * This adapter searches HDX for Ethiopia datasets (demographics, geography)
 * so analysts can discover + download official datasets. It does not scrape
 * or fabricate data.gov.et content.
 */

export const HDX_CKAN_SEARCH = 'https://data.humdata.org/api/3/action/package_search';
export const ETHIOPIA_OPEN_DATA_PORTAL = 'https://data.gov.et/';

export interface OpenDataset {
  id: string;
  title: string;
  name: string;
  notes?: string;
  organization?: string;
  resources: Array<{ name: string; format: string; url: string; size?: number }>;
}

export class OpenDataPortalAdapter {
  /** Probe data.gov.et availability (expected: unreachable from most networks). */
  async probeEthiopiaPortal(): Promise<{ reachable: boolean; note: string }> {
    try {
      await axios.head(ETHIOPIA_OPEN_DATA_PORTAL, { timeout: 10000 });
      return { reachable: true, note: 'data.gov.et responded.' };
    } catch {
      return {
        reachable: false,
        note:
          'data.gov.et did not resolve/respond when checked (2026-10). Ethiopia datasets are ' +
          'discovered via the HDX CKAN API instead; if the national portal comes online, add it here.',
      };
    }
  }

  /**
   * Search HDX for Ethiopia datasets. `q` is appended to "ethiopia".
   */
  async searchEthiopiaDatasets(query: string, rows = 10): Promise<OpenDataset[]> {
    const q = query ? `ethiopia ${query}` : 'ethiopia';
    const res = await axios.get(HDX_CKAN_SEARCH, {
      params: { q, rows },
      timeout: 25000,
      headers: { Accept: 'application/json', 'User-Agent': 'EstatePlus/1.0 (data-integration)' },
    });

    const results: any[] = res.data?.result?.results ?? [];
    const datasets: OpenDataset[] = results.map((r) => ({
      id: String(r.id ?? r.name ?? ''),
      title: String(r.title ?? ''),
      name: String(r.name ?? ''),
      notes: r.notes ? String(r.notes).slice(0, 2000) : undefined,
      organization: r.organization?.title ?? r.organization?.name ?? undefined,
      resources: (r.resources ?? []).map((resource: any) => ({
        name: String(resource.name ?? ''),
        format: String(resource.format ?? ''),
        url: String(resource.url ?? ''),
        size: resource.size != null ? Number(resource.size) : undefined,
      })),
    }));

    logger.info({ msg: 'HDX Ethiopia dataset search', query, results: datasets.length });
    return datasets;
  }
}

export const openDataPortalAdapter = new OpenDataPortalAdapter();
