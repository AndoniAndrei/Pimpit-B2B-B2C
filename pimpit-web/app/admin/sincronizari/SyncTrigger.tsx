'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncTrigger() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    if (!confirm('Sincronizarea poate dura câteva minute. Continui?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sincronizarea a eșuat')
      alert(
        `Sincronizare finalizată: ${data.succeeded}/${data.totalSuppliers} furnizori OK` +
        (data.failed ? ` (${data.failed} cu erori — vezi tabelul)` : '')
      )
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? 'Se sincronizează…' : 'Sincronizează Acum'}
    </button>
  )
}
