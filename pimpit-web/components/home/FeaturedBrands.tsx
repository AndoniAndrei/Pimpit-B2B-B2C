import Link from 'next/link'
import { SectionHeading } from './CategoryTiles'

interface Props {
  brands: string[]
}

/**
 * Featured brands as chip buttons — CARiD-style "Featured Makes" row.
 * No logo assets; the brand name is the wordmark.
 */
export default function FeaturedBrands({ brands }: Props) {
  if (!brands.length) return null

  return (
    <section className="bg-pimpit-surface-2 border-y border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <SectionHeading
          title="Brand-uri populare"
          subtitle="Producători aftermarket cu certificare TÜV / KBA"
          cta={
            <Link
              href="/jante"
              className="text-sm font-semibold text-pimpit-accent hover:text-pimpit-accent-hover transition-colors"
            >
              Vezi toate →
            </Link>
          }
        />

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {brands.slice(0, 10).map((brand) => (
            <Link
              key={brand}
              href={`/jante?brand=${encodeURIComponent(brand)}`}
              className="group flex items-center justify-between bg-white border border-pimpit-border rounded-md px-4 py-3.5 shadow-premium hover:shadow-premium-hover hover:border-pimpit-accent/40 transition-all"
            >
              <span className="font-semibold text-sm text-pimpit-text truncate">{brand}</span>
              <span className="text-pimpit-text-muted group-hover:text-pimpit-accent group-hover:translate-x-0.5 transition-all">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
