import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/catalog/ProductCard'
import FilterSidebar from '@/components/catalog/FilterSidebar'
import MobileFilters from '@/components/catalog/MobileFilters'
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



export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  // Use anon client — public products are readable via RLS policy
  const db = createClient()

  const page = Math.max(1, parseInt(sp(searchParams.page) || '1'))
  const PAGE_SIZE = 24
  const from = (page - 1) * PAGE_SIZE

  const search = sp(searchParams.search)
  const brands = spArr(searchParams.brand)
  const models = spArr(searchParams.model)
  const diameters = spArr(searchParams.diameter)
  const widths = spArr(searchParams.width)
  const pcds = spArr(searchParams.pcd)
  const colors = spArr(searchParams.color)
  const finishes = spArr(searchParams.finish)
  const priceMin = parseInt(sp(searchParams.price_min) || '0')
  const priceMax = parseInt(sp(searchParams.price_max) || '0')
  const sortBy = sp(searchParams.sort) || 'stock'

  // ── Products query (jante only) ─────────────────────────────────────────────
  let query = db.from('products')
    .select('id,slug,part_number,brand,model,name,price,price_old,price_b2b,stock,stock_incoming,images,diameter,width,pcd,et_offset,center_bore,color,finish', { count: 'exact' })
    .eq('is_active', true)
    .eq('product_type', 'jante')
    .range(from, from + PAGE_SIZE - 1)

  if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,part_number.ilike.%${search}%`)
  if (brands.length) query = query.in('brand', brands)
  if (models.length) query = query.in('model', models)
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
  // ── Filter options via PostgreSQL RPC (cascading faceted search) ─────────────
  // Single DB round-trip using SELECT DISTINCT — no Supabase row-limit issues.
  // The function applies "exclude self" logic per dimension (see migration 002).
  const { data: opts } = await db.rpc('get_cascading_filter_options', {
    p_search:    search         || null,
    p_brands:    brands.length    ? brands                : null,
    p_models:    models.length    ? models                : null,
    p_diameters: diameters.length ? diameters.map(Number) : null,
    p_widths:    widths.length    ? widths.map(Number)    : null,
    p_pcds:      pcds.length      ? pcds                  : null,
    p_colors:    colors.length    ? colors                : null,
    p_finishes:  finishes.length  ? finishes              : null,
    p_price_min: priceMin  || null,
    p_price_max: priceMax  || null,
  })

  const filterOptions = {
    brands:    (opts?.brands    ?? []) as string[],
    models:    (opts?.models    ?? []) as string[],
    diameters: (opts?.diameters ?? []) as number[],
    widths:    (opts?.widths    ?? []) as number[],
    pcds:      (opts?.pcds      ?? []) as string[],
    colors:    (opts?.colors    ?? []) as string[],
    finishes:  (opts?.finishes  ?? []) as string[],
    priceMin:  Math.floor(opts?.price_min ?? 0),
    priceMax:  Math.ceil(opts?.price_max  ?? 99999),
  }

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  const activeFilterCount = brands.length + models.length + diameters.length + widths.length + pcds.length +
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
              mobileFilterSlot={
                <div className="lg:hidden">
                  <MobileFilters options={filterOptions} activeCount={activeFilterCount} />
                </div>
              }
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
