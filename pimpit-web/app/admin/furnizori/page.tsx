import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export default async function FurnizoriPage() {
  const supabase = createClient()
  
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*, pricing_rules(*)')
    .order('id')

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Gestionare Furnizori</h1>

      <div className="grid gap-6">
        {suppliers?.map(supplier => (
          <div key={supplier.id} className="bg-card border rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{supplier.name}</h2>
                <p className="text-sm text-muted-foreground">URL: {supplier.feed_url}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {supplier.is_active ? 'ACTIV' : 'INACTIV'}
              </span>
            </div>

            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold mb-3">Reguli de Preț (Pricing Rules)</h3>
              {supplier.pricing_rules?.[0] ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Base Discount</span>
                    <span className="font-medium">{(supplier.pricing_rules[0].base_discount * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Base Multiplier</span>
                    <span className="font-medium">{supplier.pricing_rules[0].base_multiplier}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Fixed Cost</span>
                    <span className="font-medium">{supplier.pricing_rules[0].fixed_cost} RON</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Margin</span>
                    <span className="font-medium">{(supplier.pricing_rules[0].margin_multiplier * 100 - 100).toFixed(0)}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nu există reguli definite.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
