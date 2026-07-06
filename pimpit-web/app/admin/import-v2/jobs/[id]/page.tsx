import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import JobActions from './JobActions';

export const dynamic = 'force-dynamic';

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const db = makeAdminClient();

  const { data: job } = await db.from('import_jobs').select('*').eq('id', params.id).maybeSingle();
  if (!job) {
    return (
      <div className="space-y-4">
        <p>Jobul nu există.</p>
        <Link className="text-primary underline" href="/admin/import-v2">← Înapoi la importuri</Link>
      </div>
    );
  }

  const [{ data: supplier }, { data: profile }, { data: staged }, { data: errorSamples }] = await Promise.all([
    db.from('suppliers').select('name').eq('id', job.supplier_id).maybeSingle(),
    job.profile_id
      ? db.from('supplier_mapping_profiles').select('name, category_id').eq('id', job.profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('import_staged_variants').select('action').eq('job_id', params.id).limit(100000),
    db.from('import_errors').select('row_index, phase, severity, code, message')
      .eq('job_id', params.id).order('id').limit(100),
  ]);

  const stagedSummary: Record<string, number> = {};
  for (const s of staged ?? []) {
    stagedSummary[s.action as string] = (stagedSummary[s.action as string] ?? 0) + 1;
  }

  const errorGroups: Record<string, number> = {};
  for (const e of errorSamples ?? []) {
    errorGroups[`${e.code}`] = (errorGroups[e.code] ?? 0) + 1;
  }

  const isDryRun = job.mode === 'dry_run';
  const statusLabel =
    job.status === 'staged' && isDryRun ? 'Verificare încheiată' :
    job.status === 'staged' ? 'Așteaptă aprobarea' :
    job.status === 'published' ? 'Publicat în catalog' :
    job.status === 'failed' ? 'Eșuat' :
    job.status === 'rolled_back' ? 'Anulat (rollback)' :
    job.status;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link className="text-sm text-primary underline" href="/admin/import-v2">← Înapoi la importuri</Link>
        <h1 className="text-2xl font-bold mt-2">
          {isDryRun ? 'Raport verificare' : 'Import'} — {supplier?.name ?? `Furnizor #${job.supplier_id}`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Profil: {profile?.name ?? '—'} · Pornit: {new Date(job.created_at).toLocaleString('ro-RO')}
          {job.finished_at && ` · Durată: ${Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at ?? job.created_at).getTime()) / 1000)}s`}
        </p>
      </div>

      <div className={`rounded-lg border p-4 text-sm font-medium ${
        job.status === 'failed' ? 'bg-red-50 border-red-200 text-red-800' :
        job.status === 'published' ? 'bg-green-50 border-green-200 text-green-800' :
        job.status === 'staged' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-muted'
      }`}>
        Status: {statusLabel}
        {job.error_message && <div className="font-normal mt-1">{job.error_message}</div>}
      </div>

      {/* Contoare */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Rânduri în feed', value: job.rows_total },
          { label: 'Valide (după dedup)', value: job.rows_mapped },
          { label: 'Rânduri cu erori', value: job.rows_error, warn: job.rows_error > 0 },
          { label: 'Pregătite (staging)', value: job.rows_staged },
        ].map(s => (
          <div key={s.label} className="rounded-lg border p-4">
            <div className={`text-2xl font-bold ${s.warn ? 'text-red-600' : ''}`}>
              {(s.value ?? 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Ce se va întâmpla la publicare */}
      {Object.keys(stagedSummary).length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold text-sm mb-2">
            {job.status === 'published' ? 'Ce s-a aplicat' : 'Ce se va întâmpla la publicare'}
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-green-700">➕ {stagedSummary.create ?? 0} produse noi</span>
            <span className="text-blue-700">↻ {stagedSummary.update ?? 0} actualizate</span>
            <span className="text-muted-foreground">= {stagedSummary.unchanged ?? 0} neschimbate</span>
            <span className="text-orange-700">⏸ {stagedSummary.deactivate ?? 0} oferte dezactivate (nu mai apar în feed)</span>
          </div>
        </div>
      )}

      <JobActions
        jobId={job.id}
        status={job.status}
        mode={job.mode}
        supplierId={job.supplier_id}
        profileId={job.profile_id}
        feedId={job.feed_id}
        snapshotPath={job.snapshot_path}
      />

      {/* Erori */}
      {(errorSamples ?? []).length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold text-sm">
            Probleme găsite (primele {(errorSamples ?? []).length})
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(errorGroups).map(([code, n]) => (
              <span key={code} className="px-2 py-1 rounded-full bg-muted">{code}: {n}</span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-1.5">Rând</th><th className="p-1.5">Faza</th>
                  <th className="p-1.5">Tip</th><th className="p-1.5">Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {(errorSamples ?? []).map((e, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-1.5">{e.row_index != null ? e.row_index + 2 : '—'}</td>
                    <td className="p-1.5">{e.phase}</td>
                    <td className="p-1.5">
                      <span className={e.severity === 'warning' ? 'text-amber-600' : 'text-red-600'}>
                        {e.code}
                      </span>
                    </td>
                    <td className="p-1.5">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
