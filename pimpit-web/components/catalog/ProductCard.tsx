import Link from 'next/link'
import Image from 'next/image'
import { Product } from '@/lib/types'
import PriceDisplay from './PriceDisplay'

export default function ProductCard({ product, isB2B }: { product: Product, isB2B: boolean }) {
  return (
    <Link href={`/jante/${product.slug}`} className="group flex flex-col border rounded-xl overflow-hidden hover:shadow-lg transition-all bg-card">
      <div className="aspect-square relative bg-muted p-4">
        {product.images?.[0] ? (
          <Image 
            src={product.images[0]} 
            alt={product.name} 
            fill 
            className="object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300" 
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Fără imagine</div>
        )}
        {product.stock === 0 && (
          <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded">
            Stoc epuizat
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-xs text-muted-foreground font-medium mb-1">{product.brand}</div>
        <h3 className="font-semibold text-sm line-clamp-2 mb-2 flex-1">{product.name}</h3>
        <div className="text-xs text-muted-foreground mb-3 space-x-2">
          <span>{product.diameter}"</span>
          <span>{product.pcd}</span>
          <span>ET{product.et_offset}</span>
        </div>
        <PriceDisplay 
          price={product.price} 
          priceOld={product.price_old} 
          priceB2b={product.price_b2b} 
          isB2B={isB2B} 
          showBadge={true} 
        />
      </div>
    </Link>
  )
}
