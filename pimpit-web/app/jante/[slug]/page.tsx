import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ProductImage from '@/components/catalog/ProductImage'
import ProductCard from '@/components/catalog/ProductCard'
import ProductActions from './ProductActions'
import { splitAndNormalizePcds } from '@/lib/pcdUtils'
import { formatPrice } from '@/lib/utils'
import { Product } from '@/lib/types'

export const revalidate = 3600 // ISR 1 hour

const GOLD = '#C9A84C'

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
    description: `Cumpără ${product.brand} ${product.name} la cel mai bun preț.`,
  }
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-b border-white/5">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">{label}</span>
      <span className="font-mono text-sm text-zinc-100 tabular-nums text-right">{value}</span>
    </div>
  )
}

function StockBlock({ stock, stockIncoming }: { stock: number; stockIncoming: number }) {
  if (stock > 0) {
    return (
      <div className="inline-flex items-center gap-2.5 border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300">
          {stock} buc · în stoc
        </span>
      </div>
    )
  }
  if (stockIncoming > 0) {
    return (
      <div className="inline-flex items-center gap-2.5 border border-amber-500/30 bg-amber-500/10 px-3.5 py-2">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300">
          {stockIncoming} buc · la comandă
        </span>
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-2.5 border border-zinc-700 bg-zinc-800/40 px-3.5 py-2">
      <span className="h-2 w-2 rounded-full bg-zinc-500" />
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400">epuizat</span>
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

  // ET picker options
  const etMin: number | null = product.et_min ?? null
  const etMax: number | null = product.et_max ?? null
  const etValues: number[] =
    etMin != null && etMax != null && etMin !== etMax
      ? Array.from(
          { length: Math.floor(etMax) - Math.ceil(etMin) + 1 },
          (_, i) => Math.ceil(etMin) + i,
        )
      : []

  const allPcds = product.pcd ? splitAndNormalizePcds(product.pcd) : []
  const pcdOptions = allPcds.length >= 3 ? allPcds : []

  // Related wheels — same brand, fall back to same diameter
  let related: Product[] = []
  {
    const { data: byBrand } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('brand', product.brand)
      .neq('id', product.id)
      .order('stock', { ascending: false })
      .limit(4)
    related = (byBrand as Product[]) || []
    if (related.length < 4 && product.diameter) {
      const { data: byDia } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('diameter', product.diameter)
        .neq('id', product.id)
        .order('stock', { ascending: false })
        .limit(4 - related.length)
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
    <div className="bg-[#0A0A0A] text-zinc-100 -mt-16 pt-16 min-h-screen">
      {/* Top breadcrumb / brand strip */}
      <div className="border-b border-white/5">
        <div className="container mx-auto px-4 md:px-8 py-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
          <div className="flex items-center gap-2">
            <a href="/jante" className="hover:text-zinc-200 transition-colors">Jante</a>
            <span className="text-zinc-700">/</span>
            <span style={{ color: GOLD }}>{product.brand}</span>
          </div>
          <span>Cod · {product.part_number}</span>
        </div>
      </div>

      {/* Main 60/40 split */}
      <div className="container mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="grid md:grid-cols-5 gap-8 md:gap-12 lg:gap-16">
          {/* LEFT 60% — image + media */}
          <div className="md:col-span-3 space-y-4">
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#1a1a1a] via-[#141414] to-[#0a0a0a] border border-white/5">
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(60% 70% at 10% 50%, rgba(201,168,76,0.10) 0%, transparent 60%)',
                }}
              />
              <ProductImage
                src={product.images?.[0] || ''}
                alt={product.name}
                fill
                className="p-10"
                priority
              />
              {/* Watermark spec */}
              <div className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-600">
                <span style={{ color: GOLD }}>—</span>&nbsp;&nbsp;{product.brand} · {product.name}
              </div>
            </div>

            {product.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.slice(1).map((img: string, i: number) => (
                  <div key={i} className="w-24 h-24 relative shrink-0 bg-[#141414] border border-white/5 hover:border-white/20 transition-colors">
                    <ProductImage src={img} alt="" fill className="object-cover p-2" />
                  </div>
                ))}
              </div>
            )}

            {vid && (
              <div className="aspect-video overflow-hidden border border-white/5 bg-black">
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
              <div className="aspect-square overflow-hidden border border-white/5 bg-[#0d0d0d]">
                <iframe
                  src={product.model_3d_url}
                  title="Prezentare 3D"
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full"
                />
              </div>
            )}

            {product.description && (
              <div className="mt-6 p-6 bg-[#141414] border border-white/5 text-sm text-zinc-400 leading-relaxed">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
                  — Descriere
                </div>
                {product.description}
              </div>
            )}
          </div>

          {/* RIGHT 40% — specs + CTA */}
          <div className="md:col-span-2">
            {/* Brand block */}
            <div className="flex items-center justify-between mb-6">
              <div
                className="font-display font-semibold text-[11px] uppercase tracking-[0.36em] px-3 py-2 border"
                style={{ color: GOLD, borderColor: GOLD + '55' }}
              >
                {product.brand}
              </div>
              <StockBlock stock={product.stock ?? 0} stockIncoming={product.stock_incoming ?? 0} />
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-medium leading-[1.05] tracking-tight text-zinc-50">
              {product.name}
            </h1>
            {product.model && (
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">
                Model · <span className="text-zinc-300">{product.model}</span>
              </p>
            )}

            {/* Fitment spec ribbon */}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400">
              {product.diameter != null && (
                <span><span style={{ color: GOLD }}>Ø</span>&nbsp;<span className="text-zinc-100">{product.diameter}"</span></span>
              )}
              {product.width != null && (
                <span><span style={{ color: GOLD }}>J</span>&nbsp;<span className="text-zinc-100">{product.width}</span></span>
              )}
              {product.pcd && (
                <span><span style={{ color: GOLD }}>PCD</span>&nbsp;<span className="text-zinc-100">{product.pcd}</span></span>
              )}
              {(product.et_offset != null || product.et_min != null) && (
                <span><span style={{ color: GOLD }}>ET</span>&nbsp;<span className="text-zinc-100">{etLabel}</span></span>
              )}
              {product.center_bore != null && (
                <span><span style={{ color: GOLD }}>CB</span>&nbsp;<span className="text-zinc-100">{product.center_bore}</span></span>
              )}
            </div>

            {/* Price */}
            <div className="mt-8 pb-8 border-b border-white/10">
              {hasOld && (
                <span className="font-mono text-sm text-zinc-500 line-through">
                  {formatPrice(product.price_old!)}
                </span>
              )}
              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-zinc-50 tabular-nums">
                  {formatPrice(displayPrice)}
                </span>
                {isB2B && product.price_b2b != null && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] px-2 py-1 border" style={{ color: GOLD, borderColor: GOLD + '55' }}>
                    B2B
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                preț / bucată · TVA inclus
              </p>
            </div>

            {/* Fitment spec table */}
            <div className="mt-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] mb-3" style={{ color: GOLD }}>
                — Specificații fitment
              </div>
              <div className="border-t border-white/10">
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
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] border-b pb-1 transition-colors"
                  style={{ color: GOLD, borderColor: GOLD + '55' }}
                >
                  Certificat TÜV →
                </a>
              )}
            </div>

            {/* CTA actions */}
            <div className="mt-10">
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
        </div>
      </div>

      {/* Related wheels row */}
      {related.length > 0 && (
        <div className="border-t border-white/10 mt-12">
          <div className="container mx-auto px-4 md:px-8 py-14">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500 mb-2">
                  <span style={{ color: GOLD }}>—</span>&nbsp;&nbsp;Tot din {product.brand}
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-medium tracking-tight">
                  Jante similare
                </h2>
              </div>
              <a
                href={`/jante?brand=${encodeURIComponent(product.brand)}`}
                className="hidden sm:inline-flex font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-400 hover:text-zinc-100 border-b border-white/15 hover:border-white/40 pb-1"
              >
                Toate {product.brand} →
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {related.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} isB2B={isB2B} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
