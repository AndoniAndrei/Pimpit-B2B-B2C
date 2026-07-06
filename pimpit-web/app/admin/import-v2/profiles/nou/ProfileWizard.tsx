'use client';

/**
 * Wizard de configurare a unui profil de import v2, pentru non-developeri:
 *  1. Furnizor + categorie țintă
 *  2. Sursa de date (fișier urcat sau feed URL) → coloane + rânduri de probă
 *  3. Maparea coloanelor, cu PREVIEW LIVE (motorul de mapare rulează în browser
 *     pe rândurile de probă — exact același cod ca pe server)
 *  4. Preț & reguli (valută, formulă, branduri noi, filtru de rânduri)
 *  5. Salvare + rulare verificare (dry-run)
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mapRow, type MappingContext, type FieldMappingLite, type TransformRuleLite } from '@/lib/import/engine/mapper';

// ── Tipuri context ───────────────────────────────────────────────────────────

interface Ctx {
  categories: { id: number; parent_id: number | null; slug: string; name: string }[];
  attributes_by_category: Record<number, AttrDef[]>;
  brands: { id: number; name: string; slug: string; aliases: string[] }[];
  currency_rates: Record<string, number>;
  suppliers: { id: number; name: string; is_active: boolean }[];
}

interface AttrDef {
  id: number;
  code: string;
  label: string;
  data_type: string;
  unit: string | null;
  is_required: boolean;
  enum_options: string[] | null;
  validation: { min?: number; max?: number } | null;
}

interface SampleData {
  snapshot_path?: string;
  feed_id?: number;
  format: string;
  delimiter: string;
  columns: string[];
  sample_rows: Record<string, unknown>[];
  row_count: number;
}

const CORE_FIELDS = [
  { code: 'part_number', label: 'Cod produs (part number)', required: true, hint: 'Identificatorul unic al produsului la furnizor' },
  { code: 'brand',       label: 'Brand',                    required: true, hint: 'Numele brandului' },
  { code: 'family_name', label: 'Model / familie',          required: false, hint: 'Ex. „JR11" — grupează variantele pe o singură pagină' },
  { code: 'name',        label: 'Denumire completă',        required: false, hint: 'Poți combina coloane: {Model} {Marime}' },
  { code: 'ean',         label: 'EAN',                      required: false, hint: '' },
  { code: 'description', label: 'Descriere',                required: false, hint: '' },
] as const;

const OFFER_FIELDS = [
  { code: 'raw_price',      label: 'Preț furnizor', hint: 'Prețul brut din feed' },
  { code: 'price_b2b',      label: 'Preț B2B (opțional)', hint: 'Coloană cu preț dedicat clienților B2B' },
  { code: 'stock',          label: 'Stoc',          hint: '' },
  { code: 'stock_incoming', label: 'Stoc pe drum',  hint: '' },
  { code: 'supplier_sku',   label: 'SKU furnizor',  hint: '' },
] as const;

const MEDIA_FIELDS = ['image_url_1', 'image_url_2', 'image_url_3', 'image_url_4'] as const;

// ── Componenta principală ────────────────────────────────────────────────────

export default function ProfileWizard() {
  const router = useRouter();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Pasul 1
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [profileName, setProfileName] = useState('');

  // Pasul 2
  const [sourceTab, setSourceTab] = useState<'upload' | 'url'>('upload');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedFormat, setFeedFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');
  const [loadingSample, setLoadingSample] = useState(false);
  const [sample, setSample] = useState<SampleData | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  // Pasul 3 — mapări: cheie "kind:code" → expresie sursă
  const [mappings, setMappings] = useState<Record<string, string>>({});

  // Pasul 4 — reguli
  const [currency, setCurrency] = useState('RON');
  const [priceFormula, setPriceFormula] = useState('');
  const [autoCreateBrands, setAutoCreateBrands] = useState(true);
  const [filterColumn, setFilterColumn] = useState('');
  const [filterOp, setFilterOp] = useState<'in' | 'not_in' | 'not_empty'>('not_empty');
  const [filterValues, setFilterValues] = useState('');

  // Pasul 5
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/import-v2/context')
      .then(r => r.json())
      .then(d => (d.error ? setCtxError(d.error) : setCtx(d)))
      .catch(e => setCtxError(String(e)));
  }, []);

  const attrDefs: AttrDef[] = useMemo(
    () => (ctx && categoryId ? (ctx.attributes_by_category[categoryId] ?? []) : []),
    [ctx, categoryId]
  );

  // ── Construiește contextul de mapare pentru preview (identic cu serverul) ──
  const previewCtx: MappingContext | null = useMemo(() => {
    if (!ctx || !categoryId) return null;
    const fieldMappings: FieldMappingLite[] = [];
    let pos = 0;
    for (const [key, expr] of Object.entries(mappings)) {
      if (!expr.trim()) continue;
      const [kind, code] = key.split(':', 2);
      fieldMappings.push({
        target_kind: kind as FieldMappingLite['target_kind'],
        target_code: code,
        source_expression: expr.trim(),
        transform: [],
        required: (kind === 'core' && (code === 'part_number' || code === 'brand')) ||
                  (kind === 'offer' && code === 'raw_price' && !priceFormula.trim()),
        default_value: null,
        position: pos++,
      });
    }
    const rules: TransformRuleLite[] = [];
    let rpos = 0;
    if (filterColumn.trim()) {
      rules.push({
        rule_type: 'row_filter',
        config: {
          column: filterColumn.trim(),
          op: filterOp,
          values: filterOp === 'not_empty' ? undefined : filterValues.split(',').map(v => v.trim()).filter(Boolean),
        },
        position: rpos++,
      });
    }
    rules.push({ rule_type: 'brand_normalize', config: { auto_create: autoCreateBrands }, position: rpos++ });
    if (currency !== 'RON') {
      rules.push({ rule_type: 'currency_convert', config: { currency }, position: rpos++ });
    }
    if (priceFormula.trim()) {
      rules.push({ rule_type: 'formula', config: { target: 'offer:price', expression: priceFormula.trim() }, position: rpos++ });
    }
    return {
      supplierId: Number(supplierId) || 0,
      fieldMappings,
      rules,
      attributeDefs: attrDefs.map(d => ({
        id: d.id, code: d.code, data_type: d.data_type as never,
        enum_options: d.enum_options, is_required: d.is_required, validation: d.validation,
      })),
      brands: ctx.brands,
      rates: ctx.currency_rates,
    };
  }, [ctx, categoryId, mappings, currency, priceFormula, autoCreateBrands, filterColumn, filterOp, filterValues, supplierId, attrDefs]);

  const preview = useMemo(() => {
    if (!previewCtx || !sample) return [];
    return sample.sample_rows.slice(0, 5).map(row => mapRow(row, previewCtx));
  }, [previewCtx, sample]);

  // ── Acțiuni ────────────────────────────────────────────────────────────────

  async function loadSampleFromFile(file: File) {
    setLoadingSample(true);
    setSampleError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/import-v2/sample', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSample(data);
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSample(false);
    }
  }

  async function loadSampleFromUrl() {
    if (!supplierId || !feedUrl.trim()) return;
    setLoadingSample(true);
    setSampleError(null);
    try {
      // 1. creează feed-ul
      const feedRes = await fetch('/api/admin/import-v2/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          name: `Feed ${new URL(feedUrl).hostname}`,
          feed_url: feedUrl.trim(),
          format: feedFormat,
        }),
      });
      const feed = await feedRes.json();
      if (!feedRes.ok) throw new Error(feed.error ?? `HTTP ${feedRes.status}`);
      // 2. descarcă sample
      const res = await fetch('/api/admin/import-v2/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_id: feed.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSample({ ...data, feed_id: feed.id });
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSample(false);
    }
  }

  async function saveAndRun(runAfter: boolean) {
    if (!previewCtx || !supplierId || !categoryId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/import-v2/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          category_id: Number(categoryId),
          name: profileName || `Profil ${Date.now()}`,
          feed_id: sample?.feed_id ?? null,
          field_mappings: previewCtx.fieldMappings,
          transform_rules: previewCtx.rules,
        }),
      });
      const prof = await res.json();
      if (!res.ok) throw new Error(prof.error ?? `HTTP ${res.status}`);

      if (!runAfter) {
        router.push('/admin/import-v2');
        return;
      }
      const jobRes = await fetch('/api/admin/import-v2/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          profile_id: prof.id,
          feed_id: sample?.feed_id ?? null,
          snapshot_path: sample?.snapshot_path ?? null,
          mode: 'dry_run',
        }),
      });
      const job = await jobRes.json();
      if (!jobRes.ok && !job.job_id) throw new Error(job.error ?? `HTTP ${jobRes.status}`);
      router.push(`/admin/import-v2/jobs/${job.job_id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  // ── Validări per pas ───────────────────────────────────────────────────────

  const canNext =
    step === 1 ? !!supplierId && !!categoryId :
    step === 2 ? !!sample :
    step === 3 ? !!mappings['core:part_number']?.trim() && !!mappings['core:brand']?.trim() :
    step === 4 ? !!priceFormula.trim() || !!mappings['offer:raw_price']?.trim() :
    true;

  if (ctxError) return <div className="text-red-600">Eroare: {ctxError}</div>;
  if (!ctx) return <div className="text-muted-foreground">Se încarcă…</div>;

  const setMapping = (key: string, val: string) =>
    setMappings(m => ({ ...m, [key]: val }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Profil de import nou</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurezi o singură dată cum se citește feed-ul unui furnizor; apoi importurile rulează cu un click.
        </p>
      </div>

      {/* Pași */}
      <div className="flex gap-2 text-sm">
        {['Furnizor', 'Sursă date', 'Mapare coloane', 'Preț & reguli', 'Salvare'].map((label, i) => (
          <div key={label} className={`px-3 py-1.5 rounded-full border ${
            step === i + 1 ? 'bg-primary text-primary-foreground border-primary' :
            step > i + 1 ? 'bg-muted' : 'text-muted-foreground'
          }`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {/* ── Pasul 1 ── */}
      {step === 1 && (
        <div className="rounded-lg border p-6 space-y-4">
          <Field label="Furnizor *">
            <select className="w-full border rounded-md px-3 py-2" value={supplierId}
              onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— alege —</option>
              {ctx.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Categoria produselor din acest feed *">
            <select className="w-full border rounded-md px-3 py-2" value={categoryId}
              onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— alege —</option>
              {ctx.categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? '   › ' : ''}{c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Numele profilului">
            <input className="w-full border rounded-md px-3 py-2" value={profileName}
              placeholder="ex. Wheeltrade – Jante"
              onChange={e => setProfileName(e.target.value)} />
          </Field>
        </div>
      )}

      {/* ── Pasul 2 ── */}
      {step === 2 && (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setSourceTab('upload')}
              className={`px-3 py-1.5 rounded-md border text-sm ${sourceTab === 'upload' ? 'bg-primary text-primary-foreground' : ''}`}>
              Fișier (CSV / Excel / JSON)
            </button>
            <button onClick={() => setSourceTab('url')}
              className={`px-3 py-1.5 rounded-md border text-sm ${sourceTab === 'url' ? 'bg-primary text-primary-foreground' : ''}`}>
              Feed URL
            </button>
          </div>

          {sourceTab === 'upload' ? (
            <Field label="Alege fișierul primit de la furnizor">
              <input type="file" accept=".csv,.xlsx,.xls,.json,.txt"
                onChange={e => e.target.files?.[0] && loadSampleFromFile(e.target.files[0])} />
            </Field>
          ) : (
            <div className="space-y-3">
              <Field label="URL-ul feed-ului">
                <input className="w-full border rounded-md px-3 py-2" value={feedUrl}
                  placeholder="https://furnizor.ro/feed.csv"
                  onChange={e => setFeedUrl(e.target.value)} />
              </Field>
              <Field label="Format">
                <select className="border rounded-md px-3 py-2" value={feedFormat}
                  onChange={e => setFeedFormat(e.target.value as never)}>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="xlsx">Excel (XLSX)</option>
                </select>
              </Field>
              <button onClick={loadSampleFromUrl} disabled={loadingSample || !feedUrl.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">
                {loadingSample ? 'Descarc…' : 'Descarcă și analizează'}
              </button>
            </div>
          )}

          {loadingSample && sourceTab === 'upload' && <div className="text-sm text-muted-foreground">Analizez fișierul…</div>}
          {sampleError && <div className="text-sm text-red-600">Eroare: {sampleError}</div>}
          {sample && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
              ✓ {sample.row_count.toLocaleString('ro-RO')} rânduri, {sample.columns.length} coloane detectate
              {sample.format === 'csv' && ` (delimitator „${sample.delimiter === '\t' ? 'TAB' : sample.delimiter}")`}
              <div className="text-muted-foreground mt-1 truncate">
                Coloane: {sample.columns.slice(0, 12).join(', ')}{sample.columns.length > 12 ? '…' : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sugestii de coloane pentru toate input-urile de mapare */}
      {sample && (
        <datalist id="feed-columns">
          {sample.columns.map(c => <option key={c} value={c} />)}
        </datalist>
      )}

      {/* ── Pasul 3 ── */}
      {step === 3 && sample && (
        <div className="space-y-4">
          <div className="rounded-lg border p-6 space-y-3">
            <h3 className="font-semibold">Câmpuri de bază</h3>
            <p className="text-xs text-muted-foreground">
              Scrie numele coloanei din feed (apare sugestia când tastezi) sau combină mai multe coloane cu acolade: {'{Coloana1} {Coloana2}'}
            </p>
            {CORE_FIELDS.map(f => (
              <MappingInput key={f.code} label={f.label + (f.required ? ' *' : '')} hint={f.hint}
                value={mappings[`core:${f.code}`] ?? ''}
                onChange={v => setMapping(`core:${f.code}`, v)} />
            ))}
          </div>

          <div className="rounded-lg border p-6 space-y-3">
            <h3 className="font-semibold">Ofertă (preț & stoc)</h3>
            {OFFER_FIELDS.map(f => (
              <MappingInput key={f.code} label={f.label} hint={f.hint}
                value={mappings[`offer:${f.code}`] ?? ''}
                onChange={v => setMapping(`offer:${f.code}`, v)} />
            ))}
          </div>

          {attrDefs.length > 0 && (
            <div className="rounded-lg border p-6 space-y-3">
              <h3 className="font-semibold">Specificații ({attrDefs.length} atribute pentru categoria aleasă)</h3>
              {attrDefs.map(d => (
                <MappingInput key={d.code}
                  label={`${d.label}${d.unit ? ` (${d.unit})` : ''}${d.is_required ? ' *' : ''}`}
                  hint={d.data_type === 'range' ? 'Acceptă și intervale: „20-50" sau liste „20,25,30"' : ''}
                  value={mappings[`attribute:${d.code}`] ?? ''}
                  onChange={v => setMapping(`attribute:${d.code}`, v)} />
              ))}
            </div>
          )}

          <div className="rounded-lg border p-6 space-y-3">
            <h3 className="font-semibold">Imagini</h3>
            {MEDIA_FIELDS.map((code, i) => (
              <MappingInput key={code} label={`Imagine ${i + 1}`} hint=""
                value={mappings[`media:${code}`] ?? ''}
                onChange={v => setMapping(`media:${code}`, v)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Pasul 4 ── */}
      {step === 4 && (
        <div className="rounded-lg border p-6 space-y-4">
          <Field label="Moneda prețurilor din feed">
            <select className="border rounded-md px-3 py-2" value={currency} onChange={e => setCurrency(e.target.value)}>
              {Object.keys(ctx.currency_rates).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Dacă nu e RON, prețul se convertește automat cu cursul din sistem
              ({currency !== 'RON' ? `1 ${currency} = ${ctx.currency_rates[currency]} RON` : '—'}).
            </p>
          </Field>
          <Field label="Formulă de preț (opțional — are prioritate peste conversia automată)">
            <input className="w-full border rounded-md px-3 py-2 font-mono text-sm" value={priceFormula}
              placeholder="ex. {PretNet} * 5.08 * 1.19 * 1.25"
              onChange={e => setPriceFormula(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Folosește numele coloanelor între acolade. Rezultatul = prețul final de vânzare în RON.
            </p>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoCreateBrands} onChange={e => setAutoCreateBrands(e.target.checked)} />
            Creează automat brandurile care nu există încă în sistem
          </label>
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Filtru de rânduri (opțional)</h3>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <input className="border rounded-md px-3 py-2 w-44" list="feed-columns" placeholder="coloană"
                value={filterColumn} onChange={e => setFilterColumn(e.target.value)} />
              <select className="border rounded-md px-2 py-2" value={filterOp} onChange={e => setFilterOp(e.target.value as never)}>
                <option value="not_empty">nu e goală</option>
                <option value="in">este una din</option>
                <option value="not_in">NU este una din</option>
              </select>
              {filterOp !== 'not_empty' && (
                <input className="border rounded-md px-3 py-2 flex-1 min-w-40" placeholder="valori separate prin virgulă"
                  value={filterValues} onChange={e => setFilterValues(e.target.value)} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Pasul 5 ── */}
      {step === 5 && (
        <div className="rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold">Totul e gata</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>Furnizor: <b className="text-foreground">{ctx.suppliers.find(s => s.id === supplierId)?.name}</b></li>
            <li>Categorie: <b className="text-foreground">{ctx.categories.find(c => c.id === categoryId)?.name}</b></li>
            <li>Sursă: <b className="text-foreground">{sample?.feed_id ? 'Feed URL' : 'Fișier urcat'}</b> ({sample?.row_count.toLocaleString('ro-RO')} rânduri)</li>
            <li>Câmpuri mapate: <b className="text-foreground">{Object.values(mappings).filter(v => v.trim()).length}</b></li>
            <li>Preț: <b className="text-foreground">{priceFormula.trim() ? `formulă: ${priceFormula}` : `conversie automată din ${currency}`}</b></li>
          </ul>
          <p className="text-sm text-muted-foreground">
            „Salvează și verifică" rulează o simulare completă (dry-run) pe tot feed-ul —
            nu modifică nimic în catalog, doar îți arată raportul.
          </p>
          {saveError && <div className="text-sm text-red-600">Eroare: {saveError}</div>}
          <div className="flex gap-3">
            <button onClick={() => saveAndRun(true)} disabled={saving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {saving ? 'Salvez și rulez…' : 'Salvează și verifică (recomandat)'}
            </button>
            <button onClick={() => saveAndRun(false)} disabled={saving}
              className="px-4 py-2 rounded-md border text-sm disabled:opacity-50">
              Doar salvează
            </button>
          </div>
        </div>
      )}

      {/* ── Preview live (pașii 3–4) ── */}
      {(step === 3 || step === 4) && preview.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold text-sm mb-2">Preview live — primele {preview.length} rânduri prin maparea curentă</h3>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-1.5">Cod</th><th className="p-1.5">Brand</th><th className="p-1.5">Denumire</th>
                  <th className="p-1.5">Preț RON</th><th className="p-1.5">Stoc</th>
                  <th className="p-1.5">Specificații</th><th className="p-1.5">Probleme</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((m, i) => (
                  <tr key={i} className="border-b align-top">
                    <td className="p-1.5 font-mono">{m.skipped ? <span className="text-muted-foreground">filtrat</span> : m.core.partNumber || '—'}</td>
                    <td className="p-1.5">{m.core.brandName || '—'}</td>
                    <td className="p-1.5">{m.core.name || '—'}</td>
                    <td className="p-1.5">{m.offer.price != null ? m.offer.price.toLocaleString('ro-RO') : '—'}</td>
                    <td className="p-1.5">{m.offer.stock}</td>
                    <td className="p-1.5 text-muted-foreground">
                      {Object.entries(m.attributes).map(([k, v]) =>
                        `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') || '—'}
                    </td>
                    <td className="p-1.5">
                      {m.errors.length > 0
                        ? <span className="text-red-600">{m.errors.map(e => e.message).join('; ')}</span>
                        : <span className="text-green-600">✓ OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigare */}
      <div className="flex justify-between">
        <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
          className="px-4 py-2 rounded-md border text-sm disabled:opacity-40">
          ← Înapoi
        </button>
        {step < 5 && (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">
            Continuă →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}

function MappingInput({ label, hint, value, onChange }: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
      <div>
        <span className="text-sm">{label}</span>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input className="border rounded-md px-3 py-1.5 text-sm" list="feed-columns"
        placeholder="coloană din feed sau {template}"
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
