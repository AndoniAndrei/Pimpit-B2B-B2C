import { createClient } from '@/lib/supabase/server'
import Hero from '@/components/home/Hero'
import CategoryTiles from '@/components/home/CategoryTiles'
import SocialProof from '@/components/home/SocialProof'
import FeaturedBrands from '@/components/home/FeaturedBrands'
import TrendingProducts from '@/components/home/TrendingProducts'
import { Product } from '@/lib/types'

export const revalidate = 600 // 10 min ISR — homepage doesn't change often

const FEATURED_BRAND_HINTS = ['Concaver', 'Japan Racing', 'JUDD', 'Sixnine', 'MB Design', 'OZ Racing']

export default async function Home() {
  const supabase = createClient()

  // Pull a single page of stock-sorted products and use them to derive trending
  // + the brand list. Keeps the homepage to one DB round-trip.
  const { data: rows, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .eq('product_type', 'jante')
    .order('stock', { ascending: false })
    .limit(40)

  const products = (rows ?? []) as Product[]
  const trending = products.slice(0, 8)

  // Auth state for B2B price visibility
  const { data: { user } } = await supabase.auth.getUser()
  let isB2B = false
  if (user) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    isB2B = profile?.role === 'customer_b2b'
  }

  // Featured brands: prefer the known hint list (in catalog order) but fall back
  // to whatever distinct brands appear in the trending pull. Cap at 8.
  const presentBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))
  const featuredBrands = [
    ...FEATURED_BRAND_HINTS.filter((b) => presentBrands.includes(b)),
    ...presentBrands.filter((b) => !FEATURED_BRAND_HINTS.includes(b)),
  ].slice(0, 8)

  return (
    <>
      <Hero />
      <SocialProof productCount={count ?? products.length} brandCount={presentBrands.length} />
      <CategoryTiles />
      <FeaturedBrands brands={featuredBrands} />
      <TrendingProducts products={trending} isB2B={isB2B} />
    </>
  )
}
