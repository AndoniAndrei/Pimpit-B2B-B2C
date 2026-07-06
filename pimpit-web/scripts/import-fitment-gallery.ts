/**
 * Wrapper CLI peste lib/import/fitmentGallery.ts — util pentru rulări locale
 * sau din CI. În producție folosește butonul din /admin/vehicule (ruta
 * /api/admin/fitment-import), care rulează același cod pe server.
 *
 * Rulare (din pimpit-web/):
 *   npm run fitment:import                # dry-run
 *   npm run fitment:import -- --apply     # scrie în DB
 *   npm run fitment:import -- --apply --limit 1000
 *   npm run fitment:import -- --file /cale/catre/fitmentgallery.csv[.gz]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { importFitmentGallery } from '../lib/import/fitmentGallery';

function findFirst(candidates: string[]): string {
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0];
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const limitIx = args.indexOf('--limit');
const LIMIT = limitIx >= 0 ? parseInt(args[limitIx + 1], 10) : undefined;
const fileIx = args.indexOf('--file');
const FILE = fileIx >= 0
  ? resolve(args[fileIx + 1])
  : findFirst([
      join(process.cwd(), 'data', 'fitmentgallery.csv.gz'),
      join(process.cwd(), '..', 'data', 'fitmentgallery.csv.gz'),
    ]);

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

async function main() {
  loadEnvLocal();
  console.log(`Fișier: ${FILE}`);
  console.log(`Mod: ${APPLY ? 'APPLY (scrie în DB)' : 'DRY-RUN (nu scrie nimic)'}`);
  if (!existsSync(FILE)) {
    console.error(`Fișierul nu există: ${FILE}`);
    process.exit(1);
  }

  let db = null;
  if (APPLY) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }
    db = createClient(url, key, { auth: { persistSession: false } });
  }

  const summary = await importFitmentGallery(db, readFileSync(FILE), {
    apply: APPLY,
    limit: LIMIT,
    onProgress: msg => process.stdout.write(`\r  ${msg}   `),
  });

  console.log(`\n── Rezumat ─────────────────────────────────────
  Rânduri valide:         ${summary.valid}
  Respinse:               ${summary.rejected}
  Mărci unice:            ${summary.makes}
  Modele unice:           ${summary.models}
  Vehicule unice (Y/M/T): ${summary.vehicles}
  Staggered:              ${summary.staggered}
  Aplicat în DB:          ${summary.applied ? `DA (${summary.fitmentsSent} fitmenturi trimise)` : 'NU (dry-run)'}
`);
  if (summary.rejectSamples.length) {
    console.log('  Exemple respinse:', summary.rejectSamples);
  }
}

main().catch(e => {
  console.error('\nEroare:', e?.message ?? e);
  process.exit(1);
});
