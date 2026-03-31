import Link from 'next/link'
import { ShoppingCart, User } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-tighter">
          PIMPIT<span className="text-primary">.RO</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6">
          <Link href="/jante" className="text-sm font-medium hover:text-primary transition-colors">Jante</Link>
          <Link href="/accesorii" className="text-sm font-medium hover:text-primary transition-colors">Accesorii</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="p-2 hover:bg-muted rounded-full transition-colors">
            <User className="w-5 h-5" />
          </Link>
          <Link href="/cos" className="p-2 hover:bg-muted rounded-full transition-colors relative">
            <ShoppingCart className="w-5 h-5" />
            {/* Badge for cart items would go here */}
          </Link>
        </div>
      </div>
    </nav>
  )
}
