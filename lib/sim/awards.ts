import { MAX_LIFT } from './impact'
import { clamp } from './positions'
import { jitter, type Rng } from './rng'
import type { PlayerSeasonStats } from './season'
import type { Position } from './types'

export type Award = 'bola-de-ouro' | 'chuteira-de-ouro'

export const AWARD_LABEL: Record<Award, string> = {
  'bola-de-ouro': 'Bola de Ouro',
  'chuteira-de-ouro': 'Chuteira de Ouro',
}

/**
 * Gols que o artilheiro de uma liga costuma fazer. Liga forte tem artilheiro
 * mais goleador porque os clubes de cima sao muito superiores aos de baixo.
 */
function topScorerBar(leagueAverageStrength: number, rng: Rng): number {
  const base = 16 + (leagueAverageStrength - 55) * 0.32
  return base * jitter(rng, 0.14)
}

/**
 * A temporada do jogador, pelo que a Bola de Ouro enxerga.
 *
 * Nada aqui e atributo. O premio e da **temporada**, nao do jogador: quem fez
 * um ano excepcional concorre de verdade mesmo sem overall de craque
 * consagrado — que e como o premio funciona no futebol real, e o que faz a
 * temporada boa valer alguma coisa antes do auge da carreira.
 */
export type AwardsInput = {
  /** Numeros da liga. O gol da Chuteira de Ouro sai daqui. */
  stats: PlayerSeasonStats
  position: Position
  leagueAverageStrength: number
  /** Gols da temporada inteira: liga, copas e selecao. */
  seasonGoals: number
  /** Assistencias da temporada inteira. */
  seasonAssists: number
  /** Fracao dos jogos da liga que o jogador disputou, 0 a 1. */
  presence: number
  /**
   * Titulos que contam para a Bola de Ouro: primeira divisao, copa nacional,
   * competicao continental e torneio de selecao. Titulo de segunda divisao
   * fica de fora — subir de divisao nao e o feito que o premio reconhece.
   */
  titles: number
  continentalTitle: boolean
  /** Titulo de selecao no ano, quando houve. */
  nationalTitle: boolean
  /** Copa do Mundo pesa mais que qualquer outro torneio de selecao. */
  worldCupTitle: boolean
  /** Estava em campo no jogo que decidiu a temporada, e o time venceu. */
  wonDecisive: boolean
  /** Marcou ou deu assistencia na competicao decidida nesse jogo. */
  decisiveProduction: boolean
  /** O clube da temporada e de uma liga europeia. */
  inEurope: boolean
  /** Quanto a presenca do jogador somou a forca do clube, em pontos. */
  clubLift: number
}

/**
 * Requisitos sem os quais nao ha voto, por mais forte que tenha sido o ano.
 *
 * Sao os dois filtros que o premio real aplica na pratica: ninguem ganha sem
 * levantar taca, e ninguem ganha jogando fora da Europa. Nao sao pontos numa
 * soma — sao porta de entrada, e por isso ficam separados da pontuacao. Quem
 * nao passa aqui nem chega a ser comparado com a barra.
 */
function isEligible(input: AwardsInput): boolean {
  return input.inEurope && input.titles >= 1
}

/**
 * Pontuacao da temporada para a Bola de Ouro, ja passada a elegibilidade.
 *
 * As parcelas sao o que a votacao de verdade olha: producao, regularidade,
 * titulo, peso no jogo decisivo, nota e importancia no elenco. Nenhuma sozinha
 * ganha o premio.
 */
function ballonPoints(input: AwardsInput): number {
  const production = input.seasonGoals + input.seasonAssists * 0.65
  const consistency = Math.max(0, input.stats.rating - 6.6) * 24

  // Um titulo abre a porta; o segundo e o que decide a disputa. A escada nao e
  // linear de proposito — no futebol real quem faz a temporada dupla ganha,
  // mesmo com numeros parecidos com os de quem ganhou uma taca so.
  const silverware =
    input.titles * 12 +
    (input.titles >= 2 ? 16 : 0) +
    (input.titles >= 3 ? 10 : 0) +
    (input.continentalTitle ? 22 : 0) +
    (input.worldCupTitle ? 26 : input.nationalTitle ? 12 : 0)

  // Jogar a temporada inteira e parte do premio: quem some metade do ano nao
  // e o melhor do ano, por melhor que tenha sido quando jogou.
  const regularity = clamp(input.presence, 0, 1) * 14

  const decisive = (input.wonDecisive ? 10 : 0) + (input.decisiveProduction ? 6 : 0)

  // O quanto o time depende dele. Carregar um elenco mediano ao titulo pesa
  // mais que ser o decimo primeiro nome de um elenco que ja ganhava sem ele.
  const importance = clamp(input.clubLift, 0, MAX_LIFT) * 3

  // Defensor nao disputa em gol; a nota carrega mais peso para ele.
  const positionalLift = DEFENSIVE.has(input.position) ? consistency * 1.6 : 0

  return (
    production +
    consistency +
    silverware +
    regularity +
    decisive +
    importance +
    positionalLift
  )
}

const DEFENSIVE = new Set<Position>(['ZAG', 'VOL', 'ALA'])

/**
 * Barra da Bola de Ouro — a temporada que o melhor concorrente fez naquele ano.
 *
 * Calibrada em `scripts/smoke-awards.ts`: com um titulo o jogador entra na
 * disputa e ganha as vezes, com dois ele passa na maior parte dos anos bons, e
 * cumprir os requisitos nunca garante nada — a variacao da barra e o rival que
 * tambem fez uma grande temporada.
 */
const BALLON_BAR = 104

/** Variacao da barra de um ano para o outro. E o que impede o premio garantido. */
const BALLON_SPREAD = 0.12

/**
 * Premios individuais da temporada.
 *
 * Nao ha rivais modelados — seria preciso simular milhares de jogadores para
 * saber quem fez mais gols no mundo. Em vez disso cada premio tem uma barra: o
 * jogador ganha quando supera o que um concorrente de elite faria naquele ano.
 * O efeito para quem joga e o mesmo, e o custo e uma funcao em vez de um
 * segundo motor.
 */
export function resolveAwards(input: AwardsInput, rng: Rng): Award[] {
  const won: Award[] = []

  // A Chuteira de Ouro nao tem requisito: ela e da artilharia da liga, e
  // artilheiro de Brasileirao e artilheiro do mesmo jeito.
  const bar = topScorerBar(input.leagueAverageStrength, rng)
  if (input.stats.goals >= bar) {
    won.push('chuteira-de-ouro')
  }

  if (isEligible(input) && ballonPoints(input) >= BALLON_BAR * jitter(rng, BALLON_SPREAD)) {
    won.push('bola-de-ouro')
  }

  return won
}
