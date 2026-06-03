'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

const GOLD = '#C9A84C'

/**
 * Full-bleed editorial hero — dark, automotive, parallax on scroll.
 * Visual anchor is a CSS-composed wheel with dramatic side-lighting from the
 * left (radial wash + conic spoke pattern). No carousel, no stock photo.
 */
export default function Hero() {
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const lightRef = useRef<HTMLDivElement | null>(null)
  const copyRef = useRef<HTMLDivElement | null>(null)
  const numberRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let pending = false
    let raf = 0
    const onScroll = () => {
      if (pending) return
      pending = true
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        if (wheelRef.current) {
          wheelRef.current.style.transform = `translate3d(0, ${y * 0.22}px, 0) rotate(${y * 0.045}deg)`
        }
        if (lightRef.current) {
          lightRef.current.style.transform = `translate3d(${y * -0.05}px, ${y * 0.08}px, 0)`
        }
        if (copyRef.current) {
          copyRef.current.style.transform = `translate3d(0, ${y * -0.08}px, 0)`
          copyRef.current.style.opacity = String(Math.max(0, 1 - y / 500))
        }
        if (numberRef.current) {
          numberRef.current.style.transform = `translate3d(0, ${y * -0.14}px, 0)`
        }
        pending = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section className="relative w-full overflow-hidden bg-[#0A0A0A] text-zinc-100 -mt-16 pt-16 min-h-[calc(100vh-0px)] md:min-h-screen">
      {/* Background grain + vignette */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 90% at 100% 100%, #0A0A0A 30%, transparent 75%), radial-gradient(80% 60% at 50% 0%, #1a1a1a 0%, transparent 70%)',
        }}
      />

      {/* Side light from left — parallax layer */}
      <div
        ref={lightRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none will-change-transform"
        style={{
          background:
            'radial-gradient(60% 70% at 8% 55%, rgba(201,168,76,0.18) 0%, rgba(201,168,76,0.05) 35%, transparent 65%)',
        }}
      />

      {/* Section number — slow parallax */}
      <div
        ref={numberRef}
        aria-hidden
        className="hidden md:block absolute top-24 right-6 lg:right-10 font-mono text-[11px] uppercase tracking-[0.4em] text-zinc-500 will-change-transform"
      >
        <span style={{ color: GOLD }}>—</span>&nbsp;&nbsp;01 / Catalog
      </div>

      <div className="container mx-auto px-4 md:px-8 relative h-full min-h-[calc(100vh-4rem)] flex items-center">
        <div className="grid md:grid-cols-12 gap-8 md:gap-4 items-center w-full py-16 md:py-0">
          {/* Copy */}
          <div ref={copyRef} className="md:col-span-6 lg:col-span-7 relative z-10 will-change-transform">
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-zinc-400 mb-6">
              <span className="block w-8 h-px" style={{ background: GOLD }} />
              Pimpit.ro · est. 2024
            </div>

            <h1 className="font-display font-medium leading-[0.92] tracking-[-0.02em] text-[clamp(2.5rem,7vw,5.75rem)] text-zinc-50">
              Găsește jantele
              <br />
              perfecte pentru
              <br />
              <span className="italic font-light" style={{ color: GOLD }}>mașina ta.</span>
            </h1>

            <p className="mt-6 max-w-md text-zinc-400 text-base md:text-lg leading-relaxed">
              Catalog unificat. Mii de modele de la cei mai buni producători,
              filtrate după ET, PCD și diametru exact pentru fitment-ul tău.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/jante"
                className="group inline-flex items-center gap-3 font-display font-semibold text-sm uppercase tracking-[0.18em] px-7 py-4 text-[#0A0A0A] transition-transform hover:-translate-y-0.5"
                style={{ background: GOLD }}
              >
                Explorează catalogul
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.24em] text-zinc-300 hover:text-zinc-50 transition-colors border-b border-white/15 hover:border-white/40 pb-1"
              >
                Cont B2B / B2C
              </Link>
            </div>

            {/* Spec ticker */}
            <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              <span><span style={{ color: GOLD }}>Ø</span>&nbsp;&nbsp;15–24"</span>
              <span><span style={{ color: GOLD }}>PCD</span>&nbsp;&nbsp;3×112 → 5×130</span>
              <span><span style={{ color: GOLD }}>ET</span>&nbsp;&nbsp;-20 → +60</span>
              <span><span style={{ color: GOLD }}>TÜV</span>&nbsp;&nbsp;certificat</span>
            </div>
          </div>

          {/* Wheel anchor */}
          <div className="md:col-span-6 lg:col-span-5 relative flex items-center justify-center md:justify-end">
            <div
              ref={wheelRef}
              className="relative aspect-square w-[80vw] max-w-[520px] md:w-[44vw] md:max-w-[600px] will-change-transform"
            >
              <Wheel />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500 flex flex-col items-center gap-2">
        <span>Scroll</span>
        <span className="block w-px h-8 bg-gradient-to-b from-zinc-600 to-transparent" />
      </div>
    </section>
  )
}

/** CSS-composed wheel: spoke ring, hub, metallic rim, side highlight. */
function Wheel() {
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: `
          radial-gradient(circle at 20% 45%, rgba(255,233,170,0.35) 0%, transparent 28%),
          radial-gradient(circle at 50% 50%, #1f1f1f 0%, #0d0d0d 60%, #050505 100%)
        `,
        boxShadow:
          '0 60px 120px -30px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.04), inset -20px 0 60px rgba(0,0,0,0.85), inset 30px 0 80px rgba(201,168,76,0.08)',
      }}
    >
      {/* Outer rim ring */}
      <div
        className="absolute inset-[3%] rounded-full"
        style={{
          background:
            'conic-gradient(from 200deg, #2a2a2a, #0a0a0a 25%, #1a1a1a 50%, #0a0a0a 75%, #2a2a2a)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      />
      {/* Spoke pattern */}
      <div
        className="absolute inset-[8%] rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, #181818 0deg, #2e2e2e 15deg, #0c0c0c 30deg, #1f1f1f 45deg, #0c0c0c 60deg, #2e2e2e 75deg, #181818 90deg, #2e2e2e 105deg, #0c0c0c 120deg, #1f1f1f 135deg, #0c0c0c 150deg, #2e2e2e 165deg, #181818 180deg, #2e2e2e 195deg, #0c0c0c 210deg, #1f1f1f 225deg, #0c0c0c 240deg, #2e2e2e 255deg, #181818 270deg, #2e2e2e 285deg, #0c0c0c 300deg, #1f1f1f 315deg, #0c0c0c 330deg, #2e2e2e 345deg, #181818 360deg)',
        }}
      />
      {/* Left-side gold highlight */}
      <div
        className="absolute inset-[8%] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 70% at 15% 50%, rgba(201,168,76,0.25) 0%, transparent 55%)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Inner barrel */}
      <div
        className="absolute inset-[36%] rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 45%, #2a2620 0%, #0c0c0c 70%)',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9), inset 8px 0 20px rgba(201,168,76,0.1)',
        }}
      />
      {/* Center hub */}
      <div
        className="absolute inset-[44%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 35%, #3a342a 0%, #161310 60%, #050505 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(201,168,76,0.25), 0 4px 12px rgba(0,0,0,0.6)',
        }}
      />
      {/* Center pin */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[5%] h-[5%] rounded-full"
        style={{ background: GOLD, boxShadow: '0 0 12px rgba(201,168,76,0.5)' }}
      />
    </div>
  )
}
