import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

async function checkAdmin(req: NextRequest) {
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return false
  const { data } = await adminClient().from('users').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const search = searchParams.get('search') || ''
  const brand = searchParams.get('brand') || ''
  const supplier = searchParams.get('supplier') || ''
  const active = searchParams.get('active')
  const from = (page - 1) * limit

  const db = adminClient()
  let query = db.from('products')
    .select('id,part_number,brand,name,price,price_b2b,price_old,stock,stock_incoming,is_active,images,diameter,width,pcd,et_offset,winning_supplier_id,last_synced_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,part_number.ilike.%${search}%`)
  if (brand) query = query.eq('brand', brand)
  if (supplier) query = query.eq('winning_supplier_id', supplier)
  if (active === 'true') query = query.eq('is_active', true)
  if (active === 'false') query = query.eq('is_active', false)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count, page, limit })
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const db = adminClient()

  const slug = `${body.brand}-${body.name}-${body.part_number}`
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').slice(0, 200)

  const { data, error } = await db.from('products').insert({ ...body, slug }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
