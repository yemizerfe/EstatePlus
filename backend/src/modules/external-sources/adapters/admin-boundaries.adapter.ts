import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { logger } from '../../../shared/utils/logger';

/**
 * Ethiopian administrative boundaries — geoBoundaries gbOpen (CC BY 4.0).
 *
 * Verified live 2026-10:
 *   GET https://www.geoboundaries.org/api/current/gbOpen/ETH/ADM1/
 * returns metadata incl. simplifiedGJDownloadURL; the simplified GeoJSON is a
 * direct GitHub download. Boundary year represented: 2016 (build Dec 2023) —
 * kept in `sourceYear` so consumers know it is not necessarily current.
 *
 * The full GeoJSON can be tens of MB; we download once, cache to a temp file,
 * and persist features via the caller-provided `onFeature` callback so the
 * service layer owns DB writes.
 */

export const GEOBOUNDARIES_API = 'https://www.geoboundaries.org/api/current/gbOpen/ETH';

export type AdminLevel = 'ADM1' | 'ADM2' | 'ADM3';

export interface BoundaryMetadata {
  boundaryType: string;
  boundaryYearRepresented?: number;
  license?: string;
  simplifiedUrl?: string;
  fullUrl?: string;
}

export interface BoundaryFeature {
  adminLevel: AdminLevel;
  name: string;
  geometry: unknown;
  properties: Record<string, unknown>;
}

export class AdminBoundariesAdapter {
  async fetchMetadata(level: AdminLevel): Promise<BoundaryMetadata> {
    const res = await axios.get(`${GEOBOUNDARIES_API}/${level}/`, {
      timeout: 20000,
      headers: { Accept: 'application/json', 'User-Agent': 'EstatePlus/1.0 (data-integration)' },
    });
    const d = res.data ?? {};
    return {
      boundaryType: d.boundaryType ?? level,
      boundaryYearRepresented: d.boundaryYearRepresented ? Number(d.boundaryYearRepresented) : undefined,
      license: d.boundaryLicense,
      simplifiedUrl: d.simplifiedGJDownloadURL,
      fullUrl: d.gjDownloadURL,
    };
  }

  /**
   * Download the simplified GeoJSON for a level and stream features to
   * `onFeature`. Returns the number of features emitted.
   */
  async downloadFeatures(
    level: AdminLevel,
    onFeature: (feature: BoundaryFeature, metadata: BoundaryMetadata) => void | Promise<void>,
  ): Promise<{ featureCount: number; metadata: BoundaryMetadata }> {
    const metadata = await this.fetchMetadata(level);
    const url = metadata.simplifiedUrl ?? metadata.fullUrl;
    if (!url) {
      throw new Error(`geoBoundaries returned no download URL for ETH ${level}`);
    }

    // Stream to a temp file first: the payload is large and axios' arraybuffer
    // is fine for ADM1/ADM2 simplified (~1-10 MB).
    const tmp = path.join(os.tmpdir(), `gb-eth-${level}-${Date.now()}.geojson`);
    try {
      const res = await axios.get(url, {
        timeout: 120000,
        responseType: 'stream',
        headers: { 'User-Agent': 'EstatePlus/1.0 (data-integration)' },
      });
      await new Promise<void>((resolve, reject) => {
        const ws = fs.createWriteStream(tmp);
        res.data.pipe(ws);
        ws.on('finish', () => resolve());
        ws.on('error', reject);
        res.data.on('error', reject);
      });

      const raw = JSON.parse(fs.readFileSync(tmp, 'utf8')) as {
        features?: Array<{ properties?: Record<string, unknown>; geometry?: unknown }>;
      };
      const features = raw.features ?? [];

      let count = 0;
      for (const feature of features) {
        const props = feature.properties ?? {};
        const name =
          String(props.shapeName ?? props.NAME_1 ?? props.NAME_2 ?? props.name ?? '').trim() ||
          `unnamed-${count + 1}`;
        await onFeature({ adminLevel: level, name, geometry: feature.geometry, properties: props }, metadata);
        count++;
      }

      logger.info({ msg: 'geoBoundaries features processed', level, featureCount: count });
      return { featureCount: count, metadata };
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* temp cleanup is best-effort */
      }
    }
  }
}

export const adminBoundariesAdapter = new AdminBoundariesAdapter();
