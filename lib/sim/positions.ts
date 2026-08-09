import { applyCurve } from './curve'
import {
  NUMERIC_ATTRS,
  POSITIONS,
  type NumericAttr,
  type PlayerAttrs,
  type Position,
} from './types'

/**
 * Peso de cada atributo numerico por posicao. Cada linha soma 1.
 * E o que faz o mesmo draft render OVR diferente em cada posicao —
 * a decisao de posicao precisa ter consequencia real.
 */
const WEIGHTS: Record<Position, Record<NumericAttr, number>> = {
  ZAG: { def: 0.4, fis: 0.25, vel: 0.13, pas: 0.12, dri: 0.05, fin: 0.05 },
  ALA: { vel: 0.25, def: 0.22, fis: 0.18, pas: 0.18, dri: 0.12, fin: 0.05 },
  VOL: { def: 0.32, pas: 0.22, fis: 0.22, dri: 0.1, vel: 0.09, fin: 0.05 },
  MC: { pas: 0.3, dri: 0.2, def: 0.18, fis: 0.15, vel: 0.1, fin: 0.07 },
  MEI: { pas: 0.32, dri: 0.27, fin: 0.18, vel: 0.12, fis: 0.06, def: 0.05 },
  PON: { vel: 0.28, dri: 0.28, fin: 0.18, pas: 0.16, fis: 0.06, def: 0.04 },
  SA: { fin: 0.28, dri: 0.24, pas: 0.18, vel: 0.18, fis: 0.08, def: 0.04 },
  ATA: { fin: 0.38, fis: 0.2, vel: 0.18, dri: 0.14, pas: 0.06, def: 0.04 },
}

/**
 * Quanto fintas e perna ruim valem por posicao. Fintas pesam no ataque,
 * perna ruim e util em todo lugar mas nunca decisiva.
 */
const STAR_WEIGHTS: Record<Position, { fintas: number; pernaRuim: number }> = {
  ZAG: { fintas: 0.2, pernaRuim: 0.6 },
  ALA: { fintas: 0.7, pernaRuim: 0.8 },
  VOL: { fintas: 0.4, pernaRuim: 0.8 },
  MC: { fintas: 0.7, pernaRuim: 1.0 },
  MEI: { fintas: 1.3, pernaRuim: 1.0 },
  PON: { fintas: 1.6, pernaRuim: 0.9 },
  SA: { fintas: 1.4, pernaRuim: 1.1 },
  ATA: { fintas: 1.0, pernaRuim: 1.2 },
}

/**
 * Calibragem por posicao, medida em 20 mil drafts aleatorios por
 * `scripts/calibrate-positions.ts`.
 *
 * As posicoes nao competem em pe de igualdade por construcao. Como cada
 * atributo e roubado de uma lenda diferente e sorteada, o valor que cai em
 * cada slot tende a media daquele atributo no pool — e Defesa tem media 59,5
 * contra 77 a 83 de todos os outros. Resultado: quem pesa Defesa nascia ate
 * nove pontos atras. Na pratica MEI, PON e ATA respondiam por 73% das
 * carreiras e volante, ala e meio-campo nao existiam.
 *
 * Normalizar media e desvio de cada posicao para um alvo comum devolve a
 * decisao ao jogador: a melhor posicao passa a depender da combinacao que ele
 * montou, nao de qual atributo o pool distribui melhor.
 */
const TARGET_MEAN = 78.3
const TARGET_STD = 6.1

const CALIBRATION: Record<Position, { mean: number; std: number }> = {
  ZAG: { mean: 72.5, std: 8.91 },
  ALA: { mean: 77.0, std: 5.83 },
  VOL: { mean: 74.8, std: 7.37 },
  MC: { mean: 78.4, std: 5.18 },
  MEI: { mean: 81.4, std: 4.74 },
  PON: { mean: 81.4, std: 4.99 },
  SA: { mean: 81.0, std: 5.4 },
  ATA: { mean: 79.8, std: 6.37 },
}

/**
 * OVR de auge na escala 1-99 — o teto que o jogador atinge por volta dos 27.
 * A idade escala esse numero em `progression.ts`.
 *
 * A base e a media ponderada dos seis atributos; as estrelas ajustam em ate
 * ~+-4 pontos, entao decidem empates sem nunca dominar a construcao. O
 * resultado e calibrado por posicao e passa pela curva para nao nascer
 * inflado.
 */
export function overallFor(attrs: PlayerAttrs, position: Position): number {
  return clamp(applyCurve(calibratedOverallFor(attrs, position)), 1, 99)
}

/** OVR cru trazido para a escala comum a todas as posicoes. */
export function calibratedOverallFor(
  attrs: PlayerAttrs,
  position: Position,
): number {
  const { mean, std } = CALIBRATION[position]
  const raw = rawOverallFor(attrs, position)

  return TARGET_MEAN + ((raw - mean) / std) * TARGET_STD
}

/** Antes da curva. Existe para o balanceamento poder inspecionar as duas escalas. */
export function rawOverallFor(attrs: PlayerAttrs, position: Position): number {
  const weights = WEIGHTS[position]

  let base = 0
  for (const attr of NUMERIC_ATTRS) {
    base += attrs[attr] * weights[attr]
  }

  const stars = STAR_WEIGHTS[position]
  const bonus =
    (attrs.fintas - 3) * stars.fintas + (attrs.pernaRuim - 3) * stars.pernaRuim

  return clamp(Math.round(base + bonus), 1, 99)
}

/** OVR em todas as posicoes, da melhor para a pior. Alimenta a tela de troca de posicao. */
export function overallByPosition(
  attrs: PlayerAttrs,
): { position: Position; overall: number }[] {
  return POSITIONS.map((position) => ({
    position,
    overall: overallFor(attrs, position),
  })).sort((a, b) => b.overall - a.overall)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
