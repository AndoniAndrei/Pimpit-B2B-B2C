import type { Metadata } from 'next'
import { Inter, Barlow_Condensed, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/shared/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
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
    <html lang="ro" className={`${barlowCondensed.variable} ${jetbrainsMono.variable} ${inter.variable}`}>
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen pt-16">
          {children}
        </main>
      </body>
    </html>
  )
}
