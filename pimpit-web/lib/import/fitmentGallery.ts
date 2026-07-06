/**
 * Importul galeriei de fitmenturi (export Fitment Industries) în
 * vehicle_makes / vehicle_models / vehicles / vehicle_fitments.
 *
 * Logica partajată între:
 *  - ruta admin POST /api/admin/fitment-import (butonul din /admin/vehicule)
 *  - scriptul CLI scripts/import-fitment-gallery.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { gunzipSync } from 'node:zlib';
import {
  normalizeMakeName, slugify, parseWheelSpec, parseTireSpec, noneToNull,
} from './normalizers';

// ── Tipuri ───────────────────────────────────────────────────────────────────

interface CsvRow {
  url: string;
  'an fabricatie': string;
  marca: string;
  model: string;
  trim: string;
  'dimensiune jante fata (r, j, et)': string;
  'dimensiune jante spate (r, j, et)': string;
  rubbing: string;
  trimming: string;
  'front wheel spacers': string;
  'rear wheel spacers': string;
  stance: string;
  'tire info front': string;
  'tire info rear': string;
}

export interface FitmentRecord {
  source_url: string;
  makeName: string;
  makeSlug: string;
  modelName: string;
  modelSlug: string;
  year: number;
  trim: string;
  front: ReturnType<typeof parseWheelSpec>;
  rear: ReturnType<typeof parseWheelSpec>;
  frontTire: ReturnType<typeof parseTireSpec>;
  rearTire: ReturnType<typeof parseTireSpec>;
  frontTireRaw: string | null;
  rearTireRaw: string | null;
  rubbing: string | null;
  trimming: string | null;
  spacersFront: string | null;
  spacersRear: string | null;
  stance: string | null;
}

export interface FitmentStats {
  valid: number;
  rejected: number;
  makes: number;
  models: number;
  vehicles: number;
  noFrontWheel: number;
  noFrontTire: number;
  staggered: number;
}

export interface FitmentParseResult {
  records: FitmentRecord[];
  rejects: { row: number; reason: string }[];
  stats: FitmentStats;
}

export interface FitmentImportSummary extends FitmentStats {
  applied: boolean;
  fitmentsSent?: number;
  rejectSamples: { row: number; reason: string }[];
}

// ── Parsare + normalizare ────────────────────────────────────────────────────

/** Acceptă CSV brut sau gzip (detectat după magic bytes 1f 8b). */
export function parseFitmentCsv(input: Buffer, limit = Infinity): FitmentParseResult {
  const buf = input.length > 2 && input[0] === 0x1f && input[1] === 0x8b
    ? gunzipSync(input)
    : input;

  const parsed = Papa.parse<CsvRow>(buf.toString('utf-8'), {
    header: true,
    skipEmptyLines: true,
  });

  const records: FitmentRecord[] = [];
  const rejects: { row: number; reason: string }[] = [];
  const seenUrls = new Set<string>();

  parsed.data.slice(0, limit === Infinity ? undefined : limit).forEach((row, i) => {
    const url = (row.url ?? '').trim();
    if (!url) { rejects.push({ row: i + 2, reason: 'url lipsă' }); return; }
    if (seenUrls.has(url)) { rejects.push({ row: i + 2, reason: 'url duplicat' }); return; }

    const year = parseInt((row['an fabricatie'] ?? '').trim(), 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      rejects.push({ row: i + 2, reason: `an invalid: "${row['an fabricatie']}"` });
      return;
    }
    const makeName = normalizeMakeName(row.marca ?? '');
    const modelName = (row.model ?? '').trim();
    if (!makeName || !modelName) {
      rejects.push({ row: i + 2, reason: 'marcă sau model lipsă' });
      return;
    }

    seenUrls.add(url);
    records.push({
      source_url: url,
      makeName,
      makeSlug: slugify(makeName),
      modelName,
      modelSlug: slugify(modelName),
      year,
      trim: (row.trim ?? '').trim(),
      front: parseWheelSpec(row['dimensiune jante fata (r, j, et)']),
      rear: parseWheelSpec(row['dimensiune jante spate (r, j, et)']),
      frontTire: parseTireSpec(row['tire info front']),
      rearTire: parseTireSpec(row['tire info rear']),
      frontTireRaw: noneToNull(row['tire info front']),
      rearTireRaw: noneToNull(row['tire info rear']),
      rubbing: noneToNull(row.rubbing),
      trimming: noneToNull(row.trimming),
      spacersFront: noneToNull(row['front wheel spacers']),
      spacersRear: noneToNull(row['rear wheel spacers']),
      stance: noneToNull(row.stance),
    });
  });

  const makes = new Set(records.map(r => r.makeSlug));
  const models = new Set(records.map(r => `${r.makeSlug}/${r.modelSlug}`));
  const vehicles = new Set(records.map(r => `${r.makeSlug}/${r.modelSlug}|${r.year}|${r.trim}`));

  return {
    records,
    rejects,
    stats: {
      valid: records.length,
      rejected: rejects.length,
      makes: makes.size,
      models: models.size,
      vehicles: vehicles.size,
      noFrontWheel: records.filter(r => !r.front).length,
      noFrontTire: records.filter(r => !r.frontTire).length,
      staggered: records.filter(r => isStaggered(r)).length,
    },
  };
}

function isStaggered(r: FitmentRecord): boolean {
  return !!(r.front && r.rear &&
    (r.front.diameter !== r.rear.diameter || r.front.width !== r.rear.width ||
     r.front.offset !== r.rear.offset));
}

// ── Upsert în DB ─────────────────────────────────────────────────────────────

const BATCH = 500;

async function upsertBatched<T extends Record<string, unknown>>(
  db: SupabaseClient, table: string, rows: T[], onConflict: string,
  select: string, ignoreDuplicates = false,
  onProgress?: (msg: string) => void
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { data, error } = await db
      .from(table)
      .upsert(chunk as never[], { onConflict, ignoreDuplicates })
      .select(select);
    if (error) throw new Error(`${table} batch ${i / BATCH + 1}: ${error.message}`);
    out.push(...(((data ?? []) as unknown) as Record<string, unknown>[]));
    onProgress?.(`${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  return out;
}

/**
 * Rulează importul. apply=false → doar parsează și raportează (dry-run).
 * Idempotent: mărcile/modelele/vehiculele se upsertează, fitmenturile
 * duplicate (același source_url) sunt ignorate.
 */
export async function importFitmentGallery(
  db: SupabaseClient | null,
  input: Buffer,
  opts: { apply: boolean; limit?: number; onProgress?: (msg: string) => void } = { apply: false }
): Promise<FitmentImportSummary> {
  const { records, rejects, stats } = parseFitmentCsv(input, opts.limit ?? Infinity);
  const summary: FitmentImportSummary = {
    ...stats,
    applied: false,
    rejectSamples: rejects.slice(0, 5),
  };

  if (!opts.apply || !db) return summary;

  // 1) Mărci
  const makesMap = new Map<string, string>();
  for (const r of records) makesMap.set(r.makeSlug, r.makeName);
  const makeRows = Array.from(makesMap.entries()).map(([slug, name]) => ({ slug, name }));
  const makeData = await upsertBatched(db, 'vehicle_makes', makeRows, 'slug', 'id, slug', false, opts.onProgress);
  const makeIds = new Map(makeData.map(m => [m.slug as string, m.id as number]));

  // 2) Modele
  const modelsMap = new Map<string, { makeSlug: string; slug: string; name: string }>();
  for (const r of records) {
    modelsMap.set(`${r.makeSlug}/${r.modelSlug}`, { makeSlug: r.makeSlug, slug: r.modelSlug, name: r.modelName });
  }
  const modelRows = Array.from(modelsMap.values()).map(m => ({
    make_id: makeIds.get(m.makeSlug)!,
    slug: m.slug,
    name: m.name,
  }));
  const modelData = await upsertBatched(db, 'vehicle_models', modelRows, 'make_id,slug', 'id, make_id, slug', false, opts.onProgress);
  const makeIdToSlug = new Map(Array.from(makeIds.entries()).map(([s, id]) => [id, s]));
  const modelIds = new Map(
    modelData.map(m => [`${makeIdToSlug.get(m.make_id as number)}/${m.slug}`, m.id as number])
  );

  // 3) Vehicule (model + an + trim)
  const vehiclesMap = new Map<string, { modelKey: string; year: number; trim: string }>();
  for (const r of records) {
    const modelKey = `${r.makeSlug}/${r.modelSlug}`;
    vehiclesMap.set(`${modelKey}|${r.year}|${r.trim}`, { modelKey, year: r.year, trim: r.trim });
  }
  const vehicleRows = Array.from(vehiclesMap.values()).map(v => ({
    model_id: modelIds.get(v.modelKey)!,
    year: v.year,
    trim: v.trim,
  }));
  const vehicleData = await upsertBatched(db, 'vehicles', vehicleRows, 'model_id,year,trim', 'id, model_id, year, trim', false, opts.onProgress);
  const modelIdToKey = new Map(Array.from(modelIds.entries()).map(([k, id]) => [id, k]));
  const vehicleIds = new Map(
    vehicleData.map(v => [`${modelIdToKey.get(v.model_id as number)}|${v.year}|${v.trim}`, v.id as number])
  );

  // 4) Fitmenturi (duplicatele pe source_url sunt ignorate)
  const fitmentRows = records.map(r => {
    const vehicleId = vehicleIds.get(`${r.makeSlug}/${r.modelSlug}|${r.year}|${r.trim}`);
    if (!vehicleId) return null;
    return {
      vehicle_id: vehicleId,
      source: 'fitment_gallery',
      source_url: r.source_url,
      front_diameter: r.front?.diameter ?? null,
      front_width: r.front?.width ?? null,
      front_offset: r.front?.offset ?? null,
      rear_diameter: r.rear?.diameter ?? null,
      rear_width: r.rear?.width ?? null,
      rear_offset: r.rear?.offset ?? null,
      is_staggered: isStaggered(r),
      front_tire_width: r.frontTire?.width ?? null,
      front_tire_aspect: r.frontTire?.aspect ?? null,
      front_tire_diameter: r.frontTire?.rimDiameter ?? null,
      rear_tire_width: r.rearTire?.width ?? null,
      rear_tire_aspect: r.rearTire?.aspect ?? null,
      rear_tire_diameter: r.rearTire?.rimDiameter ?? null,
      front_tire_raw: r.frontTireRaw,
      rear_tire_raw: r.rearTireRaw,
      rubbing: r.rubbing,
      trimming: r.trimming,
      spacers_front: r.spacersFront,
      spacers_rear: r.spacersRear,
      stance: r.stance,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  await upsertBatched(db, 'vehicle_fitments', fitmentRows, 'source_url', 'id', true, opts.onProgress);

  summary.applied = true;
  summary.fitmentsSent = fitmentRows.length;
  return summary;
}
