import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
  const { product_id, quantity } = await request.json()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sessionId = cookies().get('session_id')?.value

  if (!user && !sessionId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 })
  }

  const cartData = {
    product_id,
    quantity,
    user_id: user ? user.id : null,
    session_id: !user ? sessionId : null
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

  const { error } = await supabase.from('cart').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  return NextResponse.json({ success: true })
}
