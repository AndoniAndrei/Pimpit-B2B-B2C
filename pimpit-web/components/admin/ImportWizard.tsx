'use client';

import { useState } from 'react';
import { evaluateFormula } from '@/lib/formulaEvaluator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedConfig {
  name: string;
  feed_url: string;
  format: 'csv' | 'json';
  delimiter: string;
  auth_method: 'none' | 'api_key' | 'basic_auth';
  api_key: string;
  token: string;
  customer_id: string;
}

interface FieldMappings {
  part_number: string;
  brand: string;
  name: string;
  price_formula: string;
  stock: string;
  stock_incoming: string;
  diameter: string;
  width: string;
  pcd: string;
  et_offset: string;
  center_bore: string;
  images: string;
  color: string;
  finish: string;
}

const EMPTY_MAPPINGS: FieldMappings = {
  part_number: '', brand: '', name: '', price_formula: '',
  stock: '', stock_incoming: '', diameter: '', width: '',
  pcd: '', et_offset: '', center_bore: '', images: '', color: '', finish: '',
};

const PRODUCT_FIELDS: { key: keyof FieldMappings; label: string; required: boolean; hint?: string }[] = [
  { key: 'part_number', label: 'Cod produs', required: true },
  { key: 'brand', label: 'Brand / Marcă', required: true },
  { key: 'name', label: 'Denumire produs', required: true },
  { key: 'price_formula', label: 'Formula preț (RON)', required: true, hint: 'Ex: {Price_EUR} * 5 * 1.19  sau  {Pret} * 1.10' },
  { key: 'stock', label: 'Stoc disponibil', required: false },
  { key: 'stock_incoming', label: 'Stoc în tranzit', required: false },
  { key: 'diameter', label: 'Diametru (inch)', required: false },
  { key: 'width', label: 'Lățime', required: false },
  { key: 'pcd', label: 'PCD', required: false },
  { key: 'et_offset', label: 'ET / Offset', required: false },
  { key: 'center_bore', label: 'Alezaj central', required: false },
  { key: 'images', label: 'URL Imagine', required: false },
  { key: 'color', label: 'Culoare', required: false },
  { key: 'finish', label: 'Finisaj', required: false },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  supplierId?: number;
  initialConfig?: FeedConfig;
  initialMappings?: FieldMappings;
  onSaved?: (supplierId: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportWizard({ supplierId, initialConfig, initialMappings, onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<FeedConfig>(initialConfig || {
    name: '', feed_url: '', format: 'csv', delimiter: ',',
    auth_method: 'none', api_key: '', token: '', customer_id: '',
  });
  const [mappings, setMappings] = useState<FieldMappings>(initialMappings || EMPTY_MAPPINGS);
  const [columns, setColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  // ─── Step 1: Fetch Preview ─────────────────────────────────────────────────

  async function handlePreview() {
    if (!config.feed_url) { setError('Introdu URL-ul feed-ului'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/feeds/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setColumns(data.columns);
      setPreviewRows(data.rows);
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 3: Calculate preview prices ────────────────────────────────────

  function calcPreviewPrice(row: Record<string, any>): string {
    if (!mappings.price_formula) return '—';
    try {
      const price = evaluateFormula(mappings.price_formula, row);
      return `${price.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON`;
    } catch {
      return 'Formulă invalidă';
    }
  }

  // ─── Save & Import ────────────────────────────────────────────────────────

  async function handleSave(andImport = false) {
    setLoading(true);
    setError('');
    try {
      let savedId = supplierId;

      if (supplierId) {
        const res = await fetch(`/api/admin/feeds/${supplierId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, field_mappings: mappings }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      } else {
        const res = await fetch('/api/admin/feeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, field_mappings: mappings }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error); return; }
        const d = await res.json();
        savedId = d.id;
      }

      if (andImport && savedId) {
        setImporting(true);
        const res = await fetch(`/api/admin/feeds/${savedId}/import`, { method: 'POST' });
        const result = await res.json();
        setImportResult(result);
        setImporting(false);
      }

      if (onSaved && savedId) onSaved(savedId);
      if (!andImport) setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1, label: 'Sursă & Autentificare' },
          { n: 2, label: 'Mapare câmpuri' },
          { n: 3, label: 'Previzualizare' },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
              ${step >= n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {n}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${step >= n ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            {n < 3 && <div className={`w-8 h-px ${step > n ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="bg-card border rounded-xl p-6 space-y-5">
          <h2 className="text-xl font-bold">Configurare sursă de date</h2>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Denumire sursă *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Ex: Furnizor A - Jante"
                value={config.name}
                onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">URL feed *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono"
                placeholder="https://furnizor.com/feed/products.csv"
                value={config.feed_url}
                onChange={e => setConfig(c => ({ ...c, feed_url: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Format</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  value={config.format}
                  onChange={e => setConfig(c => ({ ...c, format: e.target.value as any }))}
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              {config.format === 'csv' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Delimitator CSV</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                    value={config.delimiter}
                    onChange={e => setConfig(c => ({ ...c, delimiter: e.target.value }))}
                  >
                    <option value=",">Virgulă (,)</option>
                    <option value=";">Punct-virgulă (;)</option>
                    <option value="\t">Tab</option>
                    <option value="|">Pipe (|)</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Autentificare</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={config.auth_method}
                onChange={e => setConfig(c => ({ ...c, auth_method: e.target.value as any }))}
              >
                <option value="none">Fără autentificare</option>
                <option value="api_key">API Key (în URL)</option>
                <option value="basic_auth">Basic Auth (user + parolă)</option>
              </select>
            </div>

            {config.auth_method === 'api_key' && (
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  placeholder="Cheia va înlocui {API_KEY} din URL sau va fi adăugată ca parametru"
                  value={config.api_key}
                  onChange={e => setConfig(c => ({ ...c, api_key: e.target.value }))}
                />
              </div>
            )}

            {config.auth_method === 'basic_auth' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Utilizator / Customer ID</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                    value={config.customer_id}
                    onChange={e => setConfig(c => ({ ...c, customer_id: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Parolă / Token</label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                    value={config.token}
                    onChange={e => setConfig(c => ({ ...c, token: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handlePreview}
            disabled={loading || !config.feed_url}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Se încarcă preview...' : 'Preia Preview →'}
          </button>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Preview table */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground">
              Primele rânduri din feed ({columns.length} coloane detectate)
            </h3>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b">
                    {columns.slice(0, 8).map(col => (
                      <th key={col} className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                    ))}
                    {columns.length > 8 && <th className="p-2 text-muted-foreground">+{columns.length - 8} coloane</th>}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {columns.slice(0, 8).map(col => (
                        <td key={col} className="p-2 max-w-[120px] truncate" title={String(row[col] ?? '')}>{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Field mapping */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-1">Mapare câmpuri</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Selectează coloana corespunzătoare din feed pentru fiecare câmp al produsului.
            </p>

            <div className="space-y-4">
              {PRODUCT_FIELDS.map(field => (
                <div key={field.key} className="grid grid-cols-[1fr_1fr] gap-4 items-start">
                  <div>
                    <label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.hint && <p className="text-xs text-muted-foreground mt-0.5">{field.hint}</p>}
                  </div>

                  {field.key === 'price_formula' ? (
                    <div>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono"
                        placeholder="{Price_EUR} * 5 * 1.19"
                        value={mappings.price_formula}
                        onChange={e => setMappings(m => ({ ...m, price_formula: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {columns.map(col => (
                          <button
                            key={col}
                            type="button"
                            className="text-xs bg-muted hover:bg-primary hover:text-primary-foreground px-2 py-0.5 rounded cursor-pointer"
                            onClick={() => setMappings(m => ({ ...m, price_formula: m.price_formula + `{${col}}` }))}
                          >
                            {col}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                      value={mappings[field.key]}
                      onChange={e => setMappings(m => ({ ...m, [field.key]: e.target.value }))}
                    >
                      <option value="">— nu mapa —</option>
                      {columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted">
                ← Înapoi
              </button>
              <button
                onClick={() => {
                  if (!mappings.part_number || !mappings.brand || !mappings.name || !mappings.price_formula) {
                    setError('Câmpurile obligatorii (Cod produs, Brand, Denumire, Formula preț) trebuie mapate');
                    return;
                  }
                  setError('');
                  setStep(3);
                }}
                className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm"
              >
                Previzualizare prețuri →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-1">Previzualizare prețuri calculate</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Formula: <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">{mappings.price_formula}</code>
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Cod produs</th>
                    <th className="text-left p-2 font-medium">Brand</th>
                    <th className="text-left p-2 font-medium">Denumire</th>
                    <th className="text-right p-2 font-medium text-primary">Preț calculat</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2 font-mono text-xs">{row[mappings.part_number] || '—'}</td>
                      <td className="p-2">{row[mappings.brand] || '—'}</td>
                      <td className="p-2 text-muted-foreground truncate max-w-[200px]">{row[mappings.name] || '—'}</td>
                      <td className="p-2 text-right font-bold text-primary">{calcPreviewPrice(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importResult && (
            <div className={`p-4 rounded-xl border text-sm ${importResult.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {importResult.error ? (
                <p>Eroare: {importResult.error}</p>
              ) : (
                <div>
                  <p className="font-bold mb-1">Import finalizat cu succes!</p>
                  <p>Rânduri preluate: <strong>{importResult.fetched}</strong></p>
                  <p>Produse salvate/actualizate: <strong>{importResult.inserted}</strong></p>
                  <p>Ignorat (date lipsă): <strong>{importResult.skipped}</strong></p>
                  <p>Durată: <strong>{importResult.durationMs}ms</strong></p>
                  {importResult.errors?.length > 0 && (
                    <details className="mt-2"><summary className="cursor-pointer">Erori ({importResult.errors.length})</summary>
                      <ul className="mt-1 space-y-1">{importResult.errors.map((e: string, i: number) => <li key={i} className="text-xs">{e}</li>)}</ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-5 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted">
              ← Înapoi
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="px-5 py-2.5 border border-primary text-primary rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Se salvează...' : 'Salvează configurația'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={loading || importing}
              className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {importing ? 'Se importă...' : 'Salvează și importă acum'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Success ── */}
      {step === 4 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Configurație salvată!</h2>
          <p className="text-green-700 text-sm mb-6">Sursa a fost configurată. Poți rula importul oricând din lista de surse.</p>
          <a href="/admin/importuri" className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm">
            Mergi la lista de surse
          </a>
        </div>
      )}
    </div>
  );
}
