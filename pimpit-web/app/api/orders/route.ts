import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const body = await request.json()
  const { shipping_address, billing_address, customer_email, customer_phone, customer_name, payment_method } = body
  
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

  // 3. Calculate Totals & Check Stock
  let subtotal = 0
  const orderItems = []

  for (const item of cartItems) {
    const p = item.product
    if (p.stock < item.quantity) {
      return NextResponse.json({ error: `Not enough stock for ${p.name}` }, { status: 400 })
    }

    const unitPrice = (isB2B && p.price_b2b != null) ? p.price_b2b : p.price
    const totalPrice = unitPrice * item.quantity
    subtotal += totalPrice

    orderItems.push({
      product_id: p.id,
      product_name: p.name,
      product_brand: p.brand,
      product_pn: p.part_number,
      product_image: p.images?.[0] || null,
      unit_price: unitPrice,
      quantity: item.quantity,
      total_price: totalPrice
    })
  }

  const shippingCost = subtotal > 1000 ? 0 : 50 // Example logic
  const total = subtotal + shippingCost

  // 4. Create Order
  const { data: order, error: orderError } = await supabase.from('orders').insert({
    user_id: user?.id || null,
    status: 'pending',
    shipping_address,
    billing_address: billing_address || shipping_address,
    subtotal,
    shipping_cost: shippingCost,
    total,
    customer_email,
    customer_phone,
    customer_name,
    payment_method
  }).select().maybeSingle()

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // 5. Create Order Items
  const itemsToInsert = orderItems.map(oi => ({ ...oi, order_id: order.id }))
  const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert)
  
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  // 6. Clear Cart
  if (user) {
    await supabase.from('cart').delete().eq('user_id', user.id)
  } else if (sessionId) {
    await supabase.from('cart').delete().eq('session_id', sessionId)
  }

  return NextResponse.json({ order_id: order.id })
}
