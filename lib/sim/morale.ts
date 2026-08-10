import { clamp } from './positions'

/**
 * O lado humano da carreira.
 *
 * O motor antigo descrevia o jogador so por atributo e idade. Isso basta para
 * uma temporada resolvida de uma vez, mas nao para o modo Jogo a Jogo: la o
 * jogador toma decisao dentro da partida, e decisao sem consequencia e
 * cenario, nao jogo. Estes quatro numeros sao a consequencia.
 *
 * Todos vivem em 0..100 e comecam em 50 — exceto reputacao, que comeca perto
 * de zero porque ninguem nasce conhecido.
 *
 * Onde cada um pesa:
 *
 * - **confianca** — chance de acerto dentro da partida e nota. E o unico que
 *   oscila rapido: uma partida ruim derruba, uma boa levanta.
 * - **treinador** — minutos. Decide se o jogador comeca jogando, se e sacado
 *   cedo e se entra no segundo tempo.
 * - **elenco** — quanto os companheiros procuram o jogador. Mexe em
 *   assistencia recebida e em quanto ele participa do jogo.
 * - **reputacao** — o que o mundo fora do clube enxerga. Alimenta proposta,
 *   convocacao e o alcance das noticias.
 *
 * Reputacao e o unico que quase nao cai: nome construido nao evapora em uma
 * partida ruim.
 */
export type Morale = {
  confidence: number
  coach: number
  squad: number
  reputation: number
}

export type MoraleKey = keyof Morale

export type MoraleDelta = Partial<Record<MoraleKey, number>>

export const MORALE_LABEL: Record<MoraleKey, string> = {
  confidence: 'Confiança',
  coach: 'Treinador',
  squad: 'Elenco',
  reputation: 'Reputação',
}

export const STARTING_MORALE: Morale = {
  confidence: 50,
  coach: 50,
  squad: 50,
  reputation: 4,
}

export function applyMorale(morale: Morale, delta: MoraleDelta): Morale {
  return {
    confidence: clamp(morale.confidence + (delta.confidence ?? 0), 0, 100),
    coach: clamp(morale.coach + (delta.coach ?? 0), 0, 100),
    squad: clamp(morale.squad + (delta.squad ?? 0), 0, 100),
    reputation: clamp(morale.reputation + (delta.reputation ?? 0), 0, 100),
  }
}

export function mergeDeltas(deltas: MoraleDelta[]): MoraleDelta {
  const total: MoraleDelta = {}

  for (const delta of deltas) {
    for (const key of Object.keys(delta) as MoraleKey[]) {
      total[key] = (total[key] ?? 0) + (delta[key] ?? 0)
    }
  }

  return total
}

/**
 * O valor em escala -1..1, que e como o resto do motor usa.
 *
 * 50 e neutro por construcao: uma carreira que comeca no meio nao deve ganhar
 * nem perder nada antes de a primeira partida acontecer.
 */
export function moraleFactor(value: number): number {
  return (value - 50) / 50
}

/**
 * A reputacao tem escala propria.
 *
 * As outras tres comecam em 50 e oscilam em torno do meio, entao "Estável" e
 * "Baixa" descrevem bem o que se passa. A reputacao nao: ela comeca perto de
 * zero para todo mundo e sobe devagar, e chamar de "Péssima" a reputacao de um
 * garoto de 16 anos que ainda nao estreou inverte o sentido — ele nao tem uma
 * reputacao ruim, ele nao tem reputacao nenhuma.
 */
export function reputationLabel(value: number): string {
  if (value >= 70) return 'Mundial'
  if (value >= 45) return 'Continental'
  if (value >= 25) return 'Nacional'
  if (value >= 10) return 'Regional'
  return 'Desconhecido'
}

export function moraleLabel(value: number): string {
  if (value >= 80) return 'Ótima'
  if (value >= 62) return 'Alta'
  if (value >= 40) return 'Estável'
  if (value >= 22) return 'Baixa'
  return 'Péssima'
}

/**
 * Regressao ao meio entre uma temporada e outra.
 *
 * Sem isso a carreira trava: uma sequencia ruim aos 19 anos deixaria o jogador
 * com confianca no chao aos 30, e um bom inicio garantiria o resto da vida.
 * Ferias, pre-temporada e elenco novo desfazem parte do que ficou.
 *
 * Reputacao nao regride para o meio — ela decai devagar por conta propria, do
 * jeito que um nome esquecido decai.
 */
const DRIFT = 0.25
const REPUTATION_DECAY = 0.04

export function driftBetweenSeasons(morale: Morale): Morale {
  return {
    confidence: towardCenter(morale.confidence),
    coach: towardCenter(morale.coach),
    squad: towardCenter(morale.squad),
    reputation: clamp(morale.reputation * (1 - REPUTATION_DECAY), 0, 100),
  }
}

function towardCenter(value: number): number {
  return clamp(Math.round(value + (50 - value) * DRIFT), 0, 100)
}

/**
 * Reputacao ganha ao fim de uma temporada.
 *
 * Sai do que o mundo de fato ve: titulo, premio, selecao e producao. O nivel
 * da competicao pesa porque artilheiro da terceira divisao nao vira noticia
 * internacional — e a progressao realista pedida pelo modo depende disso.
 *
 * @param leagueTier 1 = primeira divisao.
 */
export function reputationGain(input: {
  leagueTier: number
  clubStrength: number
  goals: number
  assists: number
  matches: number
  champion: boolean
  titles: number
  awards: number
  calledUp: boolean
}): number {
  // Um jogo de terceira divisao pesa menos que um da elite, e a forca do clube
  // desempata dentro da mesma divisao.
  const stage = clamp(input.clubStrength / 90, 0.3, 1) / input.leagueTier

  const production =
    input.matches > 0 ? clamp((input.goals + input.assists * 0.6) / 12, 0, 1.6) : 0

  const trophies = (input.champion ? 1.5 : 0) + input.titles * 1.5 + input.awards * 4

  return Number(
    (
      (production * 4 + trophies + (input.calledUp ? 1.5 : 0)) * stage
    ).toFixed(2),
  )
}
