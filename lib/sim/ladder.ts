import type { CareerState } from './career'
import { nationalTotals, wonWorldCup } from './national'

/**
 * A escada de 11 degraus do fim de carreira.
 *
 * O degrau vem de uma pontuacao unica que soma o que a carreira produziu. Os
 * pesos dizem o que o jogo considera importante: titulo vale muito mais que
 * gol, e Bola de Ouro vale mais que tudo — e por isso que o topo e reservado a
 * quem ganhou o premio, como prometido na tela inicial.
 */
export const LADDER_LABELS = [
  'Jogador comum',
  'Profissional',
  'Titular',
  'Referência',
  'Ídolo local',
  'Nome nacional',
  'Estrela',
  'Craque',
  'Referência mundial',
  'Lenda',
  'Imortal',
] as const

/** Pontuacao minima de cada degrau, do 2 ao 11. */
const CUTOFFS = [70, 140, 220, 330, 450, 560, 685, 900, 1200, 1500]

export type CareerTotals = {
  matches: number
  goals: number
  assists: number
  titles: number
  ballonDOrs: number
  goldenBoots: number
  worldCups: number
  clubs: number
  caps: number
}

export function careerTotals(state: CareerState): CareerTotals {
  const totals: CareerTotals = {
    matches: 0,
    goals: 0,
    assists: 0,
    titles: 0,
    ballonDOrs: 0,
    goldenBoots: 0,
    worldCups: 0,
    clubs: 0,
    caps: 0,
  }

  const clubs = new Set<string>()

  for (const season of state.seasons) {
    clubs.add(season.clubId)

    totals.matches += season.stats.matches
    totals.goals += season.stats.goals
    totals.assists += season.stats.assists
    totals.titles += season.champion ? 1 : 0

    for (const run of season.cups) {
      totals.matches += run.matches
      totals.goals += run.goals
      totals.assists += run.assists
      totals.titles += run.won ? 1 : 0
    }

    for (const award of season.awards) {
      if (award === 'bola-de-ouro') totals.ballonDOrs++
      if (award === 'chuteira-de-ouro') totals.goldenBoots++
    }

    const national = season.national
    if (national) {
      const caps = nationalTotals(national)

      totals.caps += caps.caps
      totals.goals += caps.goals
      totals.assists += caps.assists

      // Titulo de selecao conta como titulo; a Copa do Mundo conta de novo, a
      // parte, porque a escada pesa ela sozinha.
      if (national.tournament?.won) totals.titles++
      if (wonWorldCup(national)) totals.worldCups++
    }
  }

  totals.clubs = clubs.size
  return totals
}

export function ladderScore(totals: CareerTotals): number {
  return Math.round(
    totals.goals +
      totals.assists * 3 +
      totals.titles * 15 +
      totals.goldenBoots * 20 +
      totals.ballonDOrs * 40 +
      totals.worldCups * 60,
  )
}

/** Degrau alcancado, de 1 a 11. */
export function ladderRung(totals: CareerTotals): number {
  const score = ladderScore(totals)

  let rung = 1
  for (const cutoff of CUTOFFS) {
    if (score >= cutoff) rung++
  }

  // O ultimo degrau exige o premio, nao so volume — e a promessa da home.
  if (rung >= LADDER_LABELS.length && totals.ballonDOrs === 0) {
    rung = LADDER_LABELS.length - 1
  }

  return Math.min(LADDER_LABELS.length, rung)
}

export function ladderLabel(totals: CareerTotals): string {
  return LADDER_LABELS[ladderRung(totals) - 1]
}
