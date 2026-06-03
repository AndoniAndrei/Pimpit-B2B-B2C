'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import FilterSidebar from './FilterSidebar'

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

export default function MobileFilters({ options, activeCount }: { options: FilterOptions; activeCount: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 border border-pimpit-border bg-white text-pimpit-text hover:border-pimpit-accent hover:text-pimpit-accent rounded-md transition-colors shrink-0 text-sm font-semibold"
      >
        <SlidersHorizontal className="w-4 h-4 shrink-0" />
        <span>Filtre</span>
        {activeCount > 0 && (
          <span className="bg-pimpit-accent text-white text-xs font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-stretch md:justify-start">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <div className="relative w-full md:w-80 md:max-w-[92vw] max-h-[88vh] md:max-h-none md:h-full bg-white border-t border-pimpit-border md:border-t-0 md:border-r rounded-t-lg md:rounded-none flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pimpit-border">
              <h2 className="text-base font-bold text-pimpit-text">Filtre</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-pimpit-text-muted hover:text-pimpit-text transition-colors"
                aria-label="Închide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-24">
              <FilterSidebar options={options} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-pimpit-border">
              <button
                onClick={() => setOpen(false)}
                className="btn-gold w-full rounded-md py-3.5 text-sm uppercase"
              >
                Arată produsele
                {activeCount > 0 && (
                  <span className="bg-white/15 px-2 py-0.5 rounded text-xs ml-2">{activeCount}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
