import type { CSSProperties } from 'react'

import { nationById } from '@/lib/sim/data/nations'
import { scaled } from '@/lib/ui/theme'

/**
 * Bandeira de uma nacionalidade.
 *
 * Emoji de bandeira nao existe no Windows — la o `🇫🇷` vira as letras `FR`, que
 * foi exatamente o que aparecia na tela de criacao. Por isso a bandeira vem do
 * `flag-icons` (SVG local), e nao da fonte do sistema.
 *
 * O tamanho e controlado por `font-size`: o `.fi` do pacote ja define largura
 * e altura em `em`, mantendo a proporcao 4:3.
 */
export function Flag({
  nationality,
  size = 16,
  style,
}: {
  nationality: string | undefined
  size?: number
  style?: CSSProperties
}) {
  const nation = nationality ? nationById(nationality) : undefined
  if (!nation) return null

  return (
    <span
      className={`fi fi-${nation.flagCode}`}
      role="img"
      aria-label={nation.name}
      style={{ fontSize: scaled(size), borderRadius: 2, flexShrink: 0, ...style }}
    />
  )
}
