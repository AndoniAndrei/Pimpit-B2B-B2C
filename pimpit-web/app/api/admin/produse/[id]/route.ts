import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await adminClient().from('products').select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Produsul nu a fost găsit' }, { status: 404 })
  return NextResponse.json(data)
}

const NUMERIC_FIELDS: Record<string, { min: number; max: number }> = {
  price:          { min: 0,    max: 999999 },
  price_b2b:      { min: 0,    max: 999999 },
  price_old:      { min: 0,    max: 999999 },
  stock:          { min: 0,    max: 9999999 },
  stock_incoming: { min: 0,    max: 9999999 },
  diameter:       { min: 10,   max: 30 },
  width:          { min: 4,    max: 16 },
  width_rear:     { min: 4,    max: 16 },
  et_offset:      { min: -100, max: 150 },
  center_bore:    { min: 30,   max: 200 },
  weight:         { min: 0,    max: 999 },
  max_load:       { min: 0,    max: 9999 },
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  for (const [field, range] of Object.entries(NUMERIC_FIELDS)) {
    if (!(field in body) || body[field] === null) continue
    const v = Number(body[field])
    if (isNaN(v)) return NextResponse.json({ error: `${field} trebuie să fie număr` }, { status: 400 })
    if (v < range.min || v > range.max)
      return NextResponse.json({ error: `${field} trebuie să fie între ${range.min} și ${range.max}` }, { status: 400 })
  }
  const { data, error } = await adminClient().from('products').update(body).eq('id', params.id).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Produsul nu a fost găsit sau actualizarea a eșuat' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await adminClient().from('products').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
