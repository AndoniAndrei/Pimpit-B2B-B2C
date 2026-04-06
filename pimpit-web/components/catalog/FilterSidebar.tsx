'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

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

interface Props {
  options: FilterOptions;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold mb-3 hover:text-primary transition-colors">
        {title}
        <ChevronIcon open={open} />
      </button>
      {open && children}
    </div>
  );
}

export default function FilterSidebar({ options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getParamArr = (key: string) => searchParams.getAll(key);

  const updateFilter = useCallback((key: string, value: string, multi = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (multi) {
      const existing = params.getAll(key);
      if (existing.includes(value)) {
        params.delete(key);
        existing.filter(v => v !== value).forEach(v => params.append(key, v));
      } else {
        params.append(key, value);
      }
    } else {
      if (params.get(key) === value) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
    // NO auto-close — user controls when to dismiss
  }, [searchParams, router, pathname]);

  const clearAll = () => router.push(pathname);

  const priceMin = parseInt(searchParams.get('price_min') || '0');
  const priceMax = parseInt(searchParams.get('price_max') || String(options.priceMax));
  const activeBrands    = getParamArr('brand');
  const activeModels    = getParamArr('model');
  const activeDiameters = getParamArr('diameter');
  const activeWidths    = getParamArr('width');
  const activePcds      = getParamArr('pcd');
  const hasActiveFilters = searchParams.toString().length > 0;

  // Split PCDs: single bolt vs multi-bolt (contains "/")
  const singlePcds = options.pcds.filter(p => !p.includes('/'));
  const multiPcds  = options.pcds.filter(p => p.includes('/'));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-base">Filtre</h2>
        {hasActiveFilters && (
          <button onClick={clearAll} className="text-xs text-primary hover:underline font-medium">
            Resetează tot
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {Array.from(searchParams.entries()).map(([k, v]) => (
            <button key={`${k}-${v}`}
              onClick={() => updateFilter(k, v, ['brand','model','diameter','width','pcd'].includes(k))}
              className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center gap-1">
              {k}: {v} ✕
            </button>
          ))}
        </div>
      )}

      {/* Brand */}
      {options.brands.length > 0 && (
        <FilterSection title="Brand">
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {options.brands.map(b => (
              <label key={b} className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={activeBrands.includes(b)}
                  onChange={() => updateFilter('brand', b, true)}
                  className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer" />
                <span className="text-sm group-hover:text-primary transition-colors">{b}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Model */}
      {options.models?.length > 0 && (
        <FilterSection title="Model" defaultOpen={false}>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {options.models.map(m => (
              <label key={m} className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={activeModels.includes(m)}
                  onChange={() => updateFilter('model', m, true)}
                  className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer" />
                <span className="text-sm group-hover:text-primary transition-colors">{m}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Diameter */}
      {options.diameters.length > 0 && (
        <FilterSection title="Diametru (inch)">
          <div className="flex flex-wrap gap-2">
            {options.diameters.map(d => (
              <button key={d} onClick={() => updateFilter('diameter', String(d), true)}
                className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors
                  ${activeDiameters.includes(String(d))
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:border-primary hover:text-primary'}`}>
                {d}"
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Width */}
      {options.widths.length > 0 && (
        <FilterSection title="Lățime" defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {options.widths.map(w => (
              <button key={w} onClick={() => updateFilter('width', String(w), true)}
                className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors
                  ${activeWidths.includes(String(w))
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:border-primary hover:text-primary'}`}>
                {w}J
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* PCD — single bolt + multi-bolt grouped separately */}
      {options.pcds.length > 0 && (
        <FilterSection title="Prindere (PCD)" defaultOpen={false}>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {singlePcds.map(p => (
              <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={activePcds.includes(p)}
                  onChange={() => updateFilter('pcd', p, true)}
                  className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer" />
                <span className="text-sm group-hover:text-primary transition-colors">{p}</span>
              </label>
            ))}
            {multiPcds.length > 0 && (
              <>
                <div className="pt-2 pb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Prindere custom (multi-bolt)
                  </span>
                </div>
                {multiPcds.map(p => (
                  <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={activePcds.includes(p)}
                      onChange={() => updateFilter('pcd', p, true)}
                      className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer" />
                    <span className="text-sm group-hover:text-primary transition-colors">{p}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        </FilterSection>
      )}

      {/* Price range */}
      {options.priceMax > 0 && (
        <FilterSection title="Preț (RON)" defaultOpen={false}>
          <div className="flex gap-2">
            <input type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder={`Min (${options.priceMin.toLocaleString()})`}
              defaultValue={priceMin || ''}
              onBlur={e => {
                const params = new URLSearchParams(searchParams.toString());
                if (e.target.value) params.set('price_min', e.target.value); else params.delete('price_min');
                router.push(`${pathname}?${params.toString()}`);
              }} />
            <input type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder={`Max (${options.priceMax.toLocaleString()})`}
              defaultValue={priceMax !== options.priceMax ? priceMax : ''}
              onBlur={e => {
                const params = new URLSearchParams(searchParams.toString());
                if (e.target.value) params.set('price_max', e.target.value); else params.delete('price_max');
                router.push(`${pathname}?${params.toString()}`);
              }} />
          </div>
        </FilterSection>
      )}

      {/* Color */}
      {options.colors.length > 0 && (
        <FilterSection title="Culoare" defaultOpen={false}>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {options.colors.map(c => (
              <label key={c} className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={getParamArr('color').includes(c)}
                  onChange={() => updateFilter('color', c, true)}
                  className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer" />
                <span className="text-sm group-hover:text-primary transition-colors">{c}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Finish */}
      {options.finishes.length > 0 && (
        <FilterSection title="Finisaj" defaultOpen={false}>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {options.finishes.map(f => (
              <label key={f} className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={getParamArr('finish').includes(f)}
                  onChange={() => updateFilter('finish', f, true)}
                  className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer" />
                <span className="text-sm group-hover:text-primary transition-colors">{f}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  );
}
