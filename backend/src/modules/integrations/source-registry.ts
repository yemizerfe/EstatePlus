// Central integration registry for EstatePlus external data sources.
// This file is informational/coordination only. It does not itself call any
// external service, and it must not import a runtime client (Prisma, axios,
// fetch, the MCP SDK, etc.). Adapters live in their own modules and own their
// own status; this registry is the single place that records each source's
// status, access method, configuration, last successful sync, last error and
// intended data freshness.
//
// Design notes:
// - Secrets required by a source must come from env vars or the deployment
//   secrets manager and must never be stored here or exposed to the frontend.
// - Status values mirror the spec's reporting categories so we can answer:
//   "which integrations were actually tested live?"
// - Each entry must be updated by the adapter that owns it, not by a generic
//   poller that guesses whether data is current.

export type SourceStatus =
  | 'not_configured'   // no credentials / no access method established yet
  | 'pending_access'   // awaiting key, partner feed, approval or manual setup
  | 'manual_only'      // no verified automated feed; manual CSV/document import supported
  | 'verified_live'    // adapter tested live against the actual source
  | 'verified_manual'  // manual import workflow tested
  | 'unavailable'      // source unsupported / endpoint removed / blocked
  | 'disabled';        // admin has disabled the adapter temporarily

export type AccessMethod =
  | 'mcp'                      // Model Context Protocol tool endpoint
  | 'rest_json_api'            // documented JSON API, no key required
  | 'rest_json_api_key'        // documented JSON API, API key required
  | 'csv_manual'               // manual CSV/document upload
  | 'document_manual'          // PDF/spreadsheet download + controlled import
  | 'open_data_portal'         // dataset discovery / portal API
  | 'osm_overpass'             // OSM Overpass / public extract
  | 'osm_extract'              // regional OSM extract download
  | 'geo_download'             // downloadable boundary/shape file
  | 'public_web_pages'         // public HTML pages whose schema.org JSON-LD is read
  // Add new rows here as sources are verified; do not invent methods.

export type IndicatorCategory =
  | 'exchange_rate'
  | 'inflation'
  | 'consumer_price_index'
  | 'interest_rate'
  | 'demographics'
  | 'construction_cost'
  | 'urban_planning'
  | 'administrative_geography'
  | 'property_listings'
  | 'neighborhood_amenities'
  | 'transport'
  | 'other';

export interface SourceCapabilities {
  // What the adapter can do today. Narrower is better than claiming too much.
  search?: boolean;
  preview?: boolean;         // can run a dry-run / preview without persisting
  import?: boolean;
  historical?: boolean;       // can retrieve historical observations, not only latest
  spatial?: boolean;          // returns coordinates/geometry
  manualUpload?: boolean;     // supports manual CSV/document import
  refreshSchedule?: string;   // human-readable suggested cadence, not executed automatically
}

export interface DataSourceIntegration {
  id: string;                 // stable machine id, e.g. 'binasmart', 'cbe_exchange'
  name: string;
  category: IndicatorCategory;
  status: SourceStatus;
  accessMethod: AccessMethod;
  endpoint?: string;          // primary endpoint, public docs only, never a secret
  healthEndpoint?: string;
  requiresCredentials: boolean;
  credentialEnvVars: string[];        // env var NAMES only, never values
  capabilities: SourceCapabilities;
  lastSuccessfulSync?: string;        // ISO timestamp or undefined
  lastAttempt?: string;
  lastError?: string;                 // category/error summary, never a raw secret
  notes: string;                      // verified limitations, license flags, review status
}

// ---------------------------------------------------------------------------
// Registry invariants (documented, not enforced at runtime here):
// ---------------------------------------------------------------------------
// - This file is informational/coordination only. It must not import a runtime
//   client (Prisma, axios, fetch, the MCP SDK, etc.). Adapters that actually
//   call a source live in their own modules and own their status.
// - `status` reflects what has been verified, not what is hoped for.
// - `credentialEnvVars` lists env var NAMES only; values never land here.
// ---------------------------------------------------------------------------

export const INTEGRATION_REGISTRY: readonly DataSourceIntegration[] = [
  // ── Sanity gate: every entry must have a stable id, a display name, and a
  //   status that matches the adapter surface actually implemented for it.
  //   Entries whose status claims more than the adapter provides are bugs, not
  //   aspirational notes.
  
  // ── Sanity gate: every entry must have a stable id, a display name, and a
  //   status that matches the adapter surface actually implemented for it.
  //   Entries whose status claims more than the adapter provides are bugs, not
  //   aspirational notes.
  
  // ── Property listings ────────────────────────────────────────────────
  {
    id: 'binasmart',
    name: 'BinaSmart MCP',
    category: 'property_listings',
    status: 'verified_live',
    accessMethod: 'mcp',
    endpoint: 'https://bina.et/mcp',
    healthEndpoint: 'https://bina.et/mcp/health',
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: true,
      preview: true,
      import: true,
      historical: false,
      spatial: false,
      refreshSchedule: 'daily or manual, within documented source limits',
    },
    lastSuccessfulSync: undefined,
    notes: 'search_properties tool discovered via MCP tool-discovery; 33 tools are exposed, of which only the property search is used. The MCP is limited to 20 requests/hour per address (shared with /api/knowledge/search) and the terms forbid copying the index wholesale, so syncs stay small and cached. Prices in search results are free text ("on request", "3,500 / month"), so an amount is only persisted after the linked listing page states it in an Offer with an explicit currency (scripts/backfill-bina-listings.ts, bina-smart.service ingest). Mounted at /api/v1/bina (bina-search.controller).',
  },

  {
    id: 'real_et',
    name: 'Real.et — Addis Ababa for sale / for rent',
    category: 'property_listings',
    status: 'verified_live',
    accessMethod: 'public_web_pages',
    endpoint: 'https://real.et/addis-ababa/property-for-sale',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: true,
      preview: true,
      import: true,
      historical: false,
      spatial: false,
      manualUpload: false,
      refreshSchedule: 'daily or on demand; 59 Addis Ababa listings verified 2026-11',
    },
    lastSuccessfulSync: undefined,
    notes: 'Verified live 2026-11: category pages publish an ItemList JSON-LD of Addis Ababa listing URLs, and each listing page publishes a schema.org RealEstateListing with offers.price/priceCurrency (ETB), floorSize, bedrooms, bathrooms, streetAddress, images and datePosted. Adapter modules/external-sources/adapters/real-et.adapter.ts; import via scripts/sync-real-et.ts. robots.txt allows / and only disallows /cdn-cgi/. Listings without an explicit ETB amount are skipped, never guessed. Inventory is small (tens of listings), so it supplements rather than replaces BinaSmart.',
  },

  {
    id: 'wikimedia_commons',
    name: 'Wikimedia Commons — neighborhood photography',
    category: 'neighborhood_amenities',
    status: 'verified_live',
    accessMethod: 'rest_json_api',
    endpoint: 'https://commons.wikimedia.org/w/api.php',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: true,
      preview: true,
      import: true,
      historical: false,
      spatial: true,
      refreshSchedule: 'once per area, refreshed on demand',
    },
    lastSuccessfulSync: undefined,
    notes: 'Geosearch over the file namespace returns photographs taken near an area coordinate; files that are maps, diagrams or seals are rejected, and the author plus licence are stored with the URL so the interface attributes the image. Free, no key, no per-address quota beyond polite use. Adapter modules/external-sources/adapters/wikimedia-commons.adapter.ts; backfill via scripts/enrich-neighborhoods.ts.',
  },

  {
    id: 'osm_geocoder',
    name: 'Nominatim (OpenStreetMap) — sub-city centres',
    category: 'neighborhood_amenities',
    status: 'verified_live',
    accessMethod: 'rest_json_api',
    endpoint: 'https://nominatim.openstreetmap.org/search',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: true,
      preview: true,
      import: true,
      historical: false,
      spatial: true,
      refreshSchedule: 'only when a neighbourhood has no centre stored',
    },
    lastSuccessfulSync: undefined,
    notes: 'Used to give each Addis Ababa sub-city a real map centre before amenities are queried. One request per sub-city with the required 1 req/second pace and an identifying User-Agent; the returned display_name and bounding box are stored on the neighbourhood for audit (scripts/sync-neighborhood-amenities.ts).',
  },

  // ── Exchange rate / economic indicators ─────────────────────────────
  {
    id: 'cbe_exchange',
    name: 'Commercial Bank of Ethiopia (CBE) daily exchange rates',
    category: 'exchange_rate',
    status: 'pending_access',
    accessMethod: 'rest_json_api',
    endpoint: 'https://combanketh.et/cbeapi/daily-exchange-rates/',
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: false,
      preview: true,
      import: true,
      historical: true,
      spatial: false,
      refreshSchedule: 'daily on business days; missing dates are missing observations, not zero',
    },
    lastSuccessfulSync: undefined,
    notes: 'Adapter fully implemented (modules/external-sources/adapters/cbe-exchange.adapter.ts → exchange_rates table) against the documented public JSON shape (no key): data[0].Date + data[0].ExchangeRate[] with currency.CurrencyCode, cashBuying/cashSelling, transactionalBuying/transactionalSelling; casing tolerant. NOT yet verified live: combanketh.et does not resolve/reach from the current dev network (DNS + timeouts), so status is pending_access until a sync succeeds from an Ethiopian network. On failure the sync reports the timeout honestly and does NOT substitute NBE or any other rate source. Empty results on weekends/holidays are missing observations, not zeros.',
  },
  {
    id: 'nbe_indicators',
    name: 'National Bank of Ethiopia (NBE)',
    category: 'exchange_rate',
    status: 'verified_manual',
    accessMethod: 'csv_manual',
    endpoint: 'https://nbe.gov.et/exchange/',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: false,
      preview: true,
      import: true,
      historical: true,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'according to official publication frequency',
    },
    lastSuccessfulSync: undefined,
    notes: 'Verified 2026-10: NBE publishes HTML pages only (exchange page and statistics pages return HTTP 200); no documented JSON/CSV API. Adapter (modules/external-sources/adapters/nbe.adapter.ts) probes the official exchange page and supports a controlled manual CSV import (date,currency,buying,selling) as the reliable ingestion path. Page values are not scraped from JS-rendered tables — empty parse results are reported honestly. NBE remains the official reference-rate source; CBE is the machine-readable daily feed.',
  },
  {
    id: 'ess_cpi',
    name: 'Ethiopian Statistical Service (ESS) — CPI / inflation',
    category: 'consumer_price_index',
    status: 'verified_manual',
    accessMethod: 'csv_manual',
    endpoint: 'https://ess.gov.et/price/',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: false,
      preview: true,
      import: true,
      historical: true,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'check for new releases monthly',
    },
    lastSuccessfulSync: undefined,
    notes: 'Verified 2026-10: ESS price page (ess.gov.et/price/) returns HTTP 200 and links monthly CPI report downloads; no JSON/CSV API. Adapter (modules/external-sources/adapters/ess-cpi.adapter.ts) lists official report links and supports controlled manual CSV import (date,indicator,value) into INFLATION_RATE / CONSUMER_PRICE_INDEX. National CPI is NOT treated as a neighborhood-specific property inflation rate.',
  },

  // ── Geographic / spatial ────────────────────────────────────────────
  {
    id: 'osm_amenities',
    name: 'OpenStreetMap (OSM) amenities / map features',
    category: 'neighborhood_amenities',
    status: 'verified_live',
    accessMethod: 'osm_overpass',
    endpoint: 'https://overpass-api.de/api/interpreter',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: true,
      preview: true,
      import: true,
      historical: false,
      spatial: true,
      refreshSchedule: 'on-demand per neighborhood; respect provider capacity limits',
    },
    lastSuccessfulSync: undefined,
    notes: 'Adapter (modules/external-sources/adapters/osm-overpass.adapter.ts) queries public Overpass instances in order (overpass-api.de, kumi.systems, ethiopia.overpass.openplaceguide.org) with bounded result counts; the main instance is frequently at capacity (502) and asks for backoff, so failures are surfaced instead of hammering. Amenities are stored unverified with OSM attribution. OSM data is NOT presented as a complete or verified directory of Addis Ababa.',
  },
  {
    id: 'admin_boundaries',
    name: 'Ethiopian administrative boundaries (geoBoundaries gbOpen)',
    category: 'administrative_geography',
    status: 'verified_live',
    accessMethod: 'geo_download',
    endpoint: 'https://www.geoboundaries.org/api/current/gbOpen/ETH/ADM1/',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: false,
      preview: true,
      import: true,
      historical: false,
      spatial: true,
      manualUpload: true,
      refreshSchedule: 'periodic availability checks; dataset changes rarely',
    },
    lastSuccessfulSync: undefined,
    notes: 'Verified live 2026-10: geoBoundaries gbOpen ETH ADM1/ADM2/ADM3 metadata + simplified GeoJSON downloads work without credentials (CC BY 4.0; boundary year represented 2016, build Dec 2023 — stored in sourceYear). Adapter persists features to the geographic_boundaries table. Administrative boundaries are kept distinct from EstatePlus neighborhoods. No PostGIS required (GeoJSON stored as JSONB).',
  },
  {
    id: 'open_data_portal',
    name: 'Ethiopian Open Data Portal (data.gov.et) — via HDX CKAN',
    category: 'other',
    status: 'verified_live',
    accessMethod: 'open_data_portal',
    endpoint: 'https://data.humdata.org/api/3/action/package_search',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: true,
      preview: true,
      import: true,
      historical: false,
      spatial: true,
      manualUpload: true,
      refreshSchedule: 'check for new relevant datasets weekly or monthly',
    },
    lastSuccessfulSync: undefined,
    notes: 'Verified 2026-10: data.gov.et does NOT resolve (DNS failure) — treated as unavailable, not proxied. Ethiopia government datasets (admin boundaries COD-AB, population, profiles) are discovered via the live HDX CKAN API (no key required); adapter returns dataset metadata + resource download URLs for analyst-driven import. If the national portal comes online, register it as a separate source.',
  },
  {
    id: 'world_bank',
    name: 'World Bank Open Data — Ethiopia',
    category: 'demographics',
    status: 'verified_live',
    accessMethod: 'rest_json_api',
    endpoint: 'https://api.worldbank.org/v2/country/ETH/indicator/SP.POP.TOTL?format=json',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: false,
      preview: true,
      import: true,
      historical: true,
      spatial: false,
      refreshSchedule: 'monthly; World Bank publishes annually',
    },
    lastSuccessfulSync: undefined,
    notes: 'Verified live 2026-10 (real JSON returned, lastupdated 2026-10-08). Indicators imported: SP.POP.TOTL (population), NY.GDP.MKTP.CD (GDP current US$), SP.URB.TOTL.IN.ZS (urban population %), NY.GDP.MKTP.KD.ZG (GDP growth %), FP.CPI.TOTL.ZG (inflation %) — stored in macro_indicators with per-year granularity. Missing years stay missing; values are never zero-filled.',
  },
  {
    id: 'urban_planning',
    name: 'Addis Ababa land administration & urban-planning publications',
    category: 'urban_planning',
    status: 'manual_only',
    accessMethod: 'document_manual',
    endpoint: 'https://www.addisland.gov.et/en-us/ReportsDashboardPublic',
    healthEndpoint: undefined,
    requiresCredentials: false,
    credentialEnvVars: [],
    capabilities: {
      search: false,
      preview: false,
      import: true,
      historical: false,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'periodic availability checks or manual uploads',
    },
    lastSuccessfulSync: undefined,
    notes: 'Prefer downloadable official documents or authorized datasets. Extracted planning statements are document-backed information, NOT legal advice. Do not claim real-time parcel ownership, title verification or zoning permissions unless the source explicitly provides that data and access is authorized.',
  },

  // ── Additional property listing providers (not implemented as pretend connectors) ──
  {
    id: 'mls_et',
    name: 'EthioMLS (mls.et)',
    category: 'property_listings',
    status: 'not_configured',
    accessMethod: 'csv_manual',
    endpoint: 'https://mls.et/en/listings',
    healthEndpoint: undefined,
    requiresCredentials: true,
    credentialEnvVars: ['MLSET_API_KEY'], // env var name only
    capabilities: {
      search: false,
      preview: false,
      import: false,
      historical: false,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'only according to authorized feed terms',
    },
    lastSuccessfulSync: undefined,
    notes: 'Public API availability, bulk-feed permissions and API key requirements not verified. Mark as not_configured until a real integration has passed its tests. Do not build a pretend connector.',
  },
  {
    id: 'real_et',
    name: 'Real.et',
    category: 'property_listings',
    status: 'not_configured',
    accessMethod: 'csv_manual',
    endpoint: 'https://real.et/',
    healthEndpoint: undefined,
    requiresCredentials: true,
    credentialEnvVars: ['REALET_API_KEY'], // env var name only
    capabilities: {
      search: false,
      preview: false,
      import: false,
      historical: false,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'only according to authorized feed terms',
    },
    lastSuccessfulSync: undefined,
    notes: 'Not configured until access is verified.',
  },
  {
    id: 'kiray_et',
    name: 'Kiray',
    category: 'property_listings',
    status: 'not_configured',
    accessMethod: 'csv_manual',
    endpoint: 'https://kiray.et/',
    healthEndpoint: undefined,
    requiresCredentials: true,
    credentialEnvVars: ['KIRAY_API_KEY'], // env var name only
    capabilities: {
      search: false,
      preview: false,
      import: false,
      historical: false,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'only according to authorized feed terms',
    },
    lastSuccessfulSync: undefined,
    notes: 'Not configured until access is verified.',
  },
  {
    id: 'hulubota',
    name: 'Hulubota',
    category: 'property_listings',
    status: 'not_configured',
    accessMethod: 'csv_manual',
    endpoint: 'https://hulubota.com/',
    healthEndpoint: undefined,
    requiresCredentials: true,
    credentialEnvVars: ['HULUBOTA_API_KEY'], // env var name only
    capabilities: {
      search: false,
      preview: false,
      import: false,
      historical: false,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'only according to authorized feed terms',
    },
    lastSuccessfulSync: undefined,
    notes: 'Not configured until access is verified.',
  },
  {
    id: 'addislist',
    name: 'AddisList',
    category: 'property_listings',
    status: 'not_configured',
    accessMethod: 'csv_manual',
    endpoint: 'https://addislist.com/',
    healthEndpoint: undefined,
    requiresCredentials: true,
    credentialEnvVars: ['ADDISLIST_API_KEY'], // env var name only
    capabilities: {
      search: false,
      preview: false,
      import: false,
      historical: false,
      spatial: false,
      manualUpload: true,
      refreshSchedule: 'only according to authorized feed terms',
    },
    lastSuccessfulSync: undefined,
    notes: 'Not configured until access is verified.',
  },
];

export function findIntegration(id: string): DataSourceIntegration | undefined {
  return INTEGRATION_REGISTRY.find((s) => s.id === id);
}

export function integrationsByStatus(status: SourceStatus): DataSourceIntegration[] {
  return INTEGRATION_REGISTRY.filter((s) => s.status === status);
}

export function integrationsByCategory(category: IndicatorCategory): DataSourceIntegration[] {
  return INTEGRATION_REGISTRY.filter((s) => s.category === category);
}

export function integrationsThatSupport(method: AccessMethod): DataSourceIntegration[] {
  return INTEGRATION_REGISTRY.filter((s) => s.accessMethod === method);
}
