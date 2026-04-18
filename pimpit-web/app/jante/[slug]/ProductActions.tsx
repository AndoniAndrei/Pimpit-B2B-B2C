'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart'

const NEEDS_HELP = '__help__'

interface Props {
  productId: string
  stock: number
  etValues: number[]       // empty when et_min == et_max (single value, no picker needed)
  etMin: number | null
  etMax: number | null
  pcdOptions: string[]     // empty when < 3 fitments (no picker needed)
}

export default function ProductActions({ productId, stock, etValues, etMin, etMax, pcdOptions }: Props) {
  const router = useRouter()
  const fetchCart = useCartStore(s => s.fetchCart)
  const setIsOpen = useCartStore(s => s.setIsOpen)
  const [etChoice, setEtChoice] = useState<string>('')
  const [pcdChoice, setPcdChoice] = useState<string>('')
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsEt = etValues.length > 0
  const needsPcd = pcdOptions.length > 0
  const outOfStock = stock <= 0

  async function addToCart() {
    setError(null)
    if (needsEt && !etChoice) {
      setError('Alege un ET din listă sau selectează „Am nevoie de ajutor".')
      return
    }
    if (needsPcd && !pcdChoice) {
      setError('Alege o prindere din listă sau selectează „Am nevoie de ajutor".')
      return
    }
    setLoading(true)
    try {
      const body: Record<string, unknown> = { product_id: productId, quantity: qty }
      if (etChoice === NEEDS_HELP) body.needs_help_et = true
      else if (etChoice) body.selected_et = parseFloat(etChoice)
      if (pcdChoice === NEEDS_HELP) body.needs_help_pcd = true
      else if (pcdChoice) body.selected_pcd = pcdChoice

      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Nu s-a putut adăuga produsul în coș.')
      }
      await fetchCart()
      setIsOpen(true)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {needsEt && (
        <label className="block">
          <span className="block text-sm font-medium mb-1">
            ET {etMin != null && etMax != null ? `(valori disponibile: ${etMin}–${etMax})` : ''}
          </span>
          <select
            className="w-full border rounded-lg px-3 py-2 bg-background"
            value={etChoice}
            onChange={e => setEtChoice(e.target.value)}
            disabled={outOfStock || loading}
          >
            <option value="">Alege ET-ul dorit…</option>
            {etValues.map(v => (
              <option key={v} value={String(v)}>ET{v}</option>
            ))}
            <option value={NEEDS_HELP}>Am nevoie de ajutor cu alegerea ET</option>
          </select>
        </label>
      )}

      {needsPcd && (
        <label className="block">
          <span className="block text-sm font-medium mb-1">Prindere (PCD)</span>
          <select
            className="w-full border rounded-lg px-3 py-2 bg-background"
            value={pcdChoice}
            onChange={e => setPcdChoice(e.target.value)}
            disabled={outOfStock || loading}
          >
            <option value="">Alege prinderea dorită…</option>
            {pcdOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value={NEEDS_HELP}>Am nevoie de ajutor pentru alegerea prinderii</option>
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Cantitate</label>
        <input
          type="number"
          min={1}
          max={stock || 1}
          className="w-20 border rounded-lg px-2 py-1.5 bg-background"
          value={qty}
          onChange={e => setQty(Math.max(1, Math.min(stock || 1, parseInt(e.target.value) || 1)))}
          disabled={outOfStock || loading}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <button
        onClick={addToCart}
        disabled={outOfStock || loading}
        className="w-full bg-primary text-primary-foreground py-4 rounded-lg font-bold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Se adaugă…' : outOfStock ? 'Indisponibil' : 'Adaugă în coș'}
      </button>
    </div>
  )
}
