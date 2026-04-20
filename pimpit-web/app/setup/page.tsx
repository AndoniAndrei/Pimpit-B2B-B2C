'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [token, setToken] = useState('')

  async function handleSetup() {
    if (!token.trim()) {
      setStatus('error')
      setMessage('Token-ul de setup este obligatoriu.')
      return
    }
    setStatus('loading')
    const res = await fetch('/api/setup-admin', {
      method: 'POST',
      headers: { 'x-setup-token': token.trim() },
    })
    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setMessage(data.message + ' (' + data.email + ')')
    } else {
      setStatus('error')
      setMessage(data.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4">
      <div className="w-full max-w-md bg-card border rounded-xl p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Setup Administrator</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Apasă butonul de mai jos pentru a seta contul tău curent ca administrator.
          <br />
          <strong>Funcționează o singură dată</strong> — după ce există un admin, pagina se blochează.
        </p>

        {status === 'idle' && (
          <div className="space-y-3">
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Token de setup (ADMIN_BOOTSTRAP_TOKEN)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              autoComplete="off"
            />
            <button
              onClick={handleSetup}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold"
            >
              Setează-mă ca Administrator
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-muted-foreground">Se procesează...</div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm font-medium">
              ✓ {message}
            </div>
            <a
              href="/admin"
              className="block w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold"
            >
              Mergi la panoul de admin →
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              ✗ {message}
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="w-full border py-3 rounded-lg font-medium text-sm hover:bg-muted"
            >
              Încearcă din nou
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
