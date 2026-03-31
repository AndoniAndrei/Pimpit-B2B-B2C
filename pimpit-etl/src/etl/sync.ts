import { createClient } from '@supabase/supabase-js';
import { SupplierConfig, PricingRule, NormalizedProduct, SyncResult } from '../types/etl.js';
import { buildFeedUrl, buildAuthHeaders, fetchWithRetry, parseCsvRaw, parseJsonRaw } from './driver.js';
import { PARSER_MAP } from './parsers.js';
import { generateSlug } from './normalizer.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function loadSuppliersFromDb(): Promise<SupplierConfig[]> {
  const { data, error } = await supabase.from('suppliers').select('*').eq('is_active', true);
  if (error) throw error;
  return data.map(d => ({
    id: d.id, name: d.name, slug: d.slug, feedUrl: d.feed_url,
    format: d.format, authMethod: d.auth_method, apiKeyRef: d.api_key_ref,
    customerIdRef: d.customer_id_ref, tokenRef: d.token_ref, isActive: d.is_active,
    brandWhitelist: d.brand_whitelist, brandBlacklist: d.brand_blacklist,
    csvDelimiter: d.csv_delimiter || (d.driver_config?.csv_delimiter) || ','
  }));
}

export async function loadPricingRulesFromDb(): Promise<PricingRule[]> {
  const { data, error } = await supabase.from('pricing_rules').select('*').eq('is_active', true);
  if (error) throw error;
  return data.map(d => ({
    supplierId: d.supplier_id, baseDiscount: d.base_discount, baseMultiplier: d.base_multiplier,
    fixedCost: d.fixed_cost, vatMultiplier: d.vat_multiplier, marginMultiplier: d.margin_multiplier,
    finalDivisor: d.final_divisor, minMarginPct: d.min_margin_pct, oldPriceFormula: d.old_price_formula
  }));
}

export async function loadTransformsFromDb(): Promise<any[]> {
  const { data, error } = await supabase.from('supplier_transforms').select('*').eq('is_active', true).order('sort_order');
  if (error) throw error;
  return data;
}

export async function countExistingProducts(): Promise<number> {
  const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

export function deduplicateProducts(products: NormalizedProduct[]): NormalizedProduct[] {
  const map = new Map<string, NormalizedProduct>();
  for (const p of products) {
    const key = `${p.partNumber.toLowerCase()}|${p.brand.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, p);
    } else {
      if (p.calculatedPrice < existing.calculatedPrice) {
        map.set(key, p);
      } else if (p.calculatedPrice === existing.calculatedPrice) {
        if (p.stock > existing.stock) {
          map.set(key, p);
        } else if (p.stock === existing.stock && p.supplierId < existing.supplierId) {
          map.set(key, p);
        }
      }
    }
  }
  return Array.from(map.values());
}

export function runSafetyCheck(newCount: number, existingCount: number) {
  if (newCount < 100) {
    throw new Error(`Safety check failed: Only ${newCount} products found (min 100).`);
  }
  if (existingCount > 0 && newCount < existingCount * 0.5) {
    throw new Error(`Safety check failed: New count ${newCount} is less than 50% of existing ${existingCount}.`);
  }
}

export function generateUniqueSlugs(products: NormalizedProduct[]) {
  const slugs = new Set<string>();
  for (const p of products) {
    let slug = generateSlug(p.brand, p.name, p.diameter, p.width, p.pcd);
    if (slugs.has(slug)) {
      slug = `${slug}-${p.partNumber.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    }
    let counter = 1;
    let finalSlug = slug;
    while (slugs.has(finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }
    slugs.add(finalSlug);
    (p as any).slug = finalSlug;
  }
}

export async function upsertProducts(products: NormalizedProduct[]) {
  const batchSize = 500;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    // Upsert into products
    const productsData = batch.map(p => ({
      part_number: p.partNumber, brand: p.brand, name: p.name, slug: (p as any).slug,
      product_type: p.productType, diameter: p.diameter, width: p.width, width_rear: p.widthRear,
      et_offset: p.etOffset, et_offset_rear: p.etOffsetRear, center_bore: p.centerBore,
      pcd: p.pcd, pcd_secondary: p.pcdSecondary, color: p.color, finish: p.finish,
      price: p.calculatedPrice, price_old: p.priceOld, images: p.images,
      stock: p.stock, stock_incoming: p.stockIncoming, winning_supplier_id: p.supplierId,
      winning_raw_price: p.rawPrice, is_active: true, last_synced_at: new Date().toISOString()
    }));
    
    const { error: err1 } = await supabase.from('products').upsert(productsData, { onConflict: 'part_number,brand' });
    if (err1) throw err1;

    // Upsert into product_sources
    const sourcesData = batch.map(p => ({
      part_number: p.partNumber, brand: p.brand, supplier_id: p.supplierId,
      raw_price: p.rawPrice, raw_currency: p.rawCurrency, calculated_price: p.calculatedPrice,
      stock: p.stock, stock_incoming: p.stockIncoming, raw_data: p.rawData,
      last_seen_at: new Date().toISOString()
    }));
    
    const { error: err2 } = await supabase.from('product_sources').upsert(sourcesData, { onConflict: 'part_number,brand,supplier_id' });
    if (err2) throw err2;
  }
}

export async function markInactiveProducts() {
  // Mark products as inactive if they haven't been synced in the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .lt('last_synced_at', yesterday)
    .eq('is_active', true);
  if (error) throw error;
}

export async function refreshFilterOptions() {
  const { error } = await supabase.rpc('refresh_filter_options');
  if (error) console.error('Failed to refresh filter options:', error);
}

export async function logSyncResult(result: SyncResult) {
  const { error } = await supabase.from('sync_logs').insert({
    supplier_id: result.supplierId, status: result.status,
    products_fetched: result.productsFetched, products_inserted: result.productsInserted,
    products_updated: result.productsUpdated, products_skipped: result.productsSkipped,
    products_before: result.productsBefore, safety_check_passed: result.safetyCheckPassed,
    safety_check_reason: result.safetyCheckReason, error_message: result.errorMessage,
    error_details: result.errorDetails, duration_ms: result.durationMs
  });
  if (error) console.error('Failed to log sync result:', error);
}

export async function syncSupplier(supplier: SupplierConfig, rule: PricingRule, transforms: any[]): Promise<NormalizedProduct[]> {
  const url = buildFeedUrl(supplier);
  const headers = buildAuthHeaders(supplier);
  const rawData = await fetchWithRetry(url, headers, supplier.id);
  
  let rows: any[] = [];
  if (supplier.format === 'csv') {
    rows = parseCsvRaw(rawData, supplier.csvDelimiter);
  } else if (supplier.format === 'json') {
    rows = parseJsonRaw(rawData);
  }

  const parser = PARSER_MAP[supplier.slug];
  if (!parser) throw new Error(`No parser found for ${supplier.slug}`);

  const products: NormalizedProduct[] = [];
  for (const row of rows) {
    const p = parser(row, supplier, rule, transforms);
    if (p) products.push(p);
  }
  return products;
}

export async function syncAllSuppliers() {
  console.log('Starting global sync...');
  const start = Date.now();
  
  const suppliers = await loadSuppliersFromDb();
  const pricingRules = await loadPricingRulesFromDb();
  const transforms = await loadTransformsFromDb();
  const existingCount = await countExistingProducts();

  const results = await Promise.allSettled(suppliers.map(async s => {
    const sStart = Date.now();
    try {
      const rule = pricingRules.find(r => r.supplierId === s.id);
      if (!rule) throw new Error(`No pricing rule for supplier ${s.id}`);
      const sTransforms = transforms.filter(t => t.supplier_id === s.id);
      
      const products = await syncSupplier(s, rule, sTransforms);
      
      await logSyncResult({
        supplierId: s.id, status: 'success', productsFetched: products.length,
        productsInserted: 0, productsUpdated: 0, productsSkipped: 0, productsBefore: 0,
        safetyCheckPassed: true, durationMs: Date.now() - sStart
      });
      return products;
    } catch (e: any) {
      console.error(`Error syncing supplier ${s.id}:`, e);
      await logSyncResult({
        supplierId: s.id, status: 'failed', productsFetched: 0,
        productsInserted: 0, productsUpdated: 0, productsSkipped: 0, productsBefore: 0,
        safetyCheckPassed: false, errorMessage: e.message, durationMs: Date.now() - sStart
      });
      return [];
    }
  }));

  let allProducts: NormalizedProduct[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allProducts = allProducts.concat(r.value);
    }
  }

  console.log(`Fetched ${allProducts.length} total products.`);
  
  const deduplicated = deduplicateProducts(allProducts);
  console.log(`Deduplicated to ${deduplicated.length} products.`);

  try {
    runSafetyCheck(deduplicated.length, existingCount);
    generateUniqueSlugs(deduplicated);
    await upsertProducts(deduplicated);
    await markInactiveProducts();
    await refreshFilterOptions();
    console.log(`Global sync completed in ${Date.now() - start}ms.`);
  } catch (e: any) {
    console.error('Global sync failed at safety/upsert stage:', e);
  }
}
