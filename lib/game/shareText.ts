/**
 * O resumo da carreira em texto, para colar em qualquer lugar.
 *
 * E o irmao do `ShareCard`: o card e para print, este texto e para quem cola
 * num grupo de mensagem. Os dois leem os mesmos numeros do motor — por isso
 * `bestSeason` mora aqui e e importada la, e nao escrita duas vezes.
 *
 * Sem React e sem estilo: funcao pura sobre o estado da carreira.
 */

import type { CareerState, SeasonRecord } from '@/lib/sim/career'
import { clubById } from '@/lib/sim/data/clubs'
import { nationById } from '@/lib/sim/data/nations'
import { trophyCase } from '@/lib/sim/history'
import { careerTotals, ladderLabel, ladderRung } from '@/lib/sim/ladder'
import { NUMERIC_ATTRS, POSITION_LABEL, type NumericAttr } from '@/lib/sim/types'

const SITE = 'sejaocraque.com'

/** Quantos titulos entram na lista. Acima disso o texto vira uma tabela. */
const MAX_TROPHIES = 4

const ATTR_ICON: Record<NumericAttr, string> = {
  vel: '⚡',
  fin: '🎯',
  pas: '🎩',
  dri: '🪄',
  def: '🛡️',
  fis: '💪',
}

/** O degrau vira icone: quem le reconhece o patamar antes de ler a palavra. */
function ladderIcon(rung: number): string {
  if (rung >= 10) return '💀'
  if (rung >= 8) return '🔥'
  if (rung >= 6) return '⭐'
  return '⚪'
}

/**
 * A bandeira como emoji, a partir do codigo ISO de duas letras.
 *
 * Os reinos britanicos usam `gb-eng` e afins no `flag-icons`, que nao tem
 * emoji equivalente simples — esses caem no globo em vez de virar um par de
 * letras solto no meio do texto.
 */
function flagEmoji(nationality: string): string {
  const code = nationById(nationality)?.flagCode
  if (!code || code.length !== 2) return '🌍'

  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  )
}

export type SeasonHighlight = {
  label: string
  rating: number
  goals: number
  assists: number
  club: string
}

/** A melhor temporada pela nota da liga — a mesma nota que o histórico mostra. */
export function bestSeason(career: CareerState): SeasonHighlight | null {
  const best = career.seasons.reduce<SeasonRecord | null>(
    (top, season) => (!top || season.stats.rating > top.stats.rating ? season : top),
    null,
  )

  if (!best) return null

  return {
    label: best.label,
    rating: best.stats.rating,
    goals: best.stats.goals,
    assists: best.stats.assists,
    club: clubById(best.clubId)?.name ?? best.clubId,
  }
}

/**
 * O texto que vai para a area de transferencia.
 *
 * Blocos separados por linha em branco, na mesma ordem do card: quem sou,
 * atributos, producao, conquistas, titulos, melhor temporada, assinatura.
 * Bloco sem conteudo — carreira sem titulo, por exemplo — nao entra: linha
 * zerada so ocupa espaco na mensagem.
 */
export function careerShareText(career: CareerState, peakOverall: number): string {
  const totals = careerTotals(career)
  const attrs = career.peakAttrs
  const best = bestSeason(career)
  const trophies = trophyCase(career).slice(0, MAX_TROPHIES)

  const icons = NUMERIC_ATTRS.map(
    (attr) => `${ATTR_ICON[attr]} ${attrs[attr]} ${attr.toUpperCase()}`,
  )

  const blocks: string[] = [
    [
      `${flagEmoji(career.config.nationality)} ${career.config.name.toUpperCase()} #${
        career.config.shirtNumber
      } | ⭐ ${peakOverall} GERAL`,
      `${ladderIcon(ladderRung(totals))} ${ladderLabel(totals).toUpperCase()} • ${
        POSITION_LABEL[career.config.position]
      }`,
    ].join('\n'),

    [icons.slice(0, 3).join(' • '), icons.slice(3).join(' • ')].join('\n'),

    [
      `🎮 ${totals.matches} jogos | ⚽ ${totals.goals} gols | 🅰️ ${totals.assists} assistências`,
      `📅 ${career.seasons.length} ${career.seasons.length === 1 ? 'temporada' : 'temporadas'}`,
    ].join('\n'),
  ]

  // A Bola de Ouro sai da conta geral de premios e ganha item proprio: e o
  // premio que a escada reserva para o topo, e some num "3 premios" ao lado da
  // Chuteira de Ouro, que vale bem menos.
  const honours = [
    totals.titles > 0
      ? `🏆 ${totals.titles} ${totals.titles === 1 ? 'título' : 'títulos'}`
      : null,
    totals.ballonDOrs > 0
      ? `🥇 ${totals.ballonDOrs} ${
          totals.ballonDOrs === 1 ? 'Bola de Ouro' : 'Bolas de Ouro'
        }`
      : null,
    totals.goldenBoots > 0
      ? `👟 ${totals.goldenBoots} ${
          totals.goldenBoots === 1 ? 'Chuteira de Ouro' : 'Chuteiras de Ouro'
        }`
      : null,
  ].filter(Boolean)

  if (honours.length > 0) blocks.push(honours.join(' | '))

  if (trophies.length > 0) {
    blocks.push(trophies.map((trophy) => `🏆 ${trophy.name} ×${trophy.count}`).join('\n'))
  }

  if (best) {
    blocks.push(
      [
        `⭐ ${best.label}`,
        `📊 Nota ${best.rating.toFixed(1)} | ⚽ ${best.goals} gols | 🅰️ ${best.assists} assistências`,
        `🔴 ${best.club}`,
      ].join('\n'),
    )
  }

  blocks.push(`⚽ CRAQUE\njogue também em ${SITE}`)

  return blocks.join('\n\n')
}
