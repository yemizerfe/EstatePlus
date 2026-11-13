import axios from 'axios';

import { normalizeCommonsImageUrl } from '../../../shared/utils/commons-image';
import { logger } from '../../../shared/utils/logger';

/**
 * Wikimedia Commons — free, no API key, attribution required.
 *
 * Neighborhood cards need a real photograph of the place, not a stock banner.
 * Commons exposes a geosearch generator over its file namespace, so an area
 * with a coordinate gets photos taken near that coordinate:
 *
 *   GET https://commons.wikimedia.org/w/api.php
 *     ?action=query&format=json&generator=geosearch
 *     &ggscoord=<lat>|<lng>&ggsradius=<m>&ggsnamespace=6&ggslimit=20
 *     &prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200
 *
 * Every returned file carries the author and licence, which are stored beside
 * the URL so the interface can attribute the photo.
 */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'EstatePlus/1.0 (neighborhood imagery; data-integration)';

/** Files that are diagrams, maps or coats of arms rather than photographs. */
const NON_PHOTO = /(\.svg|\.png|\.gif|\.webm|\.ogv|\.ogg|\.tif|\.tiff|\.pdf|map|logo|icon|coat[_ ]of[_ ]arms|seal|diagram|plan_of)/i;

/** A photo of people, food or an event does not represent a neighborhood. */
const NOT_A_PLACE = /(portrait|meets with|secretary|minister|president|conference|summit|coffee|tibs|injera|food|dish|bird|people|woman|women|man\b|child|festival|ceremony|wedding|illustration|poster|screenshot|chart|banner|selfie|group photo|laboratory|science|boeing|aircraft|airplane|airlines|\bjet\b|vegetable shop|shop by night|first hotel|view of earth|\biss0|nasa|satellite|earth observation)/i;

/**
 * Building sites, road works and demolition are never published: a card that
 * shows scaffolding reads as "this area is a construction site".
 */
const CONSTRUCTION =
  /(construction|constructing|under construction|scaffold|crane|excavat|foundation|unfinished|half[- ]built|building site|demolition|road works|earthworks|cement|rebar|bare land|empty plot)/i;

/** Titles that describe a place in or around a city. */
const PLACE_WORDS = /(addis|building|street|road|view|aerial|square|city|tower|church|cathedral|mosque|market|centre|center|sub-?city|residential|apartment|hotel|skyline|neighbou?rhood|district|block|ring road|boulevard)/i;

export interface CommonsPhoto {
  imageUrl: string;
  pageUrl: string;
  title: string;
  credit: string | null;
  license: string | null;
}

interface CommonsResponse {
  query?: {
    pages?: Record<
      string,
      {
        title: string;
        imageinfo?: Array<{
          thumburl?: string;
          url?: string;
          descriptionurl?: string;
          thumbwidth?: number;
          thumbheight?: number;
          extmetadata?: Record<string, { value?: string }>;
        }>;
      }
    >;
  };
}

function stripHtml(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return text.length > 0 ? text.slice(0, 200) : null;
}

function isPlacePhoto(title: string): boolean {
  if (NON_PHOTO.test(title) || NOT_A_PLACE.test(title) || CONSTRUCTION.test(title)) return false;
  return PLACE_WORDS.test(title);
}

function pickPhoto(payload: CommonsResponse, requireLandscape: boolean): CommonsPhoto | null {
  const pages = Object.values(payload.query?.pages ?? {});
  const candidates = pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;
      const url = info.thumburl ?? info.url;
      if (!url) return null;
      if (!isPlacePhoto(page.title)) return null;
      const width = info.thumbwidth ?? 0;
      const height = info.thumbheight ?? 0;
      if (width > 0 && width < 640) return null;
      if (requireLandscape && width > 0 && height > 0 && width / height < 1.15) return null;
      const meta = info.extmetadata ?? {};
      return {
        imageUrl: normalizeCommonsImageUrl(url) ?? url,
        pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        title: page.title.replace(/^File:/, ''),
        credit: stripHtml(meta['Artist']?.value),
        license: stripHtml(meta['LicenseShortName']?.value),
        score: width,
      };
    })
    .filter((entry): entry is CommonsPhoto & { score: number } => entry !== null)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return null;
  const { score: _score, ...photo } = best;
  return photo;
}

export class WikimediaCommonsAdapter {
  /** Photos geotagged near a coordinate, most useful first. */
  async fetchPhotosNear(lat: number, lng: number, radiusMetres = 8000): Promise<CommonsPhoto[]> {
    try {
      const response = await axios.get<CommonsResponse>(COMMONS_API, {
        timeout: 20_000,
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        params: {
          action: 'query',
          format: 'json',
          generator: 'geosearch',
          ggscoord: `${lat}|${lng}`,
          ggsradius: radiusMetres,
          ggsnamespace: 6,
          ggslimit: 20,
          prop: 'imageinfo',
          iiprop: 'url|extmetadata',
          iiurlwidth: 1200,
        },
      });
      const pages = Object.values(response.data.query?.pages ?? {});
      return pages
        .map((page) => {
          const info = page.imageinfo?.[0];
          const url = info?.thumburl ?? info?.url;
          if (!url || !isPlacePhoto(page.title)) return null;
          const meta = info?.extmetadata ?? {};
          return {
            imageUrl: normalizeCommonsImageUrl(url) ?? url,
            pageUrl:
              info?.descriptionurl ??
              `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
            title: page.title.replace(/^File:/, ''),
            credit: stripHtml(meta['Artist']?.value),
            license: stripHtml(meta['LicenseShortName']?.value),
          };
        })
        .filter((photo): photo is CommonsPhoto => photo !== null);
    } catch (error) {
      logger.warn({
        msg: 'Wikimedia Commons geosearch failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /** Photos found by name, used for an area that has no coordinate yet. */
  async searchPhoto(name: string): Promise<CommonsPhoto | null> {
    const searches = [`${name} Addis Ababa`, `${name} Ethiopia`, 'Addis Ababa'];
    for (const term of searches) {
      try {
        const response = await axios.get<CommonsResponse>(COMMONS_API, {
          timeout: 20_000,
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
          params: {
            action: 'query',
            format: 'json',
            generator: 'search',
            gsrsearch: term,
            gsrnamespace: 6,
            gsrlimit: 15,
            prop: 'imageinfo',
            iiprop: 'url|extmetadata',
            iiurlwidth: 1200,
          },
        });
        const photo = pickPhoto(response.data, true);
        if (photo) return photo;
      } catch (error) {
        logger.warn({
          msg: 'Wikimedia Commons search failed',
          term,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return null;
  }

  /** Best available photo for an area: nearby first, then by name. */
  async fetchNeighborhoodPhoto(input: {
    name: string;
    lat: number | null;
    lng: number | null;
  }): Promise<CommonsPhoto | null> {
    const candidates = await this.fetchNeighborhoodPhotoCandidates(input);
    return candidates[0] ?? null;
  }

  /**
   * Every usable photo for an area, best first, so a caller can skip an image
   * another area already uses.
   */
  async fetchNeighborhoodPhotoCandidates(input: {
    name: string;
    lat: number | null;
    lng: number | null;
  }): Promise<CommonsPhoto[]> {
    const out: CommonsPhoto[] = [];
    const seen = new Set<string>();
    const push = (photo: CommonsPhoto | null) => {
      if (!photo || seen.has(photo.imageUrl)) return;
      seen.add(photo.imageUrl);
      out.push(photo);
    };

    if (input.lat !== null && input.lng !== null) {
      const nearby = await this.fetchPhotosNear(input.lat, input.lng);
      nearby.forEach(push);
    }

    for (const term of [`${input.name} Addis Ababa`, `${input.name} Ethiopia`, 'Addis Ababa']) {
      if (out.length >= 6) break;
      try {
        const response = await axios.get<CommonsResponse>(COMMONS_API, {
          timeout: 20_000,
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
          params: {
            action: 'query',
            format: 'json',
            generator: 'search',
            gsrsearch: term,
            gsrnamespace: 6,
            gsrlimit: 20,
            prop: 'imageinfo',
            iiprop: 'url|extmetadata',
            iiurlwidth: 1200,
          },
        });
        for (const page of Object.values(response.data.query?.pages ?? {})) {
          const info = page.imageinfo?.[0];
          const url = info?.thumburl ?? info?.url;
          if (!url || !isPlacePhoto(page.title)) continue;
          const meta = info?.extmetadata ?? {};
          push({
            imageUrl: normalizeCommonsImageUrl(url) ?? url,
            pageUrl:
              info?.descriptionurl ??
              `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
            title: page.title.replace(/^File:/, ''),
            credit: stripHtml(meta['Artist']?.value),
            license: stripHtml(meta['LicenseShortName']?.value),
          });
        }
      } catch {
        // A rate-limited or failed search just contributes no candidates.
      }
      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    return out;
  }
}

export const wikimediaCommonsAdapter = new WikimediaCommonsAdapter();
