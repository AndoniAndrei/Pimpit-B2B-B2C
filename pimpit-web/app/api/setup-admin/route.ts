import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import crypto from 'crypto'

/**
 * One-shot bootstrap route for the very first admin.
 *
 * Gated by ADMIN_BOOTSTRAP_TOKEN so a random signup can't race the legit
 * operator: the caller must present the token via `x-setup-token` header
 * (or `setup_token` in the JSON body). When the env var is unset the route
 * is hard-disabled — safe default for any environment that has already
 * been bootstrapped.
 */
function tokensEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nu este configurat în Vercel' }, { status: 500 })
  }

  if (!bootstrapToken) {
    return NextResponse.json({ error: 'Setup-ul adminului este dezactivat (ADMIN_BOOTSTRAP_TOKEN lipsește).' }, { status: 403 })
  }

  // Accept the token from header or JSON body — either way, constant-time compare.
  let provided = req.headers.get('x-setup-token') ?? ''
  if (!provided) {
    try {
      const body = await req.json().catch(() => null)
      if (body && typeof body.setup_token === 'string') provided = body.setup_token
    } catch { /* body is optional */ }
  }
  if (!provided || !tokensEqual(provided, bootstrapToken)) {
    return NextResponse.json({ error: 'Token de setup invalid.' }, { status: 403 })
  }

  // Client cu service role — bypass RLS complet
  const adminClient = createServerClient(supabaseUrl, serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  })

  // Verifică dacă există deja un admin
  const { data: existingAdmin } = await adminClient
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (existingAdmin) {
    return NextResponse.json({ error: 'Există deja un administrator. Setup blocat.' }, { status: 403 })
  }

  // Ia utilizatorul curent din sesiune
  const anonClient = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: () => {},
    },
  })

  const { data: { user } } = await anonClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nu ești autentificat. Loghează-te mai întâi.' }, { status: 401 })
  }

  // Upsert în public.users cu role = admin
  const { error } = await adminClient
    .from('users')
    .upsert({ id: user.id, role: 'admin' }, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: user.email, message: 'Ești acum administrator!' })
}
