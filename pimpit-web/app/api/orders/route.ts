import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'

const addressSchema = z.object({
  street: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(100),
  county: z.string().trim().min(2).max(100),
  postal_code: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().max(100).optional().default('România')
})

const orderSchema = z.object({
  shipping_address: addressSchema,
  billing_address: addressSchema.optional().nullable(),
  customer_name: z.string().trim().min(2).max(200),
  customer_email: z.string().trim().email().max(255),
  customer_phone: z.string().trim().min(6).max(20),
  payment_method: z.literal('ramburs')
})

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }

  const parsed = orderSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const first = Object.entries(fieldErrors)[0]
    const msg = first ? `${first[0]}: ${first[1]?.[0]}` : 'Date invalide'
    return NextResponse.json({ error: msg, details: fieldErrors }, { status: 400 })
  }

  const { shipping_address, billing_address, customer_email, customer_phone, customer_name, payment_method } = parsed.data

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sessionId = cookies().get('session_id')?.value

  // 1. Get Cart
  let cartQuery = supabase.from('cart').select('*, product:products(*)')
  if (user) {
    cartQuery = cartQuery.eq('user_id', user.id)
  } else if (sessionId) {
    cartQuery = cartQuery.eq('session_id', sessionId)
  } else {
    return NextResponse.json({ error: 'No active session or cart' }, { status: 400 })
  }

  const { data: cartItems, error: cartError } = await cartQuery
  if (cartError || !cartItems || cartItems.length === 0) {
    return NextResponse.json({ error: 'Cart is empty or error fetching cart' }, { status: 400 })
  }

  // 2. Determine if B2B
  let isB2B = false
  if (user) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    isB2B = profile?.role === 'customer_b2b'
  }

  // 3. Build the RPC payload with B2B pricing applied at checkout time.
  //    Stock is NOT checked here — create_order_atomic does the check
  //    atomically inside one transaction to prevent oversell races.
  const items = cartItems.map(item => {
    const p = item.product
    const unitPrice = (isB2B && p.price_b2b != null) ? p.price_b2b : p.price
    return {
      product_id: p.id,
      product_name: p.name,
      product_brand: p.brand,
      product_pn: p.part_number,
      product_image: p.images?.[0] ?? null,
      unit_price: unitPrice,
      quantity: item.quantity,
      selected_et: item.selected_et ?? null,
      selected_pcd: item.selected_pcd ?? null,
      needs_help_et: !!item.needs_help_et,
      needs_help_pcd: !!item.needs_help_pcd,
    }
  })

  // 4. Atomic order creation: reserves stock, inserts order + items,
  //    returns the new order id. Any failure rolls the whole thing back.
  const { data: orderId, error: rpcError } = await supabase.rpc('create_order_atomic', {
    p_user_id: user?.id ?? null,
    p_customer_name: customer_name,
    p_customer_email: customer_email,
    p_customer_phone: customer_phone,
    p_shipping_address: shipping_address,
    p_billing_address: billing_address ?? null,
    p_payment_method: payment_method,
    p_items: items,
  })

  if (rpcError) {
    const msg = rpcError.message || ''
    if (msg.includes('INSUFFICIENT_STOCK')) {
      return NextResponse.json({ error: 'Stoc insuficient pentru unul dintre produse' }, { status: 409 })
    }
    if (msg.includes('EMPTY_CART')) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }
    if (msg.includes('INVALID_ITEM')) {
      return NextResponse.json({ error: 'Date invalide în coș' }, { status: 400 })
    }
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // 5. Clear Cart (best-effort — the order is already persisted)
  if (user) {
    await supabase.from('cart').delete().eq('user_id', user.id)
  } else if (sessionId) {
    await supabase.from('cart').delete().eq('session_id', sessionId)
  }

  return NextResponse.json({ order_id: orderId })
}
