import Link from 'next/link'
import ProductCard from '@/components/catalog/ProductCard'
import { SectionHeading } from './CategoryTiles'
import { Product } from '@/lib/types'

interface Props {
  products: Product[]
  isB2B: boolean
}

export default function TrendingProducts({ products, isB2B }: Props) {
  if (!products.length) return null

  return (
    <section className="bg-pimpit-bg">
      <div className="container mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <SectionHeading
          title="Cele mai căutate"
          subtitle="Cele mai bine vândute jante din ultima săptămână"
          cta={
            <Link
              href="/jante"
              className="text-sm font-semibold text-pimpit-accent hover:text-pimpit-accent-hover transition-colors"
            >
              Vezi tot catalogul →
            </Link>
          }
        />

        <div className="mt-6">
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
