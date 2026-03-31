import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  const { data: orders } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Contul meu</h1>
      
      <div className="grid md:grid-cols-3 gap-8">
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4">Date personale</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Email:</span> {user.email}</p>
            <p><span className="text-muted-foreground">Tip cont:</span> {profile?.role === 'customer_b2b' ? 'B2B (Firmă)' : 'B2C (Persoană fizică)'}</p>
            {profile?.role === 'customer_b2b' && (
              <>
                <p><span className="text-muted-foreground">Companie:</span> {profile.company_name}</p>
                <p><span className="text-muted-foreground">CUI:</span> {profile.cui}</p>
              </>
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-card border rounded-xl p-6">
          <h2 className="font-bold text-lg mb-4">Istoric Comenzi</h2>
          {orders?.length === 0 ? (
            <p className="text-muted-foreground">Nu ai plasat nicio comandă încă.</p>
          ) : (
            <div className="space-y-4">
              {orders?.map(order => (
                <div key={order.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">Comanda #{order.id.split('-')[0]}</p>
                    <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString('ro-RO')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{order.total} RON</p>
                    <span className="text-xs px-2 py-1 bg-muted rounded-full uppercase font-medium">{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
