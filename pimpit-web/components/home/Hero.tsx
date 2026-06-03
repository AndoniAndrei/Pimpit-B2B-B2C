import Link from 'next/link'
import VehicleSelector from './VehicleSelector'

/**
 * Homepage hero — CARiD-style split: vehicle selector card on the left,
 * editorial promo banner on the right. Light, readable, premium.
 */
export default function Hero() {
  return (
    <section className="bg-pimpit-bg">
      <div className="container mx-auto px-4 lg:px-8 pt-6 lg:pt-8">
        <div className="grid lg:grid-cols-[360px,1fr] gap-4 lg:gap-5">
          {/* Vehicle selector card */}
          <div className="bg-white border border-pimpit-border rounded-md p-5 shadow-premium">
            <VehicleSelector variant="hero" ctaLabel="Caută jante" />
          </div>

          {/* Promo banner — editorial product render with headline + CTA */}
          <Link
            href="/jante"
            className="group relative overflow-hidden rounded-md border border-pimpit-border shadow-premium hover:shadow-premium-hover transition-shadow"
          >
            <div className="relative aspect-[16/7] lg:aspect-auto lg:h-full min-h-[280px] flex items-stretch">
              {/* Background: warm gradient base */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 60%, #050505 100%)',
                }}
              />
              {/* Side light from left */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(70% 80% at 10% 50%, rgba(212,175,55,0.18) 0%, transparent 60%)',
                }}
              />

              {/* Wheel anchor — right side */}
              <div className="absolute right-[-8%] top-1/2 -translate-y-1/2 w-[55%] aspect-square hidden md:block">
                <Wheel />
              </div>

              {/* Copy — left side */}
              <div className="relative z-10 flex flex-col justify-center p-8 lg:p-12 max-w-xl">
                <div className="text-xs font-semibold tracking-widest uppercase text-gold-shine mb-3">
                  Premium aftermarket
                </div>
                <h1 className="font-bold text-white text-3xl md:text-4xl lg:text-5xl leading-[1.05] tracking-tight">
                  Jante perfecte pentru
                  <br />
                  <span className="text-gold-shine">mașina ta.</span>
                </h1>
                <p className="mt-4 text-white/70 text-sm md:text-base leading-relaxed max-w-md">
                  Catalog unificat &middot; mii de modele aftermarket &middot; fitment garantat
                </p>
                <div className="mt-6 inline-flex">
                  <span className="btn-gold rounded-md px-6 py-3 text-sm uppercase">
                    Explorează catalogul
                    <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

/** CSS-composed wheel — dark metallic with gold rim highlight. */
function Wheel() {
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: `
          radial-gradient(circle at 25% 45%, rgba(255,233,170,0.30) 0%, transparent 28%),
          radial-gradient(circle at 50% 50%, #2a2a2a 0%, #141414 60%, #0a0a0a 100%)
        `,
        boxShadow:
          '0 60px 120px -30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05), inset -20px 0 60px rgba(0,0,0,0.85), inset 30px 0 80px rgba(212,175,55,0.10)',
      }}
    >
      <div
        className="absolute inset-[3%] rounded-full"
        style={{
          background:
            'conic-gradient(from 200deg, #3a3a3a, #0a0a0a 25%, #1f1f1f 50%, #0a0a0a 75%, #3a3a3a)',
        }}
      />
      <div
        className="absolute inset-[8%] rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, #1d1d1d 0deg, #383838 15deg, #0c0c0c 30deg, #262626 45deg, #0c0c0c 60deg, #383838 75deg, #1d1d1d 90deg, #383838 105deg, #0c0c0c 120deg, #262626 135deg, #0c0c0c 150deg, #383838 165deg, #1d1d1d 180deg, #383838 195deg, #0c0c0c 210deg, #262626 225deg, #0c0c0c 240deg, #383838 255deg, #1d1d1d 270deg, #383838 285deg, #0c0c0c 300deg, #262626 315deg, #0c0c0c 330deg, #383838 345deg, #1d1d1d 360deg)',
        }}
      />
      <div
        className="absolute inset-[8%] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 70% at 20% 50%, rgba(212,175,55,0.35) 0%, transparent 55%)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        className="absolute inset-[36%] rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 45%, #3a342a 0%, #0c0c0c 70%)',
        }}
      />
      <div
        className="absolute inset-[44%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 35%, #4a4438 0%, #1a1612 60%, #050505 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(212,175,55,0.35)',
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[5%] h-[5%] rounded-full"
        style={{ background: '#D4AF37', boxShadow: '0 0 14px rgba(212,175,55,0.6)' }}
      />
    </div>
  )
}
