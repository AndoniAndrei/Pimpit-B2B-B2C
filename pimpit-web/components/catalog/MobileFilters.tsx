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

/**
 * Mobile filter trigger + bottom-sheet drawer.
 * On phones the panel slides up from the bottom and takes ~85vh.
 */
export default function MobileFilters({ options, activeCount }: { options: FilterOptions; activeCount: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 border border-pimpit-border bg-pimpit-surface text-pimpit-text hover:border-pimpit-accent transition-colors shrink-0 font-mono text-[11px] uppercase tracking-[0.18em]"
      >
        <SlidersHorizontal className="w-4 h-4 shrink-0" />
        <span>Filtre</span>
        {activeCount > 0 && (
          <span className="bg-pimpit-accent text-stone-900 font-mono text-[10px] font-bold min-w-[20px] h-5 px-1 flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-stretch md:justify-start">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />

          {/* Drawer — bottom sheet on mobile, side drawer on tablet */}
          <div className="relative w-full md:w-80 md:max-w-[92vw] max-h-[88vh] md:max-h-none md:h-full bg-pimpit-bg border-t border-pimpit-border md:border-t-0 md:border-r flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-pimpit-border">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-pimpit-accent">— Filtre</div>
                <h2 className="font-display font-semibold uppercase tracking-[0.2em] text-sm text-pimpit-text mt-1">Restrânge catalogul</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-pimpit-text-muted hover:text-pimpit-text transition-colors"
                aria-label="Închide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-24">
              <FilterSidebar options={options} />
            </div>

            {/* Sticky CTA */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-pimpit-bg border-t border-pimpit-border">
              <button
                onClick={() => setOpen(false)}
                className="w-full bg-pimpit-accent hover:bg-pimpit-accent-hover text-stone-900 py-3.5 font-display font-semibold uppercase tracking-[0.22em] text-sm flex items-center justify-center gap-3 transition-colors"
              >
                Arată jantele
                {activeCount > 0 && (
                  <span className="bg-pimpit-bg/15 px-2 py-0.5 font-mono text-[10px]">{activeCount}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
