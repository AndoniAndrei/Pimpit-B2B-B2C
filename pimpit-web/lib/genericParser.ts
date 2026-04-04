import { evaluateFormula } from './formulaEvaluator';
import { parseSmartNumber } from './priceParser';

/**
 * Resolve a template string with {column_name} variable substitution.
 * Supports plain column names (select from dropdown) OR templates like:
 *   "{diameter}\" {pcd} {brand} - {name}"
 *   "{width}/{et_offset}"
 * Returns trimmed result with collapsed spaces.
 */
export function resolveTemplate(template: string, row: Record<string, any>): string {
  if (!template) return '';
  // If template contains no braces, treat as a plain column name
  if (!template.includes('{')) {
    const val = row[template];
    return val !== null && val !== undefined ? String(val).trim() : '';
  }
  // Replace all {column} tokens
  const result = template.replace(/\{([^}]+)\}/g, (_m, col) => {
    const val = row[col.trim()];
    if (val === null || val === undefined) return '';
    return String(val).trim();
  });
  // Collapse multiple spaces and trim
  return result.replace(/\s{2,}/g, ' ').trim();
}

export interface ExtraFieldMapping {
  label: string;   // Name stored in custom_fields (e.g. "Culoare Specială")
  column: string;  // CSV column name
}

export interface FieldMappings {
  // Required
  part_number: string;
  brand: string;
  name: string;
  price_formula: string; // e.g. "{Price_EUR} * 5 * 1.19"

  // Optional standard fields
  stock?: string;
  stock_incoming?: string;
  diameter?: string;
  width?: string;
  width_rear?: string;
  pcd?: string;
  et_offset?: string;
  center_bore?: string;
  color?: string;
  finish?: string;
  product_type?: string;

  // Images — up to 5 columns
  images?: string;
  images_2?: string;
  images_3?: string;
  images_4?: string;
  images_5?: string;

  // Extra/custom fields the user wants to preserve
  extra_fields?: ExtraFieldMapping[];
}

export interface ParsedProduct {
  partNumber: string;
  brand: string;
  name: string;
  calculatedPrice: number;
  priceIsZero: boolean;       // true = price failed/0 → import as inactive
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
  color?: string;
  finish?: string;
  productType: string;
  customFields: Record<string, string>;
  supplierId: number;
  rawData: Record<string, any>;
  skipReason?: string;        // why this row was partially problematic
}

function getStr(row: Record<string, any>, col?: string): string | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function getNum(row: Record<string, any>, col?: string): number | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseSmartNumber(v);
  return n === null ? undefined : n;
}

/**
 * Normalise a raw image URL from a supplier CSV:
 * - protocol-relative "//cdn.com/img.jpg" → "https://cdn.com/img.jpg"
 * - absolute http/https URLs → kept as-is
 * - relative paths or empty → null (discard)
 */
function normalizeImageUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return null; // relative path — cannot use
}

export function parseRow(
  row: Record<string, any>,
  mappings: FieldMappings,
  supplierId: number
): ParsedProduct | null {
  // Support both plain column and template for text fields
  const partNumber = mappings.part_number.includes('{')
    ? resolveTemplate(mappings.part_number, row) || undefined
    : getStr(row, mappings.part_number);
  const brand = mappings.brand.includes('{')
    ? resolveTemplate(mappings.brand, row) || undefined
    : getStr(row, mappings.brand);
  const name = mappings.name.includes('{')
    ? resolveTemplate(mappings.name, row) || undefined
    : getStr(row, mappings.name);

  // partNumber is the minimum requirement for a unique DB key — skip if absent
  if (!partNumber) return null;

  // Use fallbacks for brand and name if missing
  const resolvedBrand = brand || 'Generic';
  const resolvedName = name || partNumber;

  // Evaluate price formula — zero/invalid price → import as inactive, not skip
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
      calculatedPrice = result;
    }
    const firstVar = mappings.price_formula.match(/\{([^}]+)\}/)?.[1];
    if (firstVar) rawPrice = getNum(row, firstVar) ?? 0;
  } catch (e: any) {
    priceIsZero = true;
    skipReason = `Eroare formulă preț: ${e.message}`;
  }

  // Collect images — normalise URLs before storing
  const images: string[] = [];
  for (const key of ['images', 'images_2', 'images_3', 'images_4', 'images_5'] as const) {
    const img = getStr(row, mappings[key]);
    if (!img) continue;
    const url = normalizeImageUrl(img);
    if (url) images.push(url);
  }

  // Collect custom/extra fields
  const customFields: Record<string, string> = {};
  if (mappings.extra_fields?.length) {
    for (const ef of mappings.extra_fields) {
      const val = getStr(row, ef.column);
      if (val) customFields[ef.label] = val;
    }
  }

  // Product type — fixed value or mapped column
  let productType = 'jante';
  if (mappings.product_type) {
    const mapped = row[mappings.product_type];
    productType = mapped ? String(mapped).trim() : mappings.product_type;
  }

  return {
    partNumber,
    brand: resolvedBrand,
    name: resolvedName,
    calculatedPrice,
    priceIsZero,
    rawPrice,
    skipReason,
    rawCurrency: 'RON',
    stock: getNum(row, mappings.stock) ?? 0,
    stockIncoming: getNum(row, mappings.stock_incoming) ?? 0,
    diameter: getNum(row, mappings.diameter),
    width: getNum(row, mappings.width),
    widthRear: getNum(row, mappings.width_rear),
    pcd: mappings.pcd?.includes('{') ? resolveTemplate(mappings.pcd, row) || undefined : getStr(row, mappings.pcd),
    etOffset: getNum(row, mappings.et_offset),
    centerBore: getNum(row, mappings.center_bore),
    images,
    color: mappings.color?.includes('{') ? resolveTemplate(mappings.color, row) || undefined : getStr(row, mappings.color),
    finish: mappings.finish?.includes('{') ? resolveTemplate(mappings.finish, row) || undefined : getStr(row, mappings.finish),
    productType,
    customFields,
    supplierId,
    rawData: row,
  };
}
