/**
 * Faza 3 — worker de importuri (schelet funcțional).
 *
 * Rulează în afara Next.js (Railway / Fly / VPS / local) și consumă coada
 * din import_jobs: revendică joburile `queued` cu claim_next_import_job()
 * (FOR UPDATE SKIP LOCKED — safe cu mai mulți workeri) și execută exact
 * același pipeline ca rutele admin.
 *
 * Rulare (din pimpit-web/): npm run worker
 * Necesită env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (+ credențialele furnizorilor pentru feed-urile cu auth).
 *
 * Notă: cât timp UI-ul rulează joburile in-process (sincron la creare),
 * workerul procesează doar joburile create cu status 'queued' fără rulare
 * imediată (ex. din scheduler). La cutover, ruta POST /jobs va doar insera
 * jobul, iar workerul preia totul — contractul rămâne rândul din import_jobs.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runImportJob } from '../lib/import/engine/pipeline';

const POLL_MS = 5000;

function loadEnvLocal() {
  for (const p of [join(process.cwd(), '.env.local'), join(process.cwd(), 'pimpit-web', '.env.local')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return;
  }
}

let stopping = false;
process.on('SIGINT', () => { stopping = true; console.log('\nOprire după jobul curent…'); });
process.on('SIGTERM', () => { stopping = true; });

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log('Worker pornit — aștept joburi (Ctrl+C pentru oprire).');

  while (!stopping) {
    const { data: job, error } = await db.rpc('claim_next_import_job');
    if (error) {
      console.error('claim_next_import_job:', error.message);
      await sleep(POLL_MS * 3);
      continue;
    }
    if (!job?.id) {
      await sleep(POLL_MS);
      continue;
    }

    console.log(`→ Job ${job.id} (furnizor #${job.supplier_id}, mode=${job.mode})`);
    try {
      const result = await runImportJob(job.id);
      console.log(`✓ Job ${job.id}: ${result.status} — ${result.rowsMapped}/${result.rowsTotal} rânduri, staging:`, result.staged);
    } catch (e) {
      console.error(`✗ Job ${job.id}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log('Worker oprit.');
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(e => {
  console.error('Eroare fatală:', e);
  process.exit(1);
});
