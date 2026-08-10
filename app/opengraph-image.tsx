import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import { SITE } from '@/lib/ui/site'

export const alt = SITE.title
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * O cartao que aparece quando o link e colado no WhatsApp, no X ou no Discord.
 *
 * A imagem e gerada aqui em vez de ser um PNG no `public/` porque assim ela
 * acompanha o texto do jogo: mudar `SITE.description` muda o cartao junto, sem
 * ninguem lembrar de reexportar arte.
 *
 * As cores sao hex, e nao os tokens `oklch` do tema: o renderizador do
 * `next/og` nao entende `oklch`, e uma cor que ele nao entende vira preto sem
 * aviso. Sao as mesmas cores da interface, convertidas.
 */
const BG = '#1a1512'
const CARD = '#252019'
const TEXT = '#f2ece3'
const MUTED = '#a2988a'
const ACCENT = '#c8551f'

// A logo entra embutida em base64: o cartao e gerado no build, quando ainda
// nao existe servidor de onde buscar `/logo.png` por URL.
const LOGO = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public', 'logo.png'),
).toString('base64')}`

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 80px',
          borderBottom: `16px solid ${ACCENT}`,
        }}
      >
        {/* A bola ocupa a direita, onde o texto nao chega. Fora do fluxo para
            nao empurrar as linhas nem depender da altura delas. */}
        <img
          src={LOGO}
          width={300}
          height={300}
          alt=""
          style={{ position: 'absolute', right: 72, top: 150 }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 26,
            letterSpacing: 6,
            color: MUTED,
            textTransform: 'uppercase',
          }}
        >
          <div style={{ width: 56, height: 6, background: ACCENT }} />
          <div style={{ display: 'flex' }}>Simulador de carreira no futebol</div>
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 160,
            fontWeight: 900,
            letterSpacing: -4,
            color: TEXT,
            lineHeight: 1,
          }}
        >
          {SITE.name}
        </div>

        <div style={{ marginTop: 18, fontSize: 38, color: MUTED, lineHeight: 1.25, maxWidth: 700 }}>
          {`${SITE.tagline}. Monte seu jogador e viva uma carreira inteira.`}
        </div>

        <div style={{ marginTop: 44, display: 'flex', gap: 16 }}>
          {['16 anos até a aposentadoria', 'Títulos e seleção', 'Mercado e propostas'].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  background: CARD,
                  border: `2px solid ${ACCENT}55`,
                  borderRadius: 10,
                  padding: '14px 22px',
                  fontSize: 26,
                  color: TEXT,
                }}
              >
                {label}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    size,
  )
}
