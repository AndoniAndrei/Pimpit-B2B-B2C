'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Props {
  supplierId: number;
  hasMappings: boolean;
}

export default function ImportActions({ supplierId, hasMappings }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/feeds/${supplierId}/import`, { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto">
      <div className="flex gap-2">
        <Link
          href={`/admin/importuri/${supplierId}/edit`}
          className="flex-1 sm:flex-none text-center px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-muted"
        >
          Configurează
        </Link>
        <button
          onClick={runImport}
          disabled={loading || !hasMappings}
          className="flex-1 sm:flex-none px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50"
          title={!hasMappings ? 'Configurează câmpurile mai întâi' : ''}
        >
          {loading ? 'Se importă...' : '▶ Importă acum'}
        </button>
      </div>

      {result && (
        <div className={`text-xs rounded-lg px-3 py-2 text-left sm:text-right ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {result.error
            ? `Eroare: ${result.error}`
            : `✓ ${result.upserted} produse salvate din ${result.fetched} rânduri (${(result.durationMs/1000).toFixed(1)}s)`}
        </div>
      )}
    </div>
  );
}
