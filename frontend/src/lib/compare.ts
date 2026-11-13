// Compare tray — persisted in localStorage so a user can build up to three
// properties to compare, anywhere in the app, and land back on the compare
// page with their selection intact.

export interface CompareProperty {
  id: string;
  title: string;
  location: string;
  neighborhood: string;
  price: number;
  pricePerSqm: number;
  size: number;
  bedrooms: number;
  bathrooms: number;
  rentalYield: number;
  marketValue: number;
  image: string;
}

const STORAGE_KEY = 'realestate.compare.v1';
export const MAX_COMPARE = 3;

export function getCompareList(): CompareProperty[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CompareProperty[]) : [];
  } catch {
    return [];
  }
}

function persist(list: CompareProperty[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * Add a property to the compare tray. When the tray is full, the earliest
 * property is dropped so the most recent selection always wins.
 */
export function addToCompare(property: CompareProperty): CompareProperty[] {
  const list = getCompareList();
  const next = list.some((p) => p.id === property.id)
    ? list
    : list.length >= MAX_COMPARE
      ? [...list.slice(0, MAX_COMPARE - 1), property]
      : [...list, property];
  persist(next);
  return next;
}

export function removeFromCompare(id: string): CompareProperty[] {
  const next = getCompareList().filter((p) => p.id !== id);
  persist(next);
  return next;
}

export function clearCompare(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasInCompare(id: string): boolean {
  return getCompareList().some((p) => p.id === id);
}