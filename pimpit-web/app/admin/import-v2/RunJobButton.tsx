'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Rulează un import pentru un profil existent.
 * Profilurile cu feed URL pot rula direct; cele bazate pe fișier cer un fișier nou.
 */
export default function RunJobButton({ profileId, supplierId, feedId }: {
  profileId: number; supplierId: number; feedId: number | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createJob(snapshotPath: string | null) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/import-v2/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          profile_id: profileId,
          feed_id: snapshotPath ? null : feedId,
          snapshot_path: snapshotPath,
          mode: 'dry_run',
        }),
      });
      const data = await res.json();
      if (!data.job_id) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/admin/import-v2/jobs/${data.job_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  }

  async function uploadAndRun(file: File) {
    setRunning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/import-v2/sample', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await createJob(data.snapshot_path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600 max-w-60 truncate" title={error}>{error}</span>}
      {feedId ? (
        <button onClick={() => createJob(null)} disabled={running}
          className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted disabled:opacity-50">
          {running ? 'Rulează…' : 'Verifică feed-ul (dry-run)'}
        </button>
      ) : (
        <label className={`px-3 py-1.5 rounded-md border text-sm hover:bg-muted cursor-pointer ${running ? 'opacity-50 pointer-events-none' : ''}`}>
          {running ? 'Rulează…' : 'Urcă fișier nou și verifică'}
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.json,.txt"
            onChange={e => e.target.files?.[0] && uploadAndRun(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}
