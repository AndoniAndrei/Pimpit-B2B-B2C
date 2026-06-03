import Link from 'next/link'

const TILES = [
  { label: 'Jante 17"', sub: 'Compacte · daily', href: '/jante?diameter=17', big: '17' },
  { label: 'Jante 18"', sub: 'Berline · SUV', href: '/jante?diameter=18', big: '18' },
  { label: 'Jante 19"', sub: 'Sport · GT', href: '/jante?diameter=19', big: '19' },
  { label: 'Jante 20"', sub: 'Premium · SUV', href: '/jante?diameter=20', big: '20' },
  { label: 'Jante 21"+', sub: 'Hyper · luxury', href: '/jante?diameter=21&diameter=22&diameter=23', big: '21+' },
  { label: 'Accesorii', sub: 'Distanțiere · prezoane', href: '/accesorii', big: 'ACC' },
]

export default function CategoryTiles() {
  return (
    <section className="bg-pimpit-bg border-t border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20">
        <SectionHeading
          eyebrow="02 / Catalog"
          title="Caută după diametru"
          subtitle="Începe cu mărimea jantei. Filtrele avansate (ET, PCD, lățime) sunt în pagina catalogului."
        />

        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group relative flex flex-col justify-between bg-pimpit-surface border border-pimpit-border p-5 md:p-6 aspect-[4/5] hover:border-pimpit-accent transition-colors overflow-hidden"
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'radial-gradient(120% 80% at 0% 100%, rgba(201,168,76,0.12) 0%, transparent 55%)',
                }}
              />
              <div className="relative font-mono text-[10px] uppercase tracking-[0.28em] text-pimpit-text-muted">
                {t.sub}
              </div>
              <div className="relative">
                <div className="font-display font-bold text-pimpit-text leading-none text-5xl md:text-6xl tracking-tight">
                  {t.big}
                  <span className="text-pimpit-accent">.</span>
                </div>
                <div className="mt-3 font-display font-semibold uppercase tracking-[0.18em] text-sm text-pimpit-text">
                  {t.label}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-pimpit-accent flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Explorează →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  cta,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  cta?: React.ReactNode
}) {
  return (
    <div className={`flex flex-col md:flex-row ${align === 'center' ? 'md:items-center md:text-center md:justify-center' : 'md:items-end md:justify-between'} gap-4`}>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-pimpit-text-muted mb-2 flex items-center gap-2">
          <span className="text-pimpit-accent">—</span>&nbsp;{eyebrow}
        </div>
        <h2 className="font-display font-medium text-pimpit-text text-3xl md:text-4xl lg:text-5xl uppercase tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-pimpit-text-muted text-sm md:text-base max-w-2xl">{subtitle}</p>
        )}
      </div>
      {cta}
    </div>
  )
}
