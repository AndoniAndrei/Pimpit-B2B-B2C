import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nu este configurat în Vercel' }, { status: 500 })
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
