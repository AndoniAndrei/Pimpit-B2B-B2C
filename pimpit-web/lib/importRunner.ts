import Papa from 'papaparse';
import { createServerClient } from '@supabase/ssr';
import { parseRow, FieldMappings, ParsedProduct } from './genericParser';

// ─── Supabase admin client (service role, bypasses RLS) ────────────────────

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  supplierId: number;
  supplierName: string;
  fetched: number;
  parsed: number;
  upserted: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateSlug(brand: string, name: string, partNumber: string): string {
  return `${brand} ${name} ${partNumber}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 380);
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
    let base = generateSlug(p.brand, p.name, p.partNumber);
    let slug = base;
    let counter = 1;
    while (used.has(slug)) slug = `${base}-${counter++}`;
    used.add(slug);
    slugMap.set(p, slug);
  }
  return slugMap;
}

async function fetchFeed(supplier: any): Promise<string> {
  let url: string = supplier.feed_url;
  const headers: Record<string, string> = {};
  const dc = supplier.driver_config || {};

  // Resolve API key placeholder from env or stored config
  if (supplier.auth_method === 'api_key') {
    const key = (supplier.api_key_ref ? process.env[supplier.api_key_ref] : null) || dc.api_key || '';
    if (key) url = url.includes('{API_KEY}') ? url.replace('{API_KEY}', key) : url;
  }

  // Resolve token placeholder
  const token = (supplier.token_ref ? process.env[supplier.token_ref] : null) || dc.token || '';
  if (token && url.includes('{TOKEN}')) url = url.replace('{TOKEN}', token);

  // Basic auth header
  if (supplier.auth_method === 'basic_auth') {
    const user = (supplier.customer_id_ref ? process.env[supplier.customer_id_ref] : null) || dc.customer_id || '';
    const pass = token;
    if (user && pass) {
      headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseRawData(text: string, format: string, delimiter: string): Record<string, any>[] {
  if (format === 'json') {
    const json = JSON.parse(text);
    if (Array.isArray(json)) return json;
    // Find first array property
    for (const key of Object.keys(json)) {
      if (Array.isArray(json[key])) return json[key];
    }
    return [];
  }

  // CSV
  const result = Papa.parse<Record<string, any>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter || ',',
    transformHeader: (h) => h.trim(), // trim whitespace from headers
  });

  return result.data;
}

// ─── Main import function ───────────────────────────────────────────────────

export async function runImport(supplierId: number): Promise<ImportResult> {
  const start = Date.now();
  const db = makeAdminClient();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Load supplier config
  const { data: supplier, error: supErr } = await db
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .single();

  if (supErr || !supplier) {
    throw new Error(`Furnizorul #${supplierId} nu a fost găsit`);
  }

  const dc = supplier.driver_config || {};
  const mappings: FieldMappings = dc.field_mappings;

  if (!mappings?.part_number || !mappings?.brand || !mappings?.name || !mappings?.price_formula) {
    throw new Error(
      'Configurarea câmpurilor este incompletă. Mergi la Importuri → Configurează și completează câmpurile obligatorii.'
    );
  }

  // Fetch feed
  let rawText: string;
  try {
    rawText = await fetchFeed(supplier);
  } catch (e: any) {
    throw new Error(`Nu s-a putut descărca feed-ul: ${e.message}`);
  }

  // Parse raw data
  let rows: Record<string, any>[];
  try {
    const delimiter = dc.csv_delimiter || supplier.csv_delimiter || ',';
    rows = parseRawData(rawText, supplier.format, delimiter);
  } catch (e: any) {
    throw new Error(`Eroare la parsarea fișierului: ${e.message}`);
  }

  if (rows.length === 0) {
    throw new Error('Feed-ul nu conține date sau formatul este greșit.');
  }

  // Parse each row
  const products: ParsedProduct[] = [];
  let skippedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const p = parseRow(rows[i], mappings, supplierId);
      if (p) {
        products.push(p);
      } else {
        skippedRows++;
      }
    } catch (e: any) {
      skippedRows++;
      if (errors.length < 10) errors.push(`Rând ${i + 2}: ${e.message}`);
    }
  }

  if (products.length === 0) {
    throw new Error(
      `Niciun produs valid găsit din ${rows.length} rânduri. ` +
      `Verifică maparea câmpurilor. Primele erori: ${errors.slice(0, 3).join('; ')}`
    );
  }

  // Deduplicate
  const deduplicated = deduplicateProducts(products);
  const slugMap = generateUniqueSlugs(deduplicated);

  // Check if custom_fields column exists (migration might not have run)
  const { error: colCheckErr } = await db
    .from('products')
    .select('custom_fields')
    .limit(1);
  const hasCustomFields = !colCheckErr;

  // Upsert in batches
  const BATCH = 250;
  let upserted = 0;

  for (let i = 0; i < deduplicated.length; i += BATCH) {
    const batch = deduplicated.slice(i, i + BATCH);

    const productsData = batch.map(p => {
      const record: Record<string, any> = {
        part_number: p.partNumber,
        brand: p.brand,
        name: p.name,
        slug: slugMap.get(p)!,
        product_type: p.productType as any,
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
      };
      if (hasCustomFields && Object.keys(p.customFields).length > 0) {
        record.custom_fields = p.customFields;
      }
      return record;
    });

    const { error: upsertErr } = await db
      .from('products')
      .upsert(productsData, { onConflict: 'part_number,brand' });

    if (upsertErr) {
      errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${upsertErr.message}`);
      continue;
    }
    upserted += batch.length;

    // Upsert product_sources for audit
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

    const { error: srcErr } = await db
      .from('product_sources')
      .upsert(sourcesData, { onConflict: 'part_number,brand,supplier_id' });

    if (srcErr) warnings.push(`product_sources batch ${Math.floor(i / BATCH) + 1}: ${srcErr.message}`);
  }

  // Update supplier last_sync stats
  await db
    .from('suppliers')
    .update({ last_sync_at: new Date().toISOString(), last_product_count: upserted })
    .eq('id', supplierId);

  // Refresh materialized view (non-critical)
  try {
    await db.rpc('refresh_filter_options');
  } catch {
    warnings.push('refresh_filter_options a eșuat — filtrele vor fi actualizate la următorul import');
  }

  const durationMs = Date.now() - start;

  // Log sync result
  await db.from('sync_logs').insert({
    supplier_id: supplierId,
    status: errors.length === 0 ? 'success' : 'failed',
    products_fetched: rows.length,
    products_inserted: upserted,
    products_updated: 0,
    products_skipped: skippedRows,
    safety_check_passed: true,
    error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
    duration_ms: durationMs,
  });

  return {
    supplierId,
    supplierName: supplier.name,
    fetched: rows.length,
    parsed: products.length,
    upserted,
    skipped: skippedRows,
    errors: errors.slice(0, 20),
    warnings,
    durationMs,
  };
}
