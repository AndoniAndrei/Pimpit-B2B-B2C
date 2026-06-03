'use client'

import { useRouter } from 'next/navigation'
import { useState, FormEvent } from 'react'
import { YEARS, MAKE_NAMES, VEHICLE_MAKES } from '@/lib/vehicleData'

interface Props {
  /** Visual variant: 'hero' is the big homepage version; 'inline' is the slimmer product-page version. */
  variant?: 'hero' | 'inline'
  /** CTA label. */
  ctaLabel?: string
}

export default function VehicleSelector({ variant = 'hero', ctaLabel = 'Caută jante compatibile' }: Props) {
  const router = useRouter()
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')

  const models = make ? VEHICLE_MAKES[make] ?? [] : []
  const isComplete = year && make && model

  function submit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (year && make && model) {
      params.set('vehicle', `${year}-${make}-${model}`)
    }
    // Forward to /jante; vehicle fitment lookup is a future enhancement
    // (product schema has no vehicle FK yet — see APP_STATE.md).
    router.push(`/jante${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const isHero = variant === 'hero'

  return (
    <form
      onSubmit={submit}
      className={
        isHero
          ? 'w-full bg-pimpit-surface border border-pimpit-border p-5 md:p-6'
          : 'w-full bg-pimpit-surface-2 border border-pimpit-border p-4'
      }
    >
      <div className={isHero ? 'mb-4' : 'mb-3'}>
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-pimpit-accent mb-1">
          — Fitment Check
        </div>
        <div className={isHero ? 'font-display font-semibold text-pimpit-text text-lg uppercase tracking-wide' : 'font-display font-semibold text-pimpit-text text-base uppercase tracking-wide'}>
          Spune-ne ce mașină ai
        </div>
      </div>

      <div className={isHero ? 'grid grid-cols-1 md:grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-3 gap-2'}>
        <Select value={year} onChange={setYear} label="An">
          <option value="">An</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select value={make} onChange={(v) => { setMake(v); setModel('') }} label="Marcă">
          <option value="">Marcă</option>
          {MAKE_NAMES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
        <Select value={model} onChange={setModel} label="Model" disabled={!make}>
          <option value="">{make ? 'Model' : 'Alege marca'}</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
      </div>

      <button
        type="submit"
        className={
          (isHero ? 'mt-5 w-full py-4 ' : 'mt-3 w-full py-3 ') +
          'group flex items-center justify-center gap-3 font-display font-semibold uppercase tracking-[0.22em] text-sm bg-pimpit-accent text-stone-900 hover:bg-pimpit-accent-hover transition-colors disabled:opacity-50'
        }
      >
        {ctaLabel}
        <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
      </button>

      {!isComplete && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-pimpit-text-muted">
          Sau {' '}
          <button
            type="button"
            onClick={() => router.push('/jante')}
            className="underline underline-offset-2 hover:text-pimpit-accent transition-colors"
          >
            răsfoiește tot catalogul
          </button>
        </p>
      )}
    </form>
  )
}

function Select({
  value,
  onChange,
  label,
  disabled,
  children,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-pimpit-bg border border-pimpit-border px-3 py-3 text-sm font-mono text-pimpit-text focus:outline-none focus:border-pimpit-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors appearance-none"
      >
        {children}
      </select>
    </label>
  )
}
