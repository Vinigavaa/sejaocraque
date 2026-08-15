import type { CSSProperties } from 'react'

import { trophyImage } from '@/lib/sim/data/badges'
import { scaled } from '@/lib/ui/theme'

/**
 * A taca de uma competicao.
 *
 * Diferente do escudo, ela e foto: nao encolhe bem e nao serve de icone de
 * linha. Aparece grande — na cerimonia de titulo e na sala de trofeus — ou
 * nao aparece.
 *
 * Nem toda competicao tem taca baixada (ver `scripts/fetch-badges.ts`). Quando
 * falta, o componente nao renderiza nada em vez de deixar um quadrado
 * quebrado: o nome ao lado ja identifica o titulo.
 */
export function Trophy({
  competitionId,
  size = 96,
  style,
}: {
  competitionId: string | null | undefined
  size?: number
  style?: CSSProperties
}) {
  const src = competitionId ? trophyImage(competitionId) : null
  if (!src) return null

  const side = scaled(size)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      style={{
        display: 'block',
        width: side,
        height: side,
        objectFit: 'contain',
        flexShrink: 0,
        // A foto vem em fundo transparente, mas com pouco contraste no tema
        // escuro. A sombra descola a taca do cartao sem precisar de moldura.
        filter: 'drop-shadow(0 4px 12px oklch(5% 0 0 / 0.45))',
        ...style,
      }}
    />
  )
}
