'use client'

import { useRouter } from 'next/navigation'
import { useState, FormEvent } from 'react'
import { YEARS, MAKE_NAMES, VEHICLE_MAKES } from '@/lib/vehicleData'

interface Props {
  variant?: 'hero' | 'inline'
  ctaLabel?: string
}

export default function VehicleSelector({ variant = 'hero', ctaLabel = 'Răsfoiește catalogul' }: Props) {
  const router = useRouter()
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')

  const models = make ? VEHICLE_MAKES[make] ?? [] : []

  function submit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (year && make && model) {
      params.set('vehicle', `${year}-${make}-${model}`)
    }
    router.push(`/jante${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="mb-4">
        <h2 className="text-base font-bold text-pimpit-text">Mașina ta</h2>
        <p className="text-xs text-pimpit-text-muted mt-0.5">
          Selecția vehiculului nu filtrează încă fitment-ul &mdash; folosește
          catalogul cu filtre după Ø, J, PCD și ET.
        </p>
      </div>

      <div className="space-y-2.5">
        <NumberedSelect index={1} value={year} onChange={setYear} placeholder="An">
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </NumberedSelect>
        <NumberedSelect index={2} value={make} onChange={(v) => { setMake(v); setModel('') }} placeholder="Marcă">
          {MAKE_NAMES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </NumberedSelect>
        <NumberedSelect index={3} value={model} onChange={setModel} placeholder={make ? 'Model' : 'Alege marca'} disabled={!make}>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </NumberedSelect>
      </div>

      <button
        type="submit"
        className="btn-gold rounded-md w-full mt-4 py-3.5 text-sm uppercase"
      >
        {ctaLabel}
      </button>

      <button
        type="button"
        onClick={() => router.push('/jante')}
        className="mt-3 w-full text-center text-xs text-pimpit-text-muted hover:text-pimpit-text underline underline-offset-2"
      >
        Sau răsfoiește tot catalogul
      </button>
    </form>
  )
}

function NumberedSelect({
  index,
  value,
  onChange,
  placeholder,
  disabled,
  children,
}: {
  index: number
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex items-stretch border border-pimpit-border rounded-md overflow-hidden focus-within:border-pimpit-accent transition-colors bg-white">
      <span className="flex items-center justify-center w-9 bg-pimpit-surface-2 text-pimpit-text-muted font-semibold text-sm border-r border-pimpit-border shrink-0">
        {index}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 min-w-0 bg-white px-3 py-3 text-sm text-pimpit-text focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <span className="flex items-center pr-3 text-pimpit-text-muted pointer-events-none">▾</span>
    </label>
  )
}
