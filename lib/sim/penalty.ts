import { clamp } from './positions'
import type { Rng } from './rng'
import type { PlayerAttrs, Position } from './types'

/**
 * O penalti decisivo — o unico momento em que o jogador interfere numa
 * partida. E interativo de verdade: o gol convertido entra na conta da
 * temporada. Nao e animacao por cima de um numero ja decidido.
 */

export const PENALTY_CORNERS = 6

/** Quem costuma bater. Atacante quase sempre, zagueiro quase nunca. */
const TAKER_CHANCE: Record<Position, number> = {
  ZAG: 0.04,
  ALA: 0.08,
  VOL: 0.1,
  MC: 0.18,
  MEI: 0.3,
  PON: 0.24,
  SA: 0.3,
  ATA: 0.36,
}

export function hasPenaltyMoment(
  position: Position,
  matches: number,
  rng: Rng,
): boolean {
  // Quem quase nao jogou nao cobra penalti decisivo.
  if (matches < 10) return false

  return rng() < TAKER_CHANCE[position]
}

/**
 * Converte ou nao. A finalizacao do jogador move a chance dentro de uma faixa
 * realista: mesmo um cobrador ruim converte a maioria, e nem o melhor chega a
 * ser certeza.
 */
export function convertsPenalty(
  attrs: PlayerAttrs,
  age: number,
  rng: Rng,
): boolean {
  const skill = clamp(0.58 + (attrs.fin - 60) / 190, 0.5, 0.9)

  // Veterano bate com mais frieza.
  const composure = age >= 27 ? 0.03 : 0

  return rng() < skill + composure
}
