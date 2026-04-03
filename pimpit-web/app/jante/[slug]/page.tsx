import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import PriceDisplay from '@/components/catalog/PriceDisplay'
import ProductImage from '@/components/catalog/ProductImage'

export const revalidate = 3600 // ISR 1 hour

export async function generateStaticParams() {
  // Use a standard client without cookies for build-time static generation
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true)
    .order('stock', { ascending: false })
    .limit(1000)
  
  return data?.map(p => ({ slug: p.slug })) || []
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: product } = await supabase.from('products').select('*').eq('slug', params.slug).maybeSingle()
  if (!product) return { title: 'Produs inexistent' }
  return {
    title: `${product.brand} ${product.name} ${product.diameter}x${product.width} ${product.pcd} | Pimpit.ro`,
    description: `Cumpără ${product.brand} ${product.name} la cel mai bun preț.`,
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: product, error } = await supabase.from('products').select('*').eq('slug', params.slug).maybeSingle()
  
  if (error || !product) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  let isB2B = false
  if (user) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    isB2B = profile?.role === 'customer_b2b'
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="grid md:grid-cols-2 gap-12">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square relative bg-muted rounded-lg overflow-hidden">
            <ProductImage
              src={product.images?.[0] || ''}
              alt={product.name}
              fill
              className="object-contain"
              priority
            />
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.slice(1).map((img: string, i: number) => (
                <div key={i} className="w-20 h-20 relative bg-muted rounded-md shrink-0">
                  <ProductImage src={img} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.brand} {product.name}</h1>
          <p className="text-muted-foreground mb-6">Cod: {product.part_number}</p>
          
          <div className="mb-8">
            <PriceDisplay 
              price={product.price} 
              priceOld={product.price_old} 
              priceB2b={product.price_b2b} 
              isB2B={isB2B} 
              showBadge={false} 
              large
            />
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Diametru</span>
              <span className="font-medium">{product.diameter}"</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Lățime</span>
              <span className="font-medium">{product.width}"</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">PCD</span>
              <span className="font-medium">{product.pcd}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">ET</span>
              <span className="font-medium">{product.et_offset}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">CB (Gaura centrală)</span>
              <span className="font-medium">{product.center_bore} mm</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Stoc</span>
              <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {product.stock > 0 ? `${product.stock} buc` : 'Indisponibil'}
              </span>
            </div>
          </div>

          <button 
            disabled={product.stock === 0}
            className="w-full bg-primary text-primary-foreground py-4 rounded-lg font-bold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Adaugă în coș
          </button>
        </div>
      </div>
    </div>
  )
}
