import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/shared/Navbar'
import Footer from '@/components/shared/Footer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})
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
    <html lang="ro" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} bg-pimpit-bg text-pimpit-text antialiased`}>
        <Navbar />
        <main className="min-h-screen pt-16 lg:pt-[6.75rem]">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
