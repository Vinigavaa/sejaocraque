/**
 * Nenhum clube disputa competicao continental sem ter conquistado a vaga.
 *
 * A regra tem tres bordas faceis de quebrar sem perceber: clube de segunda
 * divisao (a Championship nao classifica para a Champions), clube rebaixado
 * no ano em que conquistou a vaga, e jogador que troca de clube levando a
 * vaga do clube antigo junto.
 *
 * O script joga muitas carreiras inteiras, aceitando proposta sempre que
 * aparece, e conta em que competicao cada campanha aconteceu. Qualquer
 * campanha fora da faixa de classificacao aparece como violacao.
 *
 * npx tsx scripts/smoke-continental.ts
 */
import { playSeason, resolveTransfer, startCareer } from '../lib/sim/career'
import { CONTINENTALS } from '../lib/sim/competitions'
import { clubById } from '../lib/sim/data/clubs'
import { leagueById } from '../lib/sim/data/leagues'
import type { PlayerAttrs } from '../lib/sim/types'

const CAREERS = 300

const PEAK: PlayerAttrs = {
  vel: 82, fin: 84, pas: 76, dri: 83, def: 40, fis: 78, fintas: 4, pernaRuim: 3,
}

const runs = new Map<string, number>()
let violations = 0

for (let career = 0; career < CAREERS; career++) {
  let state = startCareer({
    seed: `continental:${career}`,
    name: 'Teste',
    nationality: 'BR',
    position: 'ATA',
    shirtNumber: 9,
    peakAttrs: PEAK,
  })

  while (!state.retired) {
    const { state: next, record } = playSeason(state, null)
    const league = leagueById(record.leagueId)!

    for (const run of record.cups) {
      if (run.id === 'copa') continue

      runs.set(run.id, (runs.get(run.id) ?? 0) + 1)

      const competition = CONTINENTALS.find((item) => item.id === run.id)
      const legit =
        competition && league.tier === 1 && competition.countries.includes(league.country)

      if (!legit) {
        violations++
        console.log(
          `VIOLACAO  ${clubById(record.clubId)?.name} (${league.name}) em ${run.name}`,
        )
      }
    }

    // Trocar de clube sempre que der: e o caminho que mais expoe vaga herdada.
    state = resolveTransfer(next, next.offers[0]?.clubId ?? null)
  }
}

console.log(`\n${CAREERS} carreiras\n`)

for (const [id, count] of [...runs.entries()].sort((a, b) => b[1] - a[1])) {
  const name = CONTINENTALS.find((item) => item.id === id)?.name ?? id
  console.log(`  ${name.padEnd(24)}${String(count).padStart(5)} campanhas`)
}

console.log(`\n  violacoes: ${violations}\n`)
