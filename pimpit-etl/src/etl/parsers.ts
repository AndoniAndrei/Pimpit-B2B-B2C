import { NormalizedProduct, PricingRule, SupplierConfig } from '../types/etl.js';
import { cleanText, cleanNumber, normalizePcd, normalizeEt, parseSize, normalizeImages, extractEtFromDescription, applyTransforms } from './normalizer.js';
import { calculatePrice, applyOldPriceFormula } from './pricing.js';

export function parseSupplier1(row: any, supplier: SupplierConfig, rule: PricingRule, transforms: any[]): NormalizedProduct | null {
  const partNumber = cleanText(row['PartNumber']);
  const brand = cleanText(row['Brand']);
  const name = cleanText(row['PartDescription']);
  const rawPrice = cleanNumber(row['Pret client in lei/buc']);
  
  if (!partNumber || !brand || !name || rawPrice === undefined) return null;

  let etOffset = cleanNumber(row['Offset']);
  if (etOffset === undefined) {
    etOffset = extractEtFromDescription(name);
  }

  const stock = cleanNumber(row['7001']) || 0;
  const stockIncoming = cleanNumber(row['On the water']) || 0;

  const images = [];
  if (row['Image URL']) images.push(cleanText(row['Image URL']));
  for (let i = 1; i <= 4; i++) {
    if (row[`Image URL ${i}`]) images.push(cleanText(row[`Image URL ${i}`]));
  }

  const calculatedPrice = calculatePrice(rawPrice, rule);

  return {
    partNumber, brand, name, productType: 'jante',
    diameter: cleanNumber(row['Diameter']),
    width: cleanNumber(row['Width']),
    etOffset,
    centerBore: cleanNumber(row['CenterBore']),
    pcd: normalizePcd(row['PCD']),
    rawPrice, rawCurrency: 'RON', calculatedPrice,
    stock, stockIncoming, images: images.filter(Boolean) as string[],
    supplierId: supplier.id, rawData: row
  };
}

export function parseSupplier2(row: any, supplier: SupplierConfig, rule: PricingRule, transforms: any[]): NormalizedProduct | null {
  const partNumber = cleanText(row['UID']);
  const brand = cleanText(row['BRAND']);
  const design = cleanText(row['DESIGN']) || '';
  const color = cleanText(row['COLOUR']) || '';
  const name = `${brand} ${design} ${color}`.trim();
  const rawPrice = cleanNumber(row['Price (EUR)']);
  
  if (!partNumber || !brand || !name || rawPrice === undefined) return null;

  const holes = cleanText(row['HOLES']);
  const pcdRaw = cleanText(row['PCD']);
  const pcd = holes && pcdRaw ? `${holes}x${pcdRaw}` : undefined;

  const stock = cleanNumber(row['TOTAL STOCK']) || 0;
  const images = row['Image URL'] ? [cleanText(row['Image URL']) as string] : [];

  const calculatedPrice = calculatePrice(rawPrice, rule);

  return {
    partNumber, brand, name, productType: 'jante',
    diameter: cleanNumber(row['Diameter']),
    width: cleanNumber(row['Width']),
    etOffset: cleanNumber(row['ET']),
    centerBore: cleanNumber(row['CB']),
    pcd, color,
    rawPrice, rawCurrency: 'EUR', calculatedPrice,
    stock, stockIncoming: 0, images,
    supplierId: supplier.id, rawData: row
  };
}

export function parseWheeltrade(row: any, supplier: SupplierConfig, rule: PricingRule, transforms: any[]): NormalizedProduct | null {
  const partNumber = cleanText(row['ean']) || cleanText(row['article_number']);
  const brand = cleanText(row['brand']) || cleanText(row['manufacturer']);
  const name = cleanText(row['description']) || cleanText(row['model']);
  const srp = cleanNumber(row['srp']);
  const net = cleanNumber(row['net']);
  
  if (!partNumber || !brand || !name || net === undefined) return null;

  const isAccessories = !!(row['thickness'] || row['thread_size']);
  const productType = isAccessories ? 'accesorii' : 'jante';

  const dualPriceConfig = transforms.find(t => t.transform_type === 'dual_price')?.config;
  const calculatedPrice = calculatePrice(net, rule, { dualPriceConfig, srp });

  const images = [];
  if (row['photo']) images.push(cleanText(row['photo']));
  for (let i = 1; i <= 5; i++) {
    if (row[`photo${i}`]) images.push(cleanText(row[`photo${i}`]));
  }

  return {
    partNumber, brand, name, productType,
    diameter: cleanNumber(row['diameter']),
    width: cleanNumber(row['width']),
    etOffset: cleanNumber(row['et']) || cleanNumber(row['offset']),
    centerBore: cleanNumber(row['cb']) || cleanNumber(row['center_bore']),
    pcd: normalizePcd(row['pcd']),
    color: cleanText(row['color']) || cleanText(row['colour']),
    finish: cleanText(row['finish']) || cleanText(row['surface']),
    rawPrice: net, rawCurrency: 'EUR', calculatedPrice,
    stock: cleanNumber(row['stock']) || cleanNumber(row['quantity']) || 0,
    stockIncoming: cleanNumber(row['stock_incoming']) || 0,
    images: images.filter(Boolean) as string[],
    supplierId: supplier.id, rawData: row
  };
}

export function parseFelgeo(row: any, supplier: SupplierConfig, rule: PricingRule, transforms: any[]): NormalizedProduct | null {
  const partNumber = cleanText(row['indeks']);
  const brand = cleanText(row['producent']);
  const name = cleanText(row['nazwa']);
  const rawPrice = cleanNumber(row['cena_netto']);
  
  if (!partNumber || !brand || !name || rawPrice === undefined) return null;

  const stockProd = cleanNumber(row['stan_magazynowy_producenta']) || 0;
  const stockOwn = cleanNumber(row['stan_magazynowy_własny']) || 0;
  const stock = Math.max(stockProd, stockOwn);

  const images = normalizeImages(row['zdjęcie']);
  const calculatedPrice = calculatePrice(rawPrice, rule);

  return {
    partNumber, brand, name, productType: 'jante',
    diameter: cleanNumber(row['rozmiar']),
    width: cleanNumber(row['szerokosc']),
    widthRear: cleanNumber(row['szerokosc_tyl']),
    etOffset: cleanNumber(row['et']),
    etOffsetRear: cleanNumber(row['et_tyl']),
    centerBore: cleanNumber(row['otwor_srodkowy']),
    pcd: normalizePcd(row['rozstaw']),
    pcdSecondary: normalizePcd(row['rozstaw2']),
    color: cleanText(row['kolor']),
    finish: cleanText(row['wykonczenie']),
    rawPrice, rawCurrency: 'EUR', calculatedPrice,
    stock, stockIncoming: cleanNumber(row['na_drodze']) || 0,
    images, supplierId: supplier.id, rawData: row
  };
}

export function parseAbsWheels(row: any, supplier: SupplierConfig, rule: PricingRule, transforms: any[]): NormalizedProduct | null {
  const mappedRow = applyTransforms(row, transforms);
  
  const partNumber = cleanText(mappedRow['Articlecode']);
  const brand = cleanText(mappedRow['Brand']);
  const name = cleanText(mappedRow['Description']);
  const rawPrice = cleanNumber(mappedRow['price_net']);
  
  if (!partNumber || !brand || !name || rawPrice === undefined) return null;

  const calculatedPrice = calculatePrice(rawPrice, rule);

  return {
    partNumber, brand, name, productType: 'jante',
    diameter: cleanNumber(mappedRow['Diameter']),
    width: cleanNumber(mappedRow['Width']),
    etOffset: cleanNumber(mappedRow['ET']),
    centerBore: cleanNumber(mappedRow['CB']),
    pcd: normalizePcd(mappedRow['PCD']),
    color: cleanText(mappedRow['Color']),
    rawPrice, rawCurrency: 'EUR', calculatedPrice,
    stock: cleanNumber(mappedRow['Stock']) || 0,
    stockIncoming: 0,
    images: mappedRow['ImageURL'] ? [cleanText(mappedRow['ImageURL']) as string] : [],
    supplierId: supplier.id, rawData: row
  };
}

export function parseStatusfalgar(row: any, supplier: SupplierConfig, rule: PricingRule, transforms: any[]): NormalizedProduct | null {
  const partNumber = cleanText(row['ArticleNumber']);
  const brand = cleanText(row['Brand']);
  const name = cleanText(row['Description']);
  const rawPrice = cleanNumber(row['Price']);
  
  if (!partNumber || !brand || !name || rawPrice === undefined) return null;

  const whitelistConfig = transforms.find(t => t.transform_type === 'brand_whitelist')?.config;
  if (whitelistConfig && whitelistConfig.allowed && !whitelistConfig.allowed.includes(brand)) {
    return null; // Ignored brand
  }

  const bolts = cleanText(row['NumberOfBolts']);
  const circle = cleanText(row['BoltCircle']);
  let pcd = circle;
  if (circle && !circle.includes('-') && !circle.includes('x') && bolts) {
    pcd = `${bolts}x${circle}`;
  } else if (circle) {
    pcd = circle.replace('-', 'x');
  }

  const imagePrefixConfig = transforms.find(t => t.transform_type === 'image_url_prefix')?.config;
  const images = [];
  if (row['ImageId'] && imagePrefixConfig) {
    images.push(`${imagePrefixConfig.prefix}${row['ImageId']}`);
  }

  const calculatedPrice = calculatePrice(rawPrice, rule);

  return {
    partNumber, brand, name, productType: 'jante',
    diameter: cleanNumber(row['Diameter']),
    width: cleanNumber(row['Width']),
    etOffset: cleanNumber(row['ET']) || cleanNumber(row['Offset']),
    centerBore: cleanNumber(row['CenterBore']),
    pcd, color: cleanText(row['Color']), finish: cleanText(row['Finish']),
    rawPrice, rawCurrency: 'SEK', calculatedPrice,
    stock: cleanNumber(row['Stock']) || 0, stockIncoming: 0,
    images, supplierId: supplier.id, rawData: row
  };
}

export function parseVeemann(row: any, supplier: SupplierConfig, rule: PricingRule, transforms: any[]): NormalizedProduct | null {
  const partNumber = cleanText(row['PartNumber']);
  const brand = cleanText(row['Brand']);
  const name = cleanText(row['Description']);
  const rawPrice = cleanNumber(row['RRP']);
  
  if (!partNumber || !brand || !name || rawPrice === undefined) return null;

  const size = parseSize(row['Size']);
  const etOffset = cleanNumber(row['Offest']) || cleanNumber(row['Offset']);
  
  const calculatedPrice = calculatePrice(rawPrice, rule);
  let priceOld = undefined;
  if (rule.oldPriceFormula) {
    const old = applyOldPriceFormula(rawPrice, rule.oldPriceFormula);
    if (old > calculatedPrice) priceOld = old;
  }

  return {
    partNumber, brand, name, productType: 'jante',
    diameter: size.diameter, width: size.width,
    etOffset, centerBore: cleanNumber(row['CB']),
    pcd: normalizePcd(row['PCD']) || normalizePcd(row['Fitment']),
    color: cleanText(row['Color/Finish']),
    rawPrice, rawCurrency: 'EUR', calculatedPrice, priceOld,
    stock: cleanNumber(row['Stock']) || 0, stockIncoming: 0,
    images: row['ImageURL'] ? [cleanText(row['ImageURL']) as string] : [],
    supplierId: supplier.id, rawData: row
  };
}

export const PARSER_MAP: Record<string, Function> = {
  'supplier-1': parseSupplier1,
  'supplier-2': parseSupplier2,
  'wheeltrade': parseWheeltrade,
  'felgeo': parseFelgeo,
  'abs-wheels': parseAbsWheels,
  'statusfalgar': parseStatusfalgar,
  'veemann': parseVeemann
};
