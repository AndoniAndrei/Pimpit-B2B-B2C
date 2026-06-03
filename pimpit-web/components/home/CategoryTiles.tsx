import Link from 'next/link'
import { Disc, Wrench, Settings, Layers, Sparkles, Gauge, ChevronRight } from 'lucide-react'

const CATEGORIES = [
  { label: 'Jante 17"',  sub: 'Compacte & daily', href: '/jante?diameter=17', Icon: Disc },
  { label: 'Jante 18"',  sub: 'Berline & SUV',    href: '/jante?diameter=18', Icon: Disc },
  { label: 'Jante 19"',  sub: 'Sport & GT',       href: '/jante?diameter=19', Icon: Disc },
  { label: 'Jante 20"',  sub: 'Premium & SUV',    href: '/jante?diameter=20', Icon: Disc },
  { label: 'Jante 21"+', sub: 'Hyper & luxury',   href: '/jante?diameter=21&diameter=22&diameter=23', Icon: Sparkles },
  { label: 'Accesorii',  sub: 'Distanțiere & prezoane', href: '/accesorii', Icon: Wrench },
  { label: 'Performanță', sub: 'Suspensii & frâne', href: '/accesorii?category=performance', Icon: Gauge },
  { label: 'Stilizare',   sub: 'Finisaje & culori', href: '/jante?finish=Lustruit', Icon: Settings },
  { label: 'Sezoniere',   sub: 'Iarnă & vară',      href: '/jante', Icon: Layers },
  { label: 'Vezi tot',    sub: 'Catalog complet',   href: '/jante', Icon: ChevronRight },
]

export default function CategoryTiles() {
  return (
    <section className="bg-pimpit-bg">
      <div className="container mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <SectionHeading
          title="Top categorii"
          subtitle="Caută rapid după mărime sau tip de produs"
        />

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {CATEGORIES.map(({ label, sub, href, Icon }) => (
            <Link
              key={href + label}
              href={href}
              className="group flex flex-col items-center text-center bg-white border border-pimpit-border rounded-md p-5 shadow-premium hover:shadow-premium-hover hover:border-pimpit-accent/40 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-pimpit-surface-2 group-hover:bg-pimpit-accent/10 flex items-center justify-center mb-3 transition-colors">
                <Icon className="w-7 h-7 text-pimpit-text group-hover:text-pimpit-accent transition-colors" />
              </div>
              <div className="text-sm font-semibold text-pimpit-text">{label}</div>
              <div className="text-xs text-pimpit-text-muted mt-0.5">{sub}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SectionHeading({
  title,
  subtitle,
  cta,
}: {
  title: string
  subtitle?: string
  cta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-pimpit-text">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm md:text-base text-pimpit-text-muted">{subtitle}</p>
        )}
      </div>
      {cta}
    </div>
  )
}
