import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/catalog/ProductCard'
import FilterSidebar from '@/components/catalog/FilterSidebar'
import MobileFilters from '@/components/catalog/MobileFilters'
import CatalogControls from '@/components/catalog/CatalogControls'
import { sanitizeSearchInput } from '@/lib/utils'
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

export default async function AccesoriiPage({ searchParams }: { searchParams: SearchParams }) {
  const db = createClient()

  const page = Math.max(1, parseInt(sp(searchParams.page) || '1'))
  const PAGE_SIZE = 24
  const from = (page - 1) * PAGE_SIZE

  const search   = sanitizeSearchInput(sp(searchParams.search))
  const brands   = spArr(searchParams.brand)
  const models   = spArr(searchParams.model)
  const colors   = spArr(searchParams.color)
  const finishes = spArr(searchParams.finish)
  const priceMin = parseInt(sp(searchParams.price_min) || '0')
  const priceMax = parseInt(sp(searchParams.price_max) || '0')
  const sortBy   = sp(searchParams.sort) || 'stock'

  // All products that are NOT jante
  let query = db.from('products')
    .select('id,slug,part_number,brand,model,name,price,price_old,price_b2b,stock,stock_incoming,images,diameter,width,pcd,et_offset,center_bore,color,finish', { count: 'exact' })
    .eq('is_active', true)
    .neq('product_type', 'jante')
    .range(from, from + PAGE_SIZE - 1)

  if (search)         query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,part_number.ilike.%${search}%`)
  if (brands.length)  query = query.in('brand', brands)
  if (models.length)  query = query.in('model', models)
  if (colors.length)  query = query.in('color', colors)
  if (finishes.length) query = query.in('finish', finishes)
  if (priceMin)       query = query.gte('price', priceMin)
  if (priceMax)       query = query.lte('price', priceMax)

  if (sortBy === 'price_asc')  query = query.order('price', { ascending: true })
  else if (sortBy === 'price_desc') query = query.order('price', { ascending: false })
  else if (sortBy === 'newest') query = query.order('created_at', { ascending: false })
  else query = query.order('stock', { ascending: false }).order('price', { ascending: true })

  const { data: products, count, error } = await query

  // Filter options — reuse the same RPC but without PCD/diameter/width (not relevant for accessories)
  const { data: opts } = await db.rpc('get_cascading_filter_options_accesorii', {
    p_search:    search        || null,
    p_brands:    brands.length   ? brands   : null,
    p_models:    models.length   ? models   : null,
    p_colors:    colors.length   ? colors   : null,
    p_finishes:  finishes.length ? finishes : null,
    p_price_min: priceMin || null,
    p_price_max: priceMax || null,
  }).maybeSingle() as any

  // Fallback: if RPC doesn't exist yet, show empty filters gracefully
  const filterOptions = {
    brands:   (opts?.brands   ?? []) as string[],
    models:   (opts?.models   ?? []) as string[],
    diameters: [] as number[],
    widths:    [] as number[],
    pcds:      [] as string[],
    colors:   (opts?.colors   ?? []) as string[],
    finishes: (opts?.finishes ?? []) as string[],
    priceMin: Math.floor(opts?.price_min ?? 0),
    priceMax: Math.ceil(opts?.price_max  ?? 99999),
  }

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  const activeFilterCount = brands.length + models.length + colors.length + finishes.length +
    (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (search ? 1 : 0)

  return (
    <div className="bg-pimpit-surface-2 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-pimpit-border">
        <div className="container mx-auto px-4 lg:px-8 py-3 text-xs text-pimpit-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-pimpit-accent transition-colors">Acasă</Link>
          <span>/</span>
          <span className="font-semibold text-pimpit-text">Accesorii</span>
        </div>
      </div>

      {/* Sticky header bar */}
      <div className="bg-white border-b border-pimpit-border sticky top-16 lg:top-[6.75rem] z-40 shadow-premium">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <Suspense fallback={
            <h1 className="text-2xl font-bold text-pimpit-text">Accesorii</h1>
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

      <div className="container mx-auto px-4 lg:px-8 py-6">
        <div className="flex gap-6">

          {/* Sidebar */}
          <aside className="w-72 shrink-0 hidden lg:block">
            <div className="bg-white border border-pimpit-border rounded-md p-5 sticky top-[14rem] shadow-premium">
              <Suspense fallback={<div className="text-xs text-pimpit-text-muted">Se încarcă filtrele…</div>}>
                <FilterSidebar options={filterOptions} />
              </Suspense>
            </div>
          </aside>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {error ? (
              <div className="bg-white border border-pimpit-error/40 text-pimpit-error rounded-md p-5 text-sm">
                Eroare la încărcarea produselor: {error.message}
              </div>
            ) : !products?.length ? (
              <div className="bg-white border border-pimpit-border rounded-md p-12 text-center shadow-premium">
                <h3 className="text-xl font-bold text-pimpit-text mb-2">Niciun produs găsit</h3>
                <p className="text-pimpit-text-muted text-sm mb-6">Încearcă să modifici filtrele sau termenul de căutare.</p>
                <Link
                  href="/accesorii"
                  className="btn-gold inline-flex rounded-md text-sm px-5 py-3 uppercase"
                >
                  Resetează filtrele →
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
                  {products.map(p => (
                    <ProductCard key={p.id} product={p as any} isB2B={false} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-10 flex-wrap text-sm">
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
    <Link href={`/accesorii?${params.toString()}`}
      className={`px-3.5 py-2 rounded text-sm font-semibold border transition-all
        ${active
          ? 'bg-pimpit-accent text-white border-pimpit-accent shadow-gold'
          : 'bg-white text-pimpit-text border-pimpit-border hover:border-pimpit-accent hover:text-pimpit-accent'}`}>
      {children}
    </Link>
  );
}
