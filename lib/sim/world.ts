import { CLUBS, clubById } from './data/clubs'
import { leagueBelow, LEAGUES, type League } from './data/leagues'
import {
  continentalByPosition,
  continentalForCupWinner,
  continentalsFor,
  nationalCupEntrants,
  simulateKnockout,
  type Continental,
} from './competitions'
import type { Rng } from './rng'
import { simulateLeague, type LeagueOutcome } from './season'
import { simulateGroupTournament } from './tournament'
import type { Club } from './types'

/**
 * O mundo fora da carreira.
 *
 * Ate aqui o jogo simulava **uma** liga por temporada: a do jogador. As outras
 * dezenove ficavam congeladas no retrato de 2025-26 dos dados, ninguem subia,
 * ninguem caia, e a vaga continental de cada clube era deduzida da forca do
 * elenco em vez de sair de uma tabela de verdade. Trocar de clube revelava a
 * costura: o jogador saia de uma Serie A que ele viu acontecer e entrava numa
 * Serie B que nunca tinha sido jogada.
 *
 * `WorldState` guarda o que a simulacao de uma temporada muda no mundo e os
 * dados estaticos nao sabem: em que divisao cada clube esta hoje e que
 * competicao continental ele conquistou o direito de disputar. Tudo o mais —
 * nome, forca, dinheiro — continua vindo de `CLUBS`, que e um retrato de
 * partida e nao precisa de historico.
 *
 * O clube do jogador nao tem tratamento especial nenhum aqui: a temporada dele
 * entra como a de qualquer outro, ja disputada, e o resto do mundo e resolvido
 * em volta com as mesmas regras.
 */
export type WorldState = {
  /** Divisao atual de cada clube, por id. */
  divisions: Record<string, string>
  /**
   * Vaga continental conquistada na temporada anterior, por clube. Ausente
   * para quem nao conquistou nenhuma — a maioria.
   */
  continental: Record<string, string>
  /** Campeao de cada liga na ultima temporada processada. */
  champions: Record<string, string>
  /** Campeao da copa nacional de cada pais na ultima temporada. */
  cupWinners: Record<string, string>
  /** Campeao de cada competicao continental na ultima temporada. */
  continentalWinners: Record<string, string>
}

/**
 * O mundo no dia em que a carreira comeca.
 *
 * As divisoes saem dos dados. As vagas continentais saem da forca do elenco,
 * porque nao existe temporada anterior para consultar — e a mesma aproximacao
 * que o jogo ja usava, agora aplicada uma unica vez, no inicio, em vez de
 * todo ano.
 */
export function startWorld(): WorldState {
  const divisions: Record<string, string> = {}
  for (const club of CLUBS) divisions[club.id] = club.leagueId

  const continental: Record<string, string> = {}

  for (const league of LEAGUES) {
    if (league.tier !== 1) continue
    if (continentalsFor(league.country).length === 0) continue

    const ranked = CLUBS.filter((club) => divisions[club.id] === league.id).sort(
      (a, b) => b.strength - a.strength,
    )

    assignContinentalSpots(
      league.country,
      ranked.map((club) => club.id),
      null,
      null,
      continental,
    )
  }

  return {
    divisions,
    continental,
    champions: {},
    cupWinners: {},
    continentalWinners: {},
  }
}

/** Os clubes que disputam a divisao nesta temporada. */
export function clubsInDivision(world: WorldState, leagueId: string): Club[] {
  return CLUBS.filter((club) => divisionOf(world, club.id) === leagueId)
}

/** A divisao em que o clube esta hoje. */
export function divisionOf(world: WorldState, clubId: string): string {
  return world.divisions[clubId] ?? clubById(clubId)?.leagueId ?? ''
}

/** A competicao continental que o clube disputa nesta temporada, se alguma. */
export function continentalOf(world: WorldState, clubId: string): string | null {
  return world.continental[clubId] ?? null
}

/**
 * Uma competicao ja disputada, que nao deve ser simulada de novo.
 *
 * E por esta porta que a temporada do jogador entra no mundo: a liga dele foi
 * jogada rodada a rodada (ou simulada de uma vez, no classico) e as copas
 * dele podem ter sido decididas partida a partida. Reaproveitar o resultado,
 * em vez de sortear outro, e o que impede o clube do jogador de ser campeao
 * na tela e rebaixado no mundo.
 */
export type PlayedCompetitions = {
  league?: LeagueOutcome
  /** Campeao das copas que o jogador disputou, por id de competicao. */
  winners?: Record<string, string>
}

export type WorldSeason = {
  world: WorldState
  /** Tabela final de cada liga, por id. */
  outcomes: Record<string, LeagueOutcome>
}

/**
 * Roda a temporada inteira do mundo e devolve o mundo do ano seguinte.
 *
 * A ordem importa e e a mesma do futebol: primeiro as ligas, depois as copas
 * (que dependem de quem estava em cada divisao), depois acesso e
 * rebaixamento, e so entao as vagas continentais — que sao das tabelas que
 * acabaram de fechar e valem para a temporada que vem.
 */
export function advanceWorld(
  world: WorldState,
  rng: Rng,
  played: PlayedCompetitions = {},
): WorldSeason {
  const outcomes: Record<string, LeagueOutcome> = {}

  for (const league of LEAGUES) {
    outcomes[league.id] =
      played.league?.leagueId === league.id
        ? played.league
        : simulateLeague(league, rng, clubsInDivision(world, league.id))
  }

  const cupWinners = playNationalCups(world, rng, played)
  const continentalWinners = playContinentals(world, rng, played)
  const divisions = applyPromotions(world.divisions, outcomes)

  return {
    world: {
      divisions,
      continental: nextContinentalSpots(
        divisions,
        outcomes,
        cupWinners,
        continentalWinners,
      ),
      champions: Object.fromEntries(
        Object.values(outcomes).map((outcome) => [outcome.leagueId, outcome.championId]),
      ),
      cupWinners,
      continentalWinners,
    },
    outcomes,
  }
}

/** A copa nacional de cada pais que tem uma. */
function playNationalCups(
  world: WorldState,
  rng: Rng,
  played: PlayedCompetitions,
): Record<string, string> {
  const winners: Record<string, string> = {}

  for (const country of countriesWithLeagues()) {
    // A copa do pais do jogador pode ter sido disputada por ele. Ela nao
    // aparece aqui com o id do pais, e sim como `'copa'` — so existe uma por
    // carreira, e ela e sempre a do pais em que ele esta jogando.
    const alreadyPlayed = played.winners?.[cupKey(country)]

    if (alreadyPlayed) {
      winners[country] = alreadyPlayed
      continue
    }

    const entrants = nationalCupEntrants(country)
    if (entrants.length < 2) continue

    winners[country] = simulateKnockout(entrants, rng).winnerId
  }

  return winners
}

/**
 * A chave de copa nacional do mundo e indexada pelo pais; a campanha do
 * jogador usa sempre o id `'copa'`. Esta funcao e a unica traducao entre as
 * duas — sem ela a copa do pais do jogador seria simulada duas vezes, com
 * dois campeoes diferentes.
 */
export function cupKey(country: string): string {
  return `copa:${country}`
}

function playContinentals(
  world: WorldState,
  rng: Rng,
  played: PlayedCompetitions,
): Record<string, string> {
  const winners: Record<string, string> = {}

  for (const competition of continentalCompetitions()) {
    const alreadyPlayed = played.winners?.[competition.id]

    if (alreadyPlayed) {
      winners[competition.id] = alreadyPlayed
      continue
    }

    const entrants = qualifiedFor(world, competition.id)
    if (entrants.length < 2) continue

    winners[competition.id] = simulateGroupTournament(entrants, rng).winnerId
  }

  return winners
}

/** Os clubes com vaga na competicao continental nesta temporada. */
export function qualifiedFor(world: WorldState, competitionId: string): Club[] {
  return CLUBS.filter((club) => world.continental[club.id] === competitionId)
}

/** Todas as competicoes continentais, sem repetir. */
function continentalCompetitions(): Continental[] {
  const seen = new Map<string, Continental>()

  for (const country of countriesWithLeagues()) {
    for (const competition of continentalsFor(country)) {
      seen.set(competition.id, competition)
    }
  }

  return [...seen.values()]
}

function countriesWithLeagues(): string[] {
  return [...new Set(LEAGUES.map((league) => league.country))]
}

/**
 * Acesso e rebaixamento, divisao por divisao.
 *
 * A troca e simetrica: quem cai de uma divisao ocupa exatamente a vaga de quem
 * sobe da de baixo. E o que mantem o tamanho de cada campeonato constante ao
 * longo da carreira inteira — sem isso a Serie A encolheria um clube por ano.
 */
function applyPromotions(
  divisions: Record<string, string>,
  outcomes: Record<string, LeagueOutcome>,
): Record<string, string> {
  const next = { ...divisions }

  for (const league of LEAGUES) {
    const below = leagueBelow(league)
    if (!below) continue

    const promoted = outcomes[below.id]?.promotedIds ?? []
    const relegated = outcomes[league.id]?.relegatedIds ?? []
    const swaps = Math.min(promoted.length, relegated.length)

    for (let index = 0; index < swaps; index++) {
      next[promoted[index]] = league.id
      next[relegated[index]] = below.id
    }
  }

  return next
}

/**
 * As vagas continentais da temporada que vem, para o mundo inteiro.
 *
 * Vale para todo clube, e nao so para o do jogador: e isto que permite o
 * Botafogo cair, o Coritiba subir e a Libertadores do ano seguinte refletir as
 * duas coisas mesmo que o jogador esteja na Inglaterra.
 */
function nextContinentalSpots(
  divisions: Record<string, string>,
  outcomes: Record<string, LeagueOutcome>,
  cupWinners: Record<string, string>,
  continentalWinners: Record<string, string>,
): Record<string, string> {
  const spots: Record<string, string> = {}

  for (const league of LEAGUES) {
    if (league.tier !== 1) continue

    const outcome = outcomes[league.id]
    if (!outcome) continue

    // Quem caiu perde a vaga que a colocacao daria — e a regra real, e e o que
    // impede um rebaixado de aparecer na Champions.
    const ranked = outcome.standings
      .map((standing) => standing.clubId)
      .filter((clubId) => divisions[clubId] === league.id)

    const champion = championFromCountry(league.country, continentalWinners, divisions)

    assignContinentalSpots(
      league.country,
      ranked,
      cupWinners[league.country] ?? null,
      champion,
      spots,
    )
  }

  return spots
}

/**
 * O campeao continental do pais, quando ele continua na primeira divisao.
 *
 * Ganhar a competicao garante a vaga do ano seguinte na principal do
 * continente, como no futebol de verdade — mas nao salva quem caiu.
 */
function championFromCountry(
  country: string,
  continentalWinners: Record<string, string>,
  divisions: Record<string, string>,
): string | null {
  for (const competition of continentalsFor(country)) {
    const winner = continentalWinners[competition.id]
    if (!winner) continue

    const league = LEAGUES.find((item) => item.id === divisions[winner])
    if (league?.country === country && league.tier === 1) return winner
  }

  return null
}

/**
 * Distribui as vagas de um pais entre as competicoes do continente.
 *
 * Titulo vem antes de colocacao — campeao continental e campeao da copa entram
 * primeiro — e a vaga que eles ocupam sai da cota da competicao, nao por cima
 * dela. E por isso que o campeao da copa que terminou em decimo empurra a
 * fila: o sexto colocado herda a vaga que sobrou, exatamente como acontece na
 * classificacao real.
 */
function assignContinentalSpots(
  country: string,
  ranked: string[],
  cupWinnerId: string | null,
  continentalChampionId: string | null,
  into: Record<string, string>,
): void {
  const competitions = continentalsFor(country)
  if (competitions.length === 0) return

  const remaining = new Map(
    competitions.map((competition) => [
      competition.id,
      competition.positions[1] - competition.positions[0] + 1,
    ]),
  )

  const give = (clubId: string, competitionId: string) => {
    const left = remaining.get(competitionId) ?? 0
    if (left <= 0 || into[clubId]) return

    into[clubId] = competitionId
    remaining.set(competitionId, left - 1)
  }

  if (continentalChampionId && ranked.includes(continentalChampionId)) {
    give(continentalChampionId, competitions[0].id)
  }

  const byCup = continentalForCupWinner(country)

  if (byCup && cupWinnerId && ranked.includes(cupWinnerId)) {
    // A vaga da copa nao rebaixa ninguem: quem terminou o campeonato dentro da
    // faixa de uma competicao maior entra por ela, e a vaga da copa desce para
    // o proximo da fila.
    const byPosition = continentalByPosition(country, ranked.indexOf(cupWinnerId) + 1)
    const keepsPosition =
      byPosition !== undefined &&
      competitions.indexOf(byPosition) <= competitions.indexOf(byCup)

    if (!keepsPosition) give(cupWinnerId, byCup.id)
  }

  let cursor = 0

  for (const competition of competitions) {
    while ((remaining.get(competition.id) ?? 0) > 0 && cursor < ranked.length) {
      const clubId = ranked[cursor++]
      if (into[clubId]) continue

      give(clubId, competition.id)
    }
  }
}

/** A liga da divisao atual do clube, ja resolvida. */
export function leagueOfClub(world: WorldState, clubId: string): League | undefined {
  return LEAGUES.find((league) => league.id === divisionOf(world, clubId))
}
