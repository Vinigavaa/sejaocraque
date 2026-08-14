import {
  advanceCampaign,
  campaignFixture,
  finalOf,
  reachedIn,
  startCampaign,
  type Campaign,
} from './campaign'
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
import type { CompetitionRun, Contender } from './competitions'
import type { Club, Position } from './types'

/**
 * A temporada disputada jogo a jogo.
 *
 * No modo classico `simulateLeague` resolve o campeonato inteiro de uma vez, e
 * a producao do jogador e apurada antes da tabela. Aqui a ordem se inverte: a
 * tabela e construida rodada por rodada, e a partida do clube do jogador nao e
 * simulada — ela e **jogada**, e o placar dela entra na tabela como qualquer
 * outro.
 *
 * O calendario nao e so a liga. Copa nacional e competicao continental entram
 * como datas no meio das rodadas, do mesmo jeito que entram na temporada de
 * verdade: o jogador disputa tudo aquilo para que o clube dele esta
 * classificado, e cada um desses jogos e jogado, nao sorteado.
 *
 * O que continua igual, de proposito: o calendario da liga e o mesmo metodo do
 * circulo, a forca de forma e a mesma, e o fechamento da tabela e literalmente
 * a mesma funcao. Duas carreiras em modos diferentes disputam o mesmo
 * campeonato — muda quem decide as partidas do clube do jogador.
 */

/** Uma data do calendario: rodada de liga ou rodada de uma competicao. */
export type SeasonDate = { kind: 'liga' } | { kind: 'copa'; campaignId: string }

export type MatchdayLog = {
  /** Id da competicao: a liga, `'copa'` ou a continental. */
  competitionId: string
  competitionName: string
  /** Fase do mata-mata. `null` em rodada de pontos corridos. */
  stage: string | null
  round: number
  opponentId: string
  atHome: boolean
  teamGoals: number
  opponentGoals: number
  player: PlayerMatchResult
}

export type MatchdaySeason = {
  leagueId: string
  leagueName: string
  clubId: string
  /** Calendario da liga, em rodadas. */
  rounds: LeagueFixture[][]
  /** Rodada de liga atual, base zero. */
  roundIndex: number
  table: Standing[]
  log: MatchdayLog[]
  /** Forca de forma de cada clube na temporada. */
  form: [string, number][]
  /** Copa nacional e continentais em que o clube esta classificado. */
  campaigns: Campaign[]
  /** Liga e copas na ordem em que sao disputadas. */
  dates: SeasonDate[]
  /** Data atual, base zero. */
  dateIndex: number
}

/** Uma competicao de mata-mata que o clube disputa nesta temporada. */
export type SeasonCompetition = {
  id: string
  name: string
  entrants: Contender[]
  /** Continental tem fase de grupos; copa nacional e mata-mata direto. */
  withGroups: boolean
}

export function startMatchdaySeason(input: {
  league: League
  clubs: Club[]
  clubId: string
  seed: string
  seasonIndex: number
  /** Copa nacional e continental. Vazio quando o clube nao disputa nenhuma. */
  competitions: SeasonCompetition[]
}): MatchdaySeason {
  const rng = createRng(`${input.seed}:calendario:${input.seasonIndex}`)
  const { clubs, league } = input

  const twice = matchesInLeague(clubs.length) === (clubs.length - 1) * 2
  const schedule = buildSchedule(sample(rng, clubs, clubs.length), twice)

  const campaigns = input.competitions.map((competition) =>
    startCampaign({ ...competition, clubId: input.clubId }, rng),
  )

  return {
    leagueId: league.id,
    leagueName: league.name,
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
    campaigns,
    dates: buildCalendar(schedule.length, campaigns),
    dateIndex: 0,
  }
}

/**
 * O calendario da temporada, com as datas de copa espalhadas entre as rodadas
 * da liga.
 *
 * Espalhar importa: empilhadas no fim, as cinco rodadas da Copa do Brasil
 * viravam um torneio depois do campeonato, e nao uma temporada. As competicoes
 * tambem se intercalam entre si, para que uma fase de grupos inteira nao caia
 * antes de a copa comecar.
 */
function buildCalendar(leagueRounds: number, campaigns: Campaign[]): SeasonDate[] {
  const queues = campaigns.map((campaign) =>
    Array.from({ length: campaign.dates }, (): SeasonDate => ({
      kind: 'copa',
      campaignId: campaign.id,
    })),
  )

  const cupDates: SeasonDate[] = []
  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const date = queue.shift()
      if (date) cupDates.push(date)
    }
  }

  const dates: SeasonDate[] = []
  let cursor = 0

  for (let round = 0; round < leagueRounds; round++) {
    dates.push({ kind: 'liga' })

    const due = Math.round(((round + 1) / leagueRounds) * cupDates.length)
    while (cursor < due) dates.push(cupDates[cursor++])
  }

  while (cursor < cupDates.length) dates.push(cupDates[cursor++])

  return dates
}

export function isSeasonOver(state: MatchdaySeason): boolean {
  return state.dateIndex >= state.dates.length
}

/** O compromisso do clube do jogador na data atual, ou `null` quando nao ha. */
export type NextFixture = {
  competitionId: string
  competitionName: string
  /** Fase do mata-mata, `null` na liga. */
  stage: string | null
  opponentId: string
  atHome: boolean
  /** Rodada da liga. `null` fora dela. */
  round: number | null
}

export function nextFixture(state: MatchdaySeason): NextFixture | null {
  if (isSeasonOver(state)) return null

  const date = state.dates[state.dateIndex]

  if (date.kind === 'copa') {
    const campaign = campaignOf(state, date.campaignId)
    const fixture = campaign ? campaignFixture(campaign) : null
    if (!campaign || !fixture) return null

    return {
      competitionId: campaign.id,
      competitionName: campaign.name,
      stage: fixture.stage,
      opponentId: fixture.opponentId,
      atHome: fixture.atHome,
      round: null,
    }
  }

  const fixture = state.rounds[state.roundIndex]?.find(
    (match) => match.homeId === state.clubId || match.awayId === state.clubId,
  )

  // Numa liga de numero impar de clubes o metodo do circulo deixa um time de
  // folga por rodada. Sem jogo, a rodada corre sozinha e a proxima e buscada.
  if (!fixture) return null

  const atHome = fixture.homeId === state.clubId

  return {
    competitionId: state.leagueId,
    competitionName: state.leagueName,
    stage: null,
    opponentId: atHome ? fixture.awayId : fixture.homeId,
    atHome,
    round: state.roundIndex + 1,
  }
}

function campaignOf(state: MatchdaySeason, id: string): Campaign | undefined {
  return state.campaigns.find((campaign) => campaign.id === id)
}

/** Monta o que o motor de partida precisa saber para a proxima data. */
export function setupForNext(
  state: MatchdaySeason,
  player: {
    name: string
    position: Position
    overall: number
    attrs: MatchSetup['attrs']
  },
  club: Club,
  leagueAverageStrength: number,
): MatchSetup | null {
  const next = nextFixture(state)
  if (!next) return null

  const opponent = clubById(next.opponentId)
  if (!opponent) return null

  return {
    competition: next.competitionName,
    stage: next.stage,
    round: next.round ?? state.roundIndex + 1,
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
 * Fecha a data atual e devolve a temporada na data seguinte.
 *
 * Numa rodada de liga isso significa gravar a partida do jogador e simular
 * todas as outras. Numa data de copa, resolver a rodada inteira da competicao
 * — inclusive quando o clube ja caiu, porque a competicao segue sem ele e o
 * mundo precisa saber quem levantou a taca.
 *
 * `played` vem nulo quando o clube nao tinha jogo na data, e entao tudo corre
 * pela simulacao — que e exatamente o que acontece no modo Classico.
 */
export function completeDate(
  state: MatchdaySeason,
  played: { teamGoals: number; opponentGoals: number; player: PlayerMatchResult } | null,
  rng: Rng,
): MatchdaySeason {
  if (isSeasonOver(state)) return state

  const date = state.dates[state.dateIndex]
  const next = date.kind === 'copa' ? completeCupDate(state, date.campaignId, played, rng)
    : completeLeagueRound(state, played, rng)

  return { ...next, dateIndex: state.dateIndex + 1 }
}

function completeCupDate(
  state: MatchdaySeason,
  campaignId: string,
  played: { teamGoals: number; opponentGoals: number; player: PlayerMatchResult } | null,
  rng: Rng,
): MatchdaySeason {
  const campaign = campaignOf(state, campaignId)
  if (!campaign) return state

  const fixture = campaignFixture(campaign)
  const score = fixture && played
    ? { forGoals: played.teamGoals, againstGoals: played.opponentGoals }
    : null

  const advanced = advanceCampaign(campaign, score, rng)

  const log =
    fixture && played
      ? [
          ...state.log,
          {
            competitionId: campaign.id,
            competitionName: campaign.name,
            stage: fixture.stage,
            round: state.roundIndex + 1,
            opponentId: fixture.opponentId,
            atHome: fixture.atHome,
            teamGoals: played.teamGoals,
            opponentGoals: played.opponentGoals,
            player: played.player,
          },
        ]
      : state.log

  return {
    ...state,
    log,
    campaigns: state.campaigns.map((item) => (item.id === campaignId ? advanced : item)),
  }
}

function completeLeagueRound(
  state: MatchdaySeason,
  played: { teamGoals: number; opponentGoals: number; player: PlayerMatchResult } | null,
  rng: Rng,
): MatchdaySeason {
  const form = new Map(state.form)
  const table = new Map(state.table.map((row) => [row.clubId, { ...row }]))
  const round = state.rounds[state.roundIndex] ?? []
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
          competitionId: state.leagueId,
          competitionName: state.leagueName,
          stage: null,
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
 * `stats` conta **so a liga**, como no modo Classico — copa e continental vem
 * em `cups`, cada uma com os proprios numeros. Sem essa separacao o resumo
 * somaria os gols de copa duas vezes.
 *
 * `winners` leva os campeoes das competicoes que o jogador disputou para o
 * mundo, para que elas nao sejam sorteadas de novo la com outro vencedor.
 */
export function finishMatchdaySeason(
  state: MatchdaySeason,
  league: League,
): {
  outcome: LeagueOutcome
  stats: PlayerSeasonStats
  cups: CompetitionRun[]
  winners: Record<string, string>
} {
  const outcome = finalizeLeague(
    league,
    state.table,
    state.rounds[state.rounds.length - 1] ?? [],
  )

  const winners: Record<string, string> = {}
  for (const campaign of state.campaigns) {
    if (campaign.winnerId) winners[campaign.id] = campaign.winnerId
  }

  return {
    outcome,
    stats: statsFromLog(state.log.filter((entry) => entry.competitionId === state.leagueId)),
    cups: state.campaigns.map((campaign) => runFrom(campaign, state.log)),
    winners,
  }
}

function runFrom(campaign: Campaign, log: MatchdayLog[]): CompetitionRun {
  const played = log.filter(
    (entry) => entry.competitionId === campaign.id && entry.player.played,
  )
  const final = finalOf(campaign)

  return {
    id: campaign.id,
    name: campaign.name,
    matches: played.length,
    reached: reachedIn(campaign),
    won: campaign.winnerId === campaign.clubId,
    goals: played.reduce((sum, entry) => sum + entry.player.goals, 0),
    assists: played.reduce((sum, entry) => sum + entry.player.assists, 0),
    final: final
      ? {
          opponentId: final.opponentId,
          opponentName: clubById(final.opponentId)?.name ?? final.opponentId,
          forGoals: final.forGoals,
          againstGoals: final.againstGoals,
          onPenalties: final.onPenalties,
        }
      : null,
  }
}

/** Os numeros somados jogo a jogo. */
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
