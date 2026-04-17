import { createClient } from '@/lib/supabase/server'
import { sanitizeSearchInput } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const supabase = createClient()

  const brand = searchParams.get('brand')
  const diameter = searchParams.get('diameter')
  const width = searchParams.get('width')
  const pcd = searchParams.get('pcd')
  const et_offset = searchParams.get('et_offset')
  const product_type = searchParams.get('product_type')
  const price_min = searchParams.get('price_min')
  const price_max = searchParams.get('price_max')
  const in_stock = searchParams.get('in_stock')
  const search = searchParams.get('search')
  const cursor = searchParams.get('cursor')
  const limit = parseInt(searchParams.get('limit') || '24', 10)

  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .limit(limit + 1) // Fetch one extra to check if there's a next page

  if (brand) query = query.eq('brand', brand)
  if (diameter) query = query.eq('diameter', parseFloat(diameter))
  if (width) query = query.eq('width', parseFloat(width))
  if (pcd) query = query.eq('pcd', pcd)
  if (et_offset) query = query.eq('et_offset', parseFloat(et_offset))
  if (product_type) query = query.eq('product_type', product_type)
  if (price_min) query = query.gte('price', parseFloat(price_min))
  if (price_max) query = query.lte('price', parseFloat(price_max))
  if (in_stock === 'true') query = query.gt('stock', 0)
  
  if (search) {
    const s = sanitizeSearchInput(search)
    if (s) query = query.or(`name.ilike.%${s}%,brand.ilike.%${s}%,part_number.ilike.%${s}%`)
  }

  if (cursor) {
    query = query.gt('id', cursor)
  }

  const { data: products, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let nextCursor = null
  if (products && products.length > limit) {
    const nextItem = products.pop() // Remove the extra item
    nextCursor = nextItem?.id
  }

  // Check if B2B user
  const { data: { user } } = await supabase.auth.getUser()
  let isB2B = false
  if (user) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    isB2B = profile?.role === 'customer_b2b'
  }

  // Map prices if B2B
  const mappedProducts = products?.map(p => {
    if (isB2B && p.price_b2b != null) {
      return { ...p, price: p.price_b2b }
    }
    return p
  })

  return NextResponse.json({
    products: mappedProducts || [],
    nextCursor,
    total: mappedProducts?.length || 0
  })
}
