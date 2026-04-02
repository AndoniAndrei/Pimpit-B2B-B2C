'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Props {
  initialSearch: string;
  initialSort: string;
  totalCount: number;
  activeFilterCount: number;
}

export default function CatalogControls({ initialSearch, initialSort, totalCount, activeFilterCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (value) params.set(key, value); else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jante aliaj</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {totalCount} produse
          {activeFilterCount > 0 && ` · ${activeFilterCount} filtr${activeFilterCount === 1 ? 'u activ' : 'e active'}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="search"
          defaultValue={initialSearch}
          placeholder="Caută brand, cod, denumire..."
          className="border rounded-xl px-4 py-2 text-sm w-64 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          onKeyDown={e => {
            if (e.key === 'Enter') updateParam('search', (e.target as HTMLInputElement).value);
          }}
          onBlur={e => updateParam('search', e.target.value)}
        />
        <select
          defaultValue={initialSort}
          onChange={e => updateParam('sort', e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
          <option value="relevance">Relevanță</option>
          <option value="price_asc">Preț crescător</option>
          <option value="price_desc">Preț descrescător</option>
          <option value="newest">Cele mai noi</option>
        </select>
      </div>
    </div>
  );
}
