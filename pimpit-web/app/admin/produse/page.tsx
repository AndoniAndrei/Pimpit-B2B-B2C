import { createServerClient } from '@supabase/ssr'
import ProduseClient from './ProduseClient'

export const revalidate = 0

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export default async function ProdusePage() {
  const { data: suppliers } = await adminClient()
    .from('suppliers')
    .select('id, name')
    .order('id')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Produse</h1>
          <p className="text-muted-foreground mt-1 text-sm">Click pe orice câmp pentru editare inline. Selectează mai multe pentru editare în masă.</p>
        </div>
      </div>
      <ProduseClient suppliers={suppliers || []} />
    </div>
  )
}
