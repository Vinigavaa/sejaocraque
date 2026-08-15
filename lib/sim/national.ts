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
import {
  advanceCampaign,
  campaignFixture,
  campaignStatus,
  reachedIn as campaignReached,
  startCampaign,
  type Campaign,
} from './campaign'
import { simulateGroupTournament } from './tournament'
import {
  NATIONS,
  NATIONS_AVERAGE,
  nationById,
  nationsIn,
  type Nation,
} from './data/nations'
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
  tournament: {
    /** Id da competicao, que e por onde a taca e encontrada. */
    id: string
    name: string
    reached: string
    won: boolean
  } | null
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
export const WORLD_CUP_ID = 'world-cup'

const QUALIFIERS_NAME = 'Eliminatórias'
const FRIENDLY_NAME = 'Amistoso'

export type NationalInput = {
  overall: number
  position: Position
  nationality: string
  /**
   * Pontos somados **so** na decisao de convocar, vindos da reputacao.
   *
   * Nao entra na producao nem na nota: quem foi convocado pelo nome joga com o
   * nivel que tem. Sem essa separacao, ser famoso melhoraria o jogador.
   */
  callUpBonus?: number
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

  if (!nation || !isCalledUp(input.overall + (input.callUpBonus ?? 0), nation)) {
    return null
  }

  const context: Context = { input, nation, rng }

  if (isWorldCupSeason(seasonIndex)) {
    return tournamentSeason(
      context,
      { id: WORLD_CUP_ID, name: WORLD_CUP_NAME },
      worldCupEntrants(rng, nation),
    )
  }

  const tournament = isContinentalSeason(seasonIndex)
    ? nationalTournamentFor(nation)
    : undefined

  if (tournament) {
    return tournamentSeason(
      context,
      tournament,
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
  competition: { id: string; name: string },
  entrants: Nation[],
): NationalSeason {
  const { input, nation, rng } = context
  const { name } = competition

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
      id: competition.id,
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
    // Seleção não paga salário: só o motor de desempenho olha este objeto.
    money: 1,
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

// ── O ano de selecao jogado partida a partida ────────────────────────

/**
 * O calendario da selecao no modo Jogo a Jogo.
 *
 * `playNationalSeason` resolve o ano inteiro numa chamada e devolve os
 * placares prontos. Isso serve ao modo Classico, mas deixava a selecao como a
 * unica parte da carreira que o jogador so lia — amistoso, Eliminatoria e
 * final de Copa do Mundo chegavam como resultado.
 *
 * Aqui vale a mesma regra da copa de clube: os compromissos entram como datas
 * no calendario da temporada e sao **jogados**. Amistosos e Eliminatorias sao
 * partidas soltas, sorteadas de uma vez no comeco do ano; o torneio e uma
 * `Campaign`, igual a Libertadores — nacao e clube entram pela mesma porta,
 * que pede so `{ id, strength }`.
 */
export type NationalCalendar = {
  nationId: string
  /** O torneio do ano. `null` em ano de preparacao. */
  tournament: { id: string; name: string } | null
  /** Amistosos e Eliminatorias, na ordem em que serao disputados. */
  exhibitions: { competition: string; opponentId: string }[]
  /** Quantas datas de selecao ja foram fechadas. */
  dateIndex: number
  /**
   * Se o jogador esta entre os relacionados, data a data.
   *
   * Sorteado de uma vez no inicio do ano, e nao no momento de cada partida,
   * porque a lista de compromissos precisa ser a mesma toda vez que a tela
   * pergunta qual e o proximo jogo. A taxa e a mesma do modo Classico: quem
   * passou raspando na convocacao joga um terco do calendario, o craque joga
   * tudo — sem isso, ser convocado pela primeira vez valeria o mesmo que ser
   * titular absoluto.
   */
  squad: boolean[]
  /** O torneio rodada a rodada. `null` em ano de preparacao. */
  campaign: Campaign | null
  /** As partidas ja disputadas, no formato do registro da temporada. */
  matches: NationalMatch[]
}

/**
 * Monta o ano de selecao, ou devolve `null` quando o jogador nao foi
 * convocado.
 *
 * A convocacao e decidida **no comeco** da temporada, e nao no fim: e quando
 * ela de fato acontece, e e o unico momento em que da para pendurar os jogos
 * no calendario. Por isso o peso do nome usado aqui e a reputacao com que o
 * jogador entrou no ano, e nao a que ele terminou.
 */
export function startNationalCalendar(
  input: NationalInput,
  seasonIndex: number,
  rng: Rng,
): NationalCalendar | null {
  const nation = nationById(input.nationality)

  if (!nation || !isCalledUp(input.overall + (input.callUpBonus ?? 0), nation)) {
    return null
  }

  const competition = tournamentOfSeason(nation, seasonIndex, rng)

  const campaign = competition
    ? startCampaign(
        {
          id: competition.id,
          name: competition.name,
          entrants: competition.entrants,
          clubId: nation.id,
          withGroups: true,
        },
        rng,
      )
    : null

  const exhibitions = drawExhibitions(nation, campaign !== null, rng)
  const dates = exhibitions.length + (campaign?.dates ?? 0)
  const share = callUpShare(input.overall, nation)

  return {
    nationId: nation.id,
    tournament: competition ? { id: competition.id, name: competition.name } : null,
    exhibitions,
    dateIndex: 0,
    squad: Array.from({ length: dates }, () => rng() < share),
    campaign,
    matches: [],
  }
}

/** Quantas datas do calendario a selecao ocupa na temporada. */
export function nationalDates(calendar: NationalCalendar): number {
  return calendar.squad.length
}

/** O compromisso da selecao na data atual. */
export type NationalFixture = {
  competition: string
  stage: string | null
  opponentId: string
  opponentName: string
  opponentStrength: number
}

/**
 * O jogo de selecao desta data, ou `null` quando o jogador nao foi relacionado
 * — ou quando a selecao ja caiu do torneio e o que resta nao e mais dela.
 */
export function nationalFixture(calendar: NationalCalendar): NationalFixture | null {
  if (!calendar.squad[calendar.dateIndex]) return null

  const pending = pendingFixture(calendar)
  if (!pending) return null

  const opponent = nationById(pending.opponentId)
  if (!opponent) return null

  return {
    competition: pending.competition,
    stage: pending.stage,
    opponentId: opponent.id,
    opponentName: opponent.name,
    opponentStrength: opponent.strength,
  }
}

/** A selecao do jogador, do jeito que o motor de partida a enxerga. */
export function nationalSide(calendar: NationalCalendar): Nation | undefined {
  return nationById(calendar.nationId)
}

/**
 * Fecha a data de selecao.
 *
 * `played` vem preenchido quando o jogador esteve em campo; sem ele a partida
 * corre pela simulacao e entra no ano como jogo que ele viu de fora —
 * exatamente o que o modo Classico ja registrava.
 */
export function completeNationalDate(
  calendar: NationalCalendar,
  played: {
    forGoals: number
    againstGoals: number
    goals: number
    assists: number
  } | null,
  rng: Rng,
): NationalCalendar {
  const pending = pendingFixture(calendar)
  const next = { ...calendar, dateIndex: calendar.dateIndex + 1 }

  if (!pending) return next

  return pending.kind === 'campanha'
    ? advanceTournamentDate(next, played, rng)
    : advanceExhibitionDate(next, pending, played, rng)
}

/** O ano fechado, no formato que o registro da temporada ja entende. */
export function finishNationalSeason(calendar: NationalCalendar): NationalSeason {
  const { campaign, tournament } = calendar

  return {
    nationId: calendar.nationId,
    matches: calendar.matches,
    tournament:
      campaign && tournament
        ? {
            id: tournament.id,
            name: tournament.name,
            reached: campaignReached(campaign),
            won: campaign.winnerId === calendar.nationId,
          }
        : null,
  }
}

// ── Detalhes do calendario ───────────────────────────────────────────

type PendingFixture =
  | { kind: 'avulso'; competition: string; stage: null; opponentId: string }
  | { kind: 'campanha'; competition: string; stage: string; opponentId: string }

/**
 * O compromisso pendente, antes de olhar se o jogador foi relacionado.
 *
 * Amistosos e Eliminatorias vem primeiro, e o torneio depois: e a ordem do
 * calendario real, e a mesma que `playNationalSeason` ja produzia.
 */
function pendingFixture(calendar: NationalCalendar): PendingFixture | null {
  const { exhibitions, dateIndex, campaign } = calendar

  if (dateIndex < exhibitions.length) {
    const fixture = exhibitions[dateIndex]
    return { kind: 'avulso', ...fixture, stage: null }
  }

  if (!campaign) return null

  const fixture = campaignFixture(campaign)
  if (!fixture) return null

  return {
    kind: 'campanha',
    competition: calendar.tournament?.name ?? '',
    stage: fixture.stage,
    opponentId: fixture.opponentId,
  }
}

function advanceExhibitionDate(
  calendar: NationalCalendar,
  pending: { competition: string; opponentId: string },
  played: { forGoals: number; againstGoals: number; goals: number; assists: number } | null,
  rng: Rng,
): NationalCalendar {
  const nation = nationById(calendar.nationId)
  const opponent = nationById(pending.opponentId)
  if (!nation || !opponent) return calendar

  const [forGoals, againstGoals] = played
    ? [played.forGoals, played.againstGoals]
    : simulateMatch(
        nation.strength * jitter(rng, 0.07),
        opponent.strength * jitter(rng, 0.07),
        rng,
      )

  return {
    ...calendar,
    matches: [
      ...calendar.matches,
      {
        competition: pending.competition,
        stage: null,
        opponentName: opponent.name,
        forGoals,
        againstGoals,
        onPenalties: false,
        won: forGoals > againstGoals,
        played: played !== null,
        goals: played?.goals ?? 0,
        assists: played?.assists ?? 0,
      },
    ],
  }
}

/**
 * Uma rodada do torneio.
 *
 * A partida entra no registro do ano a partir do caminho que a campanha acabou
 * de gravar — a mesma fonte que o modo Classico usa, entao os dois modos
 * descrevem a campanha do mesmo jeito. Depois de a selecao cair, a competicao
 * segue sozinha ate o campeao e nada mais e registrado: aqueles jogos nao sao
 * mais dela.
 */
function advanceTournamentDate(
  calendar: NationalCalendar,
  played: { forGoals: number; againstGoals: number; goals: number; assists: number } | null,
  rng: Rng,
): NationalCalendar {
  const { campaign } = calendar
  if (!campaign) return calendar

  const advanced = advanceCampaign(
    campaign,
    played ? { forGoals: played.forGoals, againstGoals: played.againstGoals } : null,
    rng,
  )

  const fresh = advanced.path.slice(campaign.path.length)

  return {
    ...calendar,
    campaign: advanced,
    matches: [
      ...calendar.matches,
      ...fresh.map((match) => ({
        competition: calendar.tournament?.name ?? '',
        stage: match.stage,
        opponentName: nationById(match.opponentId)?.name ?? match.opponentId,
        forGoals: match.forGoals,
        againstGoals: match.againstGoals,
        onPenalties: match.onPenalties,
        won: match.won,
        played: played !== null,
        goals: played?.goals ?? 0,
        assists: played?.assists ?? 0,
      })),
    ],
  }
}

/** O torneio do ano e quem o disputa, ou `undefined` em ano de preparacao. */
function tournamentOfSeason(
  nation: Nation,
  seasonIndex: number,
  rng: Rng,
): { id: string; name: string; entrants: Nation[] } | undefined {
  if (isWorldCupSeason(seasonIndex)) {
    return {
      id: WORLD_CUP_ID,
      name: WORLD_CUP_NAME,
      entrants: worldCupEntrants(rng, nation),
    }
  }

  const tournament = isContinentalSeason(seasonIndex)
    ? nationalTournamentFor(nation)
    : undefined

  if (!tournament) return undefined

  return {
    id: tournament.id,
    name: tournament.name,
    entrants: nationalTournamentEntrants(tournament, rng, nation),
  }
}

/**
 * Amistosos e Eliminatorias do ano.
 *
 * Em ano de torneio a agenda encolhe, como no calendario real: sobra espaco
 * para dois ou tres amistosos de preparacao e mais nada.
 */
function drawExhibitions(
  nation: Nation,
  hasTournament: boolean,
  rng: Rng,
): { competition: string; opponentId: string }[] {
  const others = NATIONS.filter((other) => other.id !== nation.id)
  const rivals = nationsIn(nation.confederation).filter((other) => other.id !== nation.id)
  const pool = rivals.length > 0 ? rivals : others

  const friendlies = Array.from(
    { length: hasTournament ? range(rng, 2, 3) : range(rng, 2, 4) },
    () => ({ competition: FRIENDLY_NAME, opponentId: pick(rng, others).id }),
  )

  if (hasTournament) return friendlies

  return [
    ...friendlies,
    ...Array.from({ length: range(rng, 4, 6) }, () => ({
      competition: QUALIFIERS_NAME,
      opponentId: pick(rng, pool).id,
    })),
  ]
}

/**
 * Que fracao dos jogos da selecao o jogador disputa.
 *
 * Mesma conta de `withPlayer`, que e o caminho do modo Classico: as duas
 * precisam concordar, senao o mesmo jogador teria dois numeros de jogos pela
 * selecao dependendo do modo em que a carreira foi jogada.
 */
function callUpShare(overall: number, nation: Nation): number {
  return clamp(0.5 + (overall - nation.strength + CALL_UP_MARGIN) / 24, 0.15, 1)
}

/**
 * Onde o ano de selecao esta agora, em uma linha.
 *
 * Fica no motor pelo mesmo motivo de `campaignStatus`: quem sabe se a selecao
 * caiu, em que fase, ou se o ano e de preparacao e o calendario, nao a tela.
 */
export function nationalStatus(calendar: NationalCalendar): string {
  const { campaign } = calendar

  if (!campaign) return 'Eliminatórias e amistosos'
  if (campaign.winnerId === calendar.nationId) return 'Campeão'
  if (campaign.eliminatedIn) return `Eliminado · ${campaign.eliminatedIn}`

  return calendar.dateIndex < calendar.exhibitions.length
    ? 'Amistosos de preparação'
    : campaignStatus(campaign)
}
