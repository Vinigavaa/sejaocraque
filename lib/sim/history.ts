/**
 * O passado da carreira, agregado.
 *
 * Tudo aqui ja existia em `state.seasons` — o que faltava era juntar. O
 * jogador nao consegue responder "por quais clubes eu passei" olhando uma
 * lista de temporadas soltas, e "quantos titulos eu tenho" olhando um numero
 * sem nome de competicao.
 *
 * Funcao pura sobre o estado do motor, sem React — mesma vizinhanca de
 * `ladder.ts`.
 */

import type { CareerState, SeasonRecord } from './career'
import { leagueById } from './data/leagues'

export type ClubSpell = {
  clubId: string
  /** Rotulo da primeira temporada da passagem. */
  from: string
  /** Null enquanto a passagem e a atual e a carreira nao terminou. */
  to: string | null
  seasons: number
  matches: number
  goals: number
  assists: number
  titles: number
}

/**
 * As passagens por clube, na ordem em que aconteceram.
 *
 * A passagem quebra quando o clube muda de uma temporada para a seguinte —
 * voltar a um clube antigo gera duas passagens separadas, que e o que o
 * jogador espera ver.
 */
export function clubSpells(state: CareerState): ClubSpell[] {
  const spells: ClubSpell[] = []

  for (const season of state.seasons) {
    const current = spells[spells.length - 1]

    if (!current || current.clubId !== season.clubId) {
      spells.push({
        clubId: season.clubId,
        from: season.label,
        to: season.label,
        seasons: 0,
        matches: 0,
        goals: 0,
        assists: 0,
        titles: 0,
      })
    }

    const spell = spells[spells.length - 1]

    spell.to = season.label
    spell.seasons++
    spell.matches += season.stats.matches
    spell.goals += season.stats.goals
    spell.assists += season.stats.assists
    spell.titles += season.champion ? 1 : 0

    // Copa conta na passagem: foi titulo ganho por aquele clube, naqueles anos.
    for (const run of season.cups) {
      spell.matches += run.matches
      spell.goals += run.goals
      spell.assists += run.assists
      spell.titles += run.won ? 1 : 0
    }
  }

  const last = spells[spells.length - 1]
  if (last && !state.retired) last.to = null

  return spells
}

export type Trophy = {
  name: string
  scope: 'clube' | 'selecao'
  count: number
  /** Os anos em que foi conquistado, na ordem. */
  years: string[]
}

/**
 * A sala de trofeus.
 *
 * Agrupada por **nome** da competicao e nao por id: copa nacional e torneio
 * continental de selecao nao tem id estavel entre paises, e o nome e o que o
 * jogador reconhece de qualquer jeito.
 */
export function trophyCase(state: CareerState): Trophy[] {
  const byName = new Map<string, Trophy>()

  const add = (name: string, scope: Trophy['scope'], year: string) => {
    const existing = byName.get(name)

    if (existing) {
      existing.count++
      existing.years.push(year)
      return
    }

    byName.set(name, { name, scope, count: 1, years: [year] })
  }

  for (const season of state.seasons) {
    if (season.champion) {
      add(leagueName(season), 'clube', season.label)
    }

    for (const run of season.cups) {
      if (run.won) add(run.name, 'clube', season.label)
    }

    if (season.national?.tournament?.won) {
      add(season.national.tournament.name, 'selecao', season.label)
    }
  }

  // Mais vezes primeiro; empate resolve pelo nome, para a ordem nao depender da
  // ordem de insercao.
  return [...byName.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
}

function leagueName(season: SeasonRecord): string {
  return leagueById(season.leagueId)?.name ?? season.leagueId
}
