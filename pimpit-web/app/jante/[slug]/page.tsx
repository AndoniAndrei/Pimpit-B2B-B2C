import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import PriceDisplay from '@/components/catalog/PriceDisplay'
import ProductImage from '@/components/catalog/ProductImage'

export const revalidate = 3600 // ISR 1 hour

/** Extract YouTube video ID from watch or share URLs */
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

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
        {/* Image Gallery + Media */}
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
          {/* YouTube video embed */}
          {product.youtube_link && (() => {
            const vid = getYouTubeId(product.youtube_link);
            return vid ? (
              <div className="aspect-video rounded-xl overflow-hidden border bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${vid}`}
                  title="Video produs"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : null;
          })()}
          {/* 3D HTML viewer */}
          {product.model_3d_url && (
            <div className="aspect-square rounded-xl overflow-hidden border bg-muted">
              <iframe
                src={product.model_3d_url}
                title="Prezentare 3D"
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full"
              />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.brand} {product.name}</h1>
          {product.model && (
            <p className="text-sm font-medium text-primary mb-1">Model: {product.model}</p>
          )}
          <p className="text-muted-foreground mb-2 text-sm">Cod: {product.part_number}</p>
          {product.ean && <p className="text-xs text-muted-foreground mb-4">EAN: {product.ean}</p>}
          
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

          <div className="space-y-0 mb-8 divide-y">
            {product.diameter != null && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Diametru</span>
                <span className="font-medium">{product.diameter}"</span>
              </div>
            )}
            {product.width != null && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Lățime</span>
                <span className="font-medium">{product.width}"</span>
              </div>
            )}
            {product.pcd && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">PCD</span>
                <span className="font-medium">{product.pcd}</span>
              </div>
            )}
            {product.et_offset != null && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">ET</span>
                <span className="font-medium">{product.et_offset}</span>
              </div>
            )}
            {product.center_bore != null && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">CB (Gaura centrală)</span>
                <span className="font-medium">{product.center_bore} mm</span>
              </div>
            )}
            {product.color && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Culoare</span>
                <span className="font-medium">{product.color}</span>
              </div>
            )}
            {product.finish && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Finisaj</span>
                <span className="font-medium">{product.finish}</span>
              </div>
            )}
            {product.weight != null && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Greutate</span>
                <span className="font-medium">{product.weight} kg</span>
              </div>
            )}
            {product.max_load != null && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Sarcină maximă</span>
                <span className="font-medium">{product.max_load} kg</span>
              </div>
            )}
            {product.production_method && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Metodă fabricație</span>
                <span className="font-medium">{product.production_method}</span>
              </div>
            )}
            {product.concave_profile && (
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Profil concav</span>
                <span className="font-medium">{product.concave_profile}</span>
              </div>
            )}
            {/* Custom fields from import mapping */}
            {product.custom_fields && Object.entries(product.custom_fields as Record<string, string>).map(([label, value]) =>
              value ? (
                <div key={label} className="flex justify-between py-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ) : null
            )}
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Stoc</span>
              <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {product.stock > 0 ? `${product.stock} buc` : 'Indisponibil'}
              </span>
            </div>
          </div>
          {/* Description */}
          {product.description && (
            <div className="mt-6 p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </div>
          )}
          {/* TÜV certificate link */}
          {product.certificate_url && (
            <a href={product.certificate_url} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-xs text-primary hover:underline">
              📄 Certificat TÜV
            </a>
          )}

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
