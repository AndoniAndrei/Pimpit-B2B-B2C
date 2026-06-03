import Link from 'next/link'
import { Disc, Wrench, Sparkles, ChevronRight, Tag, Clock } from 'lucide-react'

/**
 * Each tile must link to a route + query that produces real results
 * against the live catalog. No fabricated category filters
 * (e.g. `?category=performance`, `?finish=Lustruit`) — only real DB
 * fields (`diameter`, `sort`, `is_active`) or top-level routes.
 */
const CATEGORIES = [
  { label: 'Jante 17"',  href: '/jante?diameter=17', Icon: Disc },
  { label: 'Jante 18"',  href: '/jante?diameter=18', Icon: Disc },
  { label: 'Jante 19"',  href: '/jante?diameter=19', Icon: Disc },
  { label: 'Jante 20"',  href: '/jante?diameter=20', Icon: Disc },
  { label: 'Jante 21"+', href: '/jante?diameter=21&diameter=22&diameter=23', Icon: Sparkles },
  { label: 'Accesorii',  href: '/accesorii', Icon: Wrench },
  { label: 'Cele mai noi', href: '/jante?sort=newest', Icon: Clock },
  { label: 'Preț ↑',     href: '/jante?sort=price_asc', Icon: Tag },
  { label: 'Toate brand-urile', href: '/jante', Icon: ChevronRight },
  { label: 'Vezi tot',   href: '/jante', Icon: ChevronRight },
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
          {CATEGORIES.map(({ label, href, Icon }) => (
            <Link
              key={href + label}
              href={href}
              className="group flex flex-col items-center text-center bg-white border border-pimpit-border rounded-md p-5 shadow-premium hover:shadow-premium-hover hover:border-pimpit-accent/40 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-pimpit-surface-2 group-hover:bg-pimpit-accent/10 flex items-center justify-center mb-3 transition-colors">
                <Icon className="w-7 h-7 text-pimpit-text group-hover:text-pimpit-accent transition-colors" />
              </div>
              <div className="text-sm font-semibold text-pimpit-text">{label}</div>
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
