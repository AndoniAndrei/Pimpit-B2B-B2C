import { evaluateFormula } from './formulaEvaluator';

export interface FieldMappings {
  part_number: string;
  brand: string;
  name: string;
  price_formula: string;       // e.g. "{Price_EUR} * 5 * 1.19"
  stock?: string;
  stock_incoming?: string;
  diameter?: string;
  width?: string;
  width_rear?: string;
  pcd?: string;
  et_offset?: string;
  center_bore?: string;
  images?: string;             // single column; use images_2..images_5 for extras
  images_2?: string;
  images_3?: string;
  images_4?: string;
  images_5?: string;
  color?: string;
  finish?: string;
  product_type?: string;       // fixed value or column name
}

export interface ParsedProduct {
  partNumber: string;
  brand: string;
  name: string;
  calculatedPrice: number;
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
  supplierId: number;
  rawData: Record<string, any>;
}

function getNum(row: Record<string, any>, col?: string): number | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? undefined : n;
}

function getStr(row: Record<string, any>, col?: string): string | undefined {
  if (!col) return undefined;
  const v = row[col];
  if (v === undefined || v === null) return undefined;
  return String(v).trim() || undefined;
}

export function parseRow(
  row: Record<string, any>,
  mappings: FieldMappings,
  supplierId: number
): ParsedProduct | null {
  const partNumber = getStr(row, mappings.part_number);
  const brand = getStr(row, mappings.brand);
  const name = getStr(row, mappings.name);

  if (!partNumber || !brand || !name) return null;

  let calculatedPrice: number;
  let rawPrice = 0;
  try {
    calculatedPrice = evaluateFormula(mappings.price_formula, row);
    // Try to extract a "raw price" from the first variable in the formula
    const firstVar = mappings.price_formula.match(/\{([^}]+)\}/)?.[1];
    if (firstVar) rawPrice = getNum(row, firstVar) ?? 0;
  } catch {
    return null;
  }

  if (calculatedPrice <= 0) return null;

  const images: string[] = [];
  for (const key of ['images', 'images_2', 'images_3', 'images_4', 'images_5'] as const) {
    const img = getStr(row, mappings[key]);
    if (img) images.push(img);
  }

  const productType = mappings.product_type
    ? (row[mappings.product_type] || mappings.product_type)
    : 'jante';

  return {
    partNumber,
    brand,
    name,
    calculatedPrice,
    rawPrice,
    rawCurrency: 'RON',
    stock: getNum(row, mappings.stock) ?? 0,
    stockIncoming: getNum(row, mappings.stock_incoming) ?? 0,
    diameter: getNum(row, mappings.diameter),
    width: getNum(row, mappings.width),
    widthRear: getNum(row, mappings.width_rear),
    pcd: getStr(row, mappings.pcd),
    etOffset: getNum(row, mappings.et_offset),
    centerBore: getNum(row, mappings.center_bore),
    images,
    color: getStr(row, mappings.color),
    finish: getStr(row, mappings.finish),
    productType: String(productType),
    supplierId,
    rawData: row,
  };
}
