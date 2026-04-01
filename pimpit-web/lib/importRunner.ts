import Papa from 'papaparse';
import { parseRow, FieldMappings, ParsedProduct } from './genericParser';
import { createClient } from '@/lib/supabase/server';

export interface ImportResult {
  supplierId: number;
  supplierName: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

function generateSlug(brand: string, name: string, diameter?: number, width?: number, pcd?: string): string {
  const parts = [brand, name, diameter ? `${diameter}` : '', width ? `${width}` : '', pcd || '']
    .filter(Boolean)
    .join(' ');
  return parts
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

function deduplicateProducts(products: ParsedProduct[]): ParsedProduct[] {
  const map = new Map<string, ParsedProduct>();
  for (const p of products) {
    const key = `${p.partNumber.toLowerCase()}|${p.brand.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing || p.calculatedPrice < existing.calculatedPrice) {
      map.set(key, p);
    }
  }
  return Array.from(map.values());
}

function generateUniqueSlugs(products: ParsedProduct[]): Map<ParsedProduct, string> {
  const slugMap = new Map<ParsedProduct, string>();
  const used = new Set<string>();
  for (const p of products) {
    let slug = generateSlug(p.brand, p.name, p.diameter, p.width, p.pcd);
    if (used.has(slug)) {
      slug = `${slug}-${p.partNumber.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    }
    let counter = 1;
    let final = slug;
    while (used.has(final)) final = `${slug}-${counter++}`;
    used.add(final);
    slugMap.set(p, final);
  }
  return slugMap;
}

async function fetchFeed(supplier: any): Promise<string> {
  let url: string = supplier.feed_url;
  const headers: Record<string, string> = {};

  const dc = supplier.driver_config || {};

  if (supplier.auth_method === 'api_key' && supplier.api_key_ref) {
    const key = process.env[supplier.api_key_ref] || dc.api_key;
    if (key) url = url.replace('{API_KEY}', key);
  }
  if (supplier.token_ref && url.includes('{TOKEN}')) {
    const token = process.env[supplier.token_ref] || dc.token;
    if (token) url = url.replace('{TOKEN}', token);
  }
  if (supplier.auth_method === 'basic_auth') {
    const user = process.env[supplier.customer_id_ref] || dc.customer_id;
    const pass = process.env[supplier.token_ref] || dc.token;
    if (user && pass) {
      headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    }
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

export async function runImport(supplierId: number): Promise<ImportResult> {
  const start = Date.now();
  const supabase = createClient();
  const errors: string[] = [];

  const { data: supplier, error: supErr } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .single();

  if (supErr || !supplier) throw new Error('Furnizorul nu a fost găsit');

  const dc = supplier.driver_config || {};
  const mappings: FieldMappings = dc.field_mappings;
  if (!mappings) throw new Error('Nu există configurare de câmpuri pentru acest furnizor. Configurează-l mai întâi.');

  const rawText = await fetchFeed(supplier);

  let rows: Record<string, any>[] = [];
  if (supplier.format === 'csv') {
    const delimiter = dc.csv_delimiter || supplier.csv_delimiter || ',';
    const parsed = Papa.parse<Record<string, any>>(rawText, {
      header: true,
      skipEmptyLines: true,
      delimiter,
    });
    rows = parsed.data;
  } else if (supplier.format === 'json') {
    const json = JSON.parse(rawText);
    rows = Array.isArray(json) ? json : Object.values(json).find(Array.isArray) as any[] || [];
  }

  const products: ParsedProduct[] = [];
  for (const row of rows) {
    try {
      const p = parseRow(row, mappings, supplierId);
      if (p) products.push(p);
    } catch (e: any) {
      errors.push(e.message);
    }
  }

  const deduplicated = deduplicateProducts(products);
  const slugMap = generateUniqueSlugs(deduplicated);

  const batchSize = 500;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < deduplicated.length; i += batchSize) {
    const batch = deduplicated.slice(i, i + batchSize);

    const productsData = batch.map(p => ({
      part_number: p.partNumber,
      brand: p.brand,
      name: p.name,
      slug: slugMap.get(p)!,
      product_type: p.productType,
      diameter: p.diameter ?? null,
      width: p.width ?? null,
      width_rear: p.widthRear ?? null,
      et_offset: p.etOffset ?? null,
      center_bore: p.centerBore ?? null,
      pcd: p.pcd ?? null,
      color: p.color ?? null,
      finish: p.finish ?? null,
      price: p.calculatedPrice,
      images: p.images,
      stock: p.stock,
      stock_incoming: p.stockIncoming,
      winning_supplier_id: p.supplierId,
      winning_raw_price: p.rawPrice,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('products')
      .upsert(productsData, { onConflict: 'part_number,brand' });

    if (error) {
      errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
    } else {
      inserted += batch.length;
    }

    const sourcesData = batch.map(p => ({
      part_number: p.partNumber,
      brand: p.brand,
      supplier_id: p.supplierId,
      raw_price: p.rawPrice,
      raw_currency: p.rawCurrency,
      calculated_price: p.calculatedPrice,
      stock: p.stock,
      stock_incoming: p.stockIncoming,
      raw_data: p.rawData,
      last_seen_at: new Date().toISOString(),
    }));

    await supabase.from('product_sources').upsert(sourcesData, { onConflict: 'part_number,brand,supplier_id' });
  }

  // Refresh filter options
  await supabase.rpc('refresh_filter_options').catch(() => {});

  // Log sync result
  await supabase.from('sync_logs').insert({
    supplier_id: supplierId,
    status: errors.length === 0 ? 'success' : 'failed',
    products_fetched: rows.length,
    products_inserted: inserted,
    products_updated: updated,
    products_skipped: rows.length - products.length,
    safety_check_passed: true,
    error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
    duration_ms: Date.now() - start,
  });

  return {
    supplierId,
    supplierName: supplier.name,
    fetched: rows.length,
    inserted,
    updated,
    skipped: rows.length - products.length,
    errors: errors.slice(0, 10),
    durationMs: Date.now() - start,
  };
}
