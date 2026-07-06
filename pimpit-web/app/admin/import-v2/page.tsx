import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import RunJobButton from './RunJobButton';

export const dynamic = 'force-dynamic';

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  queued:      { label: 'În coadă',    cls: 'bg-gray-100 text-gray-700' },
  fetching:    { label: 'Descarcă',    cls: 'bg-blue-100 text-blue-700' },
  parsing:     { label: 'Parsează',    cls: 'bg-blue-100 text-blue-700' },
  mapping:     { label: 'Mapează',     cls: 'bg-blue-100 text-blue-700' },
  validating:  { label: 'Validează',   cls: 'bg-blue-100 text-blue-700' },
  staged:      { label: 'De aprobat',  cls: 'bg-amber-100 text-amber-800' },
  publishing:  { label: 'Publică…',    cls: 'bg-blue-100 text-blue-700' },
  published:   { label: 'Publicat ✓',  cls: 'bg-green-100 text-green-700' },
  failed:      { label: 'Eșuat',       cls: 'bg-red-100 text-red-700' },
  rolled_back: { label: 'Anulat (rollback)', cls: 'bg-orange-100 text-orange-800' },
  cancelled:   { label: 'Oprit',       cls: 'bg-gray-100 text-gray-500' },
};

export default async function ImportV2Page() {
  const db = makeAdminClient();

  const [{ data: profiles }, { data: jobs }, { data: suppliers }] = await Promise.all([
    db.from('supplier_mapping_profiles')
      .select('id, supplier_id, category_id, name, version, is_active, feed_id, created_at')
      .eq('is_active', true)
      .order('id', { ascending: false }),
    db.from('import_jobs')
      .select('id, supplier_id, profile_id, mode, status, rows_total, rows_mapped, rows_error, rows_staged, created_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(30),
    db.from('suppliers').select('id, name'),
  ]);

  const supplierName = new Map((suppliers ?? []).map(s => [s.id, s.name]));
  const profileName = new Map((profiles ?? []).map(p => [p.id, p.name]));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import V2</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalogul universal: profiluri de mapare per furnizor, importuri cu verificare (dry-run),
            aprobare și rollback.
          </p>
        </div>
        <Link href="/admin/import-v2/profiles/nou"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
          + Profil nou
        </Link>
      </div>

      {/* Profiluri */}
      <section className="space-y-3">
        <h2 className="font-semibold">Profiluri de mapare</h2>
        {(profiles ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Niciun profil încă. Creează primul profil ca să imporți un furnizor în catalogul universal.
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {(profiles ?? []).map(p => (
              <div key={p.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {supplierName.get(p.supplier_id) ?? `Furnizor #${p.supplier_id}`} · v{p.version}
                    {p.feed_id ? ' · feed URL configurat' : ' · sursă: fișier urcat'}
                  </div>
                </div>
                <RunJobButton profileId={p.id} supplierId={p.supplier_id} feedId={p.feed_id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Joburi */}
      <section className="space-y-3">
        <h2 className="font-semibold">Istoric importuri</h2>
        {(jobs ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Niciun import rulat încă.</div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-muted/50">
                  <th className="p-3">Data</th>
                  <th className="p-3">Furnizor</th>
                  <th className="p-3">Profil</th>
                  <th className="p-3">Mod</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Rânduri</th>
                  <th className="p-3 text-right">Erori</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(jobs ?? []).map(j => {
                  const st = STATUS_LABELS[j.status] ?? { label: j.status, cls: 'bg-gray-100' };
                  return (
                    <tr key={j.id} className="border-b last:border-0">
                      <td className="p-3 whitespace-nowrap">{new Date(j.created_at).toLocaleString('ro-RO')}</td>
                      <td className="p-3">{supplierName.get(j.supplier_id) ?? `#${j.supplier_id}`}</td>
                      <td className="p-3">{j.profile_id ? (profileName.get(j.profile_id) ?? `#${j.profile_id}`) : '—'}</td>
                      <td className="p-3">{j.mode === 'dry_run' ? 'verificare' : j.mode === 'staged' ? 'cu aprobare' : 'direct'}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}>{st.label}</span></td>
                      <td className="p-3 text-right">{j.rows_total?.toLocaleString('ro-RO')}</td>
                      <td className="p-3 text-right">{j.rows_error > 0 ? <span className="text-red-600">{j.rows_error}</span> : 0}</td>
                      <td className="p-3">
                        <Link className="text-primary underline text-xs" href={`/admin/import-v2/jobs/${j.id}`}>
                          detalii
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
