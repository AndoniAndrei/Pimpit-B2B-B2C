import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = createClient()
  
  const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true)
  const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true })
  const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Produse Active</h3>
          <p className="text-4xl font-black">{totalProducts || 0}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Utilizatori</h3>
          <p className="text-4xl font-black">{totalUsers || 0}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Comenzi</h3>
          <p className="text-4xl font-black">{totalOrders || 0}</p>
        </div>
      </div>
    </div>
  )
}
