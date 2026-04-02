import { createServerClient } from '@supabase/ssr'
import ProductCard from '@/components/catalog/ProductCard'
import FilterSidebar from '@/components/catalog/FilterSidebar'
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

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const db = adminClient()

  // ── Build product query ──────────────────────────────────────────────────
  const page = Math.max(1, parseInt(sp(searchParams.page) || '1'))
  const PAGE_SIZE = 24
  const from = (page - 1) * PAGE_SIZE

  let query = db.from('products')
    .select('id,slug,part_number,brand,name,price,price_old,price_b2b,stock,stock_incoming,is_active,images,diameter,width,pcd,et_offset,center_bore,color,finish', { count: 'exact' })
    .eq('is_active', true)
    .order('stock', { ascending: false })
    .order('price', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  const search = sp(searchParams.search)
  const brands = spArr(searchParams.brand)
  const diameters = spArr(searchParams.diameter)
  const widths = spArr(searchParams.width)
  const pcds = spArr(searchParams.pcd)
  const colors = spArr(searchParams.color)
  const finishes = spArr(searchParams.finish)
  const priceMin = parseInt(sp(searchParams.price_min) || '0')
  const priceMax = parseInt(sp(searchParams.price_max) || '0')
  const sortBy = sp(searchParams.sort) || 'relevance'

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

  const { data: products, count, error } = await query

  // ── Fetch filter options ─────────────────────────────────────────────────
  const [brandsRes, diamsRes, widthsRes, pcdsRes, colorsRes, finishesRes, priceRangeRes] = await Promise.all([
    db.from('products').select('brand').eq('is_active', true).not('brand', 'is', null).order('brand'),
    db.from('products').select('diameter').eq('is_active', true).not('diameter', 'is', null).order('diameter'),
    db.from('products').select('width').eq('is_active', true).not('width', 'is', null).order('width'),
    db.from('products').select('pcd').eq('is_active', true).not('pcd', 'is', null).order('pcd'),
    db.from('products').select('color').eq('is_active', true).not('color', 'is', null).order('color'),
    db.from('products').select('finish').eq('is_active', true).not('finish', 'is', null).order('finish'),
    db.from('products').select('price').eq('is_active', true).order('price', { ascending: true }).limit(1),
  ])

  function dedupe<T>(arr: (T | null | undefined)[]): T[] {
    const seen = new Set<string>();
    return arr.filter((v): v is T => {
      if (v == null) return false;
      const k = String(v);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }
  const uniqueBrands = dedupe<string>(brandsRes.data?.map(r => r.brand) ?? [])
  const uniqueDiams = dedupe<number>(diamsRes.data?.map(r => r.diameter) ?? [])
  const uniqueWidths = dedupe<number>(widthsRes.data?.map(r => r.width) ?? [])
  const uniquePcds = dedupe<string>(pcdsRes.data?.map(r => r.pcd) ?? [])
  const uniqueColors = dedupe<string>(colorsRes.data?.map(r => r.color) ?? [])
  const uniqueFinishes = dedupe<string>(finishesRes.data?.map(r => r.finish) ?? [])

  // Price range
  const { data: maxPriceRow } = await db.from('products').select('price').eq('is_active', true).order('price', { ascending: false }).limit(1)
  const minP = priceRangeRes.data?.[0]?.price ?? 0
  const maxP = maxPriceRow?.[0]?.price ?? 99999

  const filterOptions = {
    brands: uniqueBrands,
    diameters: uniqueDiams,
    widths: uniqueWidths,
    pcds: uniquePcds,
    colors: uniqueColors,
    finishes: uniqueFinishes,
    priceMin: Math.floor(minP),
    priceMax: Math.ceil(maxP),
  }

  // ── B2B check ─────────────────────────────────────────────────────────────
  // Note: catalog uses public data — no user-specific logic here
  // B2B pricing handled client-side via cookie/session

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)
  const activeFilterCount = brands.length + diameters.length + widths.length + pcds.length + colors.length + finishes.length + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (search ? 1 : 0)

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Jante aliaj</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {count ?? 0} produse
                {activeFilterCount > 0 && ` · ${activeFilterCount} filtr${activeFilterCount === 1 ? 'u activ' : 'e active'}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <form action="/jante" method="get" className="relative">
                {/* Preserve other filters */}
                {brands.map(b => <input key={b} type="hidden" name="brand" value={b} />)}
                {diameters.map(d => <input key={d} type="hidden" name="diameter" value={d} />)}
                <input
                  type="search"
                  name="search"
                  defaultValue={search}
                  placeholder="Caută brand, cod, denumire..."
                  className="border rounded-xl px-4 py-2 text-sm w-64 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </form>
              {/* Sort */}
              <form action="/jante" method="get">
                {brands.map(b => <input key={b} type="hidden" name="brand" value={b} />)}
                {diameters.map(d => <input key={d} type="hidden" name="diameter" value={d} />)}
                {search && <input type="hidden" name="search" value={search} />}
                <select name="sort" defaultValue={sortBy}
                  onChange={e => (e.target.form as HTMLFormElement)?.submit()}
                  className="border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                  <option value="relevance">Relevanță</option>
                  <option value="price_asc">Preț crescător</option>
                  <option value="price_desc">Preț descrescător</option>
                  <option value="newest">Cele mai noi</option>
                </select>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">

          {/* ── Sidebar ── */}
          <aside className="w-64 shrink-0 hidden lg:block">
            <div className="bg-white border rounded-2xl p-5 sticky top-6">
              <Suspense>
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
            ) : products?.length === 0 ? (
              <div className="bg-white border rounded-2xl p-12 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="font-semibold text-gray-900 mb-2">Niciun produs găsit</h3>
                <p className="text-gray-500 text-sm mb-4">Încearcă să modifici filtrele sau termenul de căutare.</p>
                <Link href="/jante" className="text-primary hover:underline text-sm font-medium">
                  Resetează filtrele
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products?.map(p => (
                    <ProductCard key={p.id} product={p as any} isB2B={false} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    {page > 1 && (
                      <PaginationLink searchParams={searchParams} page={page - 1}>← Înapoi</PaginationLink>
                    )}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
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
