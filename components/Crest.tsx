import type { CSSProperties } from 'react'

import { clubBadge, competitionBadge, leagueBadge } from '@/lib/sim/data/badges'
import { scaled } from '@/lib/ui/theme'

/**
 * Escudo de clube ou logo de competicao.
 *
 * As imagens sao arquivos locais em `public/badges/`, baixados por
 * `scripts/fetch-badges.ts`. Nem todo clube tem escudo: quando falta, o
 * componente nao renderiza nada em vez de deixar um quadrado quebrado na
 * linha — o nome ao lado ja identifica o time.
 */
function Crest({
  src,
  size,
  style,
}: {
  src: string | null
  size: number
  style?: CSSProperties
}) {
  if (!src) return null

  const side = scaled(size)

  // O next/image nao paga aqui: o escudo e um arquivo local, de tamanho fixo
  // e conhecido em build, que nunca muda. O que ele acrescentaria e um
  // pipeline de otimizacao sobre uma imagem que ja e pequena.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      style={{
        // `block` em vez do `inline` padrao da `<img>`: inline se alinha pela
        // linha de base do texto e ignora `margin: auto`, que e justamente
        // como as telas centralizam o escudo.
        display: 'block',
        width: side,
        height: side,
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

export function ClubCrest({
  clubId,
  size = 18,
  style,
}: {
  clubId: string | undefined
  size?: number
  style?: CSSProperties
}) {
  return <Crest src={clubId ? clubBadge(clubId) : null} size={size} style={style} />
}

export function LeagueCrest({
  leagueId,
  size = 18,
  style,
}: {
  leagueId: string | undefined
  size?: number
  style?: CSSProperties
}) {
  return <Crest src={leagueId ? leagueBadge(leagueId) : null} size={size} style={style} />
}

/**
 * Logo de uma competicao ja resolvida em id de imagem.
 *
 * Aceita tanto o id do jogo (`ucl`, `libertadores`) quanto o de uma liga —
 * o resumo de temporada lista as duas coisas lado a lado.
 */
export function CompetitionCrest({
  competitionId,
  size = 18,
  style,
}: {
  competitionId: string | null | undefined
  size?: number
  style?: CSSProperties
}) {
  const src = competitionId
    ? (competitionBadge(competitionId) ?? leagueBadge(competitionId))
    : null
  return <Crest src={src} size={size} style={style} />
}
