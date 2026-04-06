'use client';

import { useState } from 'react';
import FilterSidebar from './FilterSidebar';

interface FilterOptions {
  brands: string[];
  models: string[];
  diameters: number[];
  widths: number[];
  pcds: string[];
  colors: string[];
  finishes: string[];
  priceMin: number;
  priceMax: number;
}

export default function MobileFilters({ options, activeCount }: { options: FilterOptions; activeCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium bg-white hover:border-primary hover:text-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        Filtre
        {activeCount > 0 && (
          <span className="bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

          {/* Drawer */}
          <div className="relative w-80 max-w-[90vw] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="font-bold text-base">Filtre</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Închide filtre"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1">
              <FilterSidebar options={options} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
