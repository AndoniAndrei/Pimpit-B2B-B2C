/**
 * Detaliu + acțiuni pe un job de import v2.
 * GET  — job + sumar erori + sumar staging (raportul de dry-run)
 * POST — { action: 'publish' | 'rollback' | 'cancel' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';

export const maxDuration = 300;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();

  const { data: job, error } = await db
    .from('import_jobs').select('*').eq('id', params.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Sumar erori grupate pe cod
  const { data: errors } = await db
    .from('import_errors')
    .select('phase, severity, code')
    .eq('job_id', params.id)
    .limit(10000);
  const errorSummary: Record<string, number> = {};
  for (const e of errors ?? []) {
    const key = `${e.severity}:${e.phase}:${e.code}`;
    errorSummary[key] = (errorSummary[key] ?? 0) + 1;
  }

  // Primele erori concrete (pentru drill-down rapid)
  const { data: errorSamples } = await db
    .from('import_errors')
    .select('row_index, phase, severity, code, message')
    .eq('job_id', params.id)
    .order('id')
    .limit(50);

  // Sumar staging pe acțiune
  const { data: staged } = await db
    .from('import_staged_variants')
    .select('action')
    .eq('job_id', params.id)
    .limit(100000);
  const stagedSummary: Record<string, number> = {};
  for (const s of staged ?? []) {
    stagedSummary[s.action as string] = (stagedSummary[s.action as string] ?? 0) + 1;
  }

  return NextResponse.json({ job, error_summary: errorSummary, error_samples: errorSamples, staged_summary: stagedSummary });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();
  const { action } = await req.json();

  if (action === 'publish') {
    const { data, error } = await db.rpc('publish_import_job', { p_job_id: params.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (action === 'rollback') {
    const { data, error } = await db.rpc('rollback_import_job', { p_job_id: params.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (action === 'cancel') {
    const { error } = await db
      .from('import_jobs')
      .update({ status: 'cancelled', finished_at: new Date().toISOString() })
      .eq('id', params.id)
      .in('status', ['queued', 'staged']);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Acțiune necunoscută: ${action}` }, { status: 400 });
}
