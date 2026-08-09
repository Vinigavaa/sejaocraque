import { CLUBS, leagueOf } from './data/clubs'
import { COUNTRY_LABEL, LEAGUES } from './data/leagues'
import { range, sample, type Rng } from './rng'
import type { PlayerSeasonStats } from './season'
import type { Club } from './types'

/**
 * Quem procura o jogador depois da temporada.
 *
 * A regra antiga olhava so o presente: rendeu acima do clube, recebe proposta.
 * Isso gerava mercado quase todo ano e ignorava o que de fato move uma
 * transferencia — quantos anos o jogador tem, quanto ele ainda promete, o que
 * ja ganhou e se esta em ascensao ou em queda.
 *
 * Aqui a proposta tem duas etapas separadas de proposito:
 *
 * 1. **Interesse** (0..1): o quanto o mercado quer o jogador neste momento.
 * 2. **Movimento**: se alguem de fato aparece, e quem.
 *
 * Um jogador muito desejado pode passar o ano sem proposta, e e assim que deve
 * ser: nem todo verao tem oferta, mesmo para quem esta em alta.
 */

/** Chance de proposta para quem tem interesse maximo. Nunca e certeza. */
const MAX_OFFER_CHANCE = 0.55
/** Piso: mesmo sem nenhum atrativo, o mercado as vezes se mexe. */
const MIN_OFFER_CHANCE = 0.03
/**
 * Uma janela sem propostas depois de assinar.
 *
 * Clube nao compra para revender no ano seguinte, e o jogador que acabou de
 * chegar precisa de tempo de jogo. Sem isso o jogador roda de clube em clube
 * todo ano, que era o comportamento antigo.
 */
export const SETTLING_SEASONS = 2

export type TransferOffer = {
  clubId: string
}

/**
 * Destinos que o jogador pediu ao empresario.
 *
 * Cada entrada e um id de pais (`'ES'`) ou de liga (`'es-1'`) — pedir o pais
 * cobre todas as divisoes dele, pedir a liga e mais especifico. Lista vazia
 * significa que o empresario procura em qualquer lugar.
 */
export type TransferPreferences = string[]

export const MAX_PREFERENCES = 3

/** Se o clube atende a um dos destinos pedidos. */
export function matchesPreference(club: Club, preferences: TransferPreferences): boolean {
  if (preferences.length === 0) return true

  const league = leagueOf(club)
  return preferences.some((entry) => entry === league.id || entry === league.country)
}

export type MarketInput = {
  /** Nivel atual, ja escalado pela idade. */
  overall: number
  /** Teto do jogador. A diferenca para o atual e o que ainda promete. */
  potential: number
  age: number
  club: Club
  stats: PlayerSeasonStats
  /** Quanto o overall subiu na ultima temporada. Negativo em declinio. */
  progress: number
  /** Titulos, Bolas de Ouro e convocacoes acumulados. */
  reputation: number
  promoted: boolean
  relegated: boolean
  /** Temporadas completas no clube atual. */
  seasonsAtClub: number
}

/**
 * O quanto o mercado quer o jogador, de 0 a 1.
 *
 * Cada parcela e um sinal que um olheiro de verdade leria. Elas somam em vez
 * de multiplicar para que nenhuma sozinha zere o interesse: um veterano
 * decadente com quatro Bolas de Ouro ainda recebe ligacao.
 */
export function marketInterest(input: MarketInput): number {
  const { overall, potential, age, club, stats, progress, reputation } = input

  // Rendeu acima do que o elenco pedia. E o sinal mais direto de todos.
  const outgrew = clampUnit((overall - club.strength) / 10)

  // O que ainda promete. Vale muito aos 18, quase nada aos 30 — clube paga
  // por potencial que ainda da tempo de virar nivel.
  const upside = clampUnit((potential - overall) / 12) * clampUnit((28 - age) / 10)

  // Desempenho da temporada. A nota carrega o peso; jogar pouco derruba.
  const played = clampUnit(stats.matches / 25)
  const form = clampUnit((stats.rating - 6.2) / 1.6) * played

  // Estar em ascensao chama atencao mais do que estar estavel.
  const rising = clampUnit(progress / 4)

  // Reputacao acumulada nao evapora numa temporada ruim.
  const fame = clampUnit(reputation / 12)

  // Idade e o unico fator que so subtrai. Comeca a pesar depois dos 30.
  const wear = clampUnit((age - 30) / 6) * 0.35

  const interest =
    outgrew * 0.3 + upside * 0.2 + form * 0.2 + rising * 0.1 + fame * 0.2 - wear

  // Cair de divisao empurra o jogador para fora mesmo sem nada dos acima.
  const pushed = input.relegated ? 0.15 : 0

  return clampUnit(interest + pushed)
}

/**
 * Propostas do ano.
 *
 * O empresario procura primeiro nos destinos pedidos. So quando nao acha nada
 * la — porque o jogador ainda nao tem nivel para aquela liga, por exemplo — e
 * que ele abre para o resto do mundo, e ainda assim com menos opcoes: pedir
 * um destino significa recusar sondagem de outros lugares.
 */
export function buildOffers(
  input: MarketInput,
  preferences: TransferPreferences,
  rng: Rng,
): TransferOffer[] {
  // Recem-chegado nao e sondado. A unica excecao e quem foi rebaixado junto
  // com o clube: ai o jogador tem motivo real para querer sair.
  if (input.seasonsAtClub < SETTLING_SEASONS && !input.relegated) return []

  const interest = marketInterest(input)
  const chance = MIN_OFFER_CHANCE + interest * (MAX_OFFER_CHANCE - MIN_OFFER_CHANCE)

  if (rng() > chance) return []

  const targets = candidates(input, interest)
  if (targets.length === 0) return []

  const preferred = targets.filter((club) => matchesPreference(club, preferences))
  const hasPreferences = preferences.length > 0

  // Duas propostas so para quem o mercado disputa de verdade.
  const count = interest > 0.6 ? range(rng, 1, 2) : 1

  if (preferred.length > 0) return pickOffers(rng, preferred, count)
  if (!hasPreferences) return pickOffers(rng, targets, count)

  // Pediu destino e o empresario nao achou nada la. Ele ainda leva uma
  // sondagem de fora, mas so uma, e so quando o interesse e alto o bastante
  // para justificar contrariar o pedido.
  if (interest < 0.45) return []
  return pickOffers(rng, targets, 1)
}

/**
 * Clubes plausiveis para o momento do jogador.
 *
 * O teto sobe com o interesse: quem esta em alta e sondado por clube acima do
 * proprio nivel, quem esta em baixa so encontra porta de saida para baixo.
 */
function candidates(input: MarketInput, interest: number): Club[] {
  const { overall, club, stats } = input

  // Encostado: o mercado que existe para ele e o de quem oferece minutos.
  const benched = stats.matches > 0 && stats.matches < 8

  if (benched) {
    return CLUBS.filter(
      (other) =>
        other.id !== club.id &&
        other.strength <= club.strength - 4 &&
        other.strength >= overall - 10,
    )
  }

  const ceiling = overall + Math.round(2 + interest * 8)
  const floor = overall - (input.relegated ? 10 : 6)

  return CLUBS.filter(
    (other) =>
      other.id !== club.id &&
      other.strength >= floor &&
      other.strength <= ceiling &&
      // Trocar seis de um por meia duzia de outro nao e transferencia.
      Math.abs(other.strength - club.strength) >= 2,
  )
}

function pickOffers(rng: Rng, clubs: Club[], count: number): TransferOffer[] {
  return sample(rng, clubs, count).map((club) => ({ clubId: club.id }))
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Os destinos oferecidos na tela do empresario, agrupados por pais.
 *
 * Marcar o pais cobre todas as divisoes dele; marcar uma liga e mais
 * especifico. Sao duas ambicoes diferentes — "quero jogar na Espanha" e
 * "quero La Liga" — e o jogador escolhe qual esta pedindo.
 */
export type DestinationGroup = {
  /** Id do pais, usado como preferencia quando o jogador marca o grupo. */
  country: string
  label: string
  flag: string
  leagues: { id: string; name: string }[]
}

export function destinationGroups(): DestinationGroup[] {
  const byCountry = new Map<string, DestinationGroup>()

  for (const league of LEAGUES) {
    const existing = byCountry.get(league.country)

    if (existing) {
      existing.leagues.push({ id: league.id, name: league.name })
      continue
    }

    const label = COUNTRY_LABEL[league.country]

    byCountry.set(league.country, {
      country: league.country,
      label: label?.name ?? league.country,
      flag: label?.flag ?? '',
      leagues: [{ id: league.id, name: league.name }],
    })
  }

  return [...byCountry.values()]
}
