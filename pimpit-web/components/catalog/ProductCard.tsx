import Link from 'next/link'
import { Product } from '@/lib/types'
import PriceDisplay from './PriceDisplay'
import ProductImage from './ProductImage'

function StockBadge({ stock, stockIncoming }: { stock: number; stockIncoming: number }) {
  if (stock > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        {stock} buc în stoc
      </span>
    );
  }
  if (stockIncoming > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
        {stockIncoming} buc la comandă
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
      Stoc epuizat
    </span>
  );
}

export default function ProductCard({ product, isB2B }: { product: Product; isB2B: boolean }) {
  const specs = [
    product.diameter && `Ø${product.diameter}"`,
    product.width && `${product.width}J`,
    product.pcd,
    product.et_offset !== null && product.et_offset !== undefined && `ET${product.et_offset}`,
    product.center_bore && `CB${product.center_bore}`,
  ].filter(Boolean).join('  ·  ');

  return (
    <Link href={`/jante/${product.slug}`}
      className="group flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200">

      {/* Image */}
      <div className="relative bg-gray-50 aspect-square overflow-hidden">
        <ProductImage
          src={product.images?.[0] || ''}
          alt={product.name}
          fill
          className="p-4 group-hover:scale-105 transition-transform duration-300"
        />
        {product.color && (
          <span className="absolute top-2 left-2 text-xs bg-white/90 border px-2 py-0.5 rounded-full text-gray-600 font-medium shadow-sm">
            {product.color}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="text-xs font-bold text-primary tracking-wide uppercase">{product.brand}</div>
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{product.name}</h3>

        {/* Specs grid */}
        {specs && (
          <div className="text-xs text-gray-500 font-medium">{specs}</div>
        )}

        <div className="mt-auto pt-3 flex flex-col gap-2">
          <StockBadge stock={product.stock ?? 0} stockIncoming={product.stock_incoming ?? 0} />
          <PriceDisplay
            price={product.price}
            priceOld={product.price_old}
            priceB2b={product.price_b2b}
            isB2B={isB2B}
            showBadge={true}
          />
        </div>
      </div>

      {/* Add to cart bar — always visible on mobile, hover on desktop */}
      <div className="px-4 pb-4">
        <div className={`w-full bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-xl text-center
          transition-all duration-200 cursor-pointer select-none
          md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0
          ${product.stock === 0 ? 'opacity-40' : ''}`}>
          {product.stock === 0 ? 'Indisponibil' : 'Adaugă în coș'}
        </div>
      </div>
    </Link>
  );
}
