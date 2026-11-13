/**
 * The product is presented in English only. Source feeds occasionally publish
 * place names or whole descriptions in Amharic, so text is normalised here
 * before it is stored or displayed.
 */

const AMHARIC = /[\u1200-\u137F]/;

/** Place names that appear in Addis Ababa listing feeds. */
const PLACE_NAMES: Array<[RegExp, string]> = [
  [/ቦሌ\s*አራብሳ/g, 'Bole Arabsa'],
  [/ቦሌ/g, 'Bole'],
  [/ካዛንችስ/g, 'Kazanchis'],
  [/ሰሚት/g, 'Summit'],
  [/ሁለተኛ\s*በር/g, 'Second Gate'],
  [/ሳሪስ\s*አዲስ\s*ሰፈር/g, 'Saris Addis Sefer'],
  [/ሳሪስ/g, 'Saris'],
  [/አዲስ\s*ሰፈር/g, 'Addis Sefer'],
  [/አያት\s*ማሮናታ/g, 'Ayat Maranata'],
  [/አያት/g, 'Ayat'],
  [/ሚካኤል/g, 'Michael'],
  [/ኡራኤል/g, 'Urael'],
  [/ቂሊንጦ/g, 'Kilinto'],
  [/የካ/g, 'Yeka'],
  [/ጉለሌ/g, 'Gulele'],
  [/አራዳ/g, 'Arada'],
  [/ልደታ/g, 'Lideta'],
  [/ኮልፌ/g, 'Kolfe'],
  [/ላፍቶ/g, 'Lafto'],
  [/ቅርቅስ/g, 'Kirkos'],
  [/ንፋስ/g, 'Nifas'],
  [/ቻንቶ/g, 'Chanto'],
  [/ለቡ/g, 'Lebu'],
  [/ጃሞ/g, 'Jamo'],
  [/አደባባይ/g, 'Square'],
  [/ህንጻ/g, 'Building'],
  [/ፎቅ/g, 'Floor'],
];

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'apartment',
  VILLA: 'villa',
  CONDOMINIUM: 'condominium',
  HOUSE: 'house',
  OFFICE: 'office',
  RETAIL: 'retail space',
  WAREHOUSE: 'warehouse',
  LAND: 'land plot',
  STUDIO: 'studio',
};

export function hasAmharic(value: string | null | undefined): boolean {
  return typeof value === 'string' && AMHARIC.test(value);
}

/** Amharic text that survives place-name rewriting is prose, not a name. */
export function isAmharicProse(value: string | null | undefined): boolean {
  if (!hasAmharic(value)) return false;
  let text = value as string;
  for (const [pattern, replacement] of PLACE_NAMES) {
    text = text.replace(pattern, replacement);
  }
  return hasAmharic(text);
}

/**
 * Rewrites the place names that appear in feeds and drops anything still
 * written in Amharic, so no untranslated fragment reaches the interface.
 */
export function toEnglishText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  let text = value;
  for (const [pattern, replacement] of PLACE_NAMES) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/[\u1200-\u137F]+/g, ' ');
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([,.:;])/g, '$1').trim();
  return text.length > 0 ? text : null;
}

/** English-only pass for free text such as a neighborhood description. */
export function englishOnly(value: string | null | undefined): string | null {
  return toEnglishText(value);
}

function typeLabel(propertyType: string | null | undefined): string {
  const key = (propertyType ?? '').toUpperCase();
  return TYPE_LABELS[key] ?? (key ? key.toLowerCase().replace(/_/g, ' ') : 'property');
}

export interface TitleContext {
  propertyType?: string | null;
  bedrooms?: number | null;
  listingType?: 'sale' | 'rent' | 'both' | null;
  neighborhood?: string | null;
}

/**
 * A display title in English. A stored English title is kept as-is (with Amharic
 * place names translated); a title written in Amharic is rebuilt from the
 * record's own structured fields, which keeps the same facts without inventing
 * any.
 */
export function englishTitle(
  title: string | null | undefined,
  context: TitleContext = {},
): string {
  const cleaned = toEnglishText(title);
  if (cleaned && !isAmharicProse(title) && cleaned.length >= 3) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  const bedrooms = context.bedrooms ?? 0;
  const type = typeLabel(context.propertyType);
  const subject = bedrooms > 0 ? `${bedrooms} bedroom ${type}` : type;
  const purpose = context.listingType === 'rent' ? 'for rent' : context.listingType === 'sale' ? 'for sale' : '';
  const place = toEnglishText(context.neighborhood);

  return [subject.charAt(0).toUpperCase() + subject.slice(1), purpose, place ? `in ${place}` : '']
    .filter(Boolean)
    .join(' ');
}

export interface DescriptionContext {
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeSqm?: number | null;
  price?: number | null;
  address?: string | null;
  source?: string | null;
}

/**
 * A display description in English. A genuine English description is kept; an
 * Amharic or missing one is replaced with a factual summary built from the
 * record's own fields.
 */
export function englishDescription(
  description: string | null | undefined,
  context: DescriptionContext = {},
): string | null {
  if (description && !isAmharicProse(description)) {
    const cleaned = toEnglishText(description);
    if (cleaned && cleaned.length >= 20) return cleaned;
  }

  const facts: string[] = [];
  const bedrooms = context.bedrooms ?? 0;
  if (bedrooms > 0) facts.push(`${bedrooms} bedroom ${typeLabel(context.propertyType)}`);
  else facts.push(typeLabel(context.propertyType));
  if (context.sizeSqm && Number.isFinite(Number(context.sizeSqm))) {
    facts.push(`${Number(context.sizeSqm).toLocaleString()} m²`);
  }
  if (context.bathrooms && context.bathrooms > 0) {
    facts.push(`${context.bathrooms} bathroom`);
  }

  const place = toEnglishText(context.address);
  const price =
    context.price && Number.isFinite(Number(context.price))
      ? `ETB ${Number(context.price).toLocaleString()}`
      : null;

  const sentence = `${facts.join(', ').replace(/^./, (c) => c.toUpperCase())}${place ? ` in ${place}` : ''}.`;
  return [
    sentence,
    price ? `Offered at ${price}.` : null,
    `Listed through ${context.source ?? 'EstatePlus'}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
