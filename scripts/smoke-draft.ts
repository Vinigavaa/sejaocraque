/**
 * Sanidade do balanceamento: roda muitas carreiras com escolhas aleatorias e
 * mostra onde a regua coloca um jogador que nao pensou em nada.
 *
 * A referencia e a curva "dura": um draft ao acaso deve ficar por volta de 72,
 * e OVR 90+ tem que ser raro. Se a mediana subir, o topo da escada perde valor.
 *
 * npx tsx scripts/smoke-draft.ts
 */
import {
  attrsFromPicks,
  availableAttrs,
  isComplete,
  pickAttr,
  startDraft,
  DEFAULT_REROLLS,
} from '../lib/sim/draft'
import { CLUBS } from '../lib/sim/data/clubs'
import { LEGENDS } from '../lib/sim/data/legends'
import { overallByPosition, overallFor, rawOverallFor } from '../lib/sim/positions'
import { ageFactor, currentOverall, retirementAge, START_AGE } from '../lib/sim/progression'
import { createRng, randomSeed } from '../lib/sim/rng'
import { POSITIONS, type PlayerAttrs, type Position } from '../lib/sim/types'

const RUNS = 3000

const curved: number[] = []
const raw: number[] = []
const retirements: number[] = []
const bestPositionCount: Record<string, number> = {}
const samplePlayers: { attrs: PlayerAttrs; position: Position }[] = []
const byPosition: Record<Position, number[]> = Object.fromEntries(
  POSITIONS.map((position) => [position, [] as number[]]),
) as Record<Position, number[]>

for (let run = 0; run < RUNS; run++) {
  const seed = randomSeed()
  const rng = createRng(`escolha:${seed}`)

  let state = startDraft(
    { seed, mode: 'amador', rerolls: DEFAULT_REROLLS.amador },
    LEGENDS,
  )

  // Jogador ingenuo: escolhe um atributo disponivel ao acaso.
  while (!isComplete(state)) {
    const options = availableAttrs(state)
    state = pickAttr(state, options[Math.floor(rng() * options.length)], LEGENDS)
  }

  const attrs = attrsFromPicks(state.picks)
  const best = overallByPosition(attrs)[0]

  curved.push(best.overall)
  raw.push(rawOverallFor(attrs, best.position))
  retirements.push(retirementAge(attrs, rng))
  bestPositionCount[best.position] = (bestPositionCount[best.position] ?? 0) + 1

  for (const position of POSITIONS) {
    byPosition[position].push(overallFor(attrs, position))
  }

  if (samplePlayers.length < 1) {
    samplePlayers.push({ attrs, position: best.position })
  }
}

section('DRAFT ALEATORIO', `${RUNS} carreiras · OVR de auge na melhor posicao`)
console.log('        cru    curva')
for (const [label, p] of [
  ['min', 0],
  ['p25', 0.25],
  ['mediana', 0.5],
  ['p75', 0.75],
  ['p95', 0.95],
  ['max', 1],
] as const) {
  console.log(
    `  ${label.padEnd(8)}${String(percentile(raw, p)).padStart(3)}` +
      `${String(percentile(curved, p)).padStart(9)}`,
  )
}
console.log(`  ${'media'.padEnd(8)}${mean(raw).toFixed(0).padStart(3)}${mean(curved).toFixed(0).padStart(9)}`)

const elite = curved.filter((value) => value >= 90).length
console.log(`\n  OVR 90+  ${((elite / RUNS) * 100).toFixed(1)}% das carreiras`)

// A metrica que importa para justica: escolher volante nao pode custar OVR.
// Se as medias forem iguais, nenhuma posicao e punida por construcao.
section('OVR MEDIO DE CADA POSICAO', 'o mesmo draft avaliado nas oito')
for (const position of POSITIONS) {
  const values = byPosition[position]
  console.log(
    `  ${position.padEnd(4)} media ${mean(values).toFixed(1).padStart(5)}   ` +
      `p95 ${String(percentile(values, 0.95)).padStart(2)}`,
  )
}

// Metrica diferente: quem troca sempre para a melhor posicao acaba onde?
// Nao precisa ser 12,5% em cada — depende de quanto as posicoes se parecem.
section('QUAL POSICAO SAIU MELHOR', 'para quem sempre troca')
for (const [position, count] of Object.entries(bestPositionCount).sort(
  (a, b) => b[1] - a[1],
)) {
  const share = (count / RUNS) * 100
  console.log(`  ${position.padEnd(4)} ${share.toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(share / 2))}`)
}

section('ARCO DE UMA CARREIRA', 'auge do exemplo escalado pela idade')
const { attrs, position } = samplePlayers[0]
console.log(`  posicao ${position} · auge ${overallFor(attrs, position)}\n`)
for (let age = START_AGE; age <= 38; age += 2) {
  const ovr = currentOverall(attrs, position, age)
  console.log(
    `  ${age} anos  ${String(ovr).padStart(2)}  ${'▇'.repeat(Math.round(ovr / 2))}` +
      `${age === 26 || age === 28 ? '  ← auge' : ''}`,
  )
}

section('APOSENTADORIA')
console.log(`  mais cedo ${Math.min(...retirements)} · mediana ${percentile(retirements, 0.5)} · mais tarde ${Math.max(...retirements)}`)

section('REFERENCIA DE CLUBES', 'para comparar com o OVR do jogador')
const strengths = CLUBS.map((club) => club.strength).sort((a, b) => a - b)
console.log(`  mais fraco ${strengths[0]} · mediana ${percentile(strengths, 0.5)} · mais forte ${strengths[strengths.length - 1]}`)

console.log()

function section(title: string, subtitle?: string) {
  console.log(`\n${title}${subtitle ? ` · ${subtitle}` : ''}\n`)
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * p)]
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

// Silencia aviso de import nao usado quando o arco muda de forma.
void ageFactor
void POSITIONS
