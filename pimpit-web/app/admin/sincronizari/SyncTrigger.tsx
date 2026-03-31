'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncTrigger() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to trigger sync')
      alert('Sincronizarea a fost pornită pe Railway!')
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
      {loading ? 'Se pornește...' : 'Sincronizează Acum'}
    </button>
  )
}
