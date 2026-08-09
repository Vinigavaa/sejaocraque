/**
 * Coerencia da final de mata-mata.
 *
 * O placar da final passou a alimentar a narracao minuto a minuto, entao ele
 * precisa concordar com o campeao: quem levanta a taca e quem fez mais gols,
 * ou quem venceu o desempate quando o jogo empatou.
 *
 * npx tsx scripts/smoke-knockout.ts
 */
import { finalIn, nationalCupEntrants, simulateKnockout } from '../lib/sim/competitions'
import { createRng } from '../lib/sim/rng'

const RUNS = 500
const COUNTRIES = ['BR', 'EN', 'ES', 'DE', 'AR']

const errors: string[] = []
let penalties = 0
let goals = 0

for (const country of COUNTRIES) {
  const entrants = nationalCupEntrants(country)

  for (let run = 0; run < RUNS; run++) {
    const outcome = simulateKnockout(entrants, createRng(`copa:${country}:${run}`))
    const final = finalIn(outcome, outcome.winnerId)

    if (!final) {
      errors.push(`${country}/${run}: copa sem final`)
      continue
    }

    if (!final.won) {
      errors.push(`${country}/${run}: campeao nao e o vencedor da final`)
    }

    if (final.opponentId === outcome.winnerId) {
      errors.push(`${country}/${run}: final com o mesmo clube dos dois lados`)
    }

    if (final.onPenalties && final.forGoals !== final.againstGoals) {
      errors.push(
        `${country}/${run}: penaltis com placar ${final.forGoals}-${final.againstGoals}`,
      )
    }

    if (!final.onPenalties && final.forGoals <= final.againstGoals) {
      errors.push(
        `${country}/${run}: campeao no tempo normal com placar ` +
          `${final.forGoals}-${final.againstGoals}`,
      )
    }

    if (final.onPenalties) penalties++
    goals += final.forGoals + final.againstGoals
  }
}

const total = RUNS * COUNTRIES.length

console.log(`\nFINAIS · ${total} decisoes\n`)
console.log(`  nos penaltis   ${((penalties / total) * 100).toFixed(1)}%`)
console.log(`  gols por final ${(goals / total).toFixed(2)}`)

if (errors.length > 0) {
  console.log(`\nERROS\n`)
  for (const error of errors.slice(0, 20)) console.log(`  x ${error}`)
  console.log(`\n${errors.length} erro(s).\n`)
  process.exit(1)
}

console.log(`\nFinais coerentes.\n`)
