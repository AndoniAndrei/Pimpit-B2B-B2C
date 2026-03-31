import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const railwayUrl = process.env.ETL_RAILWAY_URL
  if (!railwayUrl) {
    return NextResponse.json({ error: 'ETL_RAILWAY_URL not configured' }, { status: 500 })
  }

  try {
    // Fire and forget to Railway webhook/endpoint
    fetch(railwayUrl, { method: 'POST' }).catch(console.error)
    return NextResponse.json({ success: true, message: 'Sync triggered' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
