import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'

const addSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  // ET / PCD selections flow through Etapa C's pickers on the product detail
  // page. Either a concrete value OR the corresponding needs_help flag, never
  // both — ProductActions enforces this client-side and we ignore stray
  // combinations server-side (selection wins when both are provided).
  selected_et: z.number().finite().optional().nullable(),
  selected_pcd: z.string().trim().min(1).max(40).optional().nullable(),
  needs_help_et: z.boolean().optional(),
  needs_help_pcd: z.boolean().optional(),
})

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sessionId = cookies().get('session_id')?.value

  let query = supabase.from('cart').select('*, product:products(*)').order('added_at', { ascending: false })

  if (user) {
    query = query.eq('user_id', user.id)
  } else if (sessionId) {
    query = query.eq('session_id', sessionId)
  } else {
    return NextResponse.json({ items: [] })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data })
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }

  const parsed = addSchema.safeParse(raw)
  if (!parsed.success) {
    const first = Object.entries(parsed.error.flatten().fieldErrors)[0]
    const msg = first ? `${first[0]}: ${first[1]?.[0]}` : 'Date invalide'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const body = parsed.data

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sessionId = cookies().get('session_id')?.value

  if (!user && !sessionId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 })
  }

  const cartData = {
    product_id: body.product_id,
    quantity: body.quantity,
    user_id: user ? user.id : null,
    session_id: !user ? sessionId : null,
    // Concrete selection wins over help flag when both slipped through.
    selected_et: body.selected_et ?? null,
    selected_pcd: body.selected_pcd ?? null,
    needs_help_et: body.selected_et != null ? false : !!body.needs_help_et,
    needs_help_pcd: body.selected_pcd != null ? false : !!body.needs_help_pcd,
  }

  const { data, error } = await supabase
    .from('cart')
    .upsert(cartData, { onConflict: user ? 'user_id,product_id' : 'session_id,product_id' })
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const supabase = createClient()

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  const sessionId = cookies().get('session_id')?.value

  if (!user && !sessionId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 })
  }

  // Scope the delete to the caller's own cart row — never trust `id` alone.
  let query = supabase.from('cart').delete().eq('id', id)
  if (user) {
    query = query.eq('user_id', user.id)
  } else {
    query = query.eq('session_id', sessionId!)
  }

  const { data, error } = await query.select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
