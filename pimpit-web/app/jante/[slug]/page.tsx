import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Award } from 'lucide-react'
import ProductImage from '@/components/catalog/ProductImage'
import ProductCard from '@/components/catalog/ProductCard'
import AccordionSection from '@/components/catalog/AccordionSection'
import ProductActions from './ProductActions'
import { splitAndNormalizePcds } from '@/lib/pcdUtils'
import { formatPrice } from '@/lib/utils'
import { Product } from '@/lib/types'

export const revalidate = 3600

function getYouTubeId(url: string): string | null {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

export async function generateStaticParams() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true)
    .order('stock', { ascending: false })
    .limit(1000)
  return data?.map((p) => ({ slug: p.slug })) || []
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: product } = await supabase.from('products').select('*').eq('slug', params.slug).maybeSingle()
  if (!product) return { title: 'Produs inexistent' }
  return {
    title: `${product.brand} ${product.name} ${product.diameter}x${product.width} ${product.pcd} | Pimpit.ro`,
    description: `${product.brand} ${product.name} — disponibilă pe pimpit.ro.`,
  }
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-pimpit-border last:border-b-0">
      <span className="text-sm text-pimpit-text-muted">{label}</span>
      <span className="text-sm font-semibold text-pimpit-text tabular-nums text-right">{value}</span>
    </div>
  )
}

function StockBlock({ stock, stockIncoming }: { stock: number; stockIncoming: number }) {
  if (stock > 0) {
    return (
      <div className="inline-flex items-center gap-2 border border-pimpit-success/40 bg-pimpit-success/10 px-3 py-1.5 rounded-md">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-pimpit-success opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-pimpit-success" />
        </span>
        <span className="text-xs font-semibold text-pimpit-success">
          În stoc ({stock} buc)
        </span>
      </div>
    )
  }
  if (stockIncoming > 0) {
    return (
      <div className="inline-flex items-center gap-2 border border-pimpit-accent/40 bg-pimpit-accent/10 px-3 py-1.5 rounded-md">
        <span className="h-2 w-2 rounded-full bg-pimpit-accent" />
        <span className="text-xs font-semibold text-pimpit-accent">
          La comandă ({stockIncoming} buc)
        </span>
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-2 border border-pimpit-border bg-pimpit-surface-2 px-3 py-1.5 rounded-md">
      <span className="h-2 w-2 rounded-full bg-pimpit-text-muted" />
      <span className="text-xs font-semibold text-pimpit-text-muted">Indisponibil</span>
    </div>
  )
}

function CertBadge({ Icon, label, sublabel }: { Icon: any; label: string; sublabel: string }) {
  return (
    <div className="inline-flex items-center gap-2.5 border border-pimpit-border bg-white px-3 py-2 rounded-md">
      <Icon className="w-4 h-4 text-pimpit-accent shrink-0" />
      <div className="leading-tight">
        <div className="text-xs font-bold text-pimpit-text">{label}</div>
        <div className="text-[10px] text-pimpit-text-muted">{sublabel}</div>
      </div>
    </div>
  )
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

  const etMin: number | null = product.et_min ?? null
  const etMax: number | null = product.et_max ?? null
  const etValues: number[] =
    etMin != null && etMax != null && etMin !== etMax
      ? Array.from({ length: Math.floor(etMax) - Math.ceil(etMin) + 1 }, (_, i) => Math.ceil(etMin) + i)
      : []

  const allPcds = product.pcd ? splitAndNormalizePcds(product.pcd) : []
  const pcdOptions = allPcds.length >= 3 ? allPcds : []

  let related: Product[] = []
  {
    const { data: byBrand } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('brand', product.brand)
      .neq('id', product.id)
      .order('stock', { ascending: false })
      .limit(8)
    related = (byBrand as Product[]) || []
    if (related.length < 8 && product.diameter) {
      const { data: byDia } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('diameter', product.diameter)
        .neq('id', product.id)
        .order('stock', { ascending: false })
        .limit(8 - related.length)
      const existing = new Set(related.map((r) => r.id))
      related = [...related, ...(((byDia as Product[]) || []).filter((p) => !existing.has(p.id)))]
    }
  }

  const displayPrice = (isB2B && product.price_b2b != null) ? product.price_b2b : product.price
  const hasOld = product.price_old && product.price_old > displayPrice
  const etLabel =
    product.et_min != null && product.et_max != null && product.et_min !== product.et_max
      ? `${product.et_min} → ${product.et_max}`
      : String(product.et_min ?? product.et_offset ?? '—')
  const vid = product.youtube_link ? getYouTubeId(product.youtube_link) : null

  return (
    <div className="bg-pimpit-surface-2 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-pimpit-border">
        <div className="container mx-auto px-4 lg:px-8 py-3 flex items-center justify-between text-xs text-pimpit-text-muted">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="hover:text-pimpit-accent transition-colors">Acasă</Link>
            <span>/</span>
            <Link href="/jante" className="hover:text-pimpit-accent transition-colors">Jante</Link>
            <span>/</span>
            <span className="font-semibold text-pimpit-text truncate">{product.brand}</span>
          </div>
          <span className="shrink-0 hidden sm:inline">Cod: {product.part_number}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-8 md:py-10">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-10">
          {/* LEFT 60% — image + media */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative aspect-square overflow-hidden bg-white border border-pimpit-border rounded-md shadow-premium">
              <ProductImage
                src={product.images?.[0] || ''}
                alt={product.name}
                fill
                className="p-10"
                priority
              />
            </div>

            {product.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {product.images.slice(0, 8).map((img: string, i: number) => (
                  <div key={i} className="w-20 h-20 relative shrink-0 bg-white border border-pimpit-border rounded-md hover:border-pimpit-accent transition-colors">
                    <ProductImage src={img} alt="" fill className="object-cover p-1.5" />
                  </div>
                ))}
              </div>
            )}

            {vid && (
              <div className="aspect-video overflow-hidden border border-pimpit-border rounded-md bg-white">
                <iframe
                  src={`https://www.youtube.com/embed/${vid}`}
                  title="Video produs"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}
            {product.model_3d_url && (
              <div className="aspect-square overflow-hidden border border-pimpit-border rounded-md bg-white">
                <iframe
                  src={product.model_3d_url}
                  title="Prezentare 3D"
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full"
                />
              </div>
            )}
          </div>

          {/* RIGHT 40% — sticky info card */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-pimpit-border rounded-md p-6 lg:p-7 shadow-premium">
              <div className="flex items-center justify-between gap-3 mb-4">
                <Link
                  href={`/jante?brand=${encodeURIComponent(product.brand)}`}
                  className="text-xs font-bold tracking-widest uppercase text-pimpit-accent hover:text-pimpit-accent-hover transition-colors"
                >
                  {product.brand}
                </Link>
                <StockBlock stock={product.stock ?? 0} stockIncoming={product.stock_incoming ?? 0} />
              </div>

              <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-pimpit-text">
                {product.name}
              </h1>
              {product.model && (
                <p className="mt-1.5 text-sm text-pimpit-text-muted">
                  Model: <span className="font-semibold text-pimpit-text">{product.model}</span>
                </p>
              )}

              {/* Fitment ribbon */}
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5">
                {product.diameter != null && <FitChip label="Ø" value={`${product.diameter}"`} />}
                {product.width != null && <FitChip label="J" value={String(product.width)} />}
                {product.pcd && <FitChip label="PCD" value={product.pcd} />}
                {(product.et_offset != null || product.et_min != null) && <FitChip label="ET" value={etLabel} />}
                {product.center_bore != null && <FitChip label="CB" value={String(product.center_bore)} />}
              </div>

              {/* Cert badges — ONLY shown when backed by real data.
                  Currently the schema only tracks TÜV (`certificate_url`).
                  Add KBA/JWL badges here only after the columns exist. */}
              {product.certificate_url && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <CertBadge Icon={Award} label="TÜV" sublabel="Certificat disponibil" />
                </div>
              )}

              {/* Price */}
              <div className="mt-6 pb-6 border-b border-pimpit-border">
                {hasOld && (
                  <span className="text-sm text-pimpit-text-muted line-through tabular-nums">
                    {formatPrice(product.price_old!)}
                  </span>
                )}
                <div className="flex items-baseline gap-3 mt-0.5">
                  <span className="text-4xl md:text-5xl font-bold tracking-tight text-pimpit-text tabular-nums">
                    {formatPrice(displayPrice)}
                  </span>
                  {isB2B && product.price_b2b != null && (
                    <span className="text-xs font-bold tracking-widest uppercase px-2 py-1 rounded border border-pimpit-accent/50 text-pimpit-accent">
                      B2B
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-pimpit-text-muted">
                  Preț per bucată · TVA inclus
                </p>
              </div>

              {/* CTA */}
              <div className="mt-6">
                <ProductActions
                  productId={product.id}
                  stock={product.stock ?? 0}
                  etValues={etValues}
                  etMin={etMin}
                  etMax={etMax}
                  pcdOptions={pcdOptions}
                />
              </div>
            </div>

            {/* Accordion sections */}
            <div className="mt-6 bg-white border border-pimpit-border rounded-md shadow-premium px-6 lg:px-7">
              {product.description && (
                <AccordionSection title="Descriere" defaultOpen>
                  <p className="text-sm text-pimpit-text leading-relaxed whitespace-pre-line">{product.description}</p>
                </AccordionSection>
              )}

              {/* "Verifică compatibilitatea" — dezactivat. Verificarea
                  automată de fitment necesită o tabelă vehicle ⇄ spec care
                  nu există încă în schema. Reactivat după build-ul acelei
                  funcționalități. */}

              <AccordionSection title="Specificații complete">
                <div className="border-t border-pimpit-border">
                  {product.diameter != null && <SpecRow label="Diametru" value={`${product.diameter}"`} />}
                  {product.width != null && <SpecRow label="Lățime" value={`${product.width}"`} />}
                  {product.pcd && <SpecRow label="PCD" value={product.pcd} />}
                  {(product.et_offset != null || product.et_min != null) && <SpecRow label="ET" value={etLabel} />}
                  {product.center_bore != null && <SpecRow label="CB (mm)" value={product.center_bore} />}
                  {product.color && <SpecRow label="Culoare" value={product.color} />}
                  {product.finish && <SpecRow label="Finisaj" value={product.finish} />}
                  {product.weight != null && <SpecRow label="Greutate" value={`${product.weight} kg`} />}
                  {product.max_load != null && <SpecRow label="Sarcină max" value={`${product.max_load} kg`} />}
                  {product.production_method && <SpecRow label="Fabricație" value={product.production_method} />}
                  {product.concave_profile && <SpecRow label="Profil concav" value={product.concave_profile} />}
                  {product.ean && <SpecRow label="EAN" value={product.ean} />}
                  {product.custom_fields &&
                    Object.entries(product.custom_fields as Record<string, string>).map(([label, value]) =>
                      value ? <SpecRow key={label} label={label} value={value} /> : null,
                    )}
                </div>
                {product.certificate_url && (
                  <a
                    href={product.certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pimpit-accent hover:text-pimpit-accent-hover transition-colors"
                  >
                    Vezi certificatul TÜV →
                  </a>
                )}
              </AccordionSection>

              {/* "Livrare & retururi" — secțiune dezactivată până când există
                  date reale în DB (transportatori, intervale, politică de
                  retur). Cifrele și termenii apar aici doar când le susținem
                  cu date confirmate. */}
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="bg-white border-t border-pimpit-border">
          <div className="container mx-auto px-4 lg:px-8 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-pimpit-text">
                  Jante similare
                </h2>
                <p className="text-sm text-pimpit-text-muted mt-1">Alte modele {product.brand}</p>
              </div>
              <Link
                href={`/jante?brand=${encodeURIComponent(product.brand)}`}
                className="hidden sm:inline-flex text-sm font-semibold text-pimpit-accent hover:text-pimpit-accent-hover transition-colors"
              >
                Vezi tot {product.brand} →
              </Link>
            </div>
            <div className="-mx-4 lg:-mx-8 px-4 lg:px-8 overflow-x-auto no-scrollbar">
              <div className="flex gap-4 pb-2">
                {related.slice(0, 8).map((p) => (
                  <div key={p.id} className="w-[72vw] sm:w-[280px] xl:w-[300px] shrink-0">
                    <ProductCard product={p} isB2B={isB2B} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FitChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-sm">
      <span className="font-mono text-xs text-pimpit-text-muted">{label}</span>
      <span className="font-semibold text-pimpit-text">{value}</span>
    </span>
  )
}
