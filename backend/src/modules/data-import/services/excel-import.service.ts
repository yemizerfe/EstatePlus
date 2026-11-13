

export interface ExcelSheetPreview {
  sheetName: string;
  rowCount: number;
  headerLabels: string[];
  sampleRows: any[][];
  columnCount: number;
  detectedDateColumns: string[];
  detectedNumericColumns: string[];
}

export interface ProfileMatch {
  sheetIndex: number;
  sheetName: string;
  profiles: string[];
  recommendedSheet: string | null;
  confidence: number;
  why: string[];
}

/**
 * Parse a workbook buffer (from multer memory storage) into a SheetJS workbook.
 * This is the only SheetJS surface the Excel routes touch directly; the rest is
 * plain-data normalization so the service stays easy to test/replace.
 */
export async function parseExcelWorkbook(buffer: Buffer): Promise<{ SheetNames: string[]; Sheets: Record<string, unknown> }> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, {type: 'buffer', cellDates: true});
  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel library could not parse the uploaded workbook');
  }
  return workbook as { SheetNames: string[]; Sheets: Record<string, unknown> };
}

/**
 * Normalize a single sheet into a stable preview shape used by the frontend
 * and by the profile detector.
 */
export function normalizeSheetPreview(sheet: any, sheetName: string): ExcelSheetPreview {
  const rawRows = (() => {
    try {
      // header:1 gives us the raw grid incl. the first row as data
      return (globalThis as any).XLSX?.utils?.sheet_to_json?.
        call?.(null, sheet, {header: 1, raw: true, defval: null}) ?? [];
    } catch {
      return [];
    }
  })();

  const headerCandidates = rawRows.length > 0 ? (rawRows[0] as any[]) : [];
  const headerLabels = headerCandidates
    .map((cell: any) => (cell == null ? '' : String(cell).trim()))
    .map((label) => (label.length > 0 ? label : null))
    .filter((label): label is string => label != null);

  const dataRows = rawRows.slice(1).filter((row: any[]) => row.some((cell) => cell != null));

  return {
    sheetName,
    rowCount: rawRows.length,
    headerLabels,
    sampleRows: dataRows.slice(0, 5),
    columnCount: headerLabels.length,
    detectedDateColumns: detectDateColumns(dataRows, headerLabels),
    detectedNumericColumns: detectNumericColumns(dataRows, headerLabels),
  };
}

function detectDateColumns(rows: any[][], labels: string[]): string[] {
  const out: string[] = [];
  for (let c = 0; c < labels.length; c++) {
    const samples = rows.slice(0, 200).map((r) => r[c] ?? null).filter((v) => v != null);
    if (samples.length === 0) continue;
    const hit = samples.some((v) => {
      if (v instanceof Date) return true;
      if (typeof v === 'number') {
        const d = new Date(v);
        return !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
      }
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true;
        if (/^\d{4}-\d{2}$/.test(trimmed)) return true;
        const ts = Date.parse(v);
        if (!isNaN(ts)) {
          const d = new Date(ts);
          return d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
        }
      }
      return false;
    });
    if (hit) out.push(labels[c]);
  }
  return out;
}


function detectNumericColumns(rows: any[][], labels: string[]): string[] {
  const out: string[] = [];
  for (let c = 0; c < labels.length; c++) {
    const samples = rows.slice(0, 200).map((r) => r[c] ?? null).filter((v) => v != null);
    if (samples.length === 0) continue;
    const hit = samples.some((v): boolean => {
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'string') {
        const cleaned = v.replace(/[,\s]/g, '');
        if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
          const n = parseFloat(cleaned);
          return Number.isFinite(n);
        }
      }
      return false;
    });
    if (hit) out.push(labels[c]);
  }
  return out;
}

/**
 * Best-guess mapping between sheets and the known import entity types.
 * This is intentionally heuristic: analysts must still confirm mappings in the UI.
 */
export function detectImportProfile(sheets: ExcelSheetPreview[]): ProfileMatch[] {
  const profiles: ProfileMatch[] = [];

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];      const matched: string[] = [];
    const reasons: string[] = [];
    let confidence = 0;

    const headers = sheet.headerLabels.map((h) => h.toLowerCase().trim());
    const numeric = sheet.detectedNumericColumns.map((h) => h.toLowerCase().trim());

    // ---- Properties / listings ----
    const propertyKeywords = ['title', 'property type', 'propertytype', 'bedroom', 'bathroom',
      'size', 'sqm', 'address', 'neighborhood', 'price', 'condition', 'lat', 'lng'];
    const propertyHits = propertyKeywords.filter((k) => headers.includes(k));
    if (propertyHits.length >= 3) {
      matched.push('properties');
      confidence += 15 * propertyHits.length;
      reasons.push(`Sheet has property-like columns: ${propertyHits.join(', ')}`);
    }

    // ---- Economic indicators ----
    const econKeywords = ['indicator', 'inflation', 'interest rate', 'interestrate',
      'gdp', 'credit growth', 'creditgrowth', 'construction cost', 'constructioncost',
      'value', 'observation', 'period', 'date'];
    const econHits = econKeywords.filter((k) => headers.includes(k));
    if (econHits.length >= 2) {
      matched.push('economic_indicators');
      confidence += 20 * econHits.length;
      reasons.push(`Sheet has economic-indicator-like columns: ${econHits.join(', ')}`);
    }

    // ---- Market statistics ----
    const marketKeywords = ['neighborhood', 'propertytype', 'property type', 'period',
      'average price', 'averageprice', 'avgprice', 'median price', 'medianprice',
      'price per sqm', 'pricePerSqm', 'sales volume', 'salesvolume', 'days on market',
      'daysonmarket', 'liquidity', 'demand', 'investment score', 'investmentScore'];
    const marketHits = marketKeywords.filter((k) => headers.includes(k));
    if (marketHits.length >= 3) {
      matched.push('market_statistics');
      confidence += 15 * marketHits.length;
      reasons.push(`Sheet has market-statistic-like columns: ${marketHits.join(', ')}`);
    }

    // ---- Neighborhoods / amenities ----
    const neighborhoodKeywords = ['neighborhood', 'amenity', 'amenitytype', 'amenity type',
      'distance', 'rating', 'statistic', 'school', 'hospital', 'market', 'park'];
    const neighborhoodHits = neighborhoodKeywords.filter((k) => headers.includes(k));
    if (neighborhoodHits.length >= 2) {
      matched.push('neighborhoods');
      confidence += 15 * neighborhoodHits.length;
      reasons.push(`Sheet has neighborhood/amenity-like columns: ${neighborhoodHits.join(', ')}`);
    }

    // Fallback: if a sheet has >= 4 columns and at least one numeric + one text,
    // guess "properties" as a safe default so the UI can still offer a mapping.
    if (matched.length === 0 && sheet.columnCount >= 4 && numeric.length >= 1) {
      matched.push('properties');
      reasons.push('Fallback guess: multi-column sheet with numeric fields');
      confidence = 30;
    }

    profiles.push({
      sheetIndex: i,
      sheetName: sheet.sheetName,
      profiles: matched.length > 0 ? matched : ['properties'],
      recommendedSheet: null,
      confidence: Math.min(confidence, 100),
      why: reasons.length > 0 ? reasons : ['No strong column signals detected; analyst mapping required'],
    });
  }

  return profiles;
}

/**
 * Guidance returned by the upload-config route; kept as a constant so the
 * route and any future template generator share one source of truth.
 */
export const sheetNameSuggestions = [
  'Properties',
  'Listings',
  'Properties_Import',
  'Economic_Indicators',
  'Market_Statistics',
  'MarketStats',
  'Neighborhoods',
  'Amenities',
  'Data',
  'Sheet1',
];
