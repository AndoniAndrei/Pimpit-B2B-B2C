/**
 * Normalizatoare partajate de motorul de import v2 și de scripturile de seed.
 * Pure functions — testate în tests/normalizers.test.ts.
 */

// ── Slug (oglindește funcția SQL slugify() din migrația 012) ─────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritice
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Unități ──────────────────────────────────────────────────────────────────

const MM_PER: Record<string, number> = {
  mm: 1,
  cm: 10,
  inch: 25.4,
};

const KG_PER: Record<string, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
};

/** Conversie de unități (lungime: mm/cm/inch; masă: kg/g/lb). */
export function convertUnit(value: number, from: string, to: string): number {
  if (from === to) return value;
  if (from in MM_PER && to in MM_PER) return (value * MM_PER[from]) / MM_PER[to];
  if (from in KG_PER && to in KG_PER) return (value * KG_PER[from]) / KG_PER[to];
  throw new Error(`Conversie de unități nesuportată: ${from} → ${to}`);
}

// ── Valută ───────────────────────────────────────────────────────────────────

export type CurrencyRates = Record<string, number>; // code → rate_to_ron

/** Convertește o sumă în RON folosind currency_rates. */
export function toRon(amount: number, currency: string, rates: CurrencyRates): number {
  const code = currency.trim().toUpperCase();
  const rate = rates[code];
  if (rate === undefined) throw new Error(`Curs valutar lipsă pentru ${code}`);
  return amount * rate;
}

// ── Brand ────────────────────────────────────────────────────────────────────

export interface BrandLookup {
  name: string;
  aliases: string[];
}

/**
 * Rezolvă textul de brand dintr-un feed la numele canonic folosind
 * brands.name + brands.aliases (case-insensitive). Returnează null când
 * brandul e necunoscut (decizia — auto-creare sau eroare — aparține apelantului).
 */
export function resolveBrand(raw: string, brands: BrandLookup[]): string | null {
  const needle = raw.trim().toLowerCase();
  if (!needle) return null;
  for (const b of brands) {
    if (b.name.toLowerCase() === needle) return b.name;
    if (b.aliases.some(a => a.toLowerCase() === needle)) return b.name;
  }
  return null;
}

// ── Specificații jantă: "R19, J9.5, ET35" ────────────────────────────────────

export interface WheelSpec {
  diameter: number;   // inch
  width: number;      // inch
  offset: number | null; // mm (ET)
}

const WHEEL_SPEC_RE = /R\s*(\d{2}(?:[.,]\d)?)\s*[,;]?\s*J\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:[,;]?\s*ET\s*(-?\d{1,3}(?:[.,]\d+)?))?/i;

/** Parsează formatul galeriei FI "R19, J9.5, ET35" (ET opțional). */
export function parseWheelSpec(raw: string | null | undefined): WheelSpec | null {
  if (!raw) return null;
  const m = raw.match(WHEEL_SPEC_RE);
  if (!m) return null;
  const num = (s: string) => parseFloat(s.replace(',', '.'));
  const diameter = num(m[1]);
  const width = num(m[2]);
  if (!isFinite(diameter) || diameter < 10 || diameter > 30) return null;
  if (!isFinite(width) || width < 3 || width > 16) return null;
  const offset = m[3] !== undefined ? num(m[3]) : null;
  if (offset !== null && (offset < -100 || offset > 150)) return null;
  return { diameter, width, offset };
}

// ── Specificații anvelopă: "245/40R19" (+ brand/model în față) ──────────────

export interface TireSpec {
  width: number;        // mm
  aspect: number;       // %
  rimDiameter: number;  // inch
  /** Textul dinaintea dimensiunii — de regulă "Brand Model". */
  label: string | null;
}

const TIRE_SPEC_RE = /(\d{3})\s*\/\s*(\d{2,3})\s*Z?R\s*(\d{2}(?:[.,]\d)?)/i;

/** Parsează "Lexani LX-Twenty 245/40R19 26.7"x9.6"" → {245, 40, 19, "Lexani LX-Twenty"}. */
export function parseTireSpec(raw: string | null | undefined): TireSpec | null {
  if (!raw) return null;
  const m = raw.match(TIRE_SPEC_RE);
  if (!m || m.index === undefined) return null;
  const width = parseInt(m[1], 10);
  const aspect = parseInt(m[2], 10);
  const rimDiameter = parseFloat(m[3].replace(',', '.'));
  if (width < 105 || width > 445) return null;
  if (aspect < 20 || aspect > 90) return null;
  if (rimDiameter < 10 || rimDiameter > 30) return null;
  const label = raw.slice(0, m.index).trim() || null;
  return { width, aspect, rimDiameter, label };
}

// ── Nume de mărci auto (galeria FI are variații de caz: DACIA, INFINITI) ────

const MAKE_CANONICAL: Record<string, string> = {
  'bmw': 'BMW',
  'gmc': 'GMC',
  'mg': 'MG',
  'ram': 'RAM',
  'seat': 'SEAT',
  'mini': 'MINI',
  'amc': 'AMC',
  'am general': 'AM General',
  'mclaren': 'McLaren',
  'infiniti': 'Infiniti',
  'dacia': 'Dacia',
  'opel/vauxhall': 'Opel/Vauxhall',
  'rolls-royce': 'Rolls-Royce',
  'mercedes-benz': 'Mercedes-Benz',
  'alfa romeo': 'Alfa Romeo',
  'aston martin': 'Aston Martin',
  'land rover': 'Land Rover',
};

/** Normalizează numele mărcii de vehicul la forma canonică. */
export function normalizeMakeName(raw: string): string {
  const cleaned = raw.trim().replace(/\s{2,}/g, ' ');
  if (!cleaned) return cleaned;
  const known = MAKE_CANONICAL[cleaned.toLowerCase()];
  if (known) return known;
  // Title Case pe cuvinte, păstrând separatorii - și /
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-z])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

/** Normalizează "None"/"" la null pentru câmpurile calitative din galerie. */
export function noneToNull(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s || s.toLowerCase() === 'none') return null;
  return s;
}
