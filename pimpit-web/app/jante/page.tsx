import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/catalog/ProductCard'
import FilterSidebar from '@/components/catalog/FilterSidebar'
import CatalogControls from '@/components/catalog/CatalogControls'
import Link from 'next/link'
import { Suspense } from 'react'

export const revalidate = 0

type SearchParams = { [key: string]: string | string[] | undefined }

function sp(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || '';
}
function spArr(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function dedupe<T>(arr: (T | null | undefined)[]): T[] {
  const seen: string[] = [];
  return arr.filter((v): v is T => {
    if (v == null) return false;
    const k = String(v);
    if (seen.includes(k)) return false;
    seen.push(k); return true;
  });
}

interface ActiveFilters {
  search: string;
  brands: string[];
  diameters: string[];
  widths: string[];
  pcds: string[];
  colors: string[];
  finishes: string[];
  priceMin: number;
  priceMax: number;
}

/**
 * Apply active filters to a Supabase query, excluding one dimension.
 * Used for cascading/dependent faceted filters: each filter dimension shows
 * only values that exist given all OTHER active filters.
 */
function withFilters(query: any, f: ActiveFilters, exclude: string) {
  if (exclude !== 'search' && f.search)
    query = query.or(`name.ilike.%${f.search}%,brand.ilike.%${f.search}%,part_number.ilike.%${f.search}%`);
  if (exclude !== 'brand' && f.brands.length) query = query.in('brand', f.brands);
  if (exclude !== 'diameter' && f.diameters.length) query = query.in('diameter', f.diameters.map(Number));
  if (exclude !== 'width' && f.widths.length) query = query.in('width', f.widths.map(Number));
  if (exclude !== 'pcd' && f.pcds.length) query = query.in('pcd', f.pcds);
  if (exclude !== 'color' && f.colors.length) query = query.in('color', f.colors);
  if (exclude !== 'finish' && f.finishes.length) query = query.in('finish', f.finishes);
  if (exclude !== 'price' && f.priceMin) query = query.gte('price', f.priceMin);
  if (exclude !== 'price' && f.priceMax) query = query.lte('price', f.priceMax);
  return query;
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  // Use anon client — public products are readable via RLS policy
  const db = createClient()

  const page = Math.max(1, parseInt(sp(searchParams.page) || '1'))
  const PAGE_SIZE = 24
  const from = (page - 1) * PAGE_SIZE

  const search = sp(searchParams.search)
  const brands = spArr(searchParams.brand)
  const diameters = spArr(searchParams.diameter)
  const widths = spArr(searchParams.width)
  const pcds = spArr(searchParams.pcd)
  const colors = spArr(searchParams.color)
  const finishes = spArr(searchParams.finish)
  const priceMin = parseInt(sp(searchParams.price_min) || '0')
  const priceMax = parseInt(sp(searchParams.price_max) || '0')
  const sortBy = sp(searchParams.sort) || 'stock'

  // ── Products query ─────────────────────────────────────────────────────────
  let query = db.from('products')
    .select('id,slug,part_number,brand,name,price,price_old,price_b2b,stock,stock_incoming,images,diameter,width,pcd,et_offset,center_bore,color,finish', { count: 'exact' })
    .eq('is_active', true)
    .range(from, from + PAGE_SIZE - 1)

  if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,part_number.ilike.%${search}%`)
  if (brands.length) query = query.in('brand', brands)
  if (diameters.length) query = query.in('diameter', diameters.map(Number))
  if (widths.length) query = query.in('width', widths.map(Number))
  if (pcds.length) query = query.in('pcd', pcds)
  if (colors.length) query = query.in('color', colors)
  if (finishes.length) query = query.in('finish', finishes)
  if (priceMin) query = query.gte('price', priceMin)
  if (priceMax) query = query.lte('price', priceMax)

  if (sortBy === 'price_asc') query = query.order('price', { ascending: true })
  else if (sortBy === 'price_desc') query = query.order('price', { ascending: false })
  else if (sortBy === 'newest') query = query.order('created_at', { ascending: false })
  else query = query.order('stock', { ascending: false }).order('price', { ascending: true })

  const { data: products, count, error } = await query

  // ── Filter options (cascading/dependent faceted search) ───────────────────
  // Each dimension shows only values that exist given ALL OTHER active filters.
  // e.g. selecting diameter=20" makes PCD filter only show PCDs available on 20" rims.
  const af: ActiveFilters = { search, brands, diameters, widths, pcds, colors, finishes, priceMin, priceMax };

  const base = () => db.from('products').eq('is_active', true);

  const [brandsRes, diamsRes, widthsRes, pcdsRes, colorsRes, finishesRes, minPriceRes, maxPriceRes] = await Promise.all([
    withFilters(base().select('brand').not('brand', 'is', null), af, 'brand').order('brand'),
    withFilters(base().select('diameter').not('diameter', 'is', null), af, 'diameter').order('diameter'),
    withFilters(base().select('width').not('width', 'is', null), af, 'width').order('width'),
    withFilters(base().select('pcd').not('pcd', 'is', null), af, 'pcd').order('pcd'),
    withFilters(base().select('color').not('color', 'is', null), af, 'color').order('color'),
    withFilters(base().select('finish').not('finish', 'is', null), af, 'finish').order('finish'),
    // Price range is always global (not cascading) to show full price extent
    db.from('products').select('price').eq('is_active', true).order('price', { ascending: true }).limit(1),
    db.from('products').select('price').eq('is_active', true).order('price', { ascending: false }).limit(1),
  ])

  const filterOptions = {
    brands:   dedupe<string>(brandsRes.data?.map(r => r.brand) ?? []),
    diameters: dedupe<number>(diamsRes.data?.map(r => r.diameter) ?? []),
    widths:   dedupe<number>(widthsRes.data?.map(r => r.width) ?? []),
    pcds:     dedupe<string>(pcdsRes.data?.map(r => r.pcd) ?? []),
    colors:   dedupe<string>(colorsRes.data?.map(r => r.color) ?? []),
    finishes: dedupe<string>(finishesRes.data?.map(r => r.finish) ?? []),
    priceMin: Math.floor(minPriceRes.data?.[0]?.price ?? 0),
    priceMax: Math.ceil(maxPriceRes.data?.[0]?.price ?? 99999),
  }

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  const activeFilterCount = brands.length + diameters.length + widths.length + pcds.length +
    colors.length + finishes.length + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (search ? 1 : 0)

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Suspense fallback={
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Jante aliaj</h1>
            </div>
          }>
            <CatalogControls
              initialSearch={search}
              initialSort={sortBy}
              totalCount={count ?? 0}
              activeFilterCount={activeFilterCount}
            />
          </Suspense>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">

          {/* ── Sidebar ── */}
          <aside className="w-64 shrink-0 hidden lg:block">
            <div className="bg-white border rounded-2xl p-5 sticky top-6">
              <Suspense fallback={<div className="text-sm text-gray-400">Se încarcă filtrele...</div>}>
                <FilterSidebar options={filterOptions} />
              </Suspense>
            </div>
          </aside>

          {/* ── Product grid ── */}
          <div className="flex-1 min-w-0">
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                Eroare la încărcarea produselor: {error.message}
              </div>
            ) : !products?.length ? (
              <div className="bg-white border rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="font-semibold text-gray-900 mb-2">Niciun produs găsit</h3>
                <p className="text-gray-500 text-sm mb-4">Încearcă să modifici filtrele sau termenul de căutare.</p>
                <Link href="/jante" className="text-primary hover:underline text-sm font-medium">
                  Resetează filtrele
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map(p => (
                    <ProductCard key={p.id} product={p as any} isB2B={false} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
                    {page > 1 && (
                      <PaginationLink searchParams={searchParams} page={page - 1}>← Înapoi</PaginationLink>
                    )}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7
                        ? i + 1
                        : page <= 4 ? i + 1
                        : page >= totalPages - 3 ? totalPages - 6 + i
                        : page - 3 + i;
                      return (
                        <PaginationLink key={p} searchParams={searchParams} page={p} active={p === page}>
                          {p}
                        </PaginationLink>
                      );
                    })}
                    {page < totalPages && (
                      <PaginationLink searchParams={searchParams} page={page + 1}>Următor →</PaginationLink>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PaginationLink({ searchParams, page, active, children }: {
  searchParams: SearchParams; page: number; active?: boolean; children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach(val => params.append(k, val));
    else if (v) params.set(k, v);
  });
  params.set('page', String(page));
  return (
    <Link href={`/jante?${params.toString()}`}
      className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors
        ${active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-white hover:border-primary hover:text-primary'}`}>
      {children}
    </Link>
  );
}
