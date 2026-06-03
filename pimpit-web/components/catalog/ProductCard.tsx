import Link from 'next/link'
import { Product } from '@/lib/types'
import ProductImage from './ProductImage'
import { formatPrice } from '@/lib/utils'

function StockBadge({ stock, stockIncoming }: { stock: number; stockIncoming: number }) {
  if (stock > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pimpit-success">
        <span className="w-1.5 h-1.5 bg-pimpit-success rounded-full" />
        În stoc ({stock})
      </span>
    )
  }
  if (stockIncoming > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pimpit-accent">
        <span className="w-1.5 h-1.5 bg-pimpit-accent rounded-full" />
        La comandă ({stockIncoming})
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pimpit-text-muted">
      <span className="w-1.5 h-1.5 bg-pimpit-text-muted rounded-full" />
      Indisponibil
    </span>
  )
}

function SpecBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-[10px] text-pimpit-text-muted">
      <span>{label}</span>
      <span className="text-pimpit-text font-semibold">{value}</span>
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
  const discountPct = hasOld
    ? Math.round(((product.price_old! - displayPrice) / product.price_old!) * 100)
    : 0

  return (
    <Link
      href={`/jante/${product.slug}`}
      className="group relative flex flex-col bg-white border border-pimpit-border rounded-md overflow-hidden shadow-premium hover:shadow-premium-hover hover:border-pimpit-accent/40 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-pimpit-surface-2 via-white to-pimpit-surface-2">
        {discountPct > 0 && (
          <span className="absolute top-3 left-3 z-10 bg-pimpit-error text-white text-xs font-bold px-2 py-1 rounded">
            -{discountPct}%
          </span>
        )}
        <ProductImage
          src={product.images?.[0] || ''}
          alt={product.name}
          fill
          className="p-6 transition-transform duration-500 group-hover:scale-[1.06]"
        />

        {product.color && (
          <span className="absolute top-3 right-3 text-[10px] font-medium text-pimpit-text bg-white/95 border border-pimpit-border px-2 py-1 rounded">
            {product.color}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2 border-t border-pimpit-border">
        <div className="text-[11px] font-bold tracking-wider uppercase text-pimpit-accent">
          {product.brand}
        </div>
        <h3 className="text-[15px] font-semibold text-pimpit-text leading-snug line-clamp-2">
          {product.name}
        </h3>

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
            {specs.map(([k, v]) => (
              <SpecBadge key={k} label={k} value={v} />
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <StockBadge stock={product.stock ?? 0} stockIncoming={product.stock_incoming ?? 0} />
          <div className="flex flex-col items-end leading-none">
            {hasOld && (
              <span className="text-xs text-pimpit-text-muted line-through tabular-nums">
                {formatPrice(product.price_old!)}
              </span>
            )}
            <span className="text-xl font-bold text-pimpit-text tabular-nums mt-0.5">
              {formatPrice(displayPrice)}
            </span>
            {isB2B && product.price_b2b != null && (
              <span className="mt-1 text-[9px] font-bold tracking-widest uppercase text-pimpit-accent">
                Preț B2B
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover CTA */}
      <div
        className={`w-full text-center text-sm font-semibold py-3 transition-all duration-300 select-none
          ${outOfStock
            ? 'bg-pimpit-surface-2 text-pimpit-text-muted'
            : 'btn-gold rounded-none md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0'}
        `}
      >
        {outOfStock ? 'Indisponibil' : 'Adaugă în coș →'}
      </div>
    </Link>
  )
}
