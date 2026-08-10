/**
 * Quem ganha Bola de Ouro, e com que temporada.
 *
 * O premio precisa ser raro sem ser inalcancavel: uma temporada excepcional
 * tem que passar mesmo antes de o jogador virar craque consagrado, e uma
 * temporada apenas boa nao pode passar nunca. E o unico jeito de calibrar
 * `BALLON_BAR` — o numero sozinho nao diz nada.
 *
 * Referencia: um jogador de auge alto deve terminar a carreira com algumas,
 * um de auge medio com nenhuma ou uma, e o ano da conquista deve ser um ano
 * visivelmente melhor que os outros da mesma carreira.
 *
 * O aproveitamento por numero de titulos e a outra metade da calibragem, e
 * tem forma esperada: zero em quem nao ganhou nada, minoria em quem ganhou um
 * titulo, maioria em quem ganhou dois, e nunca 100% — sempre ha um rival que
 * tambem fez uma grande temporada.
 *
 * npx tsx scripts/smoke-awards.ts
 */
import { playSeason, resolveTransfer, startCareer, type SeasonRecord } from '../lib/sim/career'
import { leagueById } from '../lib/sim/data/leagues'
import { nationById } from '../lib/sim/data/nations'
import { overallFor } from '../lib/sim/positions'
import type { PlayerAttrs } from '../lib/sim/types'

const CAREERS = 200

/** OVR de auge testado, do craque geracional ao titular de meio de tabela. */
const LEVELS = [88, 82, 76, 70]

/**
 * Atributos que rendem o OVR de auge pedido.
 *
 * A escala nao e linear — calibragem por posicao e curva mexem no numero —,
 * entao o valor sai por busca em vez de conta.
 */
function attrsForOverall(target: number): PlayerAttrs {
  let best = flat(50)

  for (let value = 40; value <= 99; value++) {
    const attrs = flat(value)
    if (Math.abs(overallFor(attrs, 'ATA') - target) < Math.abs(overallFor(best, 'ATA') - target)) {
      best = attrs
    }
  }

  return best
}

function flat(value: number): PlayerAttrs {
  return { vel: value, fin: value, pas: value, dri: value, def: value, fis: value, fintas: 4, pernaRuim: 3 }
}

/**
 * Titulos que a Bola de Ouro conta, na mesma regra do motor: primeira divisao,
 * copa, continental e selecao.
 */
function relevantTitles(record: SeasonRecord): number {
  const tier = leagueById(record.leagueId)?.tier
  return (
    (record.champion && tier === 1 ? 1 : 0) +
    record.cups.filter((run) => run.won).length +
    (record.national?.tournament?.won ? 1 : 0)
  )
}

function inEurope(record: SeasonRecord): boolean {
  const country = leagueById(record.leagueId)?.country
  return !!country && nationById(country)?.confederation === 'UEFA'
}

for (const target of LEVELS) {
  const peakAttrs = attrsForOverall(target)
  const perCareer: number[] = []
  const winners: SeasonRecord[] = []
  let seasons = 0

  // Aproveitamento por numero de titulos, contando so temporadas na Europa —
  // fora dela o jogador nem e elegivel, e a media ficaria diluida.
  const tries = [0, 0, 0, 0]
  const hits = [0, 0, 0, 0]

  for (let career = 0; career < CAREERS; career++) {
    let state = startCareer({
      seed: `premios:${target}:${career}`,
      name: 'Teste',
      nationality: 'BR',
      position: 'ATA',
      shirtNumber: 9,
      peakAttrs,
      careerMode: 'classico',
    })

    let won = 0

    while (!state.retired) {
      const { state: next, record } = playSeason(state, null)
      seasons++

      const awarded = record.awards.includes('bola-de-ouro')

      if (awarded) {
        won++
        winners.push(record)
      }

      if (inEurope(record)) {
        const bucket = Math.min(relevantTitles(record), 3)
        tries[bucket]++
        if (awarded) hits[bucket]++
      }

      state = resolveTransfer(next, next.offers[0]?.clubId ?? null)
    }

    perCareer.push(won)
  }

  const total = perCareer.reduce((sum, count) => sum + count, 0)
  const never = perCareer.filter((count) => count === 0).length

  console.log(`\nOVR de auge ${overallFor(peakAttrs, 'ATA')}\n`)
  console.log(`  ${(total / CAREERS).toFixed(2)} por carreira · maximo ${Math.max(...perCareer)}`)
  console.log(`  ${((never / CAREERS) * 100).toFixed(0)}% das carreiras sem nenhuma`)
  console.log(`  ${((total / seasons) * 100).toFixed(1)}% das temporadas premiadas`)

  if (winners.length > 0) {
    console.log(`  temporada media do vencedor: ${average(winners)}`)
  }

  console.log('  na Europa, por titulos na temporada:')
  for (let titles = 0; titles < tries.length; titles++) {
    if (tries[titles] === 0) continue
    const label = titles === 3 ? '3+' : String(titles)
    const rate = (hits[titles] / tries[titles]) * 100
    console.log(
      `    ${label} titulo(s): ${rate.toFixed(1).padStart(5)}%  (${hits[titles]}/${tries[titles]})`,
    )
  }
}

console.log()

function average(records: SeasonRecord[]): string {
  const mean = (pick: (record: SeasonRecord) => number) =>
    records.reduce((sum, record) => sum + pick(record), 0) / records.length

  const goals = mean(
    (record) => record.stats.goals + record.cups.reduce((sum, run) => sum + run.goals, 0),
  )
  const assists = mean(
    (record) => record.stats.assists + record.cups.reduce((sum, run) => sum + run.assists, 0),
  )
  const titles = mean(
    (record) => (record.champion ? 1 : 0) + record.cups.filter((run) => run.won).length,
  )

  return (
    `${goals.toFixed(1)} gols, ${assists.toFixed(1)} assist., ` +
    `nota ${mean((record) => record.stats.rating).toFixed(2)}, ` +
    `${titles.toFixed(1)} titulos, overall ${mean((record) => record.overall).toFixed(0)}`
  )
}
