import { clubById } from './data/clubs'
import type { League } from './data/leagues'
import { clamp } from './positions'
import { createRng, sample, type Rng } from './rng'
import {
  buildSchedule,
  emptyStanding,
  expectedOutputPerMatch,
  finalizeLeague,
  matchesInLeague,
  record,
  seasonForm,
  simulateMatch,
  type LeagueFixture,
  type LeagueOutcome,
  type PlayerSeasonStats,
  type Standing,
} from './season'
import type { MatchSetup, PlayerMatchResult } from './liveMatch'
import type { Club, Position } from './types'

/**
 * A temporada de liga disputada rodada a rodada.
 *
 * No modo classico `simulateLeague` resolve o campeonato inteiro de uma vez, e
 * a producao do jogador e apurada antes da tabela. Aqui a ordem se inverte: a
 * tabela e construida rodada por rodada, e a partida do clube do jogador nao e
 * simulada — ela e **jogada**, e o placar dela entra na tabela como qualquer
 * outro.
 *
 * O que continua igual, de proposito: o calendario e o mesmo metodo do
 * circulo, a forca de forma e a mesma, e o fechamento da tabela e literalmente
 * a mesma funcao. Duas carreiras em modos diferentes disputam o mesmo
 * campeonato — muda quem decide um dos jogos de cada rodada.
 */

export type MatchdayLog = {
  round: number
  opponentId: string
  atHome: boolean
  teamGoals: number
  opponentGoals: number
  player: PlayerMatchResult
}

export type MatchdaySeason = {
  leagueId: string
  clubId: string
  /** Calendario completo, em rodadas. */
  rounds: LeagueFixture[][]
  /** Rodada atual, base zero. */
  roundIndex: number
  table: Standing[]
  log: MatchdayLog[]
  /** Forca de forma de cada clube na temporada. */
  form: [string, number][]
}

export function startMatchdaySeason(input: {
  league: League
  clubs: Club[]
  clubId: string
  seed: string
  seasonIndex: number
}): MatchdaySeason {
  const rng = createRng(`${input.seed}:calendario:${input.seasonIndex}`)
  const { clubs, league } = input

  const twice = matchesInLeague(clubs.length) === (clubs.length - 1) * 2
  const schedule = buildSchedule(sample(rng, clubs, clubs.length), twice)

  return {
    leagueId: league.id,
    clubId: input.clubId,
    rounds: schedule.map((round) =>
      round.map(([home, away]) => ({
        homeId: home.id,
        awayId: away.id,
        homeGoals: 0,
        awayGoals: 0,
      })),
    ),
    roundIndex: 0,
    table: clubs.map((club) => emptyStanding(club.id)),
    log: [],
    form: [...seasonForm(clubs, rng)],
  }
}

export function isSeasonOver(state: MatchdaySeason): boolean {
  return state.roundIndex >= state.rounds.length
}

/** O proximo jogo do clube do jogador, ou null quando a temporada acabou. */
export function nextFixture(
  state: MatchdaySeason,
): { opponentId: string; atHome: boolean; round: number } | null {
  if (isSeasonOver(state)) return null

  const fixture = state.rounds[state.roundIndex].find(
    (match) => match.homeId === state.clubId || match.awayId === state.clubId,
  )

  // Numa liga de numero impar de clubes o metodo do circulo deixa um time de
  // folga por rodada. Sem jogo, a rodada corre sozinha e a proxima e buscada.
  if (!fixture) return null

  const atHome = fixture.homeId === state.clubId
  return {
    opponentId: atHome ? fixture.awayId : fixture.homeId,
    atHome,
    round: state.roundIndex + 1,
  }
}

/** Monta o que o motor de partida precisa saber para a proxima rodada. */
export function setupForNext(
  state: MatchdaySeason,
  player: {
    name: string
    position: Position
    overall: number
    attrs: MatchSetup['attrs']
  },
  club: Club,
  leagueName: string,
  leagueAverageStrength: number,
): MatchSetup | null {
  const next = nextFixture(state)
  if (!next) return null

  const opponent = clubById(next.opponentId)
  if (!opponent) return null

  return {
    competition: leagueName,
    stage: null,
    round: next.round,
    playerName: player.name,
    position: player.position,
    overall: player.overall,
    attrs: player.attrs,
    team: { name: club.name, clubId: club.id, strength: club.strength },
    opponent: { name: opponent.name, clubId: opponent.id, strength: opponent.strength },
    atHome: next.atHome,
    expected: expectedOutputPerMatch({
      overall: player.overall,
      position: player.position,
      club,
      leagueAverageStrength,
    }),
  }
}

/**
 * Fecha a rodada: grava a partida do jogador e simula todas as outras.
 *
 * Quando o clube do jogador esta de folga, `played` vem nulo e a rodada corre
 * inteira pela simulacao — que e exatamente o que acontece no modo classico.
 */
export function completeRound(
  state: MatchdaySeason,
  played: { teamGoals: number; opponentGoals: number; player: PlayerMatchResult } | null,
  rng: Rng,
): MatchdaySeason {
  if (isSeasonOver(state)) return state

  const form = new Map(state.form)
  const table = new Map(state.table.map((row) => [row.clubId, { ...row }]))
  const round = state.rounds[state.roundIndex]
  const resolved: LeagueFixture[] = []
  let log = state.log

  for (const fixture of round) {
    const isPlayerMatch =
      fixture.homeId === state.clubId || fixture.awayId === state.clubId

    let homeGoals: number
    let awayGoals: number

    if (isPlayerMatch && played) {
      const atHome = fixture.homeId === state.clubId
      homeGoals = atHome ? played.teamGoals : played.opponentGoals
      awayGoals = atHome ? played.opponentGoals : played.teamGoals

      log = [
        ...log,
        {
          round: state.roundIndex + 1,
          opponentId: atHome ? fixture.awayId : fixture.homeId,
          atHome,
          teamGoals: played.teamGoals,
          opponentGoals: played.opponentGoals,
          player: played.player,
        },
      ]
    } else {
      ;[homeGoals, awayGoals] = simulateMatch(
        form.get(fixture.homeId) ?? 70,
        form.get(fixture.awayId) ?? 70,
        rng,
      )
    }

    record(table.get(fixture.homeId)!, homeGoals, awayGoals)
    record(table.get(fixture.awayId)!, awayGoals, homeGoals)
    resolved.push({ ...fixture, homeGoals, awayGoals })
  }

  const rounds = [...state.rounds]
  rounds[state.roundIndex] = resolved

  return {
    ...state,
    rounds,
    roundIndex: state.roundIndex + 1,
    table: [...table.values()],
    log,
  }
}

/**
 * A temporada fechada, no formato que o resto da carreira ja entende.
 *
 * Devolve exatamente o que `simulateLeague` e `simulatePlayerSeason`
 * devolveriam — e por isso `playSeason` consegue aceitar as duas origens sem
 * nenhuma ramificacao depois deste ponto.
 */
export function finishMatchdaySeason(
  state: MatchdaySeason,
  league: League,
): { outcome: LeagueOutcome; stats: PlayerSeasonStats } {
  const outcome = finalizeLeague(
    league,
    state.table,
    state.rounds[state.rounds.length - 1] ?? [],
  )

  return { outcome, stats: statsFromLog(state.log) }
}

/** Os numeros da temporada somados jogo a jogo. */
export function statsFromLog(log: MatchdayLog[]): PlayerSeasonStats {
  const played = log.filter((entry) => entry.player.played)

  if (played.length === 0) {
    return { matches: 0, goals: 0, assists: 0, rating: 0 }
  }

  const goals = played.reduce((sum, entry) => sum + entry.player.goals, 0)
  const assists = played.reduce((sum, entry) => sum + entry.player.assists, 0)
  const rating = played.reduce((sum, entry) => sum + entry.player.rating, 0) / played.length

  return {
    matches: played.length,
    goals,
    assists,
    rating: Number(clamp(rating, 1, 10).toFixed(1)),
  }
}
