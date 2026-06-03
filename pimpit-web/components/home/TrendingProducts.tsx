import Link from 'next/link'
import ProductCard from '@/components/catalog/ProductCard'
import { SectionHeading } from './CategoryTiles'
import { Product } from '@/lib/types'

interface Props {
  products: Product[]
  isB2B: boolean
}

/**
 * Trending products row — horizontal scroll on mobile, grid on desktop.
 * Uses the standard ProductCard so cards stay consistent across the site.
 */
export default function TrendingProducts({ products, isB2B }: Props) {
  if (!products.length) return null

  return (
    <section className="bg-pimpit-bg border-t border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20">
        <SectionHeading
          eyebrow="04 / Trending"
          title="Cele mai căutate"
          subtitle="Modelele cu cea mai bună disponibilitate &amp; cele mai vândute săptămâna aceasta."
          cta={
            <Link
              href="/jante"
              className="font-mono text-[11px] uppercase tracking-[0.24em] text-pimpit-text-muted hover:text-pimpit-accent border-b border-pimpit-border hover:border-pimpit-accent pb-1 transition-colors self-start md:self-end"
            >
              Vezi tot catalogul →
            </Link>
          }
        />

        <div className="mt-10">
          {/* Mobile: horizontal scroll. Desktop: 4-col grid. */}
          <div className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-4 pb-2">
              {products.map((p) => (
                <div key={p.id} className="w-[72vw] sm:w-[300px] shrink-0">
                  <ProductCard product={p} isB2B={isB2B} />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:grid grid-cols-4 gap-5">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} isB2B={isB2B} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
