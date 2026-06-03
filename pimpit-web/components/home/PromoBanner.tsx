import Link from 'next/link'

/**
 * Visual promo banner strip — large editorial tiles below the hero.
 * CARiD-style row of branded showcase tiles linking to filtered catalog.
 * Each tile has a CSS-composed visual + bold typography (no asset deps).
 */

type Accent = 'red' | 'gold' | 'dark'

const TILES: Array<{
  eyebrow: string
  headline: string
  sub: string
  href: string
  accent: Accent
  cta: string
}> = [
  {
    eyebrow: 'Reducere până la',
    headline: '30% OFF',
    sub: 'Modele aftermarket din stoc',
    href: '/jante?sort=price_asc',
    accent: 'red',
    cta: 'Vezi ofertele',
  },
  {
    eyebrow: 'Nou în catalog',
    headline: 'Premium 20"+',
    sub: 'Hyper & luxury — Concaver, JUDD, OZ',
    href: '/jante?diameter=20&diameter=21&diameter=22',
    accent: 'gold',
    cta: 'Explorează',
  },
  {
    eyebrow: 'Selecția redacției',
    headline: 'Daily favorites',
    sub: 'Jante 18" pentru utilizare zilnică',
    href: '/jante?diameter=18',
    accent: 'dark',
    cta: 'Vezi modelele',
  },
]

export default function PromoBanner() {
  return (
    <section className="bg-pimpit-bg">
      <div className="container mx-auto px-4 lg:px-8 pt-4 lg:pt-5 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
          {TILES.map((t) => (
            <PromoTile key={t.headline} {...t} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PromoTile({
  eyebrow,
  headline,
  sub,
  href,
  accent,
  cta,
}: {
  eyebrow: string
  headline: string
  sub: string
  href: string
  accent: 'red' | 'gold' | 'dark'
  cta: string
}) {
  // Visual treatment varies per accent — each tile has its own personality
  const variants = {
    red: {
      bg: 'linear-gradient(135deg, #1a1a1a 0%, #2a0a0a 100%)',
      shine: 'radial-gradient(70% 80% at 100% 50%, rgba(220,38,38,0.30) 0%, transparent 60%)',
      eyebrowColor: 'text-red-400',
      headlineColor: 'text-white',
      subColor: 'text-white/70',
      cta: 'text-red-400 hover:text-red-300',
    },
    gold: {
      bg: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 60%, #050505 100%)',
      shine: 'radial-gradient(70% 80% at 0% 50%, rgba(212,175,55,0.28) 0%, transparent 60%)',
      eyebrowColor: 'text-gold-shine',
      headlineColor: 'text-white',
      subColor: 'text-white/70',
      cta: 'text-gold-shine',
    },
    dark: {
      bg: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)',
      shine: 'radial-gradient(70% 80% at 100% 50%, rgba(184,134,11,0.15) 0%, transparent 60%)',
      eyebrowColor: 'text-pimpit-accent',
      headlineColor: 'text-pimpit-text',
      subColor: 'text-pimpit-text-muted',
      cta: 'text-pimpit-accent hover:text-pimpit-accent-hover',
    },
  }[accent]

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-md border border-pimpit-border shadow-premium hover:shadow-premium-hover transition-shadow"
    >
      <div className="relative aspect-[16/8] md:aspect-[16/10]">
        {/* Background */}
        <div className="absolute inset-0" style={{ background: variants.bg }} />
        {/* Shine wash */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: variants.shine }} />

        {/* Decorative wheel ring — only on dark accents */}
        {accent !== 'dark' && (
          <div className="absolute -right-12 -bottom-12 md:-right-16 md:-bottom-16 w-44 h-44 md:w-56 md:h-56">
            <DecoRing accent={accent} />
          </div>
        )}

        {/* Copy */}
        <div className="relative h-full flex flex-col justify-between p-5 lg:p-6">
          <div>
            <div className={`text-[10px] font-bold tracking-[0.22em] uppercase mb-2 ${variants.eyebrowColor}`}>
              {eyebrow}
            </div>
            <div className={`text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight ${variants.headlineColor}`}>
              {headline}
            </div>
            <div className={`mt-2 text-sm ${variants.subColor} max-w-[18ch]`}>{sub}</div>
          </div>
          <div className={`text-sm font-semibold flex items-center gap-1 ${variants.cta} transition-colors`}>
            {cta}
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function DecoRing({ accent }: { accent: 'red' | 'gold' }) {
  const ringColor = accent === 'red' ? 'rgba(220,38,38,0.45)' : 'rgba(212,175,55,0.55)'
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          'conic-gradient(from 0deg, #2a2a2a, #0a0a0a 25%, #1a1a1a 50%, #0a0a0a 75%, #2a2a2a)',
        boxShadow: `inset 0 0 0 1px ${ringColor}, inset 0 0 40px rgba(0,0,0,0.6)`,
      }}
    >
      <div
        className="absolute inset-[15%] rounded-full"
        style={{ background: 'radial-gradient(circle at 30% 30%, #2a2a2a 0%, #050505 70%)' }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
        style={{ background: ringColor, boxShadow: `0 0 12px ${ringColor}` }}
      />
    </div>
  )
}
