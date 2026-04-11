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
    <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end shrink-0">
      <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
        <Link
          href={`/admin/importuri/${supplierId}/edit`}
          className="text-center px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted truncate"
        >
          ⚙ Config
        </Link>
        <button
          onClick={runImport}
          disabled={loading || !hasMappings}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 truncate"
          title={!hasMappings ? 'Configurează câmpurile mai întâi' : ''}
        >
          {loading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
              <span>Import...</span>
            </>
          ) : (
            '▶ Importă'
          )}
        </button>
      </div>

      {result && (
        <div className={`text-xs rounded-lg px-3 py-2 ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {result.error
            ? `Eroare: ${result.error}`
            : `✓ ${result.upserted} produse din ${result.fetched} (${(result.durationMs / 1000).toFixed(1)}s)`}
        </div>
      )}
    </div>
  );
}
