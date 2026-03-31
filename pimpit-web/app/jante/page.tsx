import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/catalog/ProductCard'
import Link from 'next/link'

export const revalidate = 0 // Dynamic page for search params

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = createClient()
  
  // Build query based on searchParams
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .limit(24)

  if (searchParams.brand) query = query.eq('brand', searchParams.brand)
  if (searchParams.diameter) query = query.eq('diameter', searchParams.diameter)
  if (searchParams.pcd) query = query.eq('pcd', searchParams.pcd)
  if (searchParams.search) {
    query = query.or(`name.ilike.%${searchParams.search}%,brand.ilike.%${searchParams.search}%`)
  }

  const { data: products, error } = await query

  // Check B2B status
  const { data: { user } } = await supabase.auth.getUser()
  let isB2B = false
  if (user) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    isB2B = profile?.role === 'customer_b2b'
  }

  return (
    <div className="container mx-auto py-8 flex gap-8">
      {/* Sidebar / Filters (Simplified for brevity) */}
      <aside className="w-64 shrink-0 hidden md:block">
        <div className="sticky top-24 space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Filtre</h3>
            <p className="text-sm text-muted-foreground">Folosește URL params pentru a filtra (ex: ?brand=Borbet)</p>
          </div>
          <Link href="/jante" className="text-sm text-primary hover:underline">Resetează filtre</Link>
        </div>
      </aside>

      {/* Product Grid */}
      <div className="flex-1">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Catalog Jante</h1>
          <span className="text-sm text-muted-foreground">{products?.length || 0} rezultate</span>
        </div>
        
        {error ? (
          <div className="text-destructive">Eroare la încărcarea produselor: {error.message}</div>
        ) : products?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nu am găsit produse conform filtrelor selectate.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products?.map(p => (
              <ProductCard key={p.id} product={p} isB2B={isB2B} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
