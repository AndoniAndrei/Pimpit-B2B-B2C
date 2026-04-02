'use client';

import { useState, useCallback, useRef } from 'react';
import { evaluateFormula, validateFormula, extractFormulaVariables } from '@/lib/formulaEvaluator';
import { parseSmartNumber, detectPriceAmbiguity, formatPrice } from '@/lib/priceParser';
import { resolveTemplate } from '@/lib/genericParser';

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

interface ExtraField {
  label: string;
  column: string;
}

interface FieldMappings {
  part_number: string; brand: string; name: string; price_formula: string;
  stock: string; stock_incoming: string; diameter: string; width: string;
  pcd: string; et_offset: string; center_bore: string;
  images: string; images_2: string; images_3: string; images_4: string; images_5: string;
  color: string; finish: string;
  extra_fields: ExtraField[];
}

const EMPTY_MAPPINGS: FieldMappings = {
  part_number: '', brand: '', name: '', price_formula: '',
  stock: '', stock_incoming: '', diameter: '', width: '',
  pcd: '', et_offset: '', center_bore: '',
  images: '', images_2: '', images_3: '', images_4: '', images_5: '',
  color: '', finish: '', extra_fields: [],
};

// fieldType: 'template' = free text + {col} substitution, 'formula' = math formula, 'select' = single column dropdown, 'image' = URL column
const STANDARD_FIELDS: {
  key: keyof Omit<FieldMappings, 'extra_fields'>;
  label: string;
  required: boolean;
  fieldType: 'template' | 'formula' | 'select' | 'image';
  hint?: string;
}[] = [
  { key: 'part_number',   label: 'Cod produs (SKU)',    required: true,  fieldType: 'template',
    hint: 'Selectează o coloană sau combină: {SKU}-{Variant}' },
  { key: 'brand',         label: 'Brand / Marcă',       required: true,  fieldType: 'template',
    hint: 'Ex: {Brand} sau text fix "Borbet"' },
  { key: 'name',          label: 'Denumire produs',     required: true,  fieldType: 'template',
    hint: 'Combină câmpuri: {Brand} {Diameter}" {Width}/{ET} {PCD}' },
  { key: 'price_formula', label: 'Formula preț RON',    required: true,  fieldType: 'formula',
    hint: 'Ex: {Price_EUR} * 5 * 1.19  sau  {Pret} * 1.10 + 20' },
  { key: 'stock',         label: 'Stoc disponibil',     required: false, fieldType: 'select' },
  { key: 'stock_incoming',label: 'Stoc în tranzit',     required: false, fieldType: 'select' },
  { key: 'diameter',      label: 'Diametru (inch)',      required: false, fieldType: 'select' },
  { key: 'width',         label: 'Lățime',              required: false, fieldType: 'select' },
  { key: 'pcd',           label: 'PCD',                 required: false, fieldType: 'template',
    hint: 'Ex: {PCD} sau {Boli}x{BCD}' },
  { key: 'et_offset',     label: 'ET / Offset',         required: false, fieldType: 'select' },
  { key: 'center_bore',   label: 'Alezaj central',      required: false, fieldType: 'select' },
  { key: 'images',        label: 'Imagine 1 (URL)',      required: false, fieldType: 'image' },
  { key: 'images_2',      label: 'Imagine 2 (URL)',      required: false, fieldType: 'image' },
  { key: 'images_3',      label: 'Imagine 3 (URL)',      required: false, fieldType: 'image' },
  { key: 'color',         label: 'Culoare',             required: false, fieldType: 'template',
    hint: 'Ex: {Color} sau {Culoare} {Finisaj}' },
  { key: 'finish',        label: 'Finisaj',             required: false, fieldType: 'template' },
];

interface Props {
  supplierId?: number;
  initialConfig?: Partial<FeedConfig>;
  initialMappings?: Partial<FieldMappings>;
  onSaved?: (id: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportWizard({ supplierId, initialConfig, initialMappings, onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<FeedConfig>({
    name: '', feed_url: '', format: 'csv', delimiter: ',',
    auth_method: 'none', api_key: '', token: '', customer_id: '',
    ...initialConfig,
  });
  const [mappings, setMappings] = useState<FieldMappings>({ ...EMPTY_MAPPINGS, ...initialMappings });
  const [columns, setColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [savedId, setSavedId] = useState<number | undefined>(supplierId);
  // Track which template field's column picker is open
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  // Refs for template inputs (to insert text at cursor)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Formula live validation
  const formulaValidation = mappings.price_formula
    ? validateFormula(mappings.price_formula) : null;

  // Insert {column} token at cursor position in a template input
  function insertToken(fieldKey: string, col: string) {
    const input = inputRefs.current[fieldKey];
    const token = `{${col}}`;
    if (input) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const newVal = input.value.slice(0, start) + token + input.value.slice(end);
      setMappings(m => ({ ...m, [fieldKey]: newVal }));
      // Restore focus + cursor after state update
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setMappings(m => ({ ...m, [fieldKey]: ((m as any)[fieldKey] || '') + token }));
    }
  }

  // Preview value for a template field with first data row
  function previewTemplate(template: string): string {
    if (!template || !previewRows[0]) return '';
    try { return resolveTemplate(template, previewRows[0]); } catch { return ''; }
  }

  // ── Step 1: fetch preview ─────────────────────────────────────────────────

  async function handlePreview() {
    if (!config.feed_url.trim()) { setError('URL-ul feed-ului este obligatoriu'); return; }
    if (!config.name.trim()) { setError('Denumirea sursei este obligatorie'); return; }
    setLoadingPreview(true);
    setError('');
    try {
      const res = await fetch('/api/admin/feeds/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eroare la preluarea preview'); return; }
      if (!data.columns?.length) { setError('Feed-ul nu conține coloane detectabile'); return; }
      setColumns(data.columns);
      setPreviewRows(data.rows || []);
      setStep(2);
    } catch (e: any) {
      setError('Eroare de rețea: ' + e.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  // ── Step 2: validate mappings ─────────────────────────────────────────────

  function handleGoToStep3() {
    if (!mappings.part_number) { setError('Câmpul "Cod produs" este obligatoriu'); return; }
    if (!mappings.brand)       { setError('Câmpul "Brand" este obligatoriu'); return; }
    if (!mappings.name)        { setError('Câmpul "Denumire" este obligatoriu'); return; }
    if (!mappings.price_formula.trim()) { setError('Formula de preț este obligatorie'); return; }
    if (formulaValidation && !formulaValidation.valid) {
      setError('Formula de preț are erori: ' + formulaValidation.error);
      return;
    }
    setError('');
    setStep(3);
  }

  // ── Price preview calculation ─────────────────────────────────────────────

  function calcPrice(row: Record<string, any>): { price: string; warning?: string } {
    if (!mappings.price_formula) return { price: '—' };
    try {
      const price = evaluateFormula(mappings.price_formula, row);
      // Check for price anomalies (suspiciously low)
      const warnings: string[] = [];
      const vars = extractFormulaVariables(mappings.price_formula);
      for (const v of vars) {
        const w = detectPriceAmbiguity(String(row[v] ?? ''));
        if (w) warnings.push(w);
      }
      return { price: formatPrice(price) + ' RON', warning: warnings[0] };
    } catch (e: any) {
      return { price: 'Eroare formulă', warning: e.message };
    }
  }

  // ── Save config ───────────────────────────────────────────────────────────

  async function handleSave(andImport = false) {
    setSaving(true);
    setError('');
    setImportResult(null);
    try {
      let id = savedId;

      if (id) {
        const res = await fetch(`/api/admin/feeds/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, field_mappings: mappings }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error || 'Eroare la salvare'); return; }
      } else {
        const res = await fetch('/api/admin/feeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, field_mappings: mappings }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error || 'Eroare la creare'); return; }
        const d = await res.json();
        id = d.id;
        setSavedId(id);
      }

      if (onSaved && id) onSaved(id);

      if (andImport && id) {
        setSaving(false);
        setImporting(true);
        const res = await fetch(`/api/admin/feeds/${id}/import`, { method: 'POST' });
        const result = await res.json();
        setImportResult({ ...result, ok: res.ok });
        setImporting(false);
      } else {
        setSaving(false);
        if (!andImport) {
          window.location.href = '/admin/importuri';
        }
      }
    } catch (e: any) {
      setError('Eroare de rețea: ' + e.message);
    } finally {
      setSaving(false);
      setImporting(false);
    }
  }

  // ── Extra fields management ───────────────────────────────────────────────

  const addExtraField = useCallback(() => {
    setMappings(m => ({ ...m, extra_fields: [...(m.extra_fields || []), { label: '', column: '' }] }));
  }, []);

  const updateExtraField = useCallback((idx: number, field: 'label' | 'column', value: string) => {
    setMappings(m => {
      const ef = [...(m.extra_fields || [])];
      ef[idx] = { ...ef[idx], [field]: value };
      return { ...m, extra_fields: ef };
    });
  }, []);

  const removeExtraField = useCallback((idx: number) => {
    setMappings(m => ({ ...m, extra_fields: (m.extra_fields || []).filter((_, i) => i !== idx) }));
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1, label: 'Sursă & Autentificare' },
          { n: 2, label: 'Mapare câmpuri' },
          { n: 3, label: 'Previzualizare & Salvare' },
        ].map(({ n, label }, i, arr) => (
          <div key={n} className="flex items-center gap-2">
            <button
              onClick={() => n < step ? setStep(n) : undefined}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${step === n ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                  : step > n ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                  : 'bg-muted text-muted-foreground'}`}
            >{n}</button>
            <span className={`text-sm font-medium hidden md:block
              ${step >= n ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            {i < arr.length - 1 && (
              <div className={`w-10 h-px mx-1 ${step > n ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ STEP 1 */}
      {step === 1 && (
        <div className="bg-card border rounded-2xl p-7 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Configurare sursă de date</h2>
            <p className="text-sm text-muted-foreground mt-1">Introdu URL-ul feed-ului și parametrii de conexiune.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Denumire sursă <span className="text-red-500">*</span></label>
              <input className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                placeholder="Ex: Furnizor A — Jante aluminiu"
                value={config.name}
                onChange={e => setConfig(c => ({ ...c, name: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5">URL feed <span className="text-red-500">*</span></label>
              <input className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background font-mono"
                placeholder="https://furnizor.com/products.csv"
                value={config.feed_url}
                onChange={e => setConfig(c => ({ ...c, feed_url: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">
                Folosește <code className="bg-muted px-1 rounded">{'{API_KEY}'}</code> sau{' '}
                <code className="bg-muted px-1 rounded">{'{TOKEN}'}</code> în URL pentru substituție automată.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Format fișier</label>
              <select className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                value={config.format}
                onChange={e => setConfig(c => ({ ...c, format: e.target.value as any }))}>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>

            {config.format === 'csv' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Delimitator CSV</label>
                <select className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                  value={config.delimiter}
                  onChange={e => setConfig(c => ({ ...c, delimiter: e.target.value }))}>
                  <option value=",">Virgulă  (,)</option>
                  <option value=";">Punct-virgulă  (;)</option>
                  <option value="\t">Tab  (\t)</option>
                  <option value="|">Pipe  (|)</option>
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Autentificare</label>
              <select className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                value={config.auth_method}
                onChange={e => setConfig(c => ({ ...c, auth_method: e.target.value as any }))}>
                <option value="none">Fără autentificare</option>
                <option value="api_key">API Key (înlocuit în URL)</option>
                <option value="basic_auth">Basic Auth (user + parolă)</option>
              </select>
            </div>

            {config.auth_method === 'api_key' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">API Key</label>
                <input type="password" className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                  placeholder="Înlocuiește {API_KEY} din URL"
                  value={config.api_key}
                  onChange={e => setConfig(c => ({ ...c, api_key: e.target.value }))} />
              </div>
            )}

            {config.auth_method === 'basic_auth' && (<>
              <div>
                <label className="block text-sm font-medium mb-1.5">Utilizator / Customer ID</label>
                <input className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                  value={config.customer_id}
                  onChange={e => setConfig(c => ({ ...c, customer_id: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Parolă / Token</label>
                <input type="password" className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                  value={config.token}
                  onChange={e => setConfig(c => ({ ...c, token: e.target.value }))} />
              </div>
            </>)}
          </div>

          <button onClick={handlePreview} disabled={loadingPreview || !config.feed_url.trim()}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm disabled:opacity-50 mt-2">
            {loadingPreview ? 'Se conectează și preia datele...' : 'Preia Preview →'}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ STEP 2 */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Data preview table */}
          <div className="bg-card border rounded-2xl p-5">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3">
              Preview date ({columns.length} coloane detectate în feed)
            </h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {columns.slice(0, 10).map(col => (
                      <th key={col} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap border-r last:border-0">
                        {col}
                      </th>
                    ))}
                    {columns.length > 10 && <th className="px-3 py-2 text-muted-foreground">+{columns.length - 10}</th>}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t">
                      {columns.slice(0, 10).map(col => (
                        <td key={col} className="px-3 py-2 max-w-[150px] truncate border-r last:border-0" title={String(row[col] ?? '')}>
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Field mappings */}
          <div className="bg-card border rounded-2xl p-7">
            <div className="mb-6">
              <h2 className="text-xl font-bold">Mapare câmpuri</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Asociază coloanele din feed cu câmpurile platformei. Câmpurile cu <span className="text-red-500">*</span> sunt obligatorii.
              </p>
            </div>

            <div className="space-y-4">
              {STANDARD_FIELDS.map(field => {
                const currentVal = (mappings as any)[field.key] || '';
                return (
                  <div key={field.key} className="grid grid-cols-[200px_1fr] gap-4 items-start">
                    <div className="pt-2">
                      <span className="text-sm font-medium">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      {field.hint && <p className="text-xs text-muted-foreground mt-0.5">{field.hint}</p>}
                    </div>

                    {/* ── FORMULA field ── */}
                    {field.fieldType === 'formula' && (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            ref={el => { inputRefs.current[field.key] = el; }}
                            className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-background font-mono pr-8
                              ${formulaValidation && !formulaValidation.valid ? 'border-red-400 bg-red-50' :
                                formulaValidation?.valid ? 'border-green-400' : ''}`}
                            placeholder="{Price_EUR} * 5 * 1.19 + 20"
                            value={mappings.price_formula}
                            onChange={e => setMappings(m => ({ ...m, price_formula: e.target.value }))}
                          />
                          {formulaValidation && (
                            <span className="absolute right-2 top-2.5 text-sm">
                              {formulaValidation.valid ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                        {formulaValidation && !formulaValidation.valid && (
                          <p className="text-xs text-red-600">{formulaValidation.error}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Click pe o coloană pentru a o insera:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {columns.map(col => (
                            <button key={col} type="button"
                              className="text-xs bg-muted hover:bg-primary/10 hover:text-primary border px-2 py-1 rounded-md font-mono transition-colors"
                              onClick={() => insertToken('price_formula', col)}>
                              {col}
                            </button>
                          ))}
                        </div>
                        {formulaValidation?.valid && previewRows[0] && (() => {
                          const { price, warning } = calcPrice(previewRows[0]);
                          return (
                            <div className={`text-xs px-3 py-2 rounded-lg ${warning ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                              {warning ? `⚠ ${warning}` : `✓ Exemplu preț calculat: ${price}`}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── TEMPLATE field (text + {col} substitution) ── */}
                    {field.fieldType === 'template' && (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            ref={el => { inputRefs.current[field.key] = el; }}
                            className="flex-1 border rounded-lg px-3 py-2.5 text-sm bg-background font-mono"
                            placeholder={field.hint || `{Coloana} sau text fix`}
                            value={currentVal}
                            onChange={e => setMappings(m => ({ ...m, [field.key]: e.target.value }))}
                            onFocus={() => setOpenPickerFor(field.key)}
                          />
                          <button type="button"
                            onClick={() => setOpenPickerFor(openPickerFor === field.key ? null : field.key)}
                            className="px-3 py-2 text-xs border rounded-lg bg-muted hover:bg-primary/10 hover:text-primary font-medium whitespace-nowrap">
                            + Coloană
                          </button>
                        </div>
                        {openPickerFor === field.key && (
                          <div className="flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-lg border">
                            {columns.map(col => (
                              <button key={col} type="button"
                                className="text-xs bg-white hover:bg-primary hover:text-primary-foreground border px-2 py-1 rounded-md font-mono transition-colors"
                                onClick={() => { insertToken(field.key, col); setOpenPickerFor(null); }}>
                                {col}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Live preview */}
                        {currentVal && previewRows[0] && (() => {
                          const preview = previewTemplate(currentVal);
                          return preview ? (
                            <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                              ✓ Preview: <strong>{preview}</strong>
                            </p>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* ── SELECT / IMAGE field ── */}
                    {(field.fieldType === 'select' || field.fieldType === 'image') && (
                      <select className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background"
                        value={currentVal}
                        onChange={e => setMappings(m => ({ ...m, [field.key]: e.target.value }))}>
                        <option value="">— nu mapa —</option>
                        {columns.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Extra / custom fields section */}
            <div className="mt-8 pt-6 border-t">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Câmpuri suplimentare</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mapează coloane din feed care nu au un câmp standard — vor fi stocate ca date custom pe produs.
                  </p>
                </div>
                <button onClick={addExtraField}
                  className="text-sm text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg font-medium">
                  + Adaugă câmp
                </button>
              </div>

              {(mappings.extra_fields || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-xl">
                  Niciun câmp suplimentar adăugat. Click "+ Adaugă câmp" pentru a mapa coloane extra.
                </p>
              )}

              <div className="space-y-3">
                {(mappings.extra_fields || []).map((ef, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <input className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
                      placeholder="Nume câmp (ex: Greutate, Material)"
                      value={ef.label}
                      onChange={e => updateExtraField(idx, 'label', e.target.value)} />
                    <select className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
                      value={ef.column}
                      onChange={e => updateExtraField(idx, 'column', e.target.value)}>
                      <option value="">— selectează coloana —</option>
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <button onClick={() => removeExtraField(idx)}
                      className="text-red-400 hover:text-red-600 px-2 py-2 rounded-lg hover:bg-red-50">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-7">
              <button onClick={() => { setStep(1); setError(''); }}
                className="px-5 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">
                ← Înapoi
              </button>
              <button onClick={handleGoToStep3}
                className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-semibold text-sm">
                Previzualizare prețuri →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ STEP 3 */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-card border rounded-2xl p-7">
            <h2 className="text-xl font-bold mb-1">Previzualizare prețuri calculate</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Formula: <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">{mappings.price_formula}</code>
            </p>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Cod produs</th>
                    <th className="text-left px-4 py-3 font-medium">Brand</th>
                    <th className="text-left px-4 py-3 font-medium">Denumire</th>
                    <th className="text-right px-4 py-3 font-medium text-primary">Preț calculat</th>
                    <th className="text-center px-4 py-3 font-medium">⚠</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 5).map((row, i) => {
                    const { price, warning } = calcPrice(row);
                    return (
                      <tr key={i} className={`border-t ${warning ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs">{row[mappings.part_number] || '—'}</td>
                        <td className="px-4 py-3 font-medium">{row[mappings.brand] || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{row[mappings.name] || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-primary">{price}</td>
                        <td className="px-4 py-3 text-center">
                          {warning && <span title={warning} className="text-yellow-600 cursor-help">⚠</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {previewRows.some(r => calcPrice(r).warning) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800">
                <strong>⚠ Atenție format preț:</strong> Unele valori pot fi ambigue (ex: "14.000" poate fi 14.000 sau 14000).
                Verifică că formula ta produce prețuri corecte înainte de import.
              </div>
            )}
          </div>

          {/* Import result */}
          {importResult && (
            <div className={`p-5 rounded-2xl border text-sm ${
              importResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {importResult.ok ? (
                <div className="text-green-800">
                  <p className="font-bold text-base mb-2">✓ Import finalizat cu succes!</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{importResult.fetched?.toLocaleString()}</div>
                      <div className="text-xs text-green-700">Rânduri citite</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{importResult.parsed?.toLocaleString()}</div>
                      <div className="text-xs text-green-700">Produse parsate</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-primary">{importResult.upserted?.toLocaleString()}</div>
                      <div className="text-xs text-green-700">Salvate în DB</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-muted-foreground">{importResult.skipped?.toLocaleString()}</div>
                      <div className="text-xs text-green-700">Ignorate</div>
                    </div>
                  </div>
                  {importResult.warnings?.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium">Avertismente ({importResult.warnings.length})</summary>
                      <ul className="mt-1 space-y-0.5 text-xs">{importResult.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
                    </details>
                  )}
                  {importResult.errors?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-red-700">Erori rânduri ({importResult.errors.length})</summary>
                      <ul className="mt-1 space-y-0.5 text-xs text-red-700">{importResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                    </details>
                  )}
                  <div className="mt-3 flex gap-3">
                    <a href="/admin/produse" className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">
                      Vezi produsele →
                    </a>
                    <a href="/admin/importuri" className="inline-block border px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/50">
                      Înapoi la importuri
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-red-800">
                  <p className="font-bold mb-1">✗ Import eșuat</p>
                  <p className="text-sm">{importResult.error}</p>
                </div>
              )}
            </div>
          )}

          {!importResult && (
            <div className="flex gap-3">
              <button onClick={() => { setStep(2); setError(''); }}
                className="px-5 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted">
                ← Înapoi
              </button>
              <button onClick={() => handleSave(false)} disabled={saving}
                className="px-5 py-2.5 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary/5 disabled:opacity-50">
                {saving ? 'Se salvează...' : 'Salvează configurația'}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving || importing}
                className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50">
                {importing ? '⏳ Se importă produsele...' : 'Salvează și importă acum'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
