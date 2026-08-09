import { CLUBS, clubById, clubsByCountry, clubsInLeague, leagueOf } from './data/clubs'
import {
  competitionImageId,
  continentalById,
  continentalByPosition,
  continentalEntrants,
  continentalForCupWinner,
  continentalSpotOfClub,
  continentalsFor,
  finalIn,
  matchesIn,
  nationalCupEntrants,
  nationalCupName,
  simulateKnockout,
  type Continental,
  type KnockoutResult,
} from './competitions'
import { resolveAwards, type Award, type AwardsInput } from './awards'
import { nationById } from './data/nations'
import {
  nationalFinal,
  nationalTotals,
  playNationalSeason,
  wonWorldCup,
  type NationalSeason,
} from './national'
import { leagueAbove, leagueBelow, leagueById, type League } from './data/leagues'
import { clubLift } from './impact'
import { clamp, overallFor } from './positions'
import { applyTraining, currentOverall, retirementAge, START_AGE } from './progression'
import { createRng, pick, type Rng } from './rng'
import {
  averageStrength,
  matchesInLeague,
  playerOutput,
  positionInTable,
  simulateLeague,
  simulatePlayerSeason,
  type LeagueFixture,
  type LeagueOutcome,
  type PlayerSeasonStats,
} from './season'
import { simulateGroupTournament } from './tournament'
import {
  buildOffers,
  type TransferOffer,
  type TransferPreferences,
} from './transfers'
import { ALL_ATTRS, type Attr, type Club, type PlayerAttrs, type Position } from './types'

export const FIRST_SEASON = 2026

export type CareerConfig = {
  seed: string
  name: string
  /** Codigo do pais escolhido na criacao. Nem todo pais tem liga no jogo. */
  nationality: string
  position: Position
  shirtNumber: number
  /** Atributos vindos do draft — sao o **auge**, nao o valor atual. */
  peakAttrs: PlayerAttrs
}

/** Quem nem entrou na chave da competicao. */
const NOT_ENTERED = 'Não entrou na chave'

/** O placar de uma final, pelo lado do time do jogador. */
export type FinalScore = {
  opponentId: string
  opponentName: string
  forGoals: number
  againstGoals: number
  onPenalties: boolean
}

/** Uma campanha de mata-mata dentro de uma temporada. */
export type CompetitionRun = {
  id: string
  name: string
  matches: number
  /** Fase em que o clube caiu, ou "Campeao". */
  reached: string
  won: boolean
  goals: number
  assists: number
  /** Preenchido so quando o clube do jogador chegou a final. */
  final: FinalScore | null
}

/**
 * O jogo que decide a temporada, ja resolvido, pronto para ser narrado.
 *
 * O placar vem da simulacao que ja aconteceu: a narracao minuto a minuto
 * **revela** este resultado, nunca o produz.
 */
export type DecisiveMatch = {
  /** Nome da competicao, ex: "Champions League". */
  competition: string
  /** Fase, ex: "Final" ou "Ultima rodada". */
  stage: string
  teamName: string
  opponentName: string
  /**
   * Ids dos clubes, para o escudo. Null na final de selecao, em que os dois
   * lados sao paises e quem identifica e a bandeira.
   */
  teamClubId: string | null
  opponentClubId: string | null
  teamGoals: number
  opponentGoals: number
  /** Null em final de mata-mata, que e campo neutro. */
  atHome: boolean | null
  onPenalties: boolean
  won: boolean
  /** Se o jogador esteve em campo **neste** jogo. */
  played: boolean
  /**
   * Producao do jogador na competicao inteira, e em quantos jogos. E daqui que
   * sai a taxa usada para atribuir a ele um dos gols ja contados da partida —
   * a narracao recorta numeros existentes, nunca soma novos.
   */
  playerMatches: number
  playerGoals: number
  playerAssists: number
}

export type SeasonRecord = {
  /** Rotulo da temporada, ex: "2026-27". */
  label: string
  age: number
  clubId: string
  leagueId: string
  overall: number
  stats: PlayerSeasonStats
  tablePosition: number
  champion: boolean
  promoted: boolean
  relegated: boolean
  trainingFocus: Attr | null
  /** Atributos que subiram na temporada. Vazio quando o treino nao rendeu. */
  growth: AttrGrowth[]
  /** Quanto a presenca do jogador somou a forca do clube na liga. */
  clubLift: number
  /** Valor de mercado ao fim da temporada, em milhoes de euros. */
  marketValue: number
  /** Copa nacional e, quando classificado, competicao continental. */
  cups: CompetitionRun[]
  /** Null quando o jogador nao foi convocado. */
  national: NationalSeason | null
  /** Premios individuais conquistados na temporada. */
  awards: Award[]
  /** O jogo que decidiu a temporada. Null quando nao houve nenhum narravel. */
  decisive: DecisiveMatch | null
}

export type AttrGrowth = { attr: Attr; from: number; to: number }

export type CareerState = {
  config: CareerConfig
  /** Auge atual — o treino mexe aqui, a idade escala na hora de exibir. */
  peakAttrs: PlayerAttrs
  age: number
  clubId: string
  /**
   * A divisao em que o clube do jogador esta disputando.
   *
   * Fica no estado da carreira, e nao em `Club.leagueId`, porque um clube sobe
   * e desce ao longo de uma carreira e os dados sao estaticos. Antes disso o
   * acesso trocava o **jogador** de clube para representar a divisao nova — o
   * jogador ia dormir no Ypiranga e acordava em outro time sem ter pedido para
   * sair.
   */
  leagueId: string
  seasonIndex: number
  seasons: SeasonRecord[]
  retiresAt: number
  retired: boolean
  /** Propostas na mesa. Vazio quando ninguem procurou o jogador. */
  offers: TransferOffer[]
  /**
   * A competicao continental que o clube conquistou na temporada anterior, ou
   * `null` quando nao conquistou nenhuma. A vaga vale para o ano seguinte,
   * como no futebol de verdade.
   */
  continentalId: string | null
  /** Destinos pedidos ao empresario. Vazio = procura em qualquer lugar. */
  preferences: TransferPreferences
}

export function startCareer(config: CareerConfig): CareerState {
  const rng = careerRng(config.seed, 'inicio')
  const club = pickStartingClub(config, rng)
  const league = leagueOf(club)

  return {
    config,
    peakAttrs: config.peakAttrs,
    age: START_AGE,
    clubId: club.id,
    leagueId: league.id,
    seasonIndex: 0,
    seasons: [],
    retiresAt: retirementAge(config.peakAttrs, rng),
    retired: false,
    offers: [],
    continentalId: continentalSpotOfClub(club, league.id),
    preferences: [],
  }
}

/** Troca os destinos pedidos ao empresario. Vale da proxima janela em diante. */
export function setPreferences(
  state: CareerState,
  preferences: TransferPreferences,
): CareerState {
  return { ...state, preferences }
}

/**
 * Chance de estrear em cada divisao, por faixa de potencial.
 *
 * A versao anterior mandava todo mundo para a divisao mais baixa do pais, o
 * que zerava a diferenca entre o garoto que o mercado ja disputa e o que vai
 * ter que subir na raca. Aqui a joia tem chance real de estrear na primeira
 * divisao — e continua sendo chance, nao garantia: nem toda promessa estreia
 * em clube grande, e essa incerteza e metade da graca de comecar a carreira.
 *
 * Os pesos sao do tier 1 (primeira divisao) ao 3, e sao normalizados sobre as
 * divisoes que o pais de fato tem. So o Brasil tem tres; a maioria tem duas e
 * varios paises tem so uma.
 */
const START_TIER_WEIGHTS: [minPotential: number, weights: [number, number, number]][] = [
  [88, [55, 33, 12]],
  [80, [30, 45, 25]],
  [72, [12, 43, 45]],
  [64, [4, 28, 68]],
  [0, [1, 15, 84]],
]

/**
 * Onde a historia comeca.
 *
 * A divisao sai do potencial do jogador — o teto que o draft entregou, nao o
 * OVR de agora. Um clube que aposta num garoto de 16 anos esta comprando o que
 * ele vai ser, e por isso o nivel atual entra so como desempate: entre dois
 * jogadores de mesmo teto, quem ja chega mais pronto pega o clube melhor.
 *
 * Idade nao diferencia ninguem aqui porque toda carreira comeca aos 16. Ela
 * participa de forma indireta, encolhendo o potencial no OVR de estreia.
 *
 * Quem nasce num pais sem liga mapeada comeca fora, e com a vida um pouco mais
 * dificil: nao ha clube da terra dele apostando primeiro, entao ele disputa
 * vaga com os locais em desvantagem. Isso vira `FOREIGN_HANDICAP` no sorteio
 * da divisao — antes esse jogador era barrado da primeira divisao por regra,
 * o que o prendia ao mesmo teto que a divisao mais baixa impunha aos outros.
 */
const FOREIGN_HANDICAP = 8

function pickStartingClub(config: CareerConfig, rng: Rng): Club {
  const potential = overallFor(config.peakAttrs, config.position)
  const current = currentOverall(config.peakAttrs, config.position, START_AGE)

  const domestic = clubsByCountry(config.nationality)
  const abroad = domestic.length === 0
  const pool = abroad ? CLUBS : domestic

  const tier = pickStartingTier(pool, potential - (abroad ? FOREIGN_HANDICAP : 0), rng)
  const entry = pool.filter((club) => leagueOf(club).tier === tier)

  return pickClubByFit(entry.length > 0 ? entry : pool, {
    potential,
    current,
    position: config.position,
    rng,
  })
}

/** Sorteia a divisao de estreia entre as que o pais tem. */
function pickStartingTier(pool: Club[], potential: number, rng: Rng): number {
  const available = [...new Set(pool.map((club) => leagueOf(club).tier))].sort()
  if (available.length === 1) return available[0]

  const row = START_TIER_WEIGHTS.find(([floor]) => potential >= floor)
  const weights = row ? row[1] : START_TIER_WEIGHTS[START_TIER_WEIGHTS.length - 1][1]

  // Normaliza sobre o que existe: num pais de duas divisoes, o peso da
  // terceira nao pode simplesmente sumir — ele engorda a divisao mais baixa
  // que o pais tem, que e onde aquele jogador entraria.
  const totals = available.map((tier) => {
    const own = weights[tier - 1] ?? 0
    const isLowest = tier === available[available.length - 1]
    const orphan = isLowest
      ? weights.slice(available.length).reduce((sum, weight) => sum + weight, 0)
      : 0

    return own + orphan
  })

  const total = totals.reduce((sum, weight) => sum + weight, 0)
  let draw = rng() * total

  for (let index = 0; index < available.length; index++) {
    draw -= totals[index]
    if (draw <= 0) return available[index]
  }

  return available[available.length - 1]
}

/**
 * Quanto a posicao desloca o alvo, em pontos de forca de clube.
 *
 * Clube grande aposta cedo em quem decide jogo: ponta, segundo atacante e
 * centroavante chegam prontos para a base de elite. Zagueiro e volante de 16
 * anos amadurecem mais devagar e costumam se formar um degrau abaixo, ainda
 * que o teto seja o mesmo. E um empurrao pequeno de proposito: muda a chance,
 * nao o destino.
 */
const POSITION_PULL: Record<Position, number> = {
  ZAG: -2,
  VOL: -2,
  ALA: -1,
  MC: 0,
  MEI: 1,
  PON: 2,
  SA: 2,
  ATA: 2,
}

/**
 * Qual clube da divisao aposta nele.
 *
 * O alvo e uma **forca de clube**, nao uma posicao na lista ordenada: promessa
 * alta mira o topo da divisao, promessa modesta mira o meio ou o fim. Todo
 * clube da divisao entra no sorteio com peso que cai conforme se afasta do
 * alvo, entao nenhum clube e obrigatorio e nenhum e impossivel — o que sai
 * sempre faz sentido para o perfil, mas duas carreiras iguais no papel
 * estreiam em lugares diferentes.
 *
 * A versao anterior sorteava uniformemente dentro de uma janela de indices em
 * torno do alvo. Como o alvo de quem tem potencial alto era sempre a ponta da
 * lista, a janela virava "os seis gigantes" e a variedade acabava ali; pior,
 * clubes de forca empatada eram ordenados pela ordem do arquivo, o que dava
 * vantagem estavel a quem estava listado antes. O peso continuo resolve os
 * dois problemas: empate de forca vira empate de chance.
 *
 * O que entra na conta:
 *
 * - **potencial** — manda, e o que o clube esta comprando;
 * - **nivel atual** — desempata com um quinto do peso: entre dois jogadores de
 *   mesmo teto, quem ja chega mais pronto pega o clube melhor;
 * - **idade** — entra dentro de `current`, que encolhe o auge para o OVR de
 *   estreia aos 16;
 * - **posicao** — desloca o alvo por `POSITION_PULL`;
 * - **reputacao/nivel do clube** — e a propria `strength`, a escala global do
 *   jogo, comparada contra o alvo.
 */
function pickClubByFit(
  clubs: Club[],
  input: { potential: number; current: number; position: Position; rng: Rng },
): Club {
  if (clubs.length === 1) return clubs[0]

  const strengths = clubs.map((club) => club.strength)
  const floor = Math.min(...strengths)
  const ceiling = Math.max(...strengths)
  if (ceiling === floor) return pick(input.rng, clubs)

  // O potencial manda; o nivel de estreia desempata com um quinto do peso.
  const grade = clamp((input.potential * 0.8 + input.current * 0.2 - 45) / 45, 0, 1)
  const target = clamp(
    floor + grade * (ceiling - floor) + POSITION_PULL[input.position],
    floor,
    ceiling,
  )

  // A largura acompanha a divisao: uma liga homogenea concentra mais, uma liga
  // desigual espalha mais. O piso evita que ligas muito planas virem sorteio de
  // um clube so.
  const width = Math.max(4, (ceiling - floor) * 0.35)

  const weights = clubs.map((club) => {
    const distance = (club.strength - target) / width
    return Math.exp(-distance * distance)
  })

  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let draw = input.rng() * total

  for (let index = 0; index < clubs.length; index++) {
    draw -= weights[index]
    if (draw <= 0) return clubs[index]
  }

  return clubs[clubs.length - 1]
}

export type SeasonResult = {
  state: CareerState
  record: SeasonRecord
  leagueOutcome: LeagueOutcome
}

/**
 * Joga uma temporada inteira e devolve o novo estado.
 *
 * `trainingFocus` e a unica decisao do jogador entre um ano e outro. O ganho
 * e aplicado no fim, entao a escolha paga na temporada seguinte — treinar nao
 * conserta o ano que ja esta acontecendo.
 */
export function playSeason(
  state: CareerState,
  trainingFocus: Attr | null,
): SeasonResult {
  if (state.retired) {
    throw new Error('playSeason: carreira ja encerrada')
  }

  const rng = careerRng(state.config.seed, `temporada:${state.seasonIndex}`)
  const club = requireClub(state.clubId)
  const league = requireLeague(state.leagueId)
  const clubs = fieldOf(league, club)

  const overall = currentOverall(state.peakAttrs, state.config.position, state.age)
  const totalMatches = matchesInLeague(clubs.length)

  // A producao do jogador e apurada antes da tabela: a tabela agora depende de
  // quanto ele jogou. `simulatePlayerSeason` nao depende da tabela — so do
  // clube, da media da liga e do total de partidas.
  const stats = simulatePlayerSeason(
    {
      overall,
      position: state.config.position,
      club,
      leagueAverageStrength: averageStrength(clubs),
      totalMatches,
    },
    rng,
  )

  const participation = stats.matches / totalMatches
  const leagueLift = clubLift(overall, club.strength, participation)

  const leagueOutcome = simulateLeague(league, rng, clubs, {
    clubId: club.id,
    amount: leagueLift,
  })

  const tablePosition = positionInTable(leagueOutcome, club.id)
  const promoted = leagueOutcome.promotedIds.includes(club.id)
  const relegated = leagueOutcome.relegatedIds.includes(club.id)

  const cups = playCups(
    {
      overall,
      position: state.config.position,
      club,
      country: league.country,
      leagueAverage: averageStrength(clubs),
      // O jogador entra nas copas na mesma proporcao em que jogou a liga:
      // quem e reserva no campeonato tambem e reserva na copa.
      participation,
      // A vaga foi conquistada na temporada anterior. Vale so se o clube
      // segue na divisao e no pais que a garantiram.
      continentalId: continentalPlayedThisSeason(state.continentalId, league),
    },
    rng,
  )

  const peakAttrs = trainingFocus
    ? applyTraining(state.peakAttrs, trainingFocus, state.age)
    : state.peakAttrs

  const national = playNationalSeason(
    { overall, position: state.config.position, nationality: state.config.nationality },
    state.seasonIndex,
    rng,
  )

  const decisive = decisiveMatch(
    {
      clubName: club.name,
      clubId: club.id,
      leagueName: league.name,
      cups,
      national,
      stats,
      totalMatches,
      lastRound: leagueOutcome.lastRound,
    },
    rng,
  )

  const record: SeasonRecord = {
    label: seasonLabel(state.seasonIndex),
    age: state.age,
    clubId: club.id,
    leagueId: league.id,
    overall,
    stats,
    tablePosition,
    champion: leagueOutcome.championId === club.id,
    promoted,
    relegated,
    trainingFocus,
    growth: growthBetween(state.peakAttrs, peakAttrs),
    clubLift: leagueLift,
    marketValue: marketValue(overall, state.age),
    cups,
    national,
    decisive,
    awards: resolveAwards(
      seasonAwardsInput({
        stats,
        position: state.config.position,
        leagueAverage: averageStrength(clubs),
        league,
        champion: leagueOutcome.championId === club.id,
        cups,
        national,
        decisive,
        totalMatches,
        clubLift: leagueLift,
      }),
      rng,
    ),
  }

  const age = state.age + 1
  const nextOverall = currentOverall(peakAttrs, state.config.position, age)

  return {
    state: {
      ...state,
      peakAttrs,
      age,
      seasonIndex: state.seasonIndex + 1,
      seasons: [...state.seasons, record],
      retired: age > state.retiresAt,
      // O clube nunca muda aqui. Trocar de time e decisao do jogador, e a
      // unica porta para isso e `resolveTransfer`.
      leagueId: leagueAfterSeason(league, promoted, relegated).id,
      offers: buildOffers(
        {
          overall: nextOverall,
          potential: overallFor(peakAttrs, state.config.position),
          age,
          club,
          stats,
          progress: nextOverall - overall,
          reputation: reputationOf(state),
          promoted,
          relegated,
          seasonsAtClub: seasonsAtClub(state, club.id),
        },
        state.preferences,
        rng,
      ),
      continentalId: earnedContinentalSpot(
        league,
        leagueAfterSeason(league, promoted, relegated),
        tablePosition,
        cups,
      ),
    },
    record,
    leagueOutcome,
  }
}

/**
 * Junta a temporada inteira para a votacao da Bola de Ouro.
 *
 * Existe porque a producao do ano esta espalhada: a liga em `stats`, cada copa
 * no seu `CompetitionRun` e a selecao em `national`. Somar so a liga — o que o
 * jogo fazia antes — descartava os gols de Champions e de Copa do Mundo, que
 * sao justamente os que ganham o premio.
 */
function seasonAwardsInput(input: {
  stats: PlayerSeasonStats
  position: Position
  leagueAverage: number
  league: League
  champion: boolean
  cups: CompetitionRun[]
  national: NationalSeason | null
  decisive: DecisiveMatch | null
  totalMatches: number
  clubLift: number
}): AwardsInput {
  const { stats, cups, national, decisive, league } = input
  const nation = national ? nationalTotals(national) : null

  const cupGoals = cups.reduce((sum, run) => sum + run.goals, 0)
  const cupAssists = cups.reduce((sum, run) => sum + run.assists, 0)

  return {
    stats,
    position: input.position,
    leagueAverageStrength: input.leagueAverage,
    seasonGoals: stats.goals + cupGoals + (nation?.goals ?? 0),
    seasonAssists: stats.assists + cupAssists + (nation?.assists ?? 0),
    presence: input.totalMatches > 0 ? stats.matches / input.totalMatches : 0,
    // Ser campeao da segunda divisao nao entra: o acesso ja e recompensado com
    // a divisao nova, e nenhuma votacao do mundo real olharia para ele.
    titles:
      (input.champion && league.tier === 1 ? 1 : 0) +
      cups.filter((run) => run.won).length +
      (national?.tournament?.won ? 1 : 0),
    // So a principal do continente pesa como titulo continental. Europa League
    // e Sul-Americana ja contam em `titles`, como qualquer outro titulo —
    // ganhar a Conference nao e ganhar a Champions.
    continentalTitle: cups.some(
      (run) => run.won && run.id === continentalsFor(league.country)[0]?.id,
    ),
    nationalTitle: national?.tournament?.won ?? false,
    worldCupTitle: national ? wonWorldCup(national) : false,
    wonDecisive: (decisive?.won && decisive.played) ?? false,
    decisiveProduction:
      (decisive?.played && decisive.playerGoals + decisive.playerAssists > 0) ?? false,
    inEurope: isEuropean(league.country),
    clubLift: input.clubLift,
  }
}

/**
 * Se o pais joga na Europa.
 *
 * Sai da confederacao da selecao e nao de uma lista propria de paises: a
 * mesma informacao em dois lugares diverge na primeira liga nova que entrar
 * no jogo.
 */
function isEuropean(country: string): boolean {
  return nationById(country)?.confederation === 'UEFA'
}

/**
 * O que o treino rendeu. Fica registrado no momento em que acontece porque a
 * regra de ganho e do motor: a interface nao deve recalcula-la para exibir.
 */
function growthBetween(before: PlayerAttrs, after: PlayerAttrs): AttrGrowth[] {
  return ALL_ATTRS.filter((attr) => after[attr] > before[attr]).map((attr) => ({
    attr,
    from: before[attr],
    to: after[attr],
  }))
}

/** Aceita uma proposta. Passar `null` significa ficar onde esta. */
export function resolveTransfer(state: CareerState, clubId: string | null): CareerState {
  if (clubId === null) {
    return { ...state, offers: [] }
  }

  if (!state.offers.some((offer) => offer.clubId === clubId)) {
    throw new Error(`resolveTransfer: proposta inexistente para ${clubId}`)
  }

  // Mudar de clube muda de divisao junto: o jogador passa a disputar a liga do
  // clube novo, e nao a divisao em que ele estava.
  //
  // A vaga continental tambem fica para tras. Ela e do clube que a conquistou:
  // quem sai de um semifinalista da Champions para um clube de meio de tabela
  // passa a disputar o que o clube novo disputa.
  const target = requireClub(clubId)
  const league = leagueOf(target)

  return {
    ...state,
    clubId,
    leagueId: league.id,
    continentalId: continentalSpotOfClub(target, league.id),
    offers: [],
  }
}

/**
 * O jogador sobe e desce **junto com o clube**, sem trocar de time.
 *
 * A versao anterior nao conseguia fazer isso: como `Club.leagueId` e estatico,
 * ela representava o acesso trocando o jogador por outro clube da divisao de
 * destino. Sair de um clube passa a ser sempre escolha do jogador.
 */
function leagueAfterSeason(
  league: League,
  promoted: boolean,
  relegated: boolean,
): League {
  if (!promoted && !relegated) return league

  return (promoted ? leagueAbove(league) : leagueBelow(league)) ?? league
}

/**
 * O campo da temporada.
 *
 * Depois de um acesso o clube do jogador nao consta da divisao nova nos dados
 * estaticos — ele entra aqui, no lugar do mais fraco, para a tabela nao crescer
 * de tamanho a cada promocao.
 *
 * O clube continua listado na divisao de origem nos dados. Nao incomoda: o jogo
 * so simula a liga do jogador, e a copa nacional reune o pais inteiro de
 * qualquer forma.
 */
function fieldOf(league: League, club: Club): Club[] {
  const clubs = clubsInLeague(league.id)

  if (clubs.some((other) => other.id === club.id)) return clubs

  const weakest = clubs.reduce(
    (worst, other) => (other.strength < worst.strength ? other : worst),
    clubs[0],
  )

  return [club, ...clubs.filter((other) => other.id !== weakest?.id)]
}

/**
 * O peso do nome do jogador no mercado.
 *
 * Titulo, premio individual e convocacao sao o que um clube de fora enxerga
 * de longe — mais do que a nota da ultima temporada. Bola de Ouro pesa mais
 * que titulo porque e o que faz um clube pagar acima do nivel atual.
 */
function reputationOf(state: CareerState): number {
  let reputation = 0

  for (const season of state.seasons) {
    if (season.champion) reputation += 1
    reputation += season.cups.filter((run) => run.won).length
    reputation += season.awards.length * 3
    if (season.national) reputation += 0.5
  }

  return reputation
}

/**
 * Ha quantas temporadas seguidas o jogador esta no mesmo clube, contando a que
 * acabou de ser jogada.
 *
 * O `+1` existe porque este calculo roda antes de a temporada entrar em
 * `state.seasons`. Sem ele, quem acabou de completar o primeiro ano no clube
 * apareceria com zero.
 */
function seasonsAtClub(state: CareerState, clubId: string): number {
  let seasons = 1

  for (let index = state.seasons.length - 1; index >= 0; index--) {
    if (state.seasons[index].clubId !== clubId) break
    seasons++
  }

  return seasons
}

/**
 * Copa nacional todo ano, competicao continental so para quem conquistou vaga
 * na temporada anterior. E o que da peso concreto a jogar num clube grande:
 * mais jogos, mais gols e mais titulo possivel.
 */
function playCups(
  input: {
    overall: number
    position: Position
    club: Club
    country: string
    leagueAverage: number
    participation: number
    continentalId: string | null
  },
  rng: Rng,
): CompetitionRun[] {
  const { club, country, participation, continentalId } = input
  const runs: CompetitionRun[] = []

  const boost = {
    clubId: club.id,
    amount: clubLift(input.overall, club.strength, participation),
  }

  const cup = simulateKnockout(nationalCupEntrants(country), rng, boost)
  const cupRun = toRun(nationalCupName(country), 'copa', cup, input, participation, rng)

  // A chave so aceita potencia de dois, entao parte dos clubes fica de fora.
  // Quem nao entrou nao disputou a competicao — registrar isso como campanha
  // zerada enche o resumo de linha sem conteudo.
  if (cupRun.reached !== NOT_ENTERED) runs.push(cupRun)

  const continental = continentalId ? continentalById(continentalId) : undefined

  if (continental) {
    // Continental de clube tem fase de grupos; copa nacional nao. E o formato
    // real de cada uma.
    const outcome = simulateGroupTournament(
      continentalEntrants(continental, club),
      rng,
      boost,
    )
    const run = toRun(continental.name, continental.id, outcome, input, participation, rng)

    if (run.reached !== NOT_ENTERED) runs.push(run)
  }

  return runs
}

function toRun(
  name: string,
  id: string,
  outcome: KnockoutResult,
  input: {
    overall: number
    position: Position
    club: Club
    leagueAverage: number
  },
  participation: number,
  rng: Rng,
): CompetitionRun {
  const { club } = input
  const matches = Math.round(matchesIn(outcome, club.id) * clamp(participation, 0, 1))
  const won = outcome.winnerId === club.id

  const { goals, assists } = playerOutput(
    {
      overall: input.overall,
      position: input.position,
      club,
      leagueAverageStrength: input.leagueAverage,
      matches,
    },
    rng,
  )

  return {
    id,
    name,
    matches,
    reached: won ? 'Campeão' : (outcome.eliminatedIn.get(club.id) ?? NOT_ENTERED),
    won,
    goals,
    assists,
    final: finalScoreFor(outcome, club.id, (id) => clubById(id)?.name ?? id),
  }
}

/**
 * O placar da final pelo lado de quem se pergunta. Devolve null para quem nao
 * chegou la — que e a maioria.
 */
function finalScoreFor(
  outcome: KnockoutResult,
  id: string,
  nameOf: (id: string) => string,
): FinalScore | null {
  const final = finalIn(outcome, id)
  if (!final) return null

  return {
    opponentId: final.opponentId,
    opponentName: nameOf(final.opponentId),
    forGoals: final.forGoals,
    againstGoals: final.againstGoals,
    onPenalties: final.onPenalties,
  }
}

/**
 * A vaga continental do ano seguinte, ou `null` quando o clube nao conquistou
 * nenhuma.
 *
 * Tres caminhos legitimos, como no futebol de verdade:
 *
 * - colocacao na primeira divisao, dentro da faixa da competicao;
 * - titulo da copa nacional, que da a segunda competicao do continente;
 * - titulo continental, que garante a principal no ano seguinte.
 *
 * Vale o melhor deles. E nada disso classifica quem nao vai estar na primeira
 * divisao do pais na temporada que vem: colocacao em segunda divisao nao entra
 * em faixa nenhuma, e quem caiu perde a vaga que tinha conquistado.
 */
function earnedContinentalSpot(
  playedLeague: League,
  nextLeague: League,
  tablePosition: number,
  cups: CompetitionRun[],
): string | null {
  if (playedLeague.tier !== 1 || nextLeague.tier !== 1) return null

  const { country } = playedLeague
  const ranking = continentalsFor(country)
  if (ranking.length === 0) return null

  const earned: Continental[] = []

  const byPosition = continentalByPosition(country, tablePosition)
  if (byPosition) earned.push(byPosition)

  if (cups.some((run) => run.id === 'copa' && run.won)) {
    const byCup = continentalForCupWinner(country)
    if (byCup) earned.push(byCup)
  }

  if (cups.some((run) => run.id !== 'copa' && run.won)) earned.push(ranking[0])

  if (earned.length === 0) return null

  // A ordem de `continentalsFor` vai da competicao maior para a menor.
  return earned.reduce((best, item) =>
    ranking.indexOf(item) < ranking.indexOf(best) ? item : best,
  ).id
}

/**
 * A vaga que o clube de fato disputa nesta temporada.
 *
 * A vaga foi conquistada no ano anterior, mas o jogador pode ter mudado de
 * clube desde entao. A conferencia final acontece aqui: a competicao precisa
 * cobrir o pais da liga atual, e a liga precisa ser a primeira divisao.
 */
function continentalPlayedThisSeason(
  continentalId: string | null,
  league: League,
): string | null {
  if (!continentalId || league.tier !== 1) return null

  const continental = continentalById(continentalId)
  return continental?.countries.includes(league.country) ? continentalId : null
}

/**
 * O jogo que decide a temporada.
 *
 * Precedencia: quanto maior a competicao, mais a final dela define o ano.
 * Sem nenhuma final, sobra a partida do clube na ultima rodada da liga — que e
 * o "ultimo jogo da temporada" no sentido literal.
 */
export function decisiveMatch(
  input: {
    clubName: string
    clubId: string
    leagueName: string
    cups: CompetitionRun[]
    national: NationalSeason | null
    stats: PlayerSeasonStats
    totalMatches: number
    lastRound: LeagueFixture[]
  },
  rng: Rng,
): DecisiveMatch | null {
  const { national } = input

  // A final de selecao vem antes de qualquer final de clube: ganhar a Copa do
  // Mundo ou a Eurocopa e o jogo do ano, nao a Copa do Brasil.
  const nationalDecider = national ? nationalFinal(national) : null

  if (national && nationalDecider) {
    return {
      competition: nationalDecider.competition,
      stage: 'Final',
      teamName: nationById(national.nationId)?.name ?? national.nationId,
      opponentName: nationalDecider.opponentName,
      teamClubId: null,
      opponentClubId: null,
      teamGoals: nationalDecider.forGoals,
      opponentGoals: nationalDecider.againstGoals,
      atHome: null,
      onPenalties: nationalDecider.onPenalties,
      won:
        nationalDecider.forGoals > nationalDecider.againstGoals ||
        (nationalDecider.onPenalties && national.tournament?.won === true),
      // Aqui a producao e da propria partida, e nao uma taxa da competicao
      // inteira: o calendario da selecao guarda jogo a jogo.
      played: nationalDecider.played,
      playerMatches: nationalDecider.played ? 1 : 0,
      playerGoals: nationalDecider.goals,
      playerAssists: nationalDecider.assists,
    }
  }

  // Continental antes de copa nacional: a final maior manda.
  const ordered = [...input.cups].sort((a, b) => Number(a.id === 'copa') - Number(b.id === 'copa'))

  for (const run of ordered) {
    if (!run.final) continue

    return fromFinal({
      competition: run.name,
      teamName: input.clubName,
      teamClubId: input.clubId,
      score: run.final,
      playerMatches: run.matches,
      playerGoals: run.goals,
      playerAssists: run.assists,
    })
  }

  const fixture = input.lastRound.find(
    (match) => match.homeId === input.clubId || match.awayId === input.clubId,
  )

  if (!fixture) return null

  const atHome = fixture.homeId === input.clubId
  const opponentId = atHome ? fixture.awayId : fixture.homeId
  const teamGoals = atHome ? fixture.homeGoals : fixture.awayGoals
  const opponentGoals = atHome ? fixture.awayGoals : fixture.homeGoals

  return {
    competition: input.leagueName,
    stage: 'Última rodada',
    teamName: input.clubName,
    opponentName: clubById(opponentId)?.name ?? opponentId,
    teamClubId: input.clubId,
    opponentClubId: opponentId,
    teamGoals,
    opponentGoals,
    atHome,
    onPenalties: false,
    won: teamGoals > opponentGoals,
    // Na liga o jogador nao joga tudo: entra na ultima rodada na mesma
    // proporcao em que jogou a temporada.
    played:
      input.totalMatches > 0 && rng() < input.stats.matches / input.totalMatches,
    playerMatches: input.stats.matches,
    playerGoals: input.stats.goals,
    playerAssists: input.stats.assists,
  }
}

function fromFinal(input: {
  competition: string
  teamName: string
  teamClubId: string
  score: FinalScore
  playerMatches: number
  playerGoals: number
  playerAssists: number
}): DecisiveMatch {
  return {
    competition: input.competition,
    stage: 'Final',
    teamName: input.teamName,
    opponentName: input.score.opponentName,
    teamClubId: input.teamClubId,
    opponentClubId: input.score.opponentId,
    teamGoals: input.score.forGoals,
    opponentGoals: input.score.againstGoals,
    atHome: null,
    onPenalties: input.score.onPenalties,
    won: input.score.forGoals > input.score.againstGoals || input.score.onPenalties,
    // Quem chegou a final e nao entrou em nenhum jogo da competicao nao entrou
    // nesse tambem.
    played: input.playerMatches > 0,
    playerMatches: input.playerMatches,
    playerGoals: input.playerGoals,
    playerAssists: input.playerAssists,
  }
}

/** Uma competicao disputada na temporada, do jeito que o resumo mostra. */
export type SeasonLine = {
  name: string
  matches: number
  goals: number
  assists: number
  /** Colocacao na liga, fase no mata-mata, ou "Convocado" na selecao. */
  reached: string
  won: boolean
  /**
   * Id da imagem da competicao, ou `null` na linha da selecao — o emblema de
   * um pais e a bandeira, que ja tem componente proprio.
   */
  badgeId: string | null
}

export type SeasonTotals = {
  matches: number
  goals: number
  assists: number
  lines: SeasonLine[]
}

/**
 * O que o jogador fez no ano somando liga, copas e selecao.
 *
 * Hoje esses tres numeros vivem em campos diferentes do registro e ninguem os
 * soma — o jogador nunca ve quantos jogos de fato disputou na temporada.
 */
export function seasonTotals(record: SeasonRecord): SeasonTotals {
  const lines: SeasonLine[] = [
    {
      name: leagueById(record.leagueId)?.name ?? record.leagueId,
      matches: record.stats.matches,
      goals: record.stats.goals,
      assists: record.stats.assists,
      reached: `${record.tablePosition}º lugar`,
      won: record.champion,
      badgeId: record.leagueId,
    },
    ...record.cups.map((run) => ({
      name: run.name,
      matches: run.matches,
      goals: run.goals,
      assists: run.assists,
      reached: run.reached,
      won: run.won,
      badgeId: competitionImageId(run.id, record.leagueId),
    })),
  ]

  const national = record.national

  if (national) {
    const totals = nationalTotals(national)
    const tournament = national.tournament

    lines.push({
      name: nationById(national.nationId)?.name ?? national.nationId,
      matches: totals.caps,
      goals: totals.goals,
      assists: totals.assists,
      reached: tournament ? `${tournament.name} · ${tournament.reached}` : 'Convocado',
      won: tournament?.won ?? false,
      badgeId: null,
    })
  }

  return {
    matches: sum(lines, (line) => line.matches),
    goals: sum(lines, (line) => line.goals),
    assists: sum(lines, (line) => line.assists),
    lines,
  }
}

function sum<T>(items: T[], of: (item: T) => number): number {
  return items.reduce((total, item) => total + of(item), 0)
}

/** Valor de mercado em milhoes de euros. So vitrine — nao entra em regra. */
export function marketValue(overall: number, age: number): number {
  if (overall < 55) return 0

  const base = Math.pow((overall - 50) / 10, 3.1)
  const agePenalty = age <= 24 ? 1.25 : age <= 28 ? 1 : Math.max(0.15, 1 - (age - 28) * 0.13)

  return Math.round(clamp(base * agePenalty, 0, 250))
}

export function seasonLabel(seasonIndex: number): string {
  const start = FIRST_SEASON + seasonIndex
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

/** Cada temporada tem seu proprio stream, derivado da seed da carreira. */
function careerRng(seed: string, scope: string): Rng {
  return createRng(`${seed}:${scope}`)
}

function requireClub(clubId: string): Club {
  const club = clubById(clubId)
  if (!club) throw new Error(`Clube inexistente: ${clubId}`)
  return club
}

function requireLeague(leagueId: string): League {
  const league = leagueById(leagueId)
  if (!league) throw new Error(`Liga inexistente: ${leagueId}`)
  return league
}
