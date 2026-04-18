import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { evaluateFormula } from '@/lib/formulaEvaluator'

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

async function checkAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await adminClient().from('users').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin'
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { ids, action, value } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0 || !action) {
    return NextResponse.json({ error: 'ids și action sunt obligatorii' }, { status: 400 })
  }
  if (ids.length > 5000) {
    return NextResponse.json({ error: 'Prea multe produse selectate (max 5000 per cerere)' }, { status: 400 })
  }

  const db = adminClient()

  if (action === 'activate') {
    const { error } = await db.from('products').update({ is_active: true }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: ids.length })
  }

  if (action === 'deactivate') {
    const { error } = await db.from('products').update({ is_active: false }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: ids.length })
  }

  if (action === 'delete') {
    const { error } = await db.from('products').delete().in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: ids.length })
  }

  if (action === 'set_stock') {
    const stock = parseInt(value)
    if (isNaN(stock)) return NextResponse.json({ error: 'Stoc invalid' }, { status: 400 })
    const { error } = await db.from('products').update({ stock }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: ids.length })
  }

  if (action === 'price_formula') {
    // value = formula like "{price} * 1.10" where {price} references current price
    if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
      return NextResponse.json({ error: 'Formulă invalidă (max 200 caractere)' }, { status: 400 })
    }

    const { data: products, error: fetchErr } = await db.from('products').select('id, price').in('id', ids)
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const updates: { id: string; price: number }[] = []
    for (const p of products ?? []) {
      const computed = evaluateFormula(value, { price: p.price })
      if (!Number.isFinite(computed) || computed < 0) continue
      updates.push({ id: p.id, price: Math.round(computed * 100) / 100 })
    }

    const errors: string[] = []
    const CHUNK = 50
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK)
      const results = await Promise.all(
        chunk.map(u => db.from('products').update({ price: u.price }).eq('id', u.id))
      )
      for (const r of results) if (r.error) errors.push(r.error.message)
    }
    if (errors.length) {
      return NextResponse.json({
        error: errors[0],
        updated: updates.length - errors.length,
        failed: errors.length,
      }, { status: 207 })
    }
    return NextResponse.json({ updated: updates.length, skipped: ids.length - updates.length })
  }

  if (action === 'set_price') {
    const price = parseFloat(value)
    if (isNaN(price)) return NextResponse.json({ error: 'Preț invalid' }, { status: 400 })
    const { error } = await db.from('products').update({ price }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: ids.length })
  }

  return NextResponse.json({ error: 'Acțiune necunoscută' }, { status: 400 })
}
