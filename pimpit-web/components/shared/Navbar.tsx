'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingCart, User, Menu, X, Search } from 'lucide-react'
import { useState, FormEvent } from 'react'

const NAV_LINKS = [
  { label: 'Jante', href: '/jante' },
  { label: 'Accesorii', href: '/accesorii' },
]

export default function Navbar() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const q = search.trim()
    router.push(q ? `/jante?search=${encodeURIComponent(q)}` : '/jante')
    setMenuOpen(false)
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-pimpit-border shadow-premium">
      <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center gap-4 lg:gap-6">
        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 -ml-2 text-pimpit-text hover:text-pimpit-accent transition-colors"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Meniu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo */}
        <Link
          href="/"
          className="font-bold text-2xl tracking-tight text-pimpit-text shrink-0 flex items-baseline"
          onClick={() => setMenuOpen(false)}
        >
          PIMPIT<span className="text-gold-shine">.RO</span>
        </Link>

        {/* Search — center, prominent */}
        <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-2xl">
          <div className="relative w-full">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după brand, model, cod sau dimensiune (ex: 19x9.5 5x112)"
              className="w-full bg-white border border-pimpit-border rounded-md pl-4 pr-12 py-2.5 text-sm text-pimpit-text placeholder:text-pimpit-text-muted focus:outline-none focus:border-pimpit-accent focus:ring-1 focus:ring-pimpit-accent transition-colors"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 h-full px-4 text-pimpit-text-muted hover:text-pimpit-accent transition-colors border-l border-pimpit-border"
              aria-label="Caută"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Right side icons */}
        <div className="flex items-center gap-1 ml-auto md:ml-0">
          <Link
            href="/auth/login"
            className="p-2.5 text-pimpit-text hover:text-pimpit-accent transition-colors flex items-center gap-2"
            aria-label="Cont"
          >
            <User className="w-5 h-5" />
            <span className="hidden xl:inline text-sm font-medium">Cont</span>
          </Link>
          <Link
            href="/cos"
            className="p-2.5 text-pimpit-text hover:text-pimpit-accent transition-colors relative flex items-center gap-2"
            aria-label="Coș"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden xl:inline text-sm font-medium">Coș</span>
          </Link>
        </div>
      </div>

      {/* Secondary nav bar — category links (CARiD-style row below the search) */}
      <div className="hidden lg:block border-t border-pimpit-border bg-white">
        <div className="container mx-auto px-4 lg:px-8 h-11 flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-pimpit-text hover:text-pimpit-accent transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-pimpit-border">
          <form onSubmit={submitSearch} className="px-4 py-3 border-b border-pimpit-border md:hidden">
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută…"
                className="w-full bg-white border border-pimpit-border rounded-md pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-pimpit-accent"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-pimpit-text-muted">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="px-4 py-2 flex flex-col">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="font-semibold text-base text-pimpit-text py-3 border-b border-pimpit-border last:border-0"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="font-semibold text-base text-pimpit-text py-3 border-b border-pimpit-border last:border-0"
            >
              Cont B2B / B2C
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
