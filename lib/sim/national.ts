/**
 * O ano de selecao, partida a partida.
 *
 * A versao anterior resolvia um ano inteiro com `caps = range(rng, 6, 10)`: um
 * numero, sem adversario, sem placar e sem competicao. O jogador via "8 jogos"
 * e nao sabia se aquilo foi Eliminatoria, amistoso ou Copa America — porque o
 * motor tambem nao sabia.
 *
 * Aqui a partida e a unidade. Tudo o que a interface mostra do ano — quantos
 * jogos, quantos gols, qual campeonato — sai da lista, e nao de campos
 * paralelos que poderiam divergir dela.
 */

import {
  CALL_UP_MARGIN,
  isCalledUp,
  isContinentalSeason,
  isWorldCupSeason,
  nationalTournamentEntrants,
  nationalTournamentFor,
  worldCupEntrants,
  type KnockoutMatch,
  type KnockoutResult,
} from './competitions'
import { simulateGroupTournament } from './tournament'
import { NATIONS, nationById, nationsIn, type Nation } from './data/nations'
import { clubLift } from './impact'
import { buildTimeline, type LiveEvent, type NarratableMatch } from './liveMatch'
import { clamp } from './positions'
import { createRng, jitter, pick, range, type Rng } from './rng'
import { playerOutput, simulateMatch } from './season'
import type { Club, Position } from './types'

export type NationalMatch = {
  competition: string
  /** Fase, no mata-mata. Null em amistoso e eliminatoria. */
  stage: string | null
  opponentName: string
  forGoals: number
  againstGoals: number
  onPenalties: boolean
  /**
   * Se a selecao venceu a partida. Nao da para derivar do placar: um mata-mata
   * empatado no tempo normal e decidido nos penaltis, e ai o placar sozinho nao
   * diz quem passou.
   */
  won: boolean
  /** Se o jogador entrou em campo. Quando falso, gols e assistencias sao 0. */
  played: boolean
  goals: number
  assists: number
}

export type NationalSeason = {
  nationId: string
  matches: NationalMatch[]
  /** O torneio do ano, quando houve. Null em ano de preparacao. */
  tournament: { name: string; reached: string; won: boolean } | null
}

export type NationalTotals = { caps: number; goals: number; assists: number }

/**
 * Os numeros do ano. Contam so as partidas em que o jogador entrou: estar na
 * lista e nao jogar nao e uma convocacao no sentido que o jogador entende.
 */
export function nationalTotals(national: NationalSeason): NationalTotals {
  const totals: NationalTotals = { caps: 0, goals: 0, assists: 0 }

  for (const match of national.matches) {
    if (!match.played) continue

    totals.caps++
    totals.goals += match.goals
    totals.assists += match.assists
  }

  return totals
}

/** Verdadeiro quando a selecao ganhou a Copa do Mundo naquele ano. */
export function wonWorldCup(national: NationalSeason): boolean {
  return national.tournament?.name === WORLD_CUP_NAME && national.tournament.won
}

export const WORLD_CUP_NAME = 'Copa do Mundo'

const QUALIFIERS_NAME = 'Eliminatórias'
const FRIENDLY_NAME = 'Amistoso'

const NATIONS_AVERAGE =
  NATIONS.reduce((sum, nation) => sum + nation.strength, 0) / NATIONS.length

export type NationalInput = {
  overall: number
  position: Position
  nationality: string
}

/**
 * O ano da selecao. Null quando o jogador nao foi convocado — que continua
 * sendo uma decisao do ano inteiro: quem esta muito abaixo do nivel da selecao
 * nem entra na lista.
 */
export function playNationalSeason(
  input: NationalInput,
  seasonIndex: number,
  rng: Rng,
): NationalSeason | null {
  const nation = nationById(input.nationality)

  if (!nation || !isCalledUp(input.overall, nation)) {
    return null
  }

  const context: Context = { input, nation, rng }

  if (isWorldCupSeason(seasonIndex)) {
    return tournamentSeason(context, WORLD_CUP_NAME, worldCupEntrants(rng, nation))
  }

  const tournament = isContinentalSeason(seasonIndex)
    ? nationalTournamentFor(nation)
    : undefined

  if (tournament) {
    return tournamentSeason(
      context,
      tournament.name,
      nationalTournamentEntrants(tournament, rng, nation),
    )
  }

  return preparationSeason(context)
}

type Context = { input: NationalInput; nation: Nation; rng: Rng }

/**
 * Ano de preparacao: Eliminatorias contra a propria confederacao e amistosos
 * contra qualquer um. E o que preenche os anos em que nao ha torneio — antes
 * eles eram identicos aos outros, um lote de numeros sem nome.
 */
function preparationSeason(context: Context): NationalSeason {
  const { nation, rng } = context

  const rivals = nationsIn(nation.confederation).filter((other) => other.id !== nation.id)
  const others = NATIONS.filter((other) => other.id !== nation.id)

  const matches: NationalMatch[] = [
    ...friendlies(context, range(rng, 2, 4)),
    ...Array.from({ length: range(rng, 4, 6) }, () =>
      exhibition(context, QUALIFIERS_NAME, pick(rng, rivals.length > 0 ? rivals : others)),
    ),
  ]

  return { nationId: nation.id, matches, tournament: null }
}

/**
 * Ano de torneio. A campanha vem do mata-mata ja resolvido: as partidas do
 * caminho da selecao viram as partidas do ano, na ordem das fases.
 */
function tournamentSeason(
  context: Context,
  name: string,
  entrants: Nation[],
): NationalSeason {
  const { input, nation, rng } = context

  const outcome = simulateGroupTournament(entrants, rng, {
    clubId: nation.id,
    amount: clubLift(input.overall, nation.strength, 1),
  })

  const path = outcome.paths.get(nation.id) ?? []
  const won = outcome.winnerId === nation.id

  const matches: NationalMatch[] = [
    ...friendlies(context, range(rng, 2, 3)),
    ...path.map((match) => fromKnockout(context, name, match)),
  ]

  return {
    nationId: nation.id,
    matches,
    tournament: {
      name,
      reached: reachedIn(outcome, nation.id, won),
      won,
    },
  }
}

function reachedIn(outcome: KnockoutResult, id: string, won: boolean): string {
  if (won) return 'Campeão'
  return outcome.eliminatedIn.get(id) ?? 'Não se classificou'
}

function fromKnockout(
  context: Context,
  competition: string,
  match: KnockoutMatch,
): NationalMatch {
  return withPlayer(context, {
    competition,
    stage: match.stage,
    opponentName: nationById(match.opponentId)?.name ?? match.opponentId,
    forGoals: match.forGoals,
    againstGoals: match.againstGoals,
    onPenalties: match.onPenalties,
    won: match.won,
  })
}

function friendlies(context: Context, count: number): NationalMatch[] {
  const others = NATIONS.filter((other) => other.id !== context.nation.id)

  return Array.from({ length: count }, () =>
    exhibition(context, FRIENDLY_NAME, pick(context.rng, others)),
  )
}

/** Uma partida fora de mata-mata: aceita empate, e o placar decide sozinho. */
function exhibition(
  context: Context,
  competition: string,
  opponent: Nation,
): NationalMatch {
  const { nation, rng } = context

  const [forGoals, againstGoals] = simulateMatch(
    nation.strength * jitter(rng, 0.07),
    opponent.strength * jitter(rng, 0.07),
    rng,
  )

  return withPlayer(context, {
    competition,
    stage: null,
    opponentName: opponent.name,
    forGoals,
    againstGoals,
    onPenalties: false,
    won: forGoals > againstGoals,
  })
}

/**
 * Sorteia se o jogador entrou em campo e, se entrou, o que ele produziu.
 *
 * A chance vem da mesma folga que decide a convocacao: quem passou raspando
 * joga um terco do calendario, o craque joga tudo. Antes disso, estar na lista
 * significava jogar exatamente o mesmo lote todo ano.
 */
function withPlayer(
  context: Context,
  fixture: Omit<NationalMatch, 'played' | 'goals' | 'assists'>,
): NationalMatch {
  const { input, nation, rng } = context

  const gap = input.overall - nation.strength + CALL_UP_MARGIN
  const share = clamp(0.5 + gap / 24, 0.15, 1)

  if (rng() >= share) {
    return { ...fixture, played: false, goals: 0, assists: 0 }
  }

  const asContender: Club = {
    id: nation.id,
    name: nation.name,
    leagueId: 'selecao',
    strength: nation.strength,
  }

  const { goals, assists } = playerOutput(
    {
      overall: input.overall,
      position: input.position,
      club: asContender,
      leagueAverageStrength: NATIONS_AVERAGE,
      matches: 1,
    },
    rng,
  )

  return { ...fixture, played: true, goals, assists }
}

/**
 * A narracao de uma partida de selecao.
 *
 * A semente inclui a temporada e o indice da partida, entao o mesmo jogo narra
 * igual toda vez que for aberto — sem guardar nenhuma lista de lances no estado
 * da carreira.
 */
export function nationalTimeline(
  national: NationalSeason,
  index: number,
  input: { seed: string; seasonLabel: string; playerName: string },
): LiveEvent[] {
  const match = national.matches[index]
  if (!match) return []

  const narratable: NarratableMatch = {
    teamName: nationById(national.nationId)?.name ?? national.nationId,
    opponentName: match.opponentName,
    teamGoals: match.forGoals,
    opponentGoals: match.againstGoals,
    stage: match.stage,
    onPenalties: match.onPenalties,
    won: match.won,
    played: match.played,
    // A producao e da propria partida, entao a taxa de atribuicao e exata.
    playerMatches: match.played ? 1 : 0,
    playerGoals: match.goals,
    playerAssists: match.assists,
  }

  return buildTimeline(
    narratable,
    input.playerName,
    createRng(`${input.seed}:selecao:${input.seasonLabel}:${index}`),
  )
}

/** A final do torneio do ano, pelo lado da selecao. Null quando nao houve. */
export function nationalFinal(national: NationalSeason): NationalMatch | null {
  if (!national.tournament) return null

  return (
    national.matches.find(
      (match) => match.competition === national.tournament?.name && match.stage === 'Final',
    ) ?? null
  )
}
