'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { splitAndNormalizePcds } from '@/lib/pcdUtils'

interface FilterOptions {
  brands: string[]
  models: string[]
  diameters: number[]
  widths: number[]
  pcds: string[]
  ets?: number[]
  colors: string[]
  finishes: string[]
  priceMin: number
  priceMax: number
}

interface Props {
  options: FilterOptions
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function FilterSection({ title, count, children, defaultOpen = true }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-pimpit-border last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-4 font-display font-semibold text-xs uppercase tracking-[0.22em] text-pimpit-text hover:text-pimpit-accent transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {count != null && count > 0 && (
            <span className="font-mono text-[10px] text-pimpit-accent">·{count}</span>
          )}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="pb-5">{children}</div>}
    </div>
  )
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group py-1">
      <span
        className={`relative w-4 h-4 flex items-center justify-center border transition-colors shrink-0 ${
          checked ? 'bg-pimpit-accent border-pimpit-accent' : 'bg-pimpit-bg border-pimpit-border group-hover:border-pimpit-accent'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-stone-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        <input type="checkbox" checked={checked} onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer" />
      </span>
      <span className="text-sm text-pimpit-text-muted group-hover:text-pimpit-text transition-colors">{label}</span>
    </label>
  )
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] border transition-colors
        ${active
          ? 'bg-pimpit-accent text-stone-900 border-pimpit-accent'
          : 'bg-pimpit-bg text-pimpit-text-muted border-pimpit-border hover:border-pimpit-accent hover:text-pimpit-text'}
      `}
    >
      {children}
    </button>
  )
}

export default function FilterSidebar({ options }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const getParamArr = (key: string) => searchParams.getAll(key)

  const updateFilter = useCallback((key: string, value: string, multi = false) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (multi) {
      const existing = params.getAll(key)
      if (existing.includes(value)) {
        params.delete(key)
        existing.filter((v) => v !== value).forEach((v) => params.append(key, v))
      } else {
        params.append(key, value)
      }
    } else {
      if (params.get(key) === value) params.delete(key)
      else params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const clearAll = () => router.push(pathname)

  const priceMin = parseInt(searchParams.get('price_min') || '0')
  const priceMax = parseInt(searchParams.get('price_max') || String(options.priceMax))
  const activeBrands = getParamArr('brand')
  const activeModels = getParamArr('model')
  const activeDiameters = getParamArr('diameter')
  const activeWidths = getParamArr('width')
  const activePcds = getParamArr('pcd')
  const activeEts = getParamArr('et')
  const hasActiveFilters = searchParams.toString().length > 0

  const individualPcds = useMemo(() => {
    const seen = new Set<string>()
    for (const raw of options.pcds) {
      for (const pcd of splitAndNormalizePcds(raw)) seen.add(pcd)
    }
    return Array.from(seen).sort()
  }, [options.pcds])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-4 border-b border-pimpit-border">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-pimpit-accent">— Filtre</div>
          <h2 className="font-display font-semibold uppercase tracking-[0.18em] text-base text-pimpit-text mt-1">Restrânge</h2>
        </div>
        {hasActiveFilters && (
          <button onClick={clearAll} className="font-mono text-[10px] uppercase tracking-[0.2em] text-pimpit-accent hover:underline">
            Resetează
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 py-4 border-b border-pimpit-border">
          {Array.from(searchParams.entries()).map(([k, v]) => (
            <button
              key={`${k}-${v}`}
              onClick={() => updateFilter(k, v, ['brand', 'model', 'diameter', 'width', 'pcd', 'et', 'color', 'finish'].includes(k))}
              className="font-mono text-[10px] uppercase tracking-[0.18em] bg-pimpit-surface-2 text-pimpit-accent border border-pimpit-border px-2 py-1 hover:border-pimpit-accent transition-colors flex items-center gap-1"
            >
              {k}: {v} <span className="text-pimpit-text-muted">×</span>
            </button>
          ))}
        </div>
      )}

      {options.diameters.length > 0 && (
        <FilterSection title="Diametru" count={activeDiameters.length}>
          <div className="flex flex-wrap gap-2">
            {options.diameters.map((d) => (
              <PillButton key={d} active={activeDiameters.includes(String(d))} onClick={() => updateFilter('diameter', String(d), true)}>
                {d}"
              </PillButton>
            ))}
          </div>
        </FilterSection>
      )}

      {options.widths.length > 0 && (
        <FilterSection title="Lățime (J)" count={activeWidths.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {options.widths.map((w) => (
              <PillButton key={w} active={activeWidths.includes(String(w))} onClick={() => updateFilter('width', String(w), true)}>
                {w}J
              </PillButton>
            ))}
          </div>
        </FilterSection>
      )}

      {individualPcds.length > 0 && (
        <FilterSection title="PCD" count={activePcds.length} defaultOpen={false}>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {individualPcds.map((p) => (
              <Checkbox key={p} checked={activePcds.includes(p)} onChange={() => updateFilter('pcd', p, true)} label={p} />
            ))}
          </div>
        </FilterSection>
      )}

      {options.ets && options.ets.length > 0 && (
        <FilterSection title="ET" count={activeEts.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
            {options.ets.map((e) => (
              <PillButton key={e} active={activeEts.includes(String(e))} onClick={() => updateFilter('et', String(e), true)}>
                ET{e}
              </PillButton>
            ))}
          </div>
        </FilterSection>
      )}

      {options.brands.length > 0 && (
        <FilterSection title="Brand" count={activeBrands.length}>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {options.brands.map((b) => (
              <Checkbox key={b} checked={activeBrands.includes(b)} onChange={() => updateFilter('brand', b, true)} label={b} />
            ))}
          </div>
        </FilterSection>
      )}

      {options.models.length > 0 && (
        <FilterSection title="Model" count={activeModels.length} defaultOpen={false}>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {options.models.map((m) => (
              <Checkbox key={m} checked={activeModels.includes(m)} onChange={() => updateFilter('model', m, true)} label={m} />
            ))}
          </div>
        </FilterSection>
      )}

      {options.colors.length > 0 && (
        <FilterSection title="Culoare" defaultOpen={false}>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {options.colors.map((c) => (
              <Checkbox key={c} checked={getParamArr('color').includes(c)} onChange={() => updateFilter('color', c, true)} label={c} />
            ))}
          </div>
        </FilterSection>
      )}

      {options.finishes.length > 0 && (
        <FilterSection title="Finisaj" defaultOpen={false}>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {options.finishes.map((f) => (
              <Checkbox key={f} checked={getParamArr('finish').includes(f)} onChange={() => updateFilter('finish', f, true)} label={f} />
            ))}
          </div>
        </FilterSection>
      )}

      {options.priceMax > 0 && (
        <FilterSection title="Preț (RON)" defaultOpen={false}>
          <div className="flex gap-2">
            <input
              type="number"
              className="w-full bg-pimpit-bg border border-pimpit-border px-3 py-2 text-sm font-mono text-pimpit-text focus:outline-none focus:border-pimpit-accent transition-colors"
              placeholder={`Min ${options.priceMin.toLocaleString()}`}
              defaultValue={priceMin || ''}
              onBlur={(e) => {
                const params = new URLSearchParams(searchParams.toString())
                if (e.target.value) params.set('price_min', e.target.value)
                else params.delete('price_min')
                router.push(`${pathname}?${params.toString()}`)
              }}
            />
            <input
              type="number"
              className="w-full bg-pimpit-bg border border-pimpit-border px-3 py-2 text-sm font-mono text-pimpit-text focus:outline-none focus:border-pimpit-accent transition-colors"
              placeholder={`Max ${options.priceMax.toLocaleString()}`}
              defaultValue={priceMax !== options.priceMax ? priceMax : ''}
              onBlur={(e) => {
                const params = new URLSearchParams(searchParams.toString())
                if (e.target.value) params.set('price_max', e.target.value)
                else params.delete('price_max')
                router.push(`${pathname}?${params.toString()}`)
              }}
            />
          </div>
        </FilterSection>
      )}
    </div>
  )
}
