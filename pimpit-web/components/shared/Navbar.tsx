'use client';

import Link from 'next/link';
import { ShoppingCart, User, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-background/95 backdrop-blur-md border-b z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-tighter shrink-0" onClick={() => setMenuOpen(false)}>
          PIMPIT<span className="text-primary">.RO</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/jante" className="text-sm font-medium hover:text-primary transition-colors">Jante</Link>
          <Link href="/accesorii" className="text-sm font-medium hover:text-primary transition-colors">Accesorii</Link>
        </div>

        <div className="flex items-center gap-1">
          <Link href="/auth/login" className="p-2 hover:bg-muted rounded-full transition-colors">
            <User className="w-5 h-5" />
          </Link>
          <Link href="/cos" className="p-2 hover:bg-muted rounded-full transition-colors relative">
            <ShoppingCart className="w-5 h-5" />
          </Link>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 hover:bg-muted rounded-full transition-colors ml-1"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Meniu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-background border-t px-4 py-3 flex flex-col gap-1">
          <Link href="/jante" className="py-2.5 px-2 text-sm font-medium hover:text-primary transition-colors rounded-lg hover:bg-muted" onClick={() => setMenuOpen(false)}>
            Jante
          </Link>
          <Link href="/accesorii" className="py-2.5 px-2 text-sm font-medium hover:text-primary transition-colors rounded-lg hover:bg-muted" onClick={() => setMenuOpen(false)}>
            Accesorii
          </Link>
        </div>
      )}
    </nav>
  );
}
