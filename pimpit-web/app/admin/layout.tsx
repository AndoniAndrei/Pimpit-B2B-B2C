import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminLayoutClient from './AdminLayoutClient'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/')

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
