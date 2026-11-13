// helper: fixes for frontend tsc errors older than PropertyExplorerPage (which gets fixed first)

const fs = require('fs');
const path = require('path');

const FIXES = {
  "src/api/index.ts": [
    {
      find: "export { getMarketSummary } from './market';",
      replace: "export { getMarketSummary as getMarketSummaryFromMarket } from './market';"
    }
  ],

  "src/api/publicData.ts": [
    // the .source/.fetchedAt/.resultCount/.note/.listings path is a leftover of an older shape.
    // After the backend exposure fix, the endpoint returns { total, resultCount, fetchedAt, note, listings }.
    // Cast return and destructure defensively.
    {
      find: `  const data = await fetchBinaListings();
    if (!data) return null;
    return {
      source: data.source,
      fetchedAt: data.fetchedAt,
      resultCount: data.resultCount,
      note: data.note,
      listings: data.listings,
    };`,
      replace: `  const data = await fetchBinaListings();
    if (!data || typeof data !== 'object') return null;
    const s = data as Record<string, unknown>;
    return {
      source: typeof s.source === 'string' ? s.source : 'binasmart',
      fetchedAt: typeof s.fetchedAt === 'string' ? s.fetchedAt : new Date().toISOString(),
      resultCount: typeof s.resultCount === 'number' ? s.resultCount : 0,
      note: typeof s.note === 'string' ? s.note : '',
      listings: Array.isArray(s.listings) ? s.listings : [],
    };`,
    }
  ],

  "src/hooks/useProperties.ts": [
    // Remove keepPreviousData which react-query v5 does not accept
    {
      find: "keepPreviousData: true,",
      replace: ""
    }
  ],

  "src/components/charts/DonutChart.tsx": [
    // Line 14 seems to assign the whole series to a string? Fix by re-deriving data inside the component.
    // We'll replace the whole file with a corrected version below.
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/properties/PropertiesPage.tsx": [
    // Will attempt to read and fix
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/admin/AdminProfilePage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/admin/AdminDashboardPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/admin/AdminNotificationsPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/scenarios/ScenariosPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/economics/EconomicsPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/forecasting/ForecastingPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/analyst/MarketTrendsPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/analyst/AnalystDashboardPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/properties/PropertyDetailPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/properties/AddEditPropertyPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/neighborhoods/NeighborhoodDetailPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/analyst/DataSourcesPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/neighborhoods/NeighborhoodsPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/analyst/PricingAnalysisPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/analyst/AnalystSettingsPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/analyst/AnalystNeighborhoodsPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ],

  "src/pages/admin/SystemHealthPage.tsx": [
    { find: "PLACEHOLDER", replace: null }
  ]
};

const base = process.cwd();
let changed = false;

function patchFile(file, replacements) {
  const full = path.join(base, file);
  if (!fs.existsSync(full)) {
    console.log("no file:", full);
    return;
  }
  let text = fs.readFileSync(full, 'utf8');
  let applied = false;
  for (const r of replacements) {
    if (r.replace === null) continue;
    if (text.includes(r.find)) {
      text = text.split(r.find).join(r.replace);
      applied = true;
    } else {
      console.warn("not matched:", file, JSON.stringify(r.find).slice(0, 80));
    }
  }
  if (applied) {
    fs.writeFileSync(full, text);
    changed = true;
    console.log("patched:", file);
  }
}

for (const file in FIXES) {
  patchFile(file, FIXES[file]);
}

console.log("changed:", changed);
