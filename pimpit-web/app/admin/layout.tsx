import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="w-64 bg-card border-r p-6">
        <h2 className="font-bold text-lg mb-6">Admin Panel</h2>
        <nav className="space-y-2">
          <Link href="/admin" className="block px-4 py-2 rounded-md hover:bg-muted font-medium">Dashboard</Link>
          <Link href="/admin/produse" className="block px-4 py-2 rounded-md hover:bg-muted font-medium">Produse</Link>
          <Link href="/admin/importuri" className="block px-4 py-2 rounded-md hover:bg-muted font-medium">Importuri</Link>
          <Link href="/admin/furnizori" className="block px-4 py-2 rounded-md hover:bg-muted font-medium">Furnizori</Link>
          <Link href="/admin/sincronizari" className="block px-4 py-2 rounded-md hover:bg-muted font-medium">Sincronizări</Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
