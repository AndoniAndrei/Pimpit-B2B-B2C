import { formatPrice } from '@/lib/utils'

interface PriceDisplayProps {
  price: number
  priceOld?: number
  priceB2b?: number
  isB2B: boolean
  showBadge?: boolean
  large?: boolean
}

export default function PriceDisplay({ price, priceOld, priceB2b, isB2B, showBadge, large }: PriceDisplayProps) {
  const displayPrice = (isB2B && priceB2b != null) ? priceB2b : price
  const hasOldPrice = priceOld && priceOld > displayPrice

  return (
    <div className="flex flex-col">
      {hasOldPrice && (
        <span className="text-sm text-muted-foreground line-through">
          {formatPrice(priceOld)}
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className={`font-bold ${large ? 'text-3xl' : 'text-lg'} text-primary`}>
          {formatPrice(displayPrice)}
        </span>
        {isB2B && priceB2b != null && (
          <span className="text-[10px] uppercase tracking-wider bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-bold">
            B2B
          </span>
        )}
        {showBadge && hasOldPrice && (
          <span className="text-[10px] uppercase tracking-wider bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded font-bold">
            Reducere
          </span>
        )}
      </div>
    </div>
  )
}
