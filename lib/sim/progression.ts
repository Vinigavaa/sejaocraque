import { clamp, overallFor } from './positions'
import { range, type Rng } from './rng'
import {
  isStarAttr,
  type Attr,
  type PlayerAttrs,
  type Position,
} from './types'

export const START_AGE = 16

/**
 * O OVR do draft e o **auge** — o teto que o jogador atinge por volta dos 27.
 * A idade escala esse teto, entao aos 16 ele e visivelmente pior do que sera,
 * e depois dos 30 comeca a devolver o que ganhou.
 *
 * E o que da sentido a aposentadoria: ela chega porque os numeros cairam,
 * nao porque um contador estourou.
 */
const AGE_FACTOR: [age: number, factor: number][] = [
  [16, 0.74],
  [18, 0.82],
  [20, 0.88],
  [22, 0.93],
  [24, 0.97],
  [26, 1.0],
  [28, 1.0],
  [30, 0.97],
  [32, 0.93],
  [34, 0.87],
  [36, 0.79],
  [38, 0.7],
  [40, 0.6],
]

export function ageFactor(age: number): number {
  if (age <= AGE_FACTOR[0][0]) return AGE_FACTOR[0][1]

  for (let i = 0; i < AGE_FACTOR.length - 1; i++) {
    const [ageLow, factorLow] = AGE_FACTOR[i]
    const [ageHigh, factorHigh] = AGE_FACTOR[i + 1]

    if (age <= ageHigh) {
      const progress = (age - ageLow) / (ageHigh - ageLow)
      return factorLow + progress * (factorHigh - factorLow)
    }
  }

  return AGE_FACTOR[AGE_FACTOR.length - 1][1]
}

/** OVR exibido numa temporada: o auge escalado pela idade. */
export function currentOverall(
  peakAttrs: PlayerAttrs,
  position: Position,
  age: number,
): number {
  return clamp(Math.round(overallFor(peakAttrs, position) * ageFactor(age)), 1, 99)
}

/**
 * Ganho do foco de treino da temporada — a unica decisao do jogador entre
 * um ano e outro. Jovem evolui rapido, veterano quase nao evolui, e atributo
 * ja alto rende menos. Isso impede que treinar o mesmo atributo por quinze
 * temporadas leve todo mundo a 99.
 */
export function trainingGain(age: number, attr: Attr, value: number): number {
  if (isStarAttr(attr)) {
    // Estrelas sao grosseiras demais para ganho gradual: so sobem cedo.
    return age <= 24 && value < 5 ? 1 : 0
  }

  const base = age <= 21 ? 3 : age <= 26 ? 2 : age <= 30 ? 1 : 0
  if (base === 0) return 0

  // Quanto mais perto de 99, menor o retorno.
  const headroom = (99 - value) / 40
  return Math.max(0, Math.round(base * Math.min(1, headroom)))
}

export function applyTraining(
  attrs: PlayerAttrs,
  attr: Attr,
  age: number,
): PlayerAttrs {
  const ceiling = isStarAttr(attr) ? 5 : 99
  const gain = trainingGain(age, attr, attrs[attr])

  return { ...attrs, [attr]: clamp(attrs[attr] + gain, 1, ceiling) }
}

/**
 * Idade de aposentadoria, sorteada uma vez no inicio da carreira.
 * Fisico alto estica a carreira; o jitter evita que todo mundo pare no
 * mesmo ano e faz duas carreiras parecidas terminarem diferente.
 */
export function retirementAge(attrs: PlayerAttrs, rng: Rng): number {
  const physical = Math.round((attrs.fis - 60) / 12)
  return clamp(34 + physical + range(rng, -1, 2), 31, 40)
}
