'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const NAV = [
  { href: '/admin',              label: 'Dashboard' },
  { href: '/admin/produse',      label: 'Produse' },
  { href: '/admin/importuri',    label: 'Importuri' },
  { href: '/admin/furnizori',    label: 'Furnizori' },
  { href: '/admin/sincronizari', label: 'Sincronizări' },
];

function SidebarLinks({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map(n => (
        <Link
          key={n.href}
          href={n.href}
          onClick={onNav}
          className={`block px-4 py-2.5 rounded-md font-medium text-sm transition-colors
            ${pathname === n.href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-card border-r p-6">
        <h2 className="font-bold text-lg mb-6">Admin Panel</h2>
        <SidebarLinks />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-card border-r p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-lg">Admin Panel</span>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarLinks onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 bg-card border-b px-4 py-3 sticky top-16 z-30">
          <button onClick={() => setOpen(true)} className="p-1.5 hover:bg-muted rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Admin Panel</span>
        </div>
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
