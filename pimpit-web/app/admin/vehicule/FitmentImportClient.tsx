'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Summary {
  valid: number;
  rejected: number;
  makes: number;
  models: number;
  vehicles: number;
  staggered: number;
  applied: boolean;
  fitmentsSent?: number;
  error?: string;
}

export default function FitmentImportClient({ hasData }: { hasData: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState<'dry' | 'apply' | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(apply: boolean) {
    if (apply && !confirm(
      'Import fitmenturi în baza de date?\n\n' +
      'Operațiunea e sigură și re-rulabilă: vehiculele existente se actualizează, ' +
      'fitmenturile duplicate sunt ignorate. Durează 1–3 minute.'
    )) return;

    setRunning(apply ? 'apply' : 'dry');
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/fitment-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
      if (apply) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Import galerie fitmenturi</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Încarcă cele ~57.000 de setup-uri reale (an, marcă, model, trim, dimensiuni
          jante față/spate, anvelope, rubbing, stance) din fișierul livrat cu aplicația.
          {hasData && ' Datele existente nu se dublează — importul e re-rulabil.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => run(false)}
          disabled={running !== null}
          className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {running === 'dry' ? 'Verific…' : '1. Verifică datele (dry-run)'}
        </button>
        <button
          onClick={() => run(true)}
          disabled={running !== null}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {running === 'apply' ? 'Import în curs… (1–3 min)' : '2. Importă fitmenturile'}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm p-3">
          Eroare: {error}
        </div>
      )}

      {result && (
        <div className={`rounded-md border text-sm p-4 space-y-1 ${
          result.applied ? 'bg-green-50 border-green-200' : 'bg-muted'
        }`}>
          <div className="font-medium">
            {result.applied
              ? `✓ Import finalizat — ${result.fitmentsSent?.toLocaleString('ro-RO')} fitmenturi trimise`
              : 'Rezultat verificare (nu s-a scris nimic în DB):'}
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-muted-foreground">
            <li>Rânduri valide: <b>{result.valid.toLocaleString('ro-RO')}</b></li>
            <li>Respinse (goale): <b>{result.rejected.toLocaleString('ro-RO')}</b></li>
            <li>Mărci: <b>{result.makes}</b></li>
            <li>Modele: <b>{result.models}</b></li>
            <li>Vehicule unice: <b>{result.vehicles.toLocaleString('ro-RO')}</b></li>
            <li>Setup-uri staggered: <b>{result.staggered.toLocaleString('ro-RO')}</b></li>
          </ul>
        </div>
      )}
    </div>
  );
}
