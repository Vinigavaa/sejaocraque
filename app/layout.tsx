import type { Metadata, Viewport } from 'next'
import { Anton, Inter } from 'next/font/google'

import { t } from '@/lib/ui/theme'
// Bandeiras em SVG local: emoji de bandeira nao renderiza no Windows.
import 'flag-icons/css/flag-icons.min.css'
import './globals.css'

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CRAQUE — Simulador de carreira no futebol',
  description:
    'Roube um atributo de cada lenda, monte seu jogador e viva uma carreira inteira. Descubra onde você fica entre os maiores.',
}

export const viewport: Viewport = {
  themeColor: t.bg,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
