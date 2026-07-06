/**
 * Import engine v2 — pipeline-ul unui import_job:
 *   fetch → snapshot (Storage) → parse → map → validate → stage [→ publish]
 *
 * Rulează in-process (Faza 2). Faza 3 mută exact același cod într-un worker
 * separat — contractul e rândul din import_jobs, nu transportul.
 * Publish/rollback sunt funcții SQL atomice (migrația 017), apelate prin RPC.
 */
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { parseFeedBuffer } from '../../feedParser';
import {
  mapRow, dedupeMappedRows,
  type MappingContext, type MappedRow, type FieldMappingLite,
  type TransformRuleLite, type AttributeDefLite, type BrandLookupWithId,
} from './mapper';

function makeAdminClient(): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  ) as unknown as SupabaseClient;
}

const RAW_ROW_BATCH = 1000;
const STAGED_BATCH = 500;
const ERROR_CAP = 5000; // nu umplem import_errors la feed-uri complet greșite

// ── Tipuri interne ───────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  supplier_id: number;
  feed_id: number | null;
  profile_id: number | null;
  mode: 'dry_run' | 'staged' | 'direct';
  status: string;
  snapshot_path: string | null;
}

interface ImportError {
  job_id: string;
  row_index: number | null;
  phase: 'fetch' | 'parse' | 'map' | 'validate' | 'stage' | 'publish';
  severity: 'warning' | 'error' | 'fatal';
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface PipelineResult {
  jobId: string;
  status: string;
  rowsTotal: number;
  rowsMapped: number;
  rowsError: number;
  staged: { create: number; update: number; unchanged: number; deactivate: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function setJob(db: SupabaseClient, jobId: string, patch: Record<string, unknown>) {
  await db.from('import_jobs').update(patch).eq('id', jobId);
}

async function fail(db: SupabaseClient, jobId: string, phase: ImportError['phase'], message: string): Promise<never> {
  await db.from('import_errors').insert({
    job_id: jobId, row_index: null, phase, severity: 'fatal', code: 'FATAL', message: message.slice(0, 2000),
  });
  await setJob(db, jobId, { status: 'failed', error_message: message.slice(0, 2000), finished_at: new Date().toISOString() });
  throw new Error(message);
}

// ── Fetch feed (aceeași semantică de auth ca v1) ─────────────────────────────

interface SupplierAuthRow {
  auth_method: string | null;
  api_key_ref: string | null;
  token_ref: string | null;
  customer_id_ref: string | null;
  driver_config: Record<string, unknown> | null;
}

async function fetchFeedBuffer(
  feedUrl: string,
  supplier: SupplierAuthRow,
  authMethod: string
): Promise<Buffer> {
  let url = feedUrl;
  const dc = (supplier.driver_config ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/csv,application/json,*/*;q=0.8',
  };

  const apiKey = (supplier.api_key_ref ? process.env[supplier.api_key_ref] : null) || dc.api_key || '';
  const token = (supplier.token_ref ? process.env[supplier.token_ref] : null) || dc.token || '';
  if (apiKey && url.includes('{API_KEY}')) url = url.replace('{API_KEY}', apiKey);
  if (token && url.includes('{TOKEN}')) url = url.replace('{TOKEN}', token);

  if (authMethod === 'basic_auth') {
    const user = (supplier.customer_id_ref ? process.env[supplier.customer_id_ref] : null) || dc.customer_id || '';
    if (user && token) headers['Authorization'] = `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

// ── Încărcare context de mapare ──────────────────────────────────────────────

async function loadMappingContext(
  db: SupabaseClient, profileId: number, supplierId: number
): Promise<{ ctx: MappingContext; categoryId: number }> {
  const { data: profile, error: pErr } = await db
    .from('supplier_mapping_profiles')
    .select('id, category_id, is_active')
    .eq('id', profileId)
    .maybeSingle();
  if (pErr || !profile) throw new Error(`Profil de mapare #${profileId} inexistent`);

  const [{ data: mappings }, { data: rules }, { data: rates }, { data: brands }] = await Promise.all([
    db.from('supplier_field_mappings').select('*').eq('profile_id', profileId).order('position'),
    db.from('supplier_transform_rules').select('*').eq('profile_id', profileId).eq('is_active', true).order('position'),
    db.from('currency_rates').select('code, rate_to_ron'),
    db.from('brands').select('id, name, slug, aliases').eq('is_active', true),
  ]);

  // Definițiile categoriei + ale strămoșilor (moștenire)
  const catIds: number[] = [];
  let cursor: number | null = profile.category_id;
  while (cursor) {
    catIds.push(cursor);
    const { data: cat } = await db.from('categories').select('parent_id').eq('id', cursor).maybeSingle();
    cursor = (cat?.parent_id as number | null) ?? null;
  }
  const { data: defs } = await db
    .from('category_attribute_definitions')
    .select('id, code, data_type, enum_options, is_required, validation')
    .in('category_id', catIds);

  return {
    categoryId: profile.category_id as number,
    ctx: {
      supplierId,
      fieldMappings: (mappings ?? []) as FieldMappingLite[],
      rules: (rules ?? []) as TransformRuleLite[],
      attributeDefs: (defs ?? []) as AttributeDefLite[],
      brands: (brands ?? []) as BrandLookupWithId[],
      rates: Object.fromEntries((rates ?? []).map(r => [r.code as string, Number(r.rate_to_ron)])),
    },
  };
}

// ── Pipeline principal ───────────────────────────────────────────────────────

export async function runImportJob(jobId: string): Promise<PipelineResult> {
  const db = makeAdminClient();

  const { data: job, error: jErr } = await db
    .from('import_jobs').select('*').eq('id', jobId).maybeSingle();
  if (jErr || !job) throw new Error(`Job #${jobId} inexistent`);
  const j = job as unknown as JobRow;
  if (!j.profile_id) await fail(db, jobId, 'fetch', 'Jobul nu are profil de mapare (profile_id)');

  const { data: supplier } = await db
    .from('suppliers')
    .select('id, name, auth_method, api_key_ref, token_ref, customer_id_ref, driver_config, csv_delimiter')
    .eq('id', j.supplier_id)
    .maybeSingle();
  if (!supplier) await fail(db, jobId, 'fetch', `Furnizorul #${j.supplier_id} inexistent`);

  // ── FETCH + SNAPSHOT ──────────────────────────────────────────────────────
  await setJob(db, jobId, { status: 'fetching', started_at: new Date().toISOString() });

  let buffer: Buffer;
  let format = 'csv';
  let delimiter = (supplier!.csv_delimiter as string) || ',';

  if (j.snapshot_path) {
    // Fișier deja urcat (workflow upload) — descărcăm snapshotul existent
    const { data: blob, error: dlErr } = await db.storage.from('feed-snapshots').download(j.snapshot_path);
    if (dlErr || !blob) await fail(db, jobId, 'fetch', `Nu pot descărca snapshotul: ${dlErr?.message}`);
    buffer = Buffer.from(await blob!.arrayBuffer());
    const { data: feed } = j.feed_id
      ? await db.from('supplier_feeds').select('format, csv_delimiter').eq('id', j.feed_id).maybeSingle()
      : { data: null };
    if (feed?.format) format = feed.format as string;
    if (feed?.csv_delimiter) delimiter = feed.csv_delimiter as string;
  } else {
    if (!j.feed_id) await fail(db, jobId, 'fetch', 'Jobul nu are nici feed_id, nici snapshot_path');
    const { data: feed } = await db
      .from('supplier_feeds')
      .select('feed_url, format, auth_method, csv_delimiter, config, is_active')
      .eq('id', j.feed_id!)
      .maybeSingle();
    if (!feed?.feed_url) await fail(db, jobId, 'fetch', `Feed #${j.feed_id} inexistent sau fără URL`);
    format = (feed!.format as string) || 'csv';
    if (feed!.csv_delimiter) delimiter = feed!.csv_delimiter as string;
    try {
      buffer = await fetchFeedBuffer(feed!.feed_url as string, supplier as unknown as SupplierAuthRow, (feed!.auth_method as string) || 'none');
    } catch (e) {
      await fail(db, jobId, 'fetch', `Descărcarea feed-ului a eșuat: ${e instanceof Error ? e.message : e}`);
    }

    const snapshotPath = `${j.supplier_id}/${jobId}.bin`;
    const { error: upErr } = await db.storage
      .from('feed-snapshots')
      .upload(snapshotPath, buffer!, { contentType: 'application/octet-stream', upsert: true });
    if (upErr) {
      await db.from('import_errors').insert({
        job_id: jobId, phase: 'fetch', severity: 'warning', code: 'SNAPSHOT_FAILED',
        message: `Snapshot neîncărcat (continui): ${upErr.message}`,
      });
    } else {
      await setJob(db, jobId, { snapshot_path: snapshotPath });
    }
  }
  await setJob(db, jobId, { snapshot_hash: sha256(buffer!) });

  // ── PARSE ─────────────────────────────────────────────────────────────────
  await setJob(db, jobId, { status: 'parsing' });
  let rows: Record<string, unknown>[];
  try {
    rows = parseFeedBuffer(buffer!, format as never, delimiter);
  } catch (e) {
    return fail(db, jobId, 'parse', `Parsarea a eșuat: ${e instanceof Error ? e.message : e}`);
  }
  if (rows.length === 0) return fail(db, jobId, 'parse', 'Feed-ul nu conține rânduri');

  await setJob(db, jobId, { rows_total: rows.length });

  for (const c of chunk(rows.map((raw, i) => ({
    job_id: jobId, row_index: i, raw, row_hash: sha256(JSON.stringify(raw)),
  })), RAW_ROW_BATCH)) {
    const { error } = await db.from('import_raw_rows').insert(c);
    if (error) {
      await db.from('import_errors').insert({
        job_id: jobId, phase: 'parse', severity: 'warning', code: 'RAW_ROWS_PARTIAL',
        message: `Batch import_raw_rows eșuat: ${error.message}`,
      });
      break; // raw rows sunt best-effort; snapshotul e dovada permanentă
    }
  }
  await setJob(db, jobId, { rows_parsed: rows.length });

  // ── MAP + VALIDATE ────────────────────────────────────────────────────────
  await setJob(db, jobId, { status: 'mapping' });
  const { ctx, categoryId } = await loadMappingContext(db, j.profile_id!, j.supplier_id);

  const mapped: MappedRow[] = [];
  const importErrors: ImportError[] = [];
  let skippedCount = 0;
  let errorRowCount = 0;

  rows.forEach((row, i) => {
    const m = mapRow(row, ctx);
    if (m.skipped) { skippedCount++; return; }
    for (const w of m.warnings) {
      if (importErrors.length < ERROR_CAP)
        importErrors.push({ job_id: jobId, row_index: i, phase: 'map', severity: 'warning', code: w.code, message: w.message });
    }
    if (m.errors.length) {
      errorRowCount++;
      for (const e of m.errors) {
        if (importErrors.length < ERROR_CAP)
          importErrors.push({ job_id: jobId, row_index: i, phase: 'validate', severity: 'error', code: e.code, message: e.message });
      }
      return;
    }
    mapped.push(m);
  });

  for (const c of chunk(importErrors, RAW_ROW_BATCH)) {
    await db.from('import_errors').insert(c);
  }

  const deduped = dedupeMappedRows(mapped);
  await setJob(db, jobId, { status: 'validating', rows_mapped: deduped.length, rows_error: errorRowCount });

  if (deduped.length === 0) {
    return fail(db, jobId, 'validate', `Niciun rând valid din ${rows.length} (${errorRowCount} cu erori, ${skippedCount} filtrate)`);
  }

  // ── STAGE (diff vs catalogul live) ────────────────────────────────────────
  const brandIdBySlugKey = new Map(ctx.brands.map(b => [b.name.toLowerCase(), b.id]));

  // Variante existente pentru perechile (brand_id, part_number) din feed
  const knownPairs = deduped
    .filter(r => r.core.brandId ?? brandIdBySlugKey.get(r.core.brandName.toLowerCase()))
    .map(r => ({
      brandId: (r.core.brandId ?? brandIdBySlugKey.get(r.core.brandName.toLowerCase()))!,
      partNumber: r.core.partNumber,
    }));

  const existingVariants = new Map<string, { id: string; attrs: Record<string, unknown> }>();
  for (const c of chunk(knownPairs, 200)) {
    const brandIds = Array.from(new Set(c.map(p => p.brandId)));
    const pns = c.map(p => p.partNumber);
    const { data } = await db
      .from('product_variants')
      .select('id, brand_id, part_number, attrs')
      .in('brand_id', brandIds)
      .in('part_number', pns);
    for (const v of data ?? []) {
      existingVariants.set(`${v.brand_id}|${(v.part_number as string).toLowerCase()}`,
        { id: v.id as string, attrs: (v.attrs ?? {}) as Record<string, unknown> });
    }
  }

  // Ofertele existente ale furnizorului (pentru diff + deactivate)
  const supplierOffers = new Map<string, Record<string, unknown>>(); // variant_id → offer
  {
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data } = await db
        .from('supplier_offers')
        .select('id, variant_id, raw_price, raw_currency, price, price_b2b, stock, stock_incoming, is_available')
        .eq('supplier_id', j.supplier_id)
        .range(from, from + PAGE - 1);
      for (const o of data ?? []) supplierOffers.set(o.variant_id as string, o as Record<string, unknown>);
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
  }

  const seenVariantIds = new Set<string>();
  const counts = { create: 0, update: 0, unchanged: 0, deactivate: 0 };
  const stagedRows: Record<string, unknown>[] = [];

  for (const r of deduped) {
    const brandId = r.core.brandId ?? brandIdBySlugKey.get(r.core.brandName.toLowerCase()) ?? null;
    const variantKey = brandId ? `${brandId}|${r.core.partNumber.toLowerCase()}` : null;
    const existing = variantKey ? existingVariants.get(variantKey) : undefined;
    const currentOffer = existing ? supplierOffers.get(existing.id) : undefined;
    if (existing) seenVariantIds.add(existing.id);

    const offerPayload = {
      raw_price: r.offer.rawPrice,
      raw_currency: r.offer.currency,
      price: r.offer.price,
      stock: r.offer.stock,
      stock_incoming: r.offer.stockIncoming,
      supplier_sku: r.offer.supplierSku,
      lead_time_days: r.offer.leadTimeDays,
      is_available: true,
    };

    let action: 'create' | 'update' | 'unchanged';
    if (!existing || !currentOffer) {
      action = existing ? 'update' : 'create'; // variantă nouă SAU doar oferta e nouă
    } else {
      const same =
        Number(currentOffer.price ?? 0) === Number(r.offer.price ?? 0) &&
        Number(currentOffer.stock ?? 0) === Number(r.offer.stock ?? 0) &&
        Number(currentOffer.raw_price ?? 0) === Number(r.offer.rawPrice ?? 0) &&
        currentOffer.is_available === true &&
        JSON.stringify(existing.attrs) === JSON.stringify({ ...existing.attrs, ...r.attributes });
      action = same ? 'unchanged' : 'update';
    }
    counts[action]++;

    stagedRows.push({
      job_id: jobId,
      action,
      matched_variant_id: existing?.id ?? null,
      product_payload: {
        category_id: categoryId,
        brand_id: brandId,
        brand_name: r.core.brandName,
        family_name: r.core.familyName,
        description: r.core.description,
      },
      variant_payload: {
        part_number: r.core.partNumber,
        ean: r.core.ean,
        name_suffix: r.core.nameSuffix,
        name: r.core.name,
      },
      attributes_payload: r.attributes,
      offer_payload: offerPayload,
      media_payload: r.media,
      previous: currentOffer ?? null,
      validation_status: 'mapped',
    });
  }

  // Oferte ale furnizorului care nu mai apar în feed → dezactivare
  for (const [variantId, offer] of Array.from(supplierOffers.entries())) {
    if (seenVariantIds.has(variantId) || offer.is_available === false) continue;
    counts.deactivate++;
    stagedRows.push({
      job_id: jobId,
      action: 'deactivate',
      matched_variant_id: variantId,
      product_payload: {}, variant_payload: {}, attributes_payload: {},
      offer_payload: { is_available: false },
      media_payload: [],
      previous: offer,
      validation_status: 'mapped',
    });
  }

  for (const c of chunk(stagedRows, STAGED_BATCH)) {
    const { error } = await db.from('import_staged_variants').insert(c);
    if (error) return fail(db, jobId, 'stage', `Insert staging eșuat: ${error.message}`);
  }

  await setJob(db, jobId, {
    status: 'staged',
    rows_staged: stagedRows.length,
    stats: {
      skipped_by_filter: skippedCount,
      counts,
      finished_mapping_at: new Date().toISOString(),
    },
  });

  // ── PUBLISH (doar mode=direct; dry_run și staged așteaptă decizia admin) ──
  let finalStatus = 'staged';
  if (j.mode === 'direct') {
    const { data: pubResult, error: pubErr } = await db.rpc('publish_import_job', { p_job_id: jobId });
    if (pubErr) return fail(db, jobId, 'publish', `Publish eșuat: ${pubErr.message}`);
    finalStatus = 'published';
    await setJob(db, jobId, { stats: { counts, publish: pubResult } });
  } else if (j.mode === 'dry_run') {
    await setJob(db, jobId, { finished_at: new Date().toISOString() });
  }

  return {
    jobId,
    status: finalStatus,
    rowsTotal: rows.length,
    rowsMapped: deduped.length,
    rowsError: errorRowCount,
    staged: counts,
  };
}
