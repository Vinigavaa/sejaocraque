import { clubsInLeague } from './data/clubs'
import type { League } from './data/leagues'
import { clamp } from './positions'
import { jitter, poisson, sample, type Rng } from './rng'
import type { Club, Position } from './types'

export type Standing = {
  clubId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

/** Uma partida da liga, com o placar ja resolvido. */
export type LeagueFixture = {
  homeId: string
  awayId: string
  homeGoals: number
  awayGoals: number
}

export type LeagueOutcome = {
  leagueId: string
  /** Ja ordenada: pontos, saldo, gols pro. */
  standings: Standing[]
  championId: string
  promotedIds: string[]
  relegatedIds: string[]
  /**
   * So os jogos da ultima rodada. O calendario inteiro seriam ~380 objetos por
   * liga por temporada para exibir um; a ultima rodada e a unica que a
   * narracao do jogo decisivo precisa.
   */
  lastRound: LeagueFixture[]
}

export type PlayerSeasonStats = {
  matches: number
  goals: number
  assists: number
  /** Nota media da temporada, 1 casa decimal. */
  rating: number
}

/** Vantagem de jogar em casa, aplicada a expectativa de gols do mandante. */
const HOME_ADVANTAGE = 1.28

/** Gols esperados de um time equilibrado contra outro igual. */
const BASE_GOALS = 1.15

/**
 * Escala da diferenca de forca, em pontos, para dobrar a expectativa de gols.
 *
 * Modelo exponencial sobre a **diferenca**, nao razao. Numa liga com forcas
 * comprimidas — a Premier vai de 72 a 91 — a razao entre os extremos e so
 * 1,26, e o favorito quase nao se destaca: a primeira versao coroou o
 * Newcastle na frente de City, Liverpool e Arsenal. Sobre a diferenca, a
 * mesma distancia pesa igual em qualquer liga.
 */
const STRENGTH_SCALE = 18

/** Acima disso, pontos corridos com turno e returno viram calendario impossivel. */
const DOUBLE_ROUND_ROBIN_LIMIT = 24

/**
 * Quanto a presenca do jogador soma a forca do clube dele nesta competicao.
 *
 * Entra como parametro, e nao somado em `Club.strength`, porque a forca do
 * clube tambem decide quem e titular e serve de referencia para nota, proposta
 * e premio — ver `impact.ts`.
 */
export type ClubBoost = { clubId: string; amount: number }

export function simulateLeague(
  league: League,
  rng: Rng,
  clubs: Club[] = clubsInLeague(league.id),
  boost?: ClubBoost,
): LeagueOutcome {
  const table = new Map<string, Standing>(
    clubs.map((club) => [club.id, emptyStanding(club.id)]),
  )

  const twice = clubs.length <= DOUBLE_ROUND_ROBIN_LIMIT
  const form = seasonForm(clubs, rng, boost)
  // A ordem entra sorteada: o metodo do circulo e deterministico na ordem que
  // recebe, e sem o sorteio o clube enfrentaria o mesmo adversario na ultima
  // rodada de todas as temporadas da carreira.
  const schedule = buildSchedule(sample(rng, clubs, clubs.length), twice)
  let lastRound: LeagueFixture[] = []

  for (const round of schedule) {
    const played: LeagueFixture[] = []

    for (const [home, away] of round) {
      const [homeGoals, awayGoals] = simulateMatch(
        form.get(home.id)!,
        form.get(away.id)!,
        rng,
      )
      record(table.get(home.id)!, homeGoals, awayGoals)
      record(table.get(away.id)!, awayGoals, homeGoals)
      played.push({ homeId: home.id, awayId: away.id, homeGoals, awayGoals })
    }

    lastRound = played
  }

  const standings = [...table.values()].sort(compareStandings)
  const promoted = league.promotionSpots > 0 ? standings.slice(0, league.promotionSpots) : []
  const relegated =
    league.relegationSpots > 0 ? standings.slice(-league.relegationSpots) : []

  return {
    leagueId: league.id,
    standings,
    championId: standings[0].clubId,
    promotedIds: promoted.map((standing) => standing.clubId),
    relegatedIds: relegated.map((standing) => standing.clubId),
    lastRound,
  }
}

/**
 * Calendario em rodadas pelo metodo do circulo.
 *
 * O conjunto de confrontos e o mesmo de um todos-contra-todos: o que o
 * calendario acrescenta e **ordem**, e sem ordem nao existe "ultima rodada"
 * — o jogo que a narracao minuto a minuto precisa quando o clube nao chega a
 * nenhuma final.
 *
 * O metodo fixa o primeiro clube e gira os demais. Com numero impar entra um
 * lugar vazio, que representa a folga da rodada.
 */
export function buildSchedule(clubs: Club[], twice: boolean): [Club, Club][][] {
  if (clubs.length < 2) return []

  const wheel: (Club | null)[] = [...clubs]
  if (wheel.length % 2 === 1) wheel.push(null)

  const half = wheel.length / 2
  const firstLeg: [Club, Club][][] = []

  for (let round = 0; round < wheel.length - 1; round++) {
    const fixtures: [Club, Club][] = []

    for (let i = 0; i < half; i++) {
      const one = wheel[i]
      const other = wheel[wheel.length - 1 - i]
      if (!one || !other) continue

      // Alterna o mando a cada rodada; sem isso o mesmo clube jogaria em casa
      // o campeonato inteiro e a vantagem de mandante viraria vantagem fixa.
      fixtures.push(round % 2 === 0 ? [one, other] : [other, one])
    }

    firstLeg.push(fixtures)

    // Gira mantendo o primeiro no lugar.
    wheel.splice(1, 0, wheel.pop()!)
  }

  if (!twice) return firstLeg

  const secondLeg = firstLeg.map((round) =>
    round.map(([home, away]) => [away, home] as [Club, Club]),
  )

  return [...firstLeg, ...secondLeg]
}

/**
 * Forca efetiva de cada clube naquela temporada.
 *
 * Sem isso o campeao vira funcao pura da tabela de forcas: numa liga onde um
 * clube e muito superior — o PSG a 92 numa Ligue 1 que media 74 — ele ganhava
 * catorze anos seguidos, e titulo deixava de significar qualquer coisa. A
 * variacao de forma reproduz temporada boa e temporada ruim sem precisar
 * modelar elenco, contratacao ou lesao.
 */
const FORM_SPREAD = 0.075

function seasonForm(clubs: Club[], rng: Rng, boost?: ClubBoost): Map<string, number> {
  return new Map(
    clubs.map((club) => [
      club.id,
      // O reforco entra antes da variacao de forma: um ano bom do clube
      // multiplica o time inteiro, jogador incluido.
      boostedStrength(club, boost) * jitter(rng, FORM_SPREAD),
    ]),
  )
}

/**
 * So o participante indicado e reforcado; os adversarios jogam com a forca
 * real. Aceita clube e selecao pela mesma porta.
 */
export function boostedStrength(
  side: { id: string; strength: number },
  boost?: ClubBoost,
): number {
  return side.id === boost?.clubId ? side.strength + boost.amount : side.strength
}

/** Placar de uma partida, a partir da forca efetiva dos dois lados. */
export function simulateMatch(
  homeStrength: number,
  awayStrength: number,
  rng: Rng,
): [number, number] {
  // Dividido pela metade em cada lado: o favorito faz mais e sofre menos,
  // sem inflar o total de gols da partida.
  const edge = Math.exp((homeStrength - awayStrength) / STRENGTH_SCALE / 2)

  return [
    poisson(rng, clamp(BASE_GOALS * edge * HOME_ADVANTAGE, 0.15, 5)),
    poisson(rng, clamp(BASE_GOALS / edge, 0.15, 5)),
  ]
}

/**
 * Producao ofensiva por posicao, em gols e assistencias por jogo, para um
 * jogador de OVR 78 num clube na media da liga. Tudo o mais escala a partir
 * daqui.
 */
const OUTPUT_PER_GAME: Record<Position, { goals: number; assists: number }> = {
  ZAG: { goals: 0.05, assists: 0.03 },
  ALA: { goals: 0.07, assists: 0.2 },
  VOL: { goals: 0.06, assists: 0.1 },
  MC: { goals: 0.14, assists: 0.24 },
  MEI: { goals: 0.26, assists: 0.36 },
  PON: { goals: 0.34, assists: 0.28 },
  SA: { goals: 0.44, assists: 0.24 },
  ATA: { goals: 0.54, assists: 0.14 },
}

export function simulatePlayerSeason(
  input: {
    overall: number
    position: Position
    club: Club
    leagueAverageStrength: number
    totalMatches: number
  },
  rng: Rng,
): PlayerSeasonStats {
  const { overall, position, club, leagueAverageStrength, totalMatches } = input

  const matches = matchesPlayed(overall, club.strength, totalMatches, rng)

  if (matches === 0) {
    return { matches: 0, goals: 0, assists: 0, rating: 0 }
  }

  const { goals, assists } = playerOutput(
    { overall, position, club, leagueAverageStrength, matches },
    rng,
  )

  return {
    matches,
    goals,
    assists,
    rating: ratingFor(overall, club, goals, assists, matches, position),
  }
}

/**
 * Gols e assistencias num numero qualquer de partidas. Fica separado da
 * temporada de liga porque copa e competicao continental somam jogos ao mesmo
 * jogador, com a mesma taxa de producao.
 */
export function playerOutput(
  input: {
    overall: number
    position: Position
    club: Club
    leagueAverageStrength: number
    matches: number
  },
  rng: Rng,
): { goals: number; assists: number } {
  const { overall, position, club, leagueAverageStrength, matches } = input

  if (matches <= 0) return { goals: 0, assists: 0 }

  const quality = Math.pow(overall / 78, 2.2)
  const support = Math.pow(club.strength / leagueAverageStrength, 0.7)
  const output = OUTPUT_PER_GAME[position]

  return {
    goals: poisson(rng, output.goals * matches * quality * support * jitter(rng, 0.18)),
    assists: poisson(
      rng,
      output.assists * matches * quality * support * jitter(rng, 0.22),
    ),
  }
}

/**
 * Quantos jogos o jogador disputa. Quem esta abaixo do nivel do elenco fica no
 * banco; quem esta acima joga quase tudo. E o que torna aceitar uma proposta de
 * clube grande cedo demais uma decisao ruim.
 *
 * A margem de 10 existe porque a forca do clube descreve o **elenco**, nao o
 * titular medio: um OVR 88 no City e estrela, nao reserva. Sem ela o craque no
 * auge jogava 17 dos 38 jogos.
 */
const SQUAD_MARGIN = 10

function matchesPlayed(
  overall: number,
  clubStrength: number,
  totalMatches: number,
  rng: Rng,
): number {
  const gap = overall - clubStrength + SQUAD_MARGIN
  const share = clamp(0.55 + gap / 20, 0.05, 1)

  // O jitter pode passar de 1 — sem o teto o jogador disputava 42 jogos numa
  // liga de 38 rodadas.
  return Math.min(totalMatches, Math.round(totalMatches * share * jitter(rng, 0.12)))
}

/**
 * Nota media da temporada.
 *
 * A primeira versao media producao em valor absoluto, e por isso zagueiro
 * ficava preso perto de 6,3 enquanto atacante subia — nao por jogar pior, mas
 * porque zagueiro nao faz gol. Aqui a producao e comparada com o que a
 * **posicao** produz, entao 2 gols de um zagueiro valem o que 25 de um
 * atacante.
 *
 * A escala foi calibrada para o intervalo real de media de temporada: reserva
 * apagado perto de 5,5, titular comum perto de 6,6, craque em grande ano
 * perto de 7,8. Media de temporada acima de 8 praticamente nao existe no
 * futebol, e o teto reflete isso.
 */
const RATING_BASE = 6.75
const RATING_SPAN = 1.5

/**
 * Limites do desvio de producao. O piso impede que um garoto de 16 anos numa
 * liga fraca desabe abaixo de 5,5, e o teto reflete que media de temporada
 * acima de ~8 nao existe nem para os maiores.
 */
const PRODUCTION_FLOOR = -0.55
const PRODUCTION_CEILING = 0.9

function ratingFor(
  overall: number,
  club: Club,
  goals: number,
  assists: number,
  matches: number,
  position: Position,
): number {
  const expected = OUTPUT_PER_GAME[position]
  const expectedPerGame = expected.goals + expected.assists
  const actualPerGame = (goals + assists) / matches

  const production =
    clamp(
      actualPerGame / expectedPerGame - 1,
      PRODUCTION_FLOOR,
      PRODUCTION_CEILING,
    ) * RATING_SPAN
  // Quem esta acima do nivel do elenco tende a ser decisivo alem do placar.
  const standing = (overall - club.strength) * 0.012

  return Number(clamp(RATING_BASE + production + standing, 4.5, 9.5).toFixed(1))
}

export function averageStrength(clubs: Club[]): number {
  return clubs.reduce((sum, club) => sum + club.strength, 0) / clubs.length
}

/**
 * Jogos que cada clube disputa na liga. Acompanha o mesmo limite de turno
 * unico do calendario: sem isso uma liga de 28 clubes prometia 54 jogos e
 * entregava 27.
 */
export function matchesInLeague(clubCount: number): number {
  return (clubCount - 1) * (clubCount <= DOUBLE_ROUND_ROBIN_LIMIT ? 2 : 1)
}

export function positionInTable(outcome: LeagueOutcome, clubId: string): number {
  return outcome.standings.findIndex((standing) => standing.clubId === clubId) + 1
}

function emptyStanding(clubId: string): Standing {
  return {
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }
}

function record(standing: Standing, scored: number, conceded: number): void {
  standing.played++
  standing.goalsFor += scored
  standing.goalsAgainst += conceded

  if (scored > conceded) {
    standing.won++
    standing.points += 3
  } else if (scored === conceded) {
    standing.drawn++
    standing.points += 1
  } else {
    standing.lost++
  }
}

function compareStandings(a: Standing, b: Standing): number {
  if (b.points !== a.points) return b.points - a.points

  const aDiff = a.goalsFor - a.goalsAgainst
  const bDiff = b.goalsFor - b.goalsAgainst
  if (bDiff !== aDiff) return bDiff - aDiff

  return b.goalsFor - a.goalsFor
}
