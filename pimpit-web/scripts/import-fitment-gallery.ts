/**
 * Import galeria de fitmenturi (export Fitment Industries, 57k rânduri) în
 * vehicle_makes / vehicle_models / vehicles / vehicle_fitments.
 *
 * Rulare (din pimpit-web/):
 *   npm run fitment:import                # dry-run (implicit, nu scrie nimic)
 *   npm run fitment:import -- --apply     # scrie în DB
 *   npm run fitment:import -- --apply --limit 1000
 *   npm run fitment:import -- --file /cale/catre/fitmentgallery.csv[.gz]
 *
 * Necesită env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (citite și din pimpit-web/.env.local dacă există).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';
import {
  normalizeMakeName, slugify, parseWheelSpec, parseTireSpec, noneToNull,
} from '../lib/import/normalizers';

// Rulabil atât din pimpit-web/ cât și din rădăcina repo-ului.
function findFirst(candidates: string[]): string {
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0];
}

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const limitIx = args.indexOf('--limit');
const LIMIT = limitIx >= 0 ? parseInt(args[limitIx + 1], 10) : Infinity;
const fileIx = args.indexOf('--file');
const FILE = fileIx >= 0
  ? resolve(args[fileIx + 1])
  : findFirst([
      join(process.cwd(), 'data', 'fitmentgallery.csv.gz'),
      join(process.cwd(), '..', 'data', 'fitmentgallery.csv.gz'),
    ]);

// ── Env (.env.local fallback) ────────────────────────────────────────────────

function loadEnvLocal() {
  const p = findFirst([
    join(process.cwd(), '.env.local'),
    join(process.cwd(), 'pimpit-web', '.env.local'),
  ]);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

// ── Tipuri interne ───────────────────────────────────────────────────────────

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

interface FitmentRecord {
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

// ── Parse & normalizare ──────────────────────────────────────────────────────

function parseCsv(): { records: FitmentRecord[]; rejects: { row: number; reason: string }[] } {
  if (!existsSync(FILE)) {
    console.error(`Fișierul nu există: ${FILE}`);
    process.exit(1);
  }
  let buf = readFileSync(FILE);
  if (FILE.endsWith('.gz')) buf = gunzipSync(buf);

  const parsed = Papa.parse<CsvRow>(buf.toString('utf-8'), {
    header: true,
    skipEmptyLines: true,
  });

  const records: FitmentRecord[] = [];
  const rejects: { row: number; reason: string }[] = [];
  const seenUrls = new Set<string>();

  parsed.data.slice(0, LIMIT === Infinity ? undefined : LIMIT).forEach((row, i) => {
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

  return { records, rejects };
}

// ── Upsert helpers ───────────────────────────────────────────────────────────

const BATCH = 500;

async function upsertBatched<T extends Record<string, unknown>>(
  db: SupabaseClient, table: string, rows: T[], onConflict: string,
  select: string, ignoreDuplicates = false
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
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}   `);
  }
  if (rows.length) process.stdout.write('\n');
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fișier: ${FILE}`);
  console.log(`Mod: ${APPLY ? 'APPLY (scrie în DB)' : 'DRY-RUN (nu scrie nimic)'}`);

  const { records, rejects } = parseCsv();

  // Statistici de parsare
  const noFront = records.filter(r => !r.front).length;
  const noFrontTire = records.filter(r => !r.frontTire).length;
  const staggered = records.filter(r =>
    r.front && r.rear &&
    (r.front.diameter !== r.rear.diameter || r.front.width !== r.rear.width ||
     r.front.offset !== r.rear.offset)
  ).length;

  const makes = new Map<string, string>();          // slug → name
  const models = new Map<string, { makeSlug: string; slug: string; name: string }>();
  const vehicles = new Map<string, { modelKey: string; year: number; trim: string }>();
  for (const r of records) {
    makes.set(r.makeSlug, r.makeName);
    const modelKey = `${r.makeSlug}/${r.modelSlug}`;
    models.set(modelKey, { makeSlug: r.makeSlug, slug: r.modelSlug, name: r.modelName });
    vehicles.set(`${modelKey}|${r.year}|${r.trim}`, { modelKey, year: r.year, trim: r.trim });
  }

  console.log(`
── Rezumat parsare ─────────────────────────────
  Rânduri valide:        ${records.length}
  Respinse:              ${rejects.length}
  Mărci unice:           ${makes.size}
  Modele unice:          ${models.size}
  Vehicule unice (Y/M/T): ${vehicles.size}
  Fără dimensiune jante față: ${noFront}
  Fără anvelope față parsate: ${noFrontTire}
  Setup-uri staggered:   ${staggered}
`);
  if (rejects.length) {
    console.log('  Exemple respinse:', rejects.slice(0, 5));
  }

  if (!APPLY) {
    console.log('Dry-run încheiat. Rulează cu --apply pentru a scrie în DB.');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 1) Mărci
  const makeRows = Array.from(makes.entries()).map(([slug, name]) => ({ slug, name }));
  const makeData = await upsertBatched(db, 'vehicle_makes', makeRows, 'slug', 'id, slug');
  const makeIds = new Map(makeData.map(m => [m.slug as string, m.id as number]));

  // 2) Modele
  const modelRows = Array.from(models.values()).map(m => ({
    make_id: makeIds.get(m.makeSlug)!,
    slug: m.slug,
    name: m.name,
  }));
  const modelData = await upsertBatched(db, 'vehicle_models', modelRows, 'make_id,slug', 'id, make_id, slug');
  const makeIdToSlug = new Map(Array.from(makeIds.entries()).map(([s, id]) => [id, s]));
  const modelIds = new Map(
    modelData.map(m => [`${makeIdToSlug.get(m.make_id as number)}/${m.slug}`, m.id as number])
  );

  // 3) Vehicule (model + an + trim)
  const vehicleRows = Array.from(vehicles.values()).map(v => ({
    model_id: modelIds.get(v.modelKey)!,
    year: v.year,
    trim: v.trim,
  }));
  const vehicleData = await upsertBatched(db, 'vehicles', vehicleRows, 'model_id,year,trim', 'id, model_id, year, trim');
  const modelIdToKey = new Map(Array.from(modelIds.entries()).map(([k, id]) => [id, k]));
  const vehicleIds = new Map(
    vehicleData.map(v => [`${modelIdToKey.get(v.model_id as number)}|${v.year}|${v.trim}`, v.id as number])
  );

  // 4) Fitmenturi
  const fitmentRows = records.map(r => {
    const vehicleId = vehicleIds.get(`${r.makeSlug}/${r.modelSlug}|${r.year}|${r.trim}`);
    if (!vehicleId) return null;
    const isStaggered = !!(r.front && r.rear &&
      (r.front.diameter !== r.rear.diameter || r.front.width !== r.rear.width ||
       r.front.offset !== r.rear.offset));
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
      is_staggered: isStaggered,
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

  await upsertBatched(db, 'vehicle_fitments', fitmentRows, 'source_url', 'id', true);

  console.log(`
── Import încheiat ─────────────────────────────
  Mărci:      ${makeIds.size}
  Modele:     ${modelIds.size}
  Vehicule:   ${vehicleIds.size}
  Fitmenturi: ${fitmentRows.length} trimise (duplicatele pe source_url au fost ignorate)
`);
}

main().catch(e => {
  console.error('\nEroare:', e.message ?? e);
  process.exit(1);
});
