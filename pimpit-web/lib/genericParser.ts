import { evaluateFormula } from './formulaEvaluator';
import { parseSmartNumber } from './priceParser';
import { normalizeAndJoinPcds } from './pcdUtils';

/**
 * Resolve a template string with {column_name} variable substitution.
 */
export function resolveTemplate(template: string, row: Record<string, any>): string {
  if (!template) return '';
  if (!template.includes('{')) {
    const val = row[template];
    return val !== null && val !== undefined ? String(val).trim() : '';
  }
  const result = template.replace(/\{([^}]+)\}/g, (_m, col) => {
    const val = row[col.trim()];
    if (val === null || val === undefined) return '';
    return String(val).trim();
  });
  return result.replace(/\s{2,}/g, ' ').trim();
}

export interface ExtraFieldMapping {
  label: string;
  column: string;
}

export interface FieldMappings {
  // Required
  part_number: string;
  brand: string;
  name: string;
  price_formula: string;

  // Core wheel fields
  stock?: string;
  stock_incoming?: string;
  diameter?: string;
  width?: string;
  width_rear?: string;
  size_split?: string;  // column with concatenated "DIAMETERxWIDTH" (e.g. "20x10.5")
  pcd?: string;
  et_offset?: string;
  center_bore?: string;
  color?: string;
  finish?: string;

  // Product categorisation
  product_type?: string;  // fixed 'jante'|'accesorii' OR column name
  model?: string;         // template — wheel model name

  // Identification
  ean?: string;

  // Media
  images?: string;
  images_2?: string;
  images_3?: string;
  images_4?: string;
  images_5?: string;
  youtube_link?: string;
  model_3d_url?: string;

  // Physical / spec fields
  description?: string;
  weight?: string;
  max_load?: string;
  discontinued?: string;
  production_method?: string;
  concave_profile?: string;
  cn_code?: string;
  certificate_url?: string;
  tuv_max_load?: string;

  // Import behaviour (not column names)
  price_rounding?: 'none' | 'round' | 'ceil' | 'floor';
  brand_filter?: string[];   // only import rows whose brand matches one of these (empty = all)
  model_filter?: string[];   // only import rows whose model matches one of these (empty = all)

  // Extra/custom fields
  extra_fields?: ExtraFieldMapping[];
}

export interface ParsedProduct {
  partNumber: string;
  brand: string;
  name: string;
  model?: string;
  ean?: string;
  description?: string;
  calculatedPrice: number;
  priceIsZero: boolean;
  rawPrice: number;
  rawCurrency: string;
  stock: number;
  stockIncoming: number;
  diameter?: number;
  width?: number;
  widthRear?: number;
  pcd?: string;
  etOffset?: number;
  centerBore?: number;
  images: string[];
  youtubeLink?: string;
  model3dUrl?: string;
  color?: string;
  finish?: string;
  weight?: number;
  maxLoad?: number;
  discontinued: boolean;
  productionMethod?: string;
  concaveProfile?: string;
  cnCode?: string;
  certificateUrl?: string;
  tuvMaxLoad?: string;
  productType: string;
  customFields: Record<string, string>;
  supplierId: number;
  rawData: Record<string, any>;
  skipReason?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStr(row: Record<string, any>, col?: string, maxLen?: number): string | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (v === undefined || v === null) return undefined;
  let s = String(v).trim();
  if (!s) return undefined;
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function getNum(row: Record<string, any>, col?: string): number | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseSmartNumber(v);
  return n === null ? undefined : n;
}

function getBool(row: Record<string, any>, col?: string): boolean {
  if (!col) return false;
  const v = row[col];
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'tak' || s === 't';
}

/**
 * Clamp a number to the maximum value representable in a PostgreSQL NUMERIC(precision, scale).
 * Prevents "numeric field overflow" errors on insertion.
 */
function clampNum(val: number | undefined, intDigits: number): number | undefined {
  if (val === undefined || val === null || isNaN(val)) return undefined;
  const max = Math.pow(10, intDigits) - 1;
  return Math.min(Math.abs(val), max) * (val < 0 ? -1 : 1);
}

function normalizeImageUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return null;
}

function applyPriceRounding(price: number, mode?: string): number {
  switch (mode) {
    case 'round': return Math.round(price);
    case 'ceil':  return Math.ceil(price);
    case 'floor': return Math.floor(price);
    default:      return price;
  }
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseRow(
  row: Record<string, any>,
  mappings: FieldMappings,
  supplierId: number
): ParsedProduct | null {
  const partNumber = mappings.part_number.includes('{')
    ? resolveTemplate(mappings.part_number, row) || undefined
    : getStr(row, mappings.part_number);

  const brand = mappings.brand.includes('{')
    ? resolveTemplate(mappings.brand, row) || undefined
    : getStr(row, mappings.brand);

  const name = mappings.name.includes('{')
    ? resolveTemplate(mappings.name, row) || undefined
    : getStr(row, mappings.name);

  // partNumber is required for the unique DB key
  if (!partNumber) return null;

  const resolvedBrand = brand || 'Generic';
  const resolvedName  = name  || partNumber;

  // Model field (template or plain column)
  const resolvedModel = mappings.model?.includes('{')
    ? resolveTemplate(mappings.model, row) || undefined
    : getStr(row, mappings.model);

  // ── Brand / model filter ─────────────────────────────────────────────────
  if (mappings.brand_filter?.length) {
    const bf = mappings.brand_filter.map(b => b.trim().toLowerCase()).filter(Boolean);
    if (bf.length && !bf.includes(resolvedBrand.toLowerCase())) return null;
  }
  if (mappings.model_filter?.length && resolvedModel) {
    const mf = mappings.model_filter.map(m => m.trim().toLowerCase()).filter(Boolean);
    if (mf.length && !mf.includes(resolvedModel.toLowerCase())) return null;
  }

  // ── Price ────────────────────────────────────────────────────────────────
  let calculatedPrice = 0;
  let priceIsZero = false;
  let rawPrice = 0;
  let skipReason: string | undefined;
  try {
    const result = evaluateFormula(mappings.price_formula, row);
    if (!result || result <= 0) {
      priceIsZero = true;
      skipReason = `Preț 0 sau negativ (formula: ${mappings.price_formula})`;
    } else {
      calculatedPrice = applyPriceRounding(result, mappings.price_rounding);
    }
    const firstVar = mappings.price_formula.match(/\{([^}]+)\}/)?.[1];
    if (firstVar) rawPrice = getNum(row, firstVar) ?? 0;
  } catch (e: any) {
    priceIsZero = true;
    skipReason = `Eroare formulă preț: ${e.message}`;
  }

  // ── Images ───────────────────────────────────────────────────────────────
  const images: string[] = [];
  for (const key of ['images', 'images_2', 'images_3', 'images_4', 'images_5'] as const) {
    const img = getStr(row, mappings[key]);
    if (!img) continue;
    const url = normalizeImageUrl(img);
    if (url) images.push(url);
  }

  // ── Custom / extra fields ────────────────────────────────────────────────
  const customFields: Record<string, string> = {};
  if (mappings.extra_fields?.length) {
    for (const ef of mappings.extra_fields) {
      const val = getStr(row, ef.column);
      if (val) customFields[ef.label] = val;
    }
  }

  // ── Product type ─────────────────────────────────────────────────────────
  let productType = 'jante';
  if (mappings.product_type) {
    const mapped = row[mappings.product_type];
    productType = mapped ? String(mapped).trim().toLowerCase() : mappings.product_type.toLowerCase();
    // Normalise common aliases
    if (['wheels', 'wheel', 'jante', 'rim', 'rims'].includes(productType)) productType = 'jante';
    else if (['accessories', 'accessory', 'accesorii', 'acc'].includes(productType)) productType = 'accesorii';
    else productType = 'jante'; // safe default
  }

  return {
    partNumber,
    brand: resolvedBrand,
    name: resolvedName,
    model: resolvedModel,
    ean: getStr(row, mappings.ean),
    description: mappings.description?.includes('{')
      ? resolveTemplate(mappings.description, row) || undefined
      : getStr(row, mappings.description),
    calculatedPrice,
    priceIsZero,
    rawPrice,
    skipReason,
    rawCurrency: 'RON',
    stock:         getNum(row, mappings.stock) ?? 0,
    stockIncoming: getNum(row, mappings.stock_incoming) ?? 0,
    // Clamp numerics to avoid PostgreSQL overflow
    // If size_split is mapped, parse "DIAMETERxWIDTH" as fallback for missing diameter/width
    ...(() => {
      let diameter = clampNum(getNum(row, mappings.diameter), 4);
      let width    = clampNum(getNum(row, mappings.width),    4);
      if (mappings.size_split && (diameter === undefined || width === undefined)) {
        const raw = getStr(row, mappings.size_split);
        if (raw) {
          // Supports separators: x X × (with optional spaces)
          const parts = raw.replace(/,/g, '.').split(/\s*[xX×]\s*/);
          if (parts.length >= 2) {
            const d = parseFloat(parts[0]);
            const w = parseFloat(parts[1]);
            if (!isNaN(d) && diameter === undefined) diameter = clampNum(d, 4);
            if (!isNaN(w) && width    === undefined) width    = clampNum(w, 4);
          }
        }
      }
      return { diameter, width };
    })(),
    widthRear:  clampNum(getNum(row, mappings.width_rear),  4),
    pcd: (() => {
      const raw = mappings.pcd?.includes('{')
        ? resolveTemplate(mappings.pcd, row) || undefined
        : getStr(row, mappings.pcd);
      if (!raw) return undefined;
      return normalizeAndJoinPcds(raw) ?? undefined;
    })(),
    etOffset:   clampNum(getNum(row, mappings.et_offset),   5),
    centerBore: clampNum(getNum(row, mappings.center_bore), 5),
    images,
    youtubeLink:    getStr(row, mappings.youtube_link),
    model3dUrl:     getStr(row, mappings.model_3d_url),
    color: mappings.color?.includes('{')
      ? resolveTemplate(mappings.color, row) || undefined
      : getStr(row, mappings.color),
    finish: mappings.finish?.includes('{')
      ? resolveTemplate(mappings.finish, row) || undefined
      : getStr(row, mappings.finish),
    weight:           clampNum(getNum(row, mappings.weight),    7),
    maxLoad:          clampNum(getNum(row, mappings.max_load),   9) as number | undefined,
    discontinued:     getBool(row, mappings.discontinued),
    productionMethod: getStr(row, mappings.production_method),
    concaveProfile:   getStr(row, mappings.concave_profile),
    cnCode:           getStr(row, mappings.cn_code),
    certificateUrl:   getStr(row, mappings.certificate_url),
    tuvMaxLoad:       getStr(row, mappings.tuv_max_load),
    productType,
    customFields,
    supplierId,
    rawData: row,
  };
}
