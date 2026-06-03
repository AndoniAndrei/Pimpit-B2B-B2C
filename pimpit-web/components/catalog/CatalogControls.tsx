'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search } from 'lucide-react'

interface Props {
  initialSearch: string
  initialSort: string
  totalCount: number
  activeFilterCount: number
  mobileFilterSlot?: React.ReactNode
}

export default function CatalogControls({ initialSearch, initialSort, totalCount, activeFilterCount, mobileFilterSlot }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  return (
    <div className="flex flex-col gap-3">
      {/* Title row */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-pimpit-accent mb-1">— Catalog</div>
          <h1 className="font-display font-medium uppercase tracking-tight text-2xl md:text-3xl text-pimpit-text leading-none">
            Jante aliaj
          </h1>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-pimpit-text-muted shrink-0">
          <span className="text-pimpit-text tabular-nums">{totalCount.toLocaleString()}</span>&nbsp;produse
          {activeFilterCount > 0 && (
            <span className="hidden sm:inline">&nbsp;·&nbsp;{activeFilterCount} filtr{activeFilterCount === 1 ? 'u' : 'e'}</span>
          )}
        </p>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {mobileFilterSlot}

        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pimpit-text-muted pointer-events-none" />
          <input
            type="search"
            defaultValue={initialSearch}
            placeholder="Caută brand, cod, model"
            className="w-full bg-pimpit-surface border border-pimpit-border pl-10 pr-3 py-2.5 text-sm text-pimpit-text placeholder:text-pimpit-text-muted focus:outline-none focus:border-pimpit-accent transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParam('search', (e.target as HTMLInputElement).value)
            }}
            onBlur={(e) => updateParam('search', e.target.value)}
          />
        </div>

        <select
          defaultValue={initialSort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="bg-pimpit-surface border border-pimpit-border px-3 py-2.5 text-sm font-mono text-pimpit-text focus:outline-none focus:border-pimpit-accent cursor-pointer shrink-0 transition-colors"
        >
          <option value="relevance">Relevanță</option>
          <option value="price_asc">Preț ↑</option>
          <option value="price_desc">Preț ↓</option>
          <option value="newest">Noi</option>
        </select>
      </div>
    </div>
  )
}
