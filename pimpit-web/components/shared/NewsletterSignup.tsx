'use client'

import { useState, FormEvent } from 'react'
import { Mail, CheckCircle2 } from 'lucide-react'

/**
 * Premium newsletter signup — CARiD-style "Unlock our Perks" strip.
 * Optimistic UX: submit shows a thank-you state immediately. Backend
 * wiring (Mailchimp / Brevo / Supabase newsletter table) is a future
 * task — for now the email is just collected client-side.
 */
export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || submitted) return
    setSubmitted(true)
    // TODO: POST to /api/newsletter once backend is wired.
  }

  return (
    <div className="bg-pimpit-surface-2 border-y border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-10">
        <div className="grid md:grid-cols-[1fr,auto] items-center gap-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-full bg-pimpit-accent/10 items-center justify-center">
              <Mail className="w-5 h-5 text-pimpit-accent" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-pimpit-text">
                Acces la oferte premium
              </h3>
              <p className="text-sm text-pimpit-text-muted mt-1 max-w-md">
                Abonează-te pentru reduceri exclusive, lansări noi și ghiduri
                de fitment direct pe email.
              </p>
            </div>
          </div>

          {submitted ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-pimpit-success">
              <CheckCircle2 className="w-5 h-5" />
              Mulțumim! Verifică inbox-ul.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresa ta de email"
                className="flex-1 md:w-72 bg-white border border-pimpit-border rounded-md px-4 py-3 text-sm text-pimpit-text placeholder:text-pimpit-text-muted focus:outline-none focus:border-pimpit-accent focus:ring-1 focus:ring-pimpit-accent transition-colors"
              />
              <button type="submit" className="btn-gold rounded-md px-5 py-3 text-sm uppercase whitespace-nowrap">
                Abonează-mă
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
