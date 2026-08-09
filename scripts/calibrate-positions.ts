/**
 * Mede a distribuicao de OVR cru de cada posicao sobre drafts aleatorios e
 * imprime as constantes de calibragem para colar em `positions.ts`.
 *
 * Existe porque as posicoes nao competem em pe de igualdade por construcao:
 * cada atributo tem media propria no pool de lendas, e quem pesa o atributo
 * mais fraco perde sempre. Medir e a unica forma honesta de corrigir.
 *
 * npx tsx scripts/calibrate-positions.ts
 */
import { LEGENDS } from '../lib/sim/data/legends'
import {
  attrsFromPicks,
  availableAttrs,
  isComplete,
  pickAttr,
  startDraft,
  DEFAULT_REROLLS,
} from '../lib/sim/draft'
import { rawOverallFor } from '../lib/sim/positions'
import { createRng, randomSeed } from '../lib/sim/rng'
import { ALL_ATTRS, POSITIONS, type Position } from '../lib/sim/types'

const RUNS = 20000

const samples: Record<Position, number[]> = Object.fromEntries(
  POSITIONS.map((position) => [position, [] as number[]]),
) as Record<Position, number[]>

const attrValues: Record<string, number[]> = Object.fromEntries(
  ALL_ATTRS.map((attr) => [attr, [] as number[]]),
)

for (let run = 0; run < RUNS; run++) {
  const seed = randomSeed()
  const rng = createRng(`calibra:${seed}`)

  let state = startDraft(
    { seed, mode: 'amador', rerolls: DEFAULT_REROLLS.amador },
    LEGENDS,
  )

  while (!isComplete(state)) {
    const options = availableAttrs(state)
    state = pickAttr(state, options[Math.floor(rng() * options.length)], LEGENDS)
  }

  const attrs = attrsFromPicks(state.picks)

  for (const attr of ALL_ATTRS) {
    attrValues[attr].push(attrs[attr])
  }
  for (const position of POSITIONS) {
    samples[position].push(rawOverallFor(attrs, position))
  }
}

console.log(`\nMEDIA DE CADA ATRIBUTO NO DRAFT · ${RUNS} simulacoes\n`)
for (const attr of ALL_ATTRS) {
  const values = attrValues[attr]
  console.log(`  ${attr.padEnd(10)} media ${mean(values).toFixed(1).padStart(5)}   desvio ${std(values).toFixed(1)}`)
}

console.log(`\nOVR CRU POR POSICAO\n`)
const stats = POSITIONS.map((position) => ({
  position,
  mean: mean(samples[position]),
  std: std(samples[position]),
}))

for (const stat of stats) {
  console.log(
    `  ${stat.position.padEnd(4)} media ${stat.mean.toFixed(1).padStart(5)}   desvio ${stat.std.toFixed(2)}`,
  )
}

const targetMean = mean(stats.map((stat) => stat.mean))
const targetStd = mean(stats.map((stat) => stat.std))

console.log(`\nALVO COMUM\n`)
console.log(`  media ${targetMean.toFixed(1)}   desvio ${targetStd.toFixed(2)}`)

console.log(`\nCOLE EM positions.ts\n`)
console.log(`const TARGET_MEAN = ${targetMean.toFixed(1)}`)
console.log(`const TARGET_STD = ${targetStd.toFixed(2)}\n`)
console.log(`const CALIBRATION: Record<Position, { mean: number; std: number }> = {`)
for (const stat of stats) {
  console.log(`  ${stat.position}: { mean: ${stat.mean.toFixed(1)}, std: ${stat.std.toFixed(2)} },`)
}
console.log(`}\n`)

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function std(values: number[]): number {
  const m = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length)
}
