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
import { competitionImageId } from './competitions'
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

/** Um titulo conquistado numa temporada. */
export type SeasonTitle = {
  name: string
  /** Id da imagem da taca — ver `trophyImage`. */
  imageId: string
  scope: 'clube' | 'selecao'
}

/**
 * Os titulos de uma temporada, na ordem em que valem ser celebrados.
 *
 * Fica aqui, e nao na tela, porque e a mesma regra que monta a sala de
 * trofeus: se a cerimonia e a estante discordassem sobre o que e titulo, uma
 * das duas estaria mentindo.
 */
export function titlesIn(season: SeasonRecord): SeasonTitle[] {
  const titles: SeasonTitle[] = []

  if (season.champion) {
    titles.push({
      name: leagueName(season),
      imageId: season.leagueId,
      scope: 'clube',
    })
  }

  for (const run of season.cups) {
    if (!run.won) continue

    titles.push({
      name: run.name,
      imageId: competitionImageId(run.id, season.leagueId),
      scope: 'clube',
    })
  }

  const tournament = season.national?.tournament
  if (tournament?.won) {
    titles.push({ name: tournament.name, imageId: tournament.id, scope: 'selecao' })
  }

  return titles
}

export type Trophy = {
  name: string
  /**
   * Id da imagem da taca — ver `trophyImage`. E o id da liga para titulo de
   * campeonato, `cup-${pais}` para copa nacional, e o proprio id da
   * competicao no resto.
   */
  imageId: string
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

  const add = (
    name: string,
    imageId: string,
    scope: Trophy['scope'],
    year: string,
  ) => {
    const existing = byName.get(name)

    if (existing) {
      existing.count++
      existing.years.push(year)
      return
    }

    byName.set(name, { name, imageId, scope, count: 1, years: [year] })
  }

  for (const season of state.seasons) {
    for (const title of titlesIn(season)) {
      add(title.name, title.imageId, title.scope, season.label)
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
