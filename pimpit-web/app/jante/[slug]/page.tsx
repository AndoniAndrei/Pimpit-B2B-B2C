import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Shield, Award, BadgeCheck } from 'lucide-react'
import ProductImage from '@/components/catalog/ProductImage'
import ProductCard from '@/components/catalog/ProductCard'
import AccordionSection from '@/components/catalog/AccordionSection'
import VehicleSelector from '@/components/home/VehicleSelector'
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
    description: `Cumpără ${product.brand} ${product.name} la cel mai bun preț.`,
  }
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-b border-pimpit-border last:border-b-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-pimpit-text-muted">{label}</span>
      <span className="font-mono text-sm text-pimpit-text tabular-nums text-right">{value}</span>
    </div>
  )
}

function StockBlock({ stock, stockIncoming }: { stock: number; stockIncoming: number }) {
  if (stock > 0) {
    return (
      <div className="inline-flex items-center gap-2.5 border border-pimpit-success/40 bg-pimpit-success/10 px-3.5 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-pimpit-success opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-pimpit-success" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-pimpit-success">
          {stock} buc · în stoc
        </span>
      </div>
    )
  }
  if (stockIncoming > 0) {
    return (
      <div className="inline-flex items-center gap-2.5 border border-pimpit-accent/40 bg-pimpit-accent/10 px-3.5 py-2">
        <span className="h-2 w-2 rounded-full bg-pimpit-accent" />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-pimpit-accent">
          {stockIncoming} buc · la comandă
        </span>
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-2.5 border border-pimpit-border bg-pimpit-surface-2 px-3.5 py-2">
      <span className="h-2 w-2 rounded-full bg-pimpit-text-muted" />
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-pimpit-text-muted">epuizat</span>
    </div>
  )
}

function CertBadge({ Icon, label, sublabel }: { Icon: any; label: string; sublabel: string }) {
  return (
    <div className="inline-flex items-center gap-2.5 border border-pimpit-border bg-pimpit-surface px-3 py-2.5">
      <Icon className="w-4 h-4 text-pimpit-accent shrink-0" />
      <div className="leading-tight">
        <div className="font-display font-semibold uppercase tracking-[0.18em] text-[11px] text-pimpit-text">{label}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-pimpit-text-muted">{sublabel}</div>
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

  // Related: same brand, fall back to same diameter
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
    <div className="bg-pimpit-bg text-pimpit-text min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-pimpit-border">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.24em] text-pimpit-text-muted">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="hover:text-pimpit-text transition-colors">Acasă</Link>
            <span className="text-pimpit-border">/</span>
            <Link href="/jante" className="hover:text-pimpit-text transition-colors">Jante</Link>
            <span className="text-pimpit-border">/</span>
            <span className="text-pimpit-accent truncate">{product.brand}</span>
          </div>
          <span className="shrink-0 hidden sm:inline">Cod · {product.part_number}</span>
        </div>
      </div>

      {/* Main 60/40 split */}
      <div className="container mx-auto px-4 lg:px-8 py-10 md:py-16">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 xl:gap-16">
          {/* LEFT 60% — image + media */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-pimpit-surface-2 via-pimpit-surface to-pimpit-bg border border-pimpit-border">
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
              <div className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.32em] text-pimpit-text-muted">
                <span className="text-pimpit-accent">—</span>&nbsp;&nbsp;{product.brand} · {product.name}
              </div>
            </div>

            {product.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {product.images.slice(0, 8).map((img: string, i: number) => (
                  <div key={i} className="w-24 h-24 relative shrink-0 bg-pimpit-surface border border-pimpit-border hover:border-pimpit-accent transition-colors">
                    <ProductImage src={img} alt="" fill className="object-cover p-2" />
                  </div>
                ))}
              </div>
            )}

            {vid && (
              <div className="aspect-video overflow-hidden border border-pimpit-border bg-pimpit-bg">
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
              <div className="aspect-square overflow-hidden border border-pimpit-border bg-pimpit-surface">
                <iframe
                  src={product.model_3d_url}
                  title="Prezentare 3D"
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full"
                />
              </div>
            )}
          </div>

          {/* RIGHT 40% — brand, name, price, fitment, CTA */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="font-display font-semibold uppercase tracking-[0.32em] text-[11px] text-pimpit-accent px-3 py-2 border border-pimpit-accent/50">
                {product.brand}
              </div>
              <StockBlock stock={product.stock ?? 0} stockIncoming={product.stock_incoming ?? 0} />
            </div>

            <h1 className="font-display font-medium text-3xl md:text-4xl uppercase leading-[1.05] tracking-tight text-pimpit-text">
              {product.name}
            </h1>
            {product.model && (
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.24em] text-pimpit-text-muted">
                Model · <span className="text-pimpit-text">{product.model}</span>
              </p>
            )}

            {/* Fitment ribbon */}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.22em] text-pimpit-text-muted">
              {product.diameter != null && (
                <span><span className="text-pimpit-accent">Ø</span>&nbsp;<span className="text-pimpit-text">{product.diameter}"</span></span>
              )}
              {product.width != null && (
                <span><span className="text-pimpit-accent">J</span>&nbsp;<span className="text-pimpit-text">{product.width}</span></span>
              )}
              {product.pcd && (
                <span><span className="text-pimpit-accent">PCD</span>&nbsp;<span className="text-pimpit-text">{product.pcd}</span></span>
              )}
              {(product.et_offset != null || product.et_min != null) && (
                <span><span className="text-pimpit-accent">ET</span>&nbsp;<span className="text-pimpit-text">{etLabel}</span></span>
              )}
              {product.center_bore != null && (
                <span><span className="text-pimpit-accent">CB</span>&nbsp;<span className="text-pimpit-text">{product.center_bore}</span></span>
              )}
            </div>

            {/* Certification badges */}
            <div className="mt-5 flex flex-wrap gap-2">
              {product.certificate_url && <CertBadge Icon={Award} label="TÜV" sublabel="Certificat" />}
              <CertBadge Icon={Shield} label="KBA" sublabel="Approved" />
              <CertBadge Icon={BadgeCheck} label="JWL" sublabel="Tested" />
            </div>

            {/* Price */}
            <div className="mt-8 pb-8 border-b border-pimpit-border">
              {hasOld && (
                <span className="font-mono text-sm text-pimpit-text-muted line-through">
                  {formatPrice(product.price_old!)}
                </span>
              )}
              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl md:text-5xl font-bold tracking-tight text-pimpit-text tabular-nums">
                  {formatPrice(displayPrice)}
                </span>
                {isB2B && product.price_b2b != null && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] px-2 py-1 border border-pimpit-accent/50 text-pimpit-accent">
                    B2B
                  </span>
                )}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-pimpit-text-muted">
                preț / bucată · TVA inclus
              </p>
            </div>

            {/* Fitment table */}
            <div className="mt-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-pimpit-accent mb-3">
                — Specificații fitment
              </div>
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
              </div>
              {product.certificate_url && (
                <a
                  href={product.certificate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] border-b border-pimpit-accent/50 hover:border-pimpit-accent pb-1 transition-colors text-pimpit-accent"
                >
                  Certificat TÜV →
                </a>
              )}
            </div>

            {/* CTA */}
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

            {/* Accordion sections */}
            <div className="mt-12 border-t border-pimpit-border">
              {product.description && (
                <AccordionSection title="Descriere" defaultOpen>
                  <p className="text-sm text-pimpit-text-muted leading-relaxed whitespace-pre-line">{product.description}</p>
                </AccordionSection>
              )}

              <AccordionSection title="Verifică compatibilitatea cu mașina ta">
                <p className="text-sm text-pimpit-text-muted mb-4 leading-relaxed">
                  Selectează vehiculul tău pentru a confirma fitment-ul. Răspuns instant pe baza dimensiunilor jantei.
                </p>
                <VehicleSelector variant="inline" ctaLabel="Verifică fitment-ul" />
              </AccordionSection>

              <AccordionSection title="Specificații complete">
                <div className="border-t border-pimpit-border">
                  {product.production_method && <SpecRow label="Fabricație" value={product.production_method} />}
                  {product.concave_profile && <SpecRow label="Profil concav" value={product.concave_profile} />}
                  {product.ean && <SpecRow label="EAN" value={product.ean} />}
                  {product.custom_fields &&
                    Object.entries(product.custom_fields as Record<string, string>).map(([label, value]) =>
                      value ? <SpecRow key={label} label={label} value={value} /> : null,
                    )}
                </div>
              </AccordionSection>

              <AccordionSection title="Livrare &amp; retururi">
                <ul className="space-y-2 text-sm text-pimpit-text-muted leading-relaxed">
                  <li><span className="text-pimpit-accent">▸</span> Livrare 24–48h în România prin curier rapid</li>
                  <li><span className="text-pimpit-accent">▸</span> Livrare gratuită la comenzi peste 1500 RON</li>
                  <li><span className="text-pimpit-accent">▸</span> Retur 14 zile fără justificare (produs nemontat)</li>
                  <li><span className="text-pimpit-accent">▸</span> Asistență fitment înainte și după comandă</li>
                </ul>
              </AccordionSection>
            </div>
          </div>
        </div>
      </div>

      {/* Related carousel */}
      {related.length > 0 && (
        <div className="border-t border-pimpit-border">
          <div className="container mx-auto px-4 lg:px-8 py-14">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-pimpit-text-muted mb-2">
                  <span className="text-pimpit-accent">—</span>&nbsp;&nbsp;Tot din {product.brand}
                </div>
                <h2 className="font-display font-medium uppercase tracking-tight text-2xl md:text-3xl text-pimpit-text">
                  Jante similare
                </h2>
              </div>
              <Link
                href={`/jante?brand=${encodeURIComponent(product.brand)}`}
                className="hidden sm:inline-flex font-mono text-[11px] uppercase tracking-[0.24em] text-pimpit-text-muted hover:text-pimpit-accent border-b border-pimpit-border hover:border-pimpit-accent pb-1 transition-colors"
              >
                Toate {product.brand} →
              </Link>
            </div>
            <div className="-mx-4 lg:-mx-8 px-4 lg:px-8 overflow-x-auto no-scrollbar">
              <div className="flex gap-4 md:gap-5 pb-2">
                {related.slice(0, 8).map((p) => (
                  <div key={p.id} className="w-[72vw] sm:w-[300px] xl:w-[320px] shrink-0">
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
