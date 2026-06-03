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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-pimpit-text">
          Jante aliaj
        </h1>
        <p className="text-sm text-pimpit-text-muted shrink-0">
          <span className="font-bold text-pimpit-text tabular-nums">{totalCount.toLocaleString()}</span>&nbsp;produse
          {activeFilterCount > 0 && (
            <span className="hidden sm:inline">&nbsp;·&nbsp;{activeFilterCount} filtr{activeFilterCount === 1 ? 'u' : 'e'}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {mobileFilterSlot}

        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pimpit-text-muted pointer-events-none" />
          <input
            type="search"
            defaultValue={initialSearch}
            placeholder="Caută brand, cod, model"
            className="w-full bg-white border border-pimpit-border rounded-md pl-10 pr-3 py-2.5 text-sm text-pimpit-text placeholder:text-pimpit-text-muted focus:outline-none focus:border-pimpit-accent focus:ring-1 focus:ring-pimpit-accent transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParam('search', (e.target as HTMLInputElement).value)
            }}
            onBlur={(e) => updateParam('search', e.target.value)}
          />
        </div>

        <select
          defaultValue={initialSort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="bg-white border border-pimpit-border rounded-md px-3 py-2.5 text-sm font-medium text-pimpit-text focus:outline-none focus:border-pimpit-accent cursor-pointer shrink-0 transition-colors"
        >
          <option value="relevance">Relevanță</option>
          <option value="price_asc">Preț ↑</option>
          <option value="price_desc">Preț ↓</option>
          <option value="newest">Cele mai noi</option>
        </select>
      </div>
    </div>
  )
}
