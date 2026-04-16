'use client'

import { useState, useEffect, useCallback } from 'react'

interface Product {
  id: string
  part_number: string
  brand: string
  name: string
  price: number
  price_b2b: number | null
  price_old: number | null
  stock: number
  stock_incoming: number
  is_active: boolean
  images: string[]
  diameter: number | null
  width: number | null
  pcd: string | null
  et_offset: number | null
  winning_supplier_id: number | null
  last_synced_at: string | null
}

interface EditState {
  id: string
  field: string
  value: string
}

export default function ProduseClient({ suppliers }: { suppliers: { id: number; name: string }[] }) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<EditState | null>(null)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [deleteAllStep, setDeleteAllStep] = useState<0 | 1 | 2>(0)
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    if (filterActive) params.set('active', filterActive)
    if (filterSupplier) params.set('supplier', filterSupplier)
    const res = await fetch(`/api/admin/produse?${params}`)
    const data = await res.json()
    setProducts(data.data || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [page, search, filterActive, filterSupplier])

  useEffect(() => { load() }, [load])

  const FIELD_RANGES: Record<string, { min: number; max: number; label: string }> = {
    price:          { min: 0,    max: 999999, label: 'Preț' },
    price_b2b:      { min: 0,    max: 999999, label: 'Preț B2B' },
    price_old:      { min: 0,    max: 999999, label: 'Preț vechi' },
    stock:          { min: 0,    max: 9999999, label: 'Stoc' },
    stock_incoming: { min: 0,    max: 9999999, label: 'Stoc viitor' },
    diameter:       { min: 10,   max: 30,     label: 'Diametru (inch)' },
    width:          { min: 4,    max: 16,     label: 'Lățime (J)' },
    et_offset:      { min: -100, max: 150,    label: 'ET offset' },
  }

  // Inline edit save
  async function saveEdit(id: string, field: string, value: string) {
    const isNumeric = ['price', 'price_b2b', 'price_old', 'stock', 'stock_incoming', 'diameter', 'width', 'et_offset'].includes(field)
    const parsed = isNumeric
      ? (value === '' ? null : parseFloat(value))
      : field === 'is_active' ? value === 'true'
      : value || null

    if (isNumeric && parsed !== null && parsed !== undefined) {
      const range = FIELD_RANGES[field]
      if (range && (isNaN(parsed as number) || (parsed as number) < range.min || (parsed as number) > range.max)) {
        setMsg(`✗ ${range.label} trebuie să fie între ${range.min} și ${range.max}`)
        return
      }
    }

    const res = await fetch(`/api/admin/produse/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: parsed }),
    })
    if (!res.ok) {
      const data = await res.json()
      setMsg(`✗ ${data.error || 'Eroare la salvare'}`)
      return
    }
    setEditing(null)
    load()
  }

  // Delete one
  async function deleteOne(id: string) {
    if (!confirm('Ștergi produsul?')) return
    await fetch(`/api/admin/produse/${id}`, { method: 'DELETE' })
    load()
  }

  // Bulk actions
  async function runBulk() {
    if (!selected.size || !bulkAction) return
    if (bulkAction === 'delete' && !confirm(`Ștergi ${selected.size} produse?`)) return
    setBulkLoading(true)
    setMsg('')
    const res = await fetch('/api/admin/produse/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action: bulkAction, value: bulkValue }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg(`✓ ${data.updated ?? data.deleted} produse actualizate`)
      setSelected(new Set())
      load()
    } else {
      setMsg(`✗ ${data.error}`)
    }
    setBulkLoading(false)
  }

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set())
    else setSelected(new Set(products.map(p => p.id)))
  }

  const toggle = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  async function deleteAll() {
    setDeleteAllLoading(true)
    const res = await fetch('/api/admin/produse/delete-all', { method: 'DELETE' })
    const data = await res.json()
    setDeleteAllLoading(false)
    setDeleteAllStep(0)
    if (res.ok) {
      setMsg(`✓ ${data.deleted} produse șterse`)
      load()
    } else {
      setMsg(`✗ ${data.error}`)
    }
  }

  const totalPages = Math.ceil(total / limit)

  const EditCell = ({ p, field, display }: { p: Product; field: string; display: string }) => {
    const isEditing = editing?.id === p.id && editing?.field === field
    if (isEditing) {
      return (
        <input
          autoFocus
          className="w-full border rounded px-1 py-0.5 text-xs bg-background"
          defaultValue={editing.value}
          onBlur={e => saveEdit(p.id, field, e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveEdit(p.id, field, (e.target as HTMLInputElement).value)
            if (e.key === 'Escape') setEditing(null)
          }}
        />
      )
    }
    return (
      <span
        className="cursor-pointer hover:bg-yellow-50 hover:text-yellow-800 px-1 py-0.5 rounded block w-full"
        title="Click pentru editare"
        onClick={() => setEditing({ id: p.id, field, value: display })}
      >
        {display || <span className="text-muted-foreground/40">—</span>}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-card border rounded-xl p-4">
        <input
          className="border rounded-lg px-3 py-2 text-sm bg-background w-full sm:w-64"
          placeholder="Caută brand, denumire, cod..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select className="border rounded-lg px-3 py-2 text-sm bg-background flex-1 sm:flex-none" value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(1) }}>
          <option value="">Toate statusurile</option>
          <option value="true">Activ</option>
          <option value="false">Inactiv</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm bg-background flex-1 sm:flex-none" value={filterSupplier} onChange={e => { setFilterSupplier(e.target.value); setPage(1) }}>
          <option value="">Toți furnizorii</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} produse</span>
        <button
          onClick={() => setDeleteAllStep(1)}
          className="w-full sm:w-auto sm:ml-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
        >
          🗑 Șterge toate produsele
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-3 items-center bg-blue-50 border border-blue-200 rounded-xl p-3">
          <span className="text-sm font-semibold text-blue-800">{selected.size} selectate</span>
          <select className="border rounded-lg px-2 py-1.5 text-sm bg-white" value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkValue('') }}>
            <option value="">Alege acțiune...</option>
            <option value="activate">Activează</option>
            <option value="deactivate">Dezactivează</option>
            <option value="set_price">Setează preț fix</option>
            <option value="price_formula">Formulă preț (ex: {'{price}'} * 1.10)</option>
            <option value="set_stock">Setează stoc</option>
            <option value="delete">🗑 Șterge</option>
          </select>
          {['set_price', 'price_formula', 'set_stock'].includes(bulkAction) && (
            <input
              className="border rounded-lg px-2 py-1.5 text-sm bg-white w-48 font-mono"
              placeholder={bulkAction === 'price_formula' ? '{price} * 1.10' : 'valoare'}
              value={bulkValue}
              onChange={e => setBulkValue(e.target.value)}
            />
          )}
          <button
            onClick={runBulk}
            disabled={bulkLoading || !bulkAction}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {bulkLoading ? 'Se aplică...' : 'Aplică'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-blue-600 hover:underline">Anulează</button>
          {msg && <span className={`text-sm font-medium ${msg.startsWith('✓') ? 'text-green-700' : 'text-red-700'}`}>{msg}</span>}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 w-8">
                  <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} />
                </th>
                <th className="p-3 text-left font-medium w-12">Img</th>
                <th className="p-3 text-left font-medium">Cod / Brand</th>
                <th className="p-3 text-left font-medium">Denumire</th>
                <th className="p-3 text-right font-medium">Preț</th>
                <th className="p-3 text-right font-medium">Preț B2B</th>
                <th className="p-3 text-center font-medium">Stoc</th>
                <th className="p-3 text-center font-medium">Status</th>
                <th className="p-3 text-center font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Se încarcă...</td></tr>
              )}
              {!loading && products.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Niciun produs găsit.</td></tr>
              )}
              {products.map(p => (
                <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/20 ${selected.has(p.id) ? 'bg-blue-50' : ''}`}>
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  </td>
                  <td className="p-3">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" className="w-10 h-10 object-cover rounded" />
                      : <div className="w-10 h-10 bg-muted rounded" />}
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-xs text-muted-foreground"><EditCell p={p} field="part_number" display={p.part_number} /></div>
                    <div className="font-medium"><EditCell p={p} field="brand" display={p.brand} /></div>
                  </td>
                  <td className="p-3 max-w-[240px]">
                    <EditCell p={p} field="name" display={p.name} />
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[p.diameter && `${p.diameter}"`, p.width && `${p.width}J`, p.pcd, p.et_offset && `ET${p.et_offset}`].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <EditCell p={p} field="price" display={p.price?.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} />
                  </td>
                  <td className="p-3 text-right">
                    <EditCell p={p} field="price_b2b" display={p.price_b2b ? p.price_b2b.toLocaleString('ro-RO', { minimumFractionDigits: 2 }) : ''} />
                  </td>
                  <td className="p-3 text-center">
                    <EditCell p={p} field="stock" display={String(p.stock ?? 0)} />
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => fetch(`/api/admin/produse/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !p.is_active }) }).then(load)}
                      className={`px-2 py-0.5 rounded-full text-xs font-bold cursor-pointer ${p.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {p.is_active ? 'ACTIV' : 'INACTIV'}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => deleteOne(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Șterge</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-muted-foreground">Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40 hover:bg-muted">← Anterior</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40 hover:bg-muted">Următor →</button>
            </div>
          </div>
        )}
      </div>
      {/* Delete All Modal */}
      {deleteAllStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-red-600 px-8 py-6 text-white">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-2xl font-bold">Atenție! Acțiune ireversibilă</h2>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-4">
              <p className="text-gray-800 text-base leading-relaxed">
                Ești pe cale să ștergi <strong className="text-red-600">TOATE produsele</strong> din baza de date.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-1">
                <p>• <strong>{total.toLocaleString()} produse</strong> vor fi șterse permanent</p>
                <p>• Această acțiune <strong>nu poate fi anulată</strong></p>
                <p>• Toate datele asociate (prețuri, stocuri, imagini) vor fi pierdute</p>
              </div>

              {deleteAllStep === 1 && (
                <p className="text-gray-600 text-sm font-medium">
                  Apasă <strong>Confirmă prima oară</strong> pentru a continua.
                </p>
              )}
              {deleteAllStep === 2 && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                  <p className="text-yellow-900 text-sm font-bold">
                    Ultima confirmare — ești absolut sigur?
                  </p>
                  <p className="text-yellow-800 text-sm mt-1">
                    Apasă <strong>Da, șterge tot</strong> pentru a executa ștergerea definitivă.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 bg-gray-50 border-t flex gap-3 justify-end">
              <button
                onClick={() => setDeleteAllStep(0)}
                disabled={deleteAllLoading}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Anulează
              </button>
              {deleteAllStep === 1 && (
                <button
                  onClick={() => setDeleteAllStep(2)}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold"
                >
                  Confirmă prima oară
                </button>
              )}
              {deleteAllStep === 2 && (
                <button
                  onClick={deleteAll}
                  disabled={deleteAllLoading}
                  className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  {deleteAllLoading ? 'Se șterge...' : 'Da, șterge tot'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
