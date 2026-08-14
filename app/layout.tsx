import type { Metadata, Viewport } from 'next'
import { Anton, Inter } from 'next/font/google'

import { AuthProvider } from '@/lib/firebase/AuthProvider'
import { SITE, siteUrl } from '@/lib/ui/site'
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
  // `metadataBase` e o que torna absolutos os caminhos abaixo. Sem ele o Next
  // emite a imagem do cartao como caminho relativo, e nenhuma rede social
  // consegue busca-la.
  metadataBase: siteUrl(),
  title: {
    default: SITE.title,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'craque',
    'simulador de carreira',
    'futebol',
    'jogo de futebol',
    'carreira de jogador',
    'lendas do futebol',
    'brasileirão',
    'jogo online grátis',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    url: '/',
    locale: SITE.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.title,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
  },
  // A tela cheia sem barra de navegador quando o jogo e salvo na tela inicial
  // do iPhone. O jogo ja e desenhado em coluna unica, entao ele cabe.
  appleWebApp: {
    capable: true,
    title: SITE.shortTitle,
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: t.bg,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${inter.variable}`}>
      <body>
        {/* Dados estruturados: e o que permite ao Google entender que a pagina
            e um jogo jogavel no navegador, e nao um texto sobre futebol. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'VideoGame',
              name: SITE.name,
              description: SITE.description,
              url: siteUrl().toString(),
              inLanguage: 'pt-BR',
              genre: ['Simulação', 'Esporte'],
              gamePlatform: 'Navegador',
              applicationCategory: 'Game',
              operatingSystem: 'Any',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
            }),
          }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
