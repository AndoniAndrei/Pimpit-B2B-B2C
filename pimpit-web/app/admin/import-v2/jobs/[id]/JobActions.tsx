'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Acțiunile disponibile pe un job, în funcție de stare:
 *  - dry_run încheiat  → „Rulează importul real" (job nou staged, aceleași setări)
 *  - staged (ne-dry)   → „Publică în catalog" / „Renunță"
 *  - published         → „Anulează importul (rollback)"
 */
export default function JobActions({ jobId, status, mode, supplierId, profileId, feedId, snapshotPath }: {
  jobId: string;
  status: string;
  mode: string;
  supplierId: number;
  profileId: number | null;
  feedId: number | null;
  snapshotPath: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'publish' | 'rollback' | 'cancel', confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/import-v2/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runReal() {
    if (!profileId) return;
    if (!confirm('Rulează importul real cu aceleași setări?\n\nDatele vor fi pregătite din nou și vei putea apăsa „Publică" la final.')) return;
    setBusy('rerun');
    setError(null);
    try {
      const res = await fetch('/api/admin/import-v2/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          profile_id: profileId,
          feed_id: feedId,
          snapshot_path: feedId ? null : snapshotPath,
          mode: 'staged',
        }),
      });
      const data = await res.json();
      if (!data.job_id) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/admin/import-v2/jobs/${data.job_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  const isDryRun = mode === 'dry_run';

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {error && <div className="text-sm text-red-600">Eroare: {error}</div>}
      <div className="flex flex-wrap gap-3">
        {status === 'staged' && isDryRun && (
          <button onClick={runReal} disabled={busy !== null}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {busy === 'rerun' ? 'Pornesc…' : '▶ Rulează importul real'}
          </button>
        )}
        {status === 'staged' && !isDryRun && (
          <>
            <button
              onClick={() => act('publish', 'Publici aceste modificări în catalogul live?\n\nPoți anula ulterior cu Rollback.')}
              disabled={busy !== null}
              className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium disabled:opacity-50">
              {busy === 'publish' ? 'Public…' : '✓ Publică în catalog'}
            </button>
            <button
              onClick={() => act('cancel', 'Renunți la acest import? Nimic nu a fost publicat.')}
              disabled={busy !== null}
              className="px-4 py-2 rounded-md border text-sm disabled:opacity-50">
              Renunță
            </button>
          </>
        )}
        {status === 'published' && (
          <button
            onClick={() => act('rollback', 'Anulezi acest import?\n\nOfertele revin la starea dinaintea importului. Prețurile și stocurile afectate se recalculează automat.')}
            disabled={busy !== null}
            className="px-4 py-2 rounded-md border border-orange-300 text-orange-700 text-sm font-medium disabled:opacity-50">
            {busy === 'rollback' ? 'Anulez…' : '↩ Anulează importul (rollback)'}
          </button>
        )}
        {isDryRun && status === 'staged' && (
          <span className="text-xs text-muted-foreground self-center">
            Verificarea nu a modificat nimic în catalog.
          </span>
        )}
      </div>
    </div>
  );
}
