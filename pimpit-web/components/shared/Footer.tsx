import Link from 'next/link'
import { Shield, Truck, CreditCard, Award } from 'lucide-react'

const FOOTER_NAV = {
  Catalog: [
    { label: 'Toate jantele', href: '/jante' },
    { label: 'Jante 17"', href: '/jante?diameter=17' },
    { label: 'Jante 18"', href: '/jante?diameter=18' },
    { label: 'Jante 19"', href: '/jante?diameter=19' },
    { label: 'Jante 20"', href: '/jante?diameter=20' },
    { label: 'Accesorii', href: '/accesorii' },
  ],
  Cont: [
    { label: 'Login / Înregistrare', href: '/auth/login' },
    { label: 'Cont B2B', href: '/auth/login' },
    { label: 'Coșul meu', href: '/cos' },
    { label: 'Comenzile mele', href: '/cont' },
  ],
  // Note: no hardcoded brand names — those should only appear when
  // proven to exist in the catalog. The homepage FeaturedBrands strip
  // already lists actual brands from the DB.
  Răsfoiește: [
    { label: 'Toate jantele', href: '/jante' },
    { label: 'Toate brand-urile', href: '/jante' },
    { label: 'Reduceri (preț ↑)', href: '/jante?sort=price_asc' },
    { label: 'Cele mai noi', href: '/jante?sort=newest' },
    { label: 'Accesorii', href: '/accesorii' },
  ],
}

// Note: trust labels are intentionally generic descriptors of how the
// platform works. Specific commitments (livrare X ore, certificat X,
// garanție Y luni) should only appear here when backed by configurable
// per-supplier or per-product data.
const TRUST_ITEMS = [
  { Icon: Award,      label: 'Catalog aftermarket' },
  { Icon: Truck,      label: 'Livrare națională' },
  { Icon: Shield,     label: 'Garanție producător' },
  { Icon: CreditCard, label: 'Plată securizată' },
]

export default function Footer() {
  return (
    <footer className="bg-white border-t border-pimpit-border text-pimpit-text">
      {/* Trust strip */}
      <div className="bg-pimpit-surface-2 border-b border-pimpit-border">
        <div className="container mx-auto px-4 lg:px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {TRUST_ITEMS.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-pimpit-accent shrink-0" />
              <span className="text-xs font-medium text-pimpit-text">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main 4-column footer */}
      <div className="container mx-auto px-4 lg:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="font-bold text-2xl tracking-tight text-pimpit-text flex items-baseline">
            PIMPIT<span className="text-gold-shine">.RO</span>
          </Link>
          <p className="mt-3 text-sm text-pimpit-text-muted leading-relaxed max-w-xs">
            Catalog de jante aliaj &amp; accesorii tuning agregate din mai mulți
            furnizori aftermarket.
          </p>
          <div className="mt-5 text-xs text-pimpit-text-muted">
            Est. 2024 · România
          </div>
        </div>

        {Object.entries(FOOTER_NAV).map(([heading, items]) => (
          <div key={heading}>
            <h4 className="text-sm font-bold text-pimpit-text mb-4">
              {heading}
            </h4>
            <ul className="space-y-2.5">
              {items.map((it) => (
                <li key={it.href + it.label}>
                  <Link
                    href={it.href}
                    className="text-sm text-pimpit-text-muted hover:text-pimpit-accent transition-colors"
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom strip */}
      <div className="border-t border-pimpit-border">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-pimpit-text-muted">
            © {new Date().getFullYear()} Pimpit.ro · Toate drepturile rezervate
          </p>
          <div className="flex items-center gap-3 text-xs font-medium text-pimpit-text-muted">
            <span>VISA</span>
            <span>MasterCard</span>
            <span>Apple Pay</span>
            <span>Stripe</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
