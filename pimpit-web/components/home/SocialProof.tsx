import { Package, Truck, Award, Star } from 'lucide-react'

interface Props {
  productCount: number
  brandCount: number
}

export default function SocialProof({ productCount, brandCount }: Props) {
  const items = [
    { Icon: Package, big: productCount.toLocaleString('ro-RO'), label: 'Jante în stoc' },
    { Icon: Award, big: brandCount.toString(), label: 'Brand-uri verificate' },
    { Icon: Truck, big: '24-48h', label: 'Livrare națională' },
    { Icon: Star, big: 'TÜV / KBA', label: 'Certificate fitment' },
  ]

  return (
    <section className="bg-pimpit-bg border-t border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
          {items.map(({ Icon, big, label }) => (
            <div key={label} className="flex items-center gap-4">
              <div className="shrink-0 w-12 h-12 flex items-center justify-center border border-pimpit-border bg-pimpit-surface">
                <Icon className="w-5 h-5 text-pimpit-accent" />
              </div>
              <div>
                <div className="font-display font-bold text-pimpit-text text-xl md:text-2xl tabular-nums tracking-tight">
                  {big}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-pimpit-text-muted">
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
