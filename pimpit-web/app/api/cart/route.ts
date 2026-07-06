import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'

const addSchema = z.object({
  // Fie un produs v1 (products), fie o variantă v2 (product_variants) — exact unul.
  product_id: z.string().uuid().optional().nullable(),
  variant_id: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  // ET / PCD selections flow through Etapa C's pickers on the product detail
  // page. Either a concrete value OR the corresponding needs_help flag, never
  // both — ProductActions enforces this client-side and we ignore stray
  // combinations server-side (selection wins when both are provided).
  selected_et: z.number().finite().optional().nullable(),
  selected_pcd: z.string().trim().min(1).max(40).optional().nullable(),
  needs_help_et: z.boolean().optional(),
  needs_help_pcd: z.boolean().optional(),
}).refine(d => !!d.product_id !== !!d.variant_id, {
  message: 'Trimite exact unul dintre product_id și variant_id',
})

/** Select-ul comun: produs v1 + variantă v2 cu familia și brandul ei. */
const CART_SELECT =
  '*, product:products(*), variant:product_variants(id, part_number, name_suffix, price, price_b2b, stock, attrs, brand:brands(name), family:catalog_products(name, slug))'

interface VariantJoin {
  id: string
  part_number: string
  name_suffix: string | null
  price: number | null
  price_b2b: number | null
  stock: number
  attrs: Record<string, unknown>
  brand: { name: string } | { name: string }[] | null
  family: { name: string; slug: string } | { name: string; slug: string }[] | null
}

/**
 * Normalizează un rând de coș v2 la forma pe care o așteaptă UI-ul existent
 * (item.product.{name, brand, price, images, part_number}), ca pagina /cos
 * să funcționeze identic pentru ambele generații de catalog.
 */
function normalizeItem(item: Record<string, unknown>) {
  const v = item.variant as VariantJoin | null
  if (!v || item.product) return item
  const brand = Array.isArray(v.brand) ? v.brand[0] : v.brand
  const family = Array.isArray(v.family) ? v.family[0] : v.family
  return {
    ...item,
    product: {
      id: null,
      name: [family?.name, v.name_suffix].filter(Boolean).join(' ') || v.part_number,
      brand: brand?.name ?? '',
      part_number: v.part_number,
      price: v.price ?? 0,
      price_b2b: v.price_b2b,
      stock: v.stock,
      images: [],
      slug: family?.slug ?? null,
      is_v2_variant: true,
    },
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sessionId = cookies().get('session_id')?.value

  let query = supabase.from('cart').select(CART_SELECT).order('added_at', { ascending: false })

  if (user) {
    query = query.eq('user_id', user.id)
  } else if (sessionId) {
    query = query.eq('session_id', sessionId)
  } else {
    return NextResponse.json({ items: [] })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: (data ?? []).map(normalizeItem) })
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
    const msg = first ? `${first[0]}: ${first[1]?.[0]}` : parsed.error.errors[0]?.message ?? 'Date invalide'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const body = parsed.data

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sessionId = cookies().get('session_id')?.value

  if (!user && !sessionId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 })
  }

  const isVariant = !!body.variant_id

  const cartData = {
    product_id: body.product_id ?? null,
    variant_id: body.variant_id ?? null,
    quantity: body.quantity,
    user_id: user ? user.id : null,
    session_id: !user ? sessionId : null,
    // Concrete selection wins over help flag when both slipped through.
    selected_et: body.selected_et ?? null,
    selected_pcd: body.selected_pcd ?? null,
    needs_help_et: body.selected_et != null ? false : !!body.needs_help_et,
    needs_help_pcd: body.selected_pcd != null ? false : !!body.needs_help_pcd,
  }

  const onConflict = isVariant
    ? (user ? 'user_id,variant_id' : 'session_id,variant_id')
    : (user ? 'user_id,product_id' : 'session_id,product_id')

  const { data, error } = await supabase
    .from('cart')
    .upsert(cartData, { onConflict })
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
