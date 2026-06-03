import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/shared/Navbar'
import Footer from '@/components/shared/Footer'

/**
 * Typography: native system font stack only (no Inter, no Barlow).
 * This is the simplest, most readable, most premium-feeling option —
 * each OS renders text in its native flagship sans (SF Pro on Mac,
 * Segoe UI Variable on Windows, Roboto on Android) which is always
 * perfectly hinted for that screen.
 *
 * JetBrains Mono remains, used only on the inline fitment chips.
 */
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Pimpit.ro | Catalog Jante Auto',
  description: 'Cel mai mare catalog de jante auto din România.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro" className={jetbrainsMono.variable}>
      <body className="bg-pimpit-bg text-pimpit-text antialiased font-sans">
        <Navbar />
        <main className="min-h-screen pt-16 lg:pt-[6.75rem]">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
