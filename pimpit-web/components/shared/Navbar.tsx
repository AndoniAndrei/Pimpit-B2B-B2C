'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingCart, User, Menu, X, Search } from 'lucide-react'
import { useState, FormEvent } from 'react'

export default function Navbar() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (!q) {
      router.push('/jante')
      return
    }
    router.push(`/jante?search=${encodeURIComponent(q)}`)
    setMenuOpen(false)
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-pimpit-bg/95 backdrop-blur-md border-b border-pimpit-border">
      <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center gap-4 lg:gap-8">
        {/* Logo */}
        <Link
          href="/"
          className="font-display font-extrabold text-2xl tracking-tight text-pimpit-text shrink-0"
          onClick={() => setMenuOpen(false)}
        >
          PIMPIT<span className="text-pimpit-accent">.RO</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          <NavLink href="/jante">Jante</NavLink>
          <NavLink href="/accesorii">Accesorii</NavLink>
        </div>

        {/* Search — prominent, fills remaining width */}
        <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-2xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pimpit-text-muted pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută brand, model, cod (ex: Concaver CVR1, 19x9.5)"
              className="w-full bg-pimpit-surface border border-pimpit-border pl-10 pr-3 py-2.5 text-sm text-pimpit-text placeholder:text-pimpit-text-muted focus:outline-none focus:border-pimpit-accent transition-colors"
            />
          </div>
        </form>

        {/* Right side: account + cart + mobile menu */}
        <div className="flex items-center gap-1 ml-auto md:ml-0">
          <Link
            href="/auth/login"
            className="p-2.5 text-pimpit-text-muted hover:text-pimpit-text transition-colors flex items-center gap-2"
            aria-label="Cont"
          >
            <User className="w-5 h-5" />
            <span className="hidden xl:inline font-mono text-[11px] uppercase tracking-[0.18em]">Cont</span>
          </Link>
          <Link
            href="/cos"
            className="p-2.5 text-pimpit-text-muted hover:text-pimpit-text transition-colors relative flex items-center gap-2"
            aria-label="Coș"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden xl:inline font-mono text-[11px] uppercase tracking-[0.18em]">Coș</span>
          </Link>
          <button
            className="lg:hidden p-2.5 text-pimpit-text-muted hover:text-pimpit-text transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Meniu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden bg-pimpit-surface border-t border-pimpit-border">
          <form onSubmit={submitSearch} className="px-4 py-3 border-b border-pimpit-border md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pimpit-text-muted pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută…"
                className="w-full bg-pimpit-bg border border-pimpit-border pl-10 pr-3 py-2.5 text-sm text-pimpit-text placeholder:text-pimpit-text-muted focus:outline-none focus:border-pimpit-accent"
              />
            </div>
          </form>
          <div className="px-4 py-2 flex flex-col">
            <MobileLink href="/jante" onClick={() => setMenuOpen(false)}>Jante</MobileLink>
            <MobileLink href="/accesorii" onClick={() => setMenuOpen(false)}>Accesorii</MobileLink>
            <MobileLink href="/auth/login" onClick={() => setMenuOpen(false)}>Cont B2B / B2C</MobileLink>
          </div>
        </div>
      )}
    </nav>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-display font-semibold uppercase text-sm tracking-[0.18em] text-pimpit-text-muted hover:text-pimpit-text px-4 py-2 transition-colors"
    >
      {children}
    </Link>
  )
}

function MobileLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="font-display font-semibold uppercase tracking-[0.2em] text-sm text-pimpit-text py-3 border-b border-pimpit-border last:border-0"
    >
      {children}
    </Link>
  )
}
