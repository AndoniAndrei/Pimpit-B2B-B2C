import { Package, Truck, Award, Shield } from 'lucide-react'

interface Props {
  productCount: number
  brandCount: number
}

export default function SocialProof({ productCount, brandCount }: Props) {
  // The first two stats are derived from real DB counts; the last two
  // are descriptive labels (no fabricated numbers or cert names).
  const items = [
    { Icon: Package, big: productCount.toLocaleString('ro-RO'), label: 'Jante în catalog' },
    { Icon: Award,   big: brandCount.toString(),                label: 'Brand-uri în catalog' },
    { Icon: Truck,   big: 'Curier',                              label: 'Livrare națională' },
    { Icon: Shield,  big: 'Plată sigură',                        label: 'Tranzacții criptate' },
  ]

  return (
    <section className="bg-white border-b border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
          {items.map(({ Icon, big, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-pimpit-accent/10">
                <Icon className="w-5 h-5 text-pimpit-accent" />
              </div>
              <div>
                <div className="font-bold text-pimpit-text text-base md:text-lg tabular-nums leading-tight">
                  {big}
                </div>
                <div className="text-xs text-pimpit-text-muted">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
