'use client'

import { useEffect, useRef } from 'react'
import VehicleSelector from './VehicleSelector'

/**
 * Homepage hero — CARiD-style structure, light pimpit palette.
 * Headline + vehicle Year/Make/Model selector on the left, CSS-composed
 * wheel anchor with side-light from the left on the right. Subtle parallax.
 */
export default function Hero() {
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const lightRef = useRef<HTMLDivElement | null>(null)
  const copyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let pending = false
    let raf = 0
    const onScroll = () => {
      if (pending) return
      pending = true
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        if (wheelRef.current) {
          wheelRef.current.style.transform = `translate3d(0, ${y * 0.18}px, 0) rotate(${y * 0.04}deg)`
        }
        if (lightRef.current) {
          lightRef.current.style.transform = `translate3d(${y * -0.04}px, ${y * 0.06}px, 0)`
        }
        if (copyRef.current) {
          copyRef.current.style.transform = `translate3d(0, ${y * -0.05}px, 0)`
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
    <section className="relative w-full overflow-hidden bg-pimpit-bg text-pimpit-text -mt-16 pt-16 min-h-[92vh] md:min-h-screen">
      {/* Warm stone vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 90% at 100% 100%, #FFFFFF 30%, transparent 75%), radial-gradient(80% 60% at 50% 0%, #FAFAF9 0%, transparent 70%)',
        }}
      />

      {/* Gold side-light parallax layer (subtle on white) */}
      <div
        ref={lightRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none will-change-transform"
        style={{
          background:
            'radial-gradient(60% 70% at 8% 55%, rgba(181,147,58,0.10) 0%, rgba(181,147,58,0.03) 35%, transparent 65%)',
        }}
      />

      {/* Section number */}
      <div
        aria-hidden
        className="hidden md:block absolute top-24 right-6 lg:right-10 font-mono text-[11px] uppercase tracking-[0.4em] text-pimpit-text-muted"
      >
        <span className="text-pimpit-accent">—</span>&nbsp;&nbsp;01 / Fitment
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative h-full min-h-[calc(92vh-4rem)] md:min-h-[calc(100vh-4rem)] flex items-center">
        <div className="grid md:grid-cols-12 gap-8 md:gap-6 items-center w-full py-12 md:py-0">
          {/* Copy + selector */}
          <div ref={copyRef} className="md:col-span-7 relative z-10 will-change-transform">
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-pimpit-text-muted mb-6">
              <span className="block w-8 h-px bg-pimpit-accent" />
              Pimpit.ro · est. 2024
            </div>

            <h1 className="font-display font-medium leading-[0.95] tracking-tight text-[clamp(2.5rem,6.5vw,5.5rem)] text-pimpit-text uppercase">
              Jante perfecte
              <br />
              pentru <span className="text-pimpit-accent">mașina ta.</span>
            </h1>

            <p className="mt-5 max-w-md text-pimpit-text-muted text-base md:text-lg leading-relaxed">
              Catalog unificat cu mii de modele aftermarket. Filtre fitment
              exact &mdash; ET, PCD, diametru &mdash; pentru match instant.
            </p>

            <div className="mt-8 max-w-xl">
              <VehicleSelector variant="hero" />
            </div>
          </div>

          {/* Wheel anchor — kept as a dark editorial product render on white */}
          <div className="md:col-span-5 relative flex items-center justify-center md:justify-end">
            <div
              ref={wheelRef}
              className="relative aspect-square w-[70vw] max-w-[460px] md:w-[42vw] md:max-w-[560px] will-change-transform"
            >
              <Wheel />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.32em] text-pimpit-text-muted flex flex-col items-center gap-2">
        <span>Scroll</span>
        <span className="block w-px h-8 bg-gradient-to-b from-pimpit-text-muted to-transparent" />
      </div>
    </section>
  )
}

function Wheel() {
  const GOLD = '#B5933A'
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: `
          radial-gradient(circle at 20% 45%, rgba(255,233,170,0.35) 0%, transparent 28%),
          radial-gradient(circle at 50% 50%, #2a2a2a 0%, #141414 60%, #0a0a0a 100%)
        `,
        boxShadow:
          '0 60px 120px -30px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.05), inset -20px 0 60px rgba(0,0,0,0.85), inset 30px 0 80px rgba(181,147,58,0.10)',
      }}
    >
      <div
        className="absolute inset-[3%] rounded-full"
        style={{
          background:
            'conic-gradient(from 200deg, #3a3a3a, #0a0a0a 25%, #1f1f1f 50%, #0a0a0a 75%, #3a3a3a)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      />
      <div
        className="absolute inset-[8%] rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, #1d1d1d 0deg, #353535 15deg, #0c0c0c 30deg, #242424 45deg, #0c0c0c 60deg, #353535 75deg, #1d1d1d 90deg, #353535 105deg, #0c0c0c 120deg, #242424 135deg, #0c0c0c 150deg, #353535 165deg, #1d1d1d 180deg, #353535 195deg, #0c0c0c 210deg, #242424 225deg, #0c0c0c 240deg, #353535 255deg, #1d1d1d 270deg, #353535 285deg, #0c0c0c 300deg, #242424 315deg, #0c0c0c 330deg, #353535 345deg, #1d1d1d 360deg)',
        }}
      />
      <div
        className="absolute inset-[8%] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 70% at 15% 50%, rgba(181,147,58,0.30) 0%, transparent 55%)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        className="absolute inset-[36%] rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 45%, #3a342a 0%, #0c0c0c 70%)',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9), inset 8px 0 20px rgba(181,147,58,0.15)',
        }}
      />
      <div
        className="absolute inset-[44%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 35%, #4a4438 0%, #1a1612 60%, #050505 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(181,147,58,0.3), 0 4px 12px rgba(0,0,0,0.4)',
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[5%] h-[5%] rounded-full"
        style={{ background: GOLD, boxShadow: '0 0 12px rgba(181,147,58,0.5)' }}
      />
    </div>
  )
}
