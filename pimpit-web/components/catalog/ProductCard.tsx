import Link from 'next/link'
import { Product } from '@/lib/types'
import ProductImage from './ProductImage'
import { formatPrice } from '@/lib/utils'

function StockBadge({ stock, stockIncoming }: { stock: number; stockIncoming: number }) {
  if (stock > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-pimpit-success">
        <span className="w-1.5 h-1.5 bg-pimpit-success rounded-full" />
        {stock} în stoc
      </span>
    )
  }
  if (stockIncoming > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-pimpit-accent">
        <span className="w-1.5 h-1.5 bg-pimpit-accent rounded-full" />
        {stockIncoming} la comandă
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-pimpit-text-muted">
      <span className="w-1.5 h-1.5 bg-pimpit-text-muted rounded-full" />
      epuizat
    </span>
  )
}

function SpecBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-[10px] uppercase tracking-[0.14em]">
      <span className="text-pimpit-text-muted">{label}</span>
      <span className="text-pimpit-text">{value}</span>
    </span>
  )
}

export default function ProductCard({ product, isB2B }: { product: Product; isB2B: boolean }) {
  const etLabel = (() => {
    const min = product.et_min
    const max = product.et_max
    if (min != null && max != null && min !== max) return `${min}–${max}`
    const single = min ?? product.et_offset
    return single != null ? String(single) : null
  })()

  const specs: Array<[string, string]> = []
  if (product.diameter) specs.push(['Ø', `${product.diameter}"`])
  if (product.width) specs.push(['J', `${product.width}`])
  if (product.pcd) specs.push(['PCD', product.pcd])
  if (etLabel) specs.push(['ET', etLabel])
  if (product.center_bore) specs.push(['CB', String(product.center_bore)])

  const displayPrice = (isB2B && product.price_b2b != null) ? product.price_b2b : product.price
  const hasOld = product.price_old && product.price_old > displayPrice
  const outOfStock = (product.stock ?? 0) === 0

  return (
    <Link
      href={`/jante/${product.slug}`}
      className="group relative flex flex-col bg-pimpit-surface border border-pimpit-border overflow-hidden transition-all duration-300 hover:border-pimpit-accent hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-pimpit-surface-2 via-pimpit-surface to-pimpit-bg">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: 'radial-gradient(120% 80% at 0% 50%, rgba(201,168,76,0.10) 0%, transparent 55%)',
          }}
        />
        <ProductImage
          src={product.images?.[0] || ''}
          alt={product.name}
          fill
          className="p-6 transition-transform duration-500 group-hover:scale-[1.06]"
        />

        {product.color && (
          <span className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-pimpit-text bg-pimpit-bg/70 backdrop-blur-sm border border-pimpit-border px-2 py-1">
            {product.color}
          </span>
        )}

        {/* Hover spec overlay */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 px-4 py-3 bg-gradient-to-t from-pimpit-bg/90 via-pimpit-bg/60 to-transparent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
        >
          <div className="h-px w-8 mb-2 bg-pimpit-accent" />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {specs.map(([k, v]) => (
              <SpecBadge key={k} label={k} value={v} />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2.5 border-t border-pimpit-border">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-pimpit-accent">
          {product.brand}
        </div>
        <h3 className="font-display text-base font-semibold text-pimpit-text leading-tight line-clamp-2 tracking-tight uppercase">
          {product.name}
        </h3>

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 pt-1">
            {specs.map(([k, v]) => (
              <SpecBadge key={k} label={k} value={v} />
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <StockBadge stock={product.stock ?? 0} stockIncoming={product.stock_incoming ?? 0} />
          <div className="flex flex-col items-end leading-none">
            {hasOld && (
              <span className="font-mono text-[10px] text-pimpit-text-muted line-through">
                {formatPrice(product.price_old!)}
              </span>
            )}
            <span className="font-display text-xl font-bold text-pimpit-text tabular-nums">
              {formatPrice(displayPrice)}
            </span>
            {isB2B && product.price_b2b != null && (
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-pimpit-accent">
                B2B
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CTA — solid gold, square corners */}
      <div
        className={`w-full font-display font-semibold text-sm uppercase tracking-[0.22em] py-3.5 text-center select-none transition-all duration-300
          ${outOfStock
            ? 'bg-pimpit-surface-2 text-pimpit-text-muted opacity-60'
            : 'bg-pimpit-accent text-pimpit-bg md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0'}
        `}
      >
        {outOfStock ? 'Indisponibil' : 'Adaugă în coș'}
      </div>
    </Link>
  )
}
