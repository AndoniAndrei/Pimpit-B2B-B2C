import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { runImportAll } from '@/lib/importRunner'

// Sync touches every active supplier in sequence; needs the longest window
// the platform allows. 300s is the Vercel Pro/Enterprise cap.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await makeAdminClient()
    .from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const summary = await runImportAll()
    return NextResponse.json({ success: true, ...summary })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Sync failed' }, { status: 500 })
  }
}
