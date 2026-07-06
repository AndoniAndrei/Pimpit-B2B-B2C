/**
 * Joburi de import v2.
 * GET  /api/admin/import-v2/jobs?supplier_id=…&limit=… — istoric
 * POST /api/admin/import-v2/jobs — creează un job și îl rulează in-process
 *      { supplier_id, profile_id, feed_id?, snapshot_path?, mode? }
 *      mode: 'dry_run' (implicit — doar raport) | 'staged' (așteaptă publish)
 *            | 'direct' (publică imediat)
 * Faza 3 va muta execuția într-un worker; contractul (rândul din import_jobs)
 * rămâne identic.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';
import { runImportJob } from '@/lib/import/engine/pipeline';

export const maxDuration = 300;

const createJobSchema = z.object({
  supplier_id: z.number().int().positive(),
  profile_id: z.number().int().positive(),
  feed_id: z.number().int().positive().nullable().optional(),
  snapshot_path: z.string().max(500).nullable().optional(),
  mode: z.enum(['dry_run', 'staged', 'direct']).default('dry_run'),
}).refine(d => d.feed_id || d.snapshot_path, {
  message: 'Este necesar feed_id sau snapshot_path (fișier urcat)',
});

export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();

  const supplierId = req.nextUrl.searchParams.get('supplier_id');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);

  let query = db
    .from('import_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (supplierId) query = query.eq('supplier_id', Number(supplierId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await checkAdmin();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = createJobSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Date invalide', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const db = makeAdminClient();

  const { data: job, error } = await db
    .from('import_jobs')
    .insert({
      supplier_id: body.supplier_id,
      profile_id: body.profile_id,
      feed_id: body.feed_id ?? null,
      snapshot_path: body.snapshot_path ?? null,
      mode: body.mode,
      triggered_by: 'manual',
      created_by: userId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const result = await runImportJob(job.id);
    return NextResponse.json({ job_id: job.id, ...result }, { status: 201 });
  } catch (e) {
    // pipeline-ul a marcat deja jobul ca failed + a scris import_errors
    return NextResponse.json(
      { job_id: job.id, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
