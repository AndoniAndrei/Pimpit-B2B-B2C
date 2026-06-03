import Link from 'next/link'
import { SectionHeading } from './CategoryTiles'

interface Props {
  brands: string[]
}

/**
 * Horizontal scroll strip of featured brands rendered as editorial wordmarks
 * (no logo assets — typography is the brand here). Each cell is a wide tile
 * with the brand name in big condensed display type.
 */
export default function FeaturedBrands({ brands }: Props) {
  if (!brands.length) return null

  return (
    <section className="bg-pimpit-surface border-t border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20">
        <SectionHeading
          eyebrow="03 / Brand-uri"
          title="Producători verificați"
          subtitle="Doar branduri cu certificare TÜV / KBA și fitment validat."
          cta={
            <Link
              href="/jante"
              className="font-mono text-[11px] uppercase tracking-[0.24em] text-pimpit-text-muted hover:text-pimpit-accent border-b border-pimpit-border hover:border-pimpit-accent pb-1 transition-colors self-start md:self-end"
            >
              Toate brand-urile →
            </Link>
          }
        />

        <div className="mt-10 -mx-4 lg:-mx-8 px-4 lg:px-8 overflow-x-auto no-scrollbar">
          <div className="flex gap-3 md:gap-4 min-w-min pb-2">
            {brands.map((brand) => (
              <Link
                key={brand}
                href={`/jante?brand=${encodeURIComponent(brand)}`}
                className="group relative shrink-0 w-[280px] md:w-[320px] aspect-[16/9] bg-pimpit-bg border border-pimpit-border hover:border-pimpit-accent transition-colors overflow-hidden flex items-center justify-center"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-30 group-hover:opacity-60 transition-opacity duration-500"
                  style={{
                    background:
                      'radial-gradient(70% 70% at 15% 50%, rgba(201,168,76,0.18) 0%, transparent 60%)',
                  }}
                />
                <div className="relative text-center px-4">
                  <div className="font-display font-bold uppercase text-pimpit-text tracking-tight text-2xl md:text-3xl leading-none">
                    {brand}
                  </div>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.32em] text-pimpit-text-muted">
                    Catalog →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
