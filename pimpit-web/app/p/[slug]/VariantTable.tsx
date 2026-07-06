'use client';

/**
 * Tabelul de variante al unei familii: specificațiile tipizate ale fiecărei
 * variante + cantitate + adaugă în coș (POST /api/cart cu variant_id).
 */
import { useState } from 'react';

interface Variant {
  id: string;
  part_number: string;
  name_suffix: string | null;
  price: number | null;
  price_old: number | null;
  stock: number;
  stock_incoming: number;
  attrs: Record<string, unknown>;
}

interface AttrDef {
  code: string;
  label: string;
  unit: string | null;
  data_type: string;
}

function formatAttr(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(' / ');
  if (typeof value === 'object') {
    const r = value as { min?: number; max?: number };
    if (r.min !== undefined && r.max !== undefined) {
      return r.min === r.max ? String(r.min) : `${r.min}–${r.max}`;
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'Da' : 'Nu';
  return String(value);
}

export default function VariantTable({ variants, attributeDefs }: {
  variants: Variant[];
  attributeDefs: AttrDef[];
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Coloane: doar atributele care apar pe cel puțin o variantă
  const usedCodes = attributeDefs.filter(d =>
    variants.some(v => v.attrs?.[d.code] !== undefined && v.attrs?.[d.code] !== null)
  );

  async function addToCart(v: Variant) {
    setBusy(v.id);
    setMessage(null);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: v.id, quantity: qty[v.id] ?? 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMessage({ id: v.id, text: 'Adăugat în coș ✓', ok: true });
    } catch (e) {
      setMessage({ id: v.id, text: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (variants.length === 0) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nicio variantă activă.</div>;
  }

  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b bg-muted/50">
            <th className="p-3">Cod</th>
            {usedCodes.map(d => (
              <th key={d.code} className="p-3 whitespace-nowrap">
                {d.label}{d.unit ? ` (${d.unit})` : ''}
              </th>
            ))}
            <th className="p-3">Stoc</th>
            <th className="p-3 text-right">Preț</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {variants.map(v => (
            <tr key={v.id} className="border-b last:border-0 align-middle">
              <td className="p-3 font-mono text-xs whitespace-nowrap">{v.part_number}</td>
              {usedCodes.map(d => (
                <td key={d.code} className="p-3 whitespace-nowrap">{formatAttr(v.attrs?.[d.code])}</td>
              ))}
              <td className="p-3 whitespace-nowrap">
                {v.stock > 0
                  ? <span className="text-green-600">{v.stock} buc</span>
                  : v.stock_incoming > 0
                    ? <span className="text-amber-600">pe drum ({v.stock_incoming})</span>
                    : <span className="text-red-500">epuizat</span>}
              </td>
              <td className="p-3 text-right whitespace-nowrap">
                {v.price_old && v.price && v.price_old > v.price && (
                  <span className="line-through text-muted-foreground text-xs mr-2">
                    {v.price_old.toLocaleString('ro-RO')} lei
                  </span>
                )}
                <span className="font-bold">{v.price?.toLocaleString('ro-RO') ?? '—'} lei</span>
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2 justify-end">
                  {message?.id === v.id && (
                    <span className={`text-xs ${message.ok ? 'text-green-600' : 'text-red-600'}`}>{message.text}</span>
                  )}
                  <input
                    type="number" min={1} max={Math.max(1, v.stock)} value={qty[v.id] ?? 1}
                    onChange={e => setQty(q => ({ ...q, [v.id]: Math.max(1, Number(e.target.value)) }))}
                    className="w-16 border rounded-md px-2 py-1.5 text-sm"
                    disabled={v.stock <= 0}
                  />
                  <button
                    onClick={() => addToCart(v)}
                    disabled={busy !== null || v.stock <= 0 || !v.price}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 whitespace-nowrap">
                    {busy === v.id ? 'Adaug…' : 'În coș'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
