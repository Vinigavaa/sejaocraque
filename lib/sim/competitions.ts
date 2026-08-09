import { CLUBS, clubsInLeague, leagueOf } from './data/clubs'
import { LEAGUES } from './data/leagues'
import {
  NATIONS,
  nationsIn,
  WORLD_CUP_SLOTS,
  type Confederation,
  type Nation,
} from './data/nations'
import { jitter, sample, type Rng } from './rng'
import { boostedStrength, simulateMatch, type ClubBoost } from './season'
import type { Club } from './types'

/**
 * Mata-mata, usado por copa nacional e competicao continental.
 *
 * Chave simples de eliminacao direta, sorteada a cada rodada. Nao ha
 * cabeca de chave nem jogo de ida e volta: os dois adicionam calendario e
 * regra sem mudar o que o jogador ve, que e ate onde o clube dele foi.
 */
/** Uma partida do mata-mata, pelo lado de quem se pergunta. */
export type KnockoutMatch = {
  stage: string
  opponentId: string
  forGoals: number
  againstGoals: number
  /** Verdadeiro quando o placar empatou e o desempate decidiu. */
  onPenalties: boolean
  won: boolean
}

export type KnockoutResult = {
  winnerId: string
  /** Nome da fase em que cada participante caiu. O campeao nao aparece. */
  eliminatedIn: Map<string, string>
  /**
   * O caminho de cada participante, na ordem das fases. Vazio para quem ficou
   * fora da chave.
   *
   * Quantos jogos alguem fez e qual foi a final sao projecoes disto — guardar
   * os tres em campos separados seria a mesma informacao em triplicata.
   */
  paths: Map<string, KnockoutMatch[]>
}

/** Quantas partidas o participante disputou na competicao. */
export function matchesIn(result: KnockoutResult, id: string): number {
  return result.paths.get(id)?.length ?? 0
}

/** A final pelo lado do participante, ou null para quem nao chegou la. */
export function finalIn(result: KnockoutResult, id: string): KnockoutMatch | null {
  return result.paths.get(id)?.find((match) => match.stage === FINAL_STAGE) ?? null
}

const FINAL_STAGE = 'Final'

/**
 * Minimo que o mata-mata precisa saber. Clube e selecao entram pela mesma
 * porta — a Copa do Mundo e o mesmo algoritmo da Copa do Brasil.
 */
export type Contender = { id: string; strength: number }

/** Nome da fase pelo numero de clubes ainda vivos. */
function roundName(remaining: number): string {
  switch (remaining) {
    case 2:
      return FINAL_STAGE
    case 4:
      return 'Semifinal'
    case 8:
      return 'Quartas de final'
    case 16:
      return 'Oitavas de final'
    case 32:
      return 'Terceira fase'
    default:
      return 'Fase inicial'
  }
}

export function simulateKnockout<T extends Contender>(
  entrants: T[],
  rng: Rng,
  boost?: ClubBoost,
): KnockoutResult {
  const eliminatedIn = new Map<string, string>()
  const paths = new Map<string, KnockoutMatch[]>(entrants.map((club) => [club.id, []]))

  const record = (id: string, match: KnockoutMatch) => {
    paths.get(id)?.push(match)
  }

  // A chave precisa de potencia de dois; o excedente entra ja classificado,
  // que e o equivalente pratico de um bye.
  let alive = sample(rng, entrants, largestPowerOfTwo(entrants.length))

  while (alive.length > 1) {
    const phase = roundName(alive.length)
    const drawn = sample(rng, alive, alive.length)
    const survivors: T[] = []

    for (let i = 0; i < drawn.length; i += 2) {
      const [home, away] = [drawn[i], drawn[i + 1]]

      const tie = playTie(home, away, rng, boost)
      survivors.push(tie.winner)
      eliminatedIn.set(tie.loser.id, phase)

      record(tie.winner.id, {
        stage: phase,
        opponentId: tie.loser.id,
        forGoals: tie.winnerGoals,
        againstGoals: tie.loserGoals,
        onPenalties: tie.onPenalties,
        won: true,
      })
      record(tie.loser.id, {
        stage: phase,
        opponentId: tie.winner.id,
        forGoals: tie.loserGoals,
        againstGoals: tie.winnerGoals,
        onPenalties: tie.onPenalties,
        won: false,
      })
    }

    alive = survivors
  }

  return { winnerId: alive[0].id, eliminatedIn, paths }
}

/**
 * Mata-mata nao aceita empate. O placar decide; empate vai para um desempate
 * ponderado pela forca, que e o efeito liquido de prorrogacao e penaltis.
 */
function playTie<T extends Contender>(
  home: T,
  away: T,
  rng: Rng,
  boost?: ClubBoost,
): {
  winner: T
  loser: T
  winnerGoals: number
  loserGoals: number
  onPenalties: boolean
} {
  const homeForm = boostedStrength(home, boost) * jitter(rng, 0.09)
  const awayForm = boostedStrength(away, boost) * jitter(rng, 0.09)

  const [homeGoals, awayGoals] = simulateMatch(homeForm, awayForm, rng)

  const homeWon =
    homeGoals !== awayGoals
      ? homeGoals > awayGoals
      : rng() < homeForm / (homeForm + awayForm)

  return {
    winner: homeWon ? home : away,
    loser: homeWon ? away : home,
    winnerGoals: homeWon ? homeGoals : awayGoals,
    loserGoals: homeWon ? awayGoals : homeGoals,
    onPenalties: homeGoals === awayGoals,
  }
}

function largestPowerOfTwo(count: number): number {
  return 2 ** Math.floor(Math.log2(Math.max(2, count)))
}

// ── Copa nacional ────────────────────────────────────────────────────

/**
 * Todos os clubes do pais, de todas as divisoes mapeadas. E o que permite o
 * time da Serie C eliminar o da Serie A — a graca da copa.
 */
export function nationalCupEntrants(country: string): Club[] {
  return CLUBS.filter((club) => leagueOf(club).country === country)
}

export function nationalCupName(country: string): string {
  return NATIONAL_CUP_NAME[country] ?? 'Copa Nacional'
}

/**
 * Traduz o id de competicao da simulacao para o id da imagem em
 * `public/badges/competitions/`.
 *
 * A copa nacional e sempre `'copa'`, sem o pais — quem distingue a Copa do
 * Brasil da FA Cup e a liga em que o jogador estava. As continentais ja usam
 * o proprio id.
 */
export function competitionImageId(runId: string, leagueId: string): string {
  if (runId !== 'copa') return runId
  const country = LEAGUES.find((league) => league.id === leagueId)?.country
  return country ? `cup-${country}` : runId
}

const NATIONAL_CUP_NAME: Record<string, string> = {
  BR: 'Copa do Brasil',
  EN: 'FA Cup',
  ES: 'Copa del Rey',
  IT: 'Coppa Italia',
  DE: 'DFB-Pokal',
  FR: 'Coupe de France',
  PT: 'Taça de Portugal',
  NL: 'KNVB Beker',
  AR: 'Copa Argentina',
  MX: 'Copa MX',
  US: 'US Open Cup',
  TR: 'Türkiye Kupası',
  SA: "King's Cup",
}

// ── Competicoes continentais ─────────────────────────────────────────

/**
 * Competicao continental de clube.
 *
 * `positions` e a faixa de colocacao na **primeira divisao** que da a vaga:
 * a Champions pega do 1o ao 4o, a Europa o 5o e o 6o, a Conference o 7o e o
 * 8o. E o que impede um clube da segunda divisao de aparecer na Champions —
 * quem nao disputou a primeira divisao nao tem colocacao nessa faixa.
 *
 * As faixas nao se sobrepoem dentro da mesma confederacao, e a ordem do array
 * vai da competicao mais importante para a menos importante.
 */
export type Continental = {
  id: string
  name: string
  /** Paises cujos clubes disputam. */
  countries: string[]
  /** Faixa de colocacao na primeira divisao que classifica, inclusiva. */
  positions: [from: number, to: number]
}

const UEFA_COUNTRIES = ['EN', 'ES', 'IT', 'DE', 'FR', 'PT', 'NL', 'TR']

export const CONTINENTALS: Continental[] = [
  {
    id: 'ucl',
    name: 'Champions League',
    countries: UEFA_COUNTRIES,
    positions: [1, 4],
  },
  {
    id: 'uel',
    name: 'Europa League',
    countries: UEFA_COUNTRIES,
    positions: [5, 6],
  },
  {
    id: 'uecl',
    name: 'Conference League',
    countries: UEFA_COUNTRIES,
    positions: [7, 8],
  },
  {
    id: 'libertadores',
    name: 'Libertadores',
    countries: ['BR', 'AR'],
    positions: [1, 6],
  },
  {
    id: 'sudamericana',
    name: 'Sul-Americana',
    countries: ['BR', 'AR'],
    positions: [7, 12],
  },
  {
    id: 'concachampions',
    name: 'Concachampions',
    countries: ['MX', 'US'],
    positions: [1, 8],
  },
  {
    id: 'afc',
    name: 'AFC Champions League',
    countries: ['SA'],
    positions: [1, 8],
  },
]

export function continentalById(id: string): Continental | undefined {
  return CONTINENTALS.find((competition) => competition.id === id)
}

/** As competicoes continentais que o pais disputa, da maior para a menor. */
export function continentalsFor(country: string): Continental[] {
  return CONTINENTALS.filter((competition) => competition.countries.includes(country))
}

/**
 * A competicao a que a colocacao na primeira divisao da direito.
 *
 * `country` precisa ser o pais da liga em que a colocacao foi conquistada, e a
 * colocacao precisa ser de uma primeira divisao — quem chama e responsavel por
 * essa checagem, que e onde a regra de divisao de fato mora.
 */
export function continentalByPosition(
  country: string,
  tablePosition: number,
): Continental | undefined {
  return continentalsFor(country).find(
    (competition) =>
      tablePosition >= competition.positions[0] &&
      tablePosition <= competition.positions[1],
  )
}

/**
 * A competicao continental que o titulo da copa nacional garante.
 *
 * No futebol real o campeao da copa vai para a segunda competicao do
 * continente (Europa League, Sul-Americana). Onde a confederacao so tem uma,
 * ele vai para ela mesma.
 */
export function continentalForCupWinner(country: string): Continental | undefined {
  const competitions = continentalsFor(country)
  return competitions[1] ?? competitions[0]
}

/**
 * Quem disputa a competicao continental.
 *
 * Os classificados sao os clubes de cada primeira divisao cuja forca os coloca
 * na faixa de colocacao da competicao — aproximacao suficiente, ja que o jogo
 * nao guarda a tabela do ano anterior de todas as ligas. O clube do jogador
 * entra pela colocacao real dele, que e a unica que o jogo de fato simulou.
 */
export function continentalEntrants(
  competition: Continental,
  playerClub?: Club,
): Club[] {
  const [from, to] = competition.positions
  const entrants: Club[] = []

  for (const country of competition.countries) {
    const topLeague = LEAGUES.find(
      (league) => league.country === country && league.tier === 1,
    )
    if (!topLeague) continue

    const ranked = [...clubsInLeague(topLeague.id)].sort(
      (a, b) => b.strength - a.strength,
    )

    entrants.push(...ranked.slice(from - 1, to))
  }

  if (playerClub && !entrants.some((club) => club.id === playerClub.id)) {
    entrants.push(playerClub)
  }

  return entrants
}

/**
 * A vaga que o clube teria pela forca dele na propria liga.
 *
 * Serve para os momentos em que o jogo nao simulou a temporada anterior do
 * clube: o comeco da carreira e a transferencia. A vaga e do clube, nao do
 * jogador — quem sai do campeao europeu para um clube de meio de tabela perde
 * a Champions junto com a camisa.
 */
export function continentalSpotOfClub(club: Club, leagueId: string): string | null {
  const league = LEAGUES.find((item) => item.id === leagueId)
  if (!league || league.tier !== 1) return null

  const ranked = [...clubsInLeague(league.id)].sort((a, b) => b.strength - a.strength)
  const position = ranked.findIndex((other) => other.id === club.id) + 1
  if (position === 0) return null

  return continentalByPosition(league.country, position)?.id ?? null
}

// ── Selecao e Copa do Mundo ──────────────────────────────────────────

/** A primeira temporada e 2026-27; a Copa cai de quatro em quatro anos. */
export const FIRST_WORLD_CUP_SEASON = 3

export function isWorldCupSeason(seasonIndex: number): boolean {
  return seasonIndex >= FIRST_WORLD_CUP_SEASON &&
    (seasonIndex - FIRST_WORLD_CUP_SEASON) % 4 === 0
}

/**
 * Margem de convocacao. Um OVR ate 12 pontos abaixo da forca da selecao ainda
 * entra na lista: e o que faz jogar por Brasil ou Franca ser mais dificil que
 * jogar por Catar, sem precisar de elenco nacional.
 */
export const CALL_UP_MARGIN = 12

export function isCalledUp(overall: number, nation: Nation): boolean {
  return overall >= nation.strength - CALL_UP_MARGIN
}

/**
 * Quem disputa a Copa. As selecoes mais fortes com uma variacao de forma que
 * abre espaco para zebra na eliminatoria — sem isso as mesmas 32 iriam a
 * todas as Copas da carreira.
 */
export function worldCupEntrants(rng: Rng, guaranteed?: Nation): Nation[] {
  return rankedEntrants(NATIONS, WORLD_CUP_SLOTS, rng, guaranteed)
}

/**
 * As selecoes mais fortes do grupo, com uma variacao de forma que abre espaco
 * para zebra na classificacao — sem isso as mesmas selecoes iriam a todos os
 * torneios da carreira.
 */
function rankedEntrants(
  pool: Nation[],
  slots: number,
  rng: Rng,
  guaranteed?: Nation,
): Nation[] {
  const ranked = [...pool]
    .map((nation) => ({ nation, seed: nation.strength * jitter(rng, 0.08) }))
    .sort((a, b) => b.seed - a.seed)
    .slice(0, slots)
    .map((entry) => entry.nation)

  if (guaranteed && !ranked.some((nation) => nation.id === guaranteed.id)) {
    ranked[ranked.length - 1] = guaranteed
  }

  return ranked
}

// ── Torneios continentais de selecao ─────────────────────────────────

/** O torneio da confederacao, disputado no meio do ciclo da Copa. */
export type NationalTournament = {
  id: string
  name: string
  confederation: Confederation
  slots: number
}

const NATIONAL_TOURNAMENTS: NationalTournament[] = [
  { id: 'euro', name: 'Eurocopa', confederation: 'UEFA', slots: 16 },
  { id: 'copa-america', name: 'Copa América', confederation: 'CONMEBOL', slots: 8 },
  { id: 'can', name: 'Copa Africana', confederation: 'CAF', slots: 8 },
  { id: 'asian-cup', name: 'Copa Asiática', confederation: 'AFC', slots: 8 },
  { id: 'gold-cup', name: 'Copa Ouro', confederation: 'CONCACAF', slots: 8 },
]

/** Abaixo disso a chave nao se forma e o ano vira ano de preparacao. */
const MIN_TOURNAMENT_ENTRANTS = 4

export function nationalTournamentFor(nation: Nation): NationalTournament | undefined {
  const tournament = NATIONAL_TOURNAMENTS.find(
    (item) => item.confederation === nation.confederation,
  )

  if (!tournament) return undefined

  return nationsIn(nation.confederation).length >= MIN_TOURNAMENT_ENTRANTS
    ? tournament
    : undefined
}

export function nationalTournamentEntrants(
  tournament: NationalTournament,
  rng: Rng,
  guaranteed?: Nation,
): Nation[] {
  return rankedEntrants(nationsIn(tournament.confederation), tournament.slots, rng, guaranteed)
}

/**
 * O torneio continental cai dois anos depois da Copa — indices 1, 5, 9, contra
 * os 3, 7, 11 da Copa. Os indices pares sobram para Eliminatorias e amistosos.
 */
export function isContinentalSeason(seasonIndex: number): boolean {
  return seasonIndex % 4 === 1
}
