import axios from 'axios';

import { logger } from '../../../shared/utils/logger';

/**
 * OpenStreetMap — Overpass API for roads, schools, hospitals, parks, transport
 * stops and nearby amenities.
 *
 * Verified 2026-10: https://overpass-api.de/api/interpreter is the main public
 * instance but is frequently at capacity (502/406) and asks clients to use
 * exponential backoff and alternative instances. We therefore query a list of
 * public instances in order, with a per-instance timeout, and surface a clear
 * error if every instance fails. Do NOT hammer one instance.
 *
 * Query shape (POST data=...):
 *   [out:json][timeout:N];(nwr["amenity"~"..."](S,W,N,E); ...);out center LIMIT;
 * Nodes carry lat/lon directly; ways/relations carry a center object.
 */

export const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://ethiopia.overpass.openplaceguide.org/api/interpreter',
];

/** OSM amenity/feature values we pull, grouped by the EstatePlus concept. */
export const OSM_FEATURE_GROUPS = {
  schools: { tags: [{ key: 'amenity', value: 'school' }, { key: 'amenity', value: 'university' }, { key: 'amenity', value: 'kindergarten' }] },
  hospitals: { tags: [{ key: 'amenity', value: 'hospital' }, { key: 'amenity', value: 'clinic' }, { key: 'amenity', value: 'pharmacy' }] },
  parks: { tags: [{ key: 'leisure', value: 'park' }, { key: 'leisure', value: 'garden' }] },
  transport: { tags: [{ key: 'highway', value: 'bus_stop' }, { key: 'public_transport', value: 'platform' }, { key: 'railway', value: 'station' }, { key: 'railway', value: 'tram_stop' }] },
  markets: { tags: [{ key: 'amenity', value: 'marketplace' }, { key: 'shop', value: 'supermarket' }] },
  banks: { tags: [{ key: 'amenity', value: 'bank' }, { key: 'amenity', value: 'bureau_de_change' }] },
  roads: { tags: [{ key: 'highway', value: 'primary' }, { key: 'highway', value: 'secondary' }, { key: 'highway', value: 'tertiary' }] },
} as const;

export type OsmFeatureGroup = keyof typeof OSM_FEATURE_GROUPS;

export interface OsmFeature {
  group: OsmFeatureGroup;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name?: string;
  lat?: number;
  lon?: number;
  tags: Record<string, string>;
}

export interface OverpassQueryOptions {
  /** Bounding box: south, west, north, east (decimal degrees). */
  bbox: [number, number, number, number];
  groups?: OsmFeatureGroup[];
  limitPerGroup?: number;
  timeoutSeconds?: number;
}

export class OsmOverpassAdapter {
  /**
   * Query the public Overpass instances in order until one answers.
   * Respects provider usage policy: one query per attempt, bounded results,
   * backoff handled by the caller between neighborhoods.
   */
  async queryAmenities(options: OverpassQueryOptions): Promise<OsmFeature[]> {
    const groups = options.groups ?? (Object.keys(OSM_FEATURE_GROUPS) as OsmFeatureGroup[]);
    const limit = options.limitPerGroup ?? 50;
    const timeout = options.timeoutSeconds ?? 30;
    const [s, w, n, e] = options.bbox;

    const clauses = groups
      .flatMap((group) =>
        OSM_FEATURE_GROUPS[group].tags.map(
          (t) => `nwr[${JSON.stringify(t.key)}=${JSON.stringify(t.value)}](${s},${w},${n},${e});`,
        ),
      )
      .join('');
    const query = `[out:json][timeout:${timeout}];(${clauses});out center ${limit};`;

    let lastError = 'no instances configured';
    for (const instance of OVERPASS_INSTANCES) {
      try {
        const response = await axios.post(instance, `data=${encodeURIComponent(query)}`, {
          timeout: (timeout + 15) * 1000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'EstatePlus/1.0 (real-estate data integration; contact via admin)',
            Accept: 'application/json',
          },
        });

        const elements: any[] = response.data?.elements ?? [];
        const features = this.normalizeElements(elements, groups);
        logger.info({ msg: 'Overpass query succeeded', instance, elements: elements.length, features: features.length });
        return features;
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        lastError = `${instance}: ${status ?? String(error)}`;
        logger.warn({ msg: 'Overpass instance failed, trying next', instance, status });
      }
    }

    throw new Error(
      `All Overpass instances failed (public instances are capacity-limited; retry later). Last error: ${lastError}`,
    );
  }

  private normalizeElements(elements: any[], groups: OsmFeatureGroup[]): OsmFeature[] {
    const out: OsmFeature[] = [];
    for (const el of elements) {
      const tags: Record<string, string> = {};
      for (const [k, v] of Object.entries(el?.tags ?? {})) tags[k] = String(v);

      const lat = typeof el.lat === 'number' ? el.lat : el?.center?.lat;
      const lon = typeof el.lon === 'number' ? el.lon : el?.center?.lon;

      out.push({
        group: this.classifyGroup(tags, groups),
        osmType: el.type,
        osmId: el.id,
        name: tags.name,
        lat,
        lon,
        tags,
      });
    }
    return out;
  }

  private classifyGroup(tags: Record<string, string>, groups: OsmFeatureGroup[]): OsmFeatureGroup {
    for (const group of groups) {
      for (const t of OSM_FEATURE_GROUPS[group].tags) {
        if (tags[t.key] === t.value) return group;
      }
    }
    return 'markets';
  }

  /** Haversine distance in meters; used to attach distance to a neighborhood center. */
  distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
}

export const osmOverpassAdapter = new OsmOverpassAdapter();
