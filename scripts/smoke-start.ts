/**
 * Onde os jogadores estreiam.
 *
 *   npx tsx scripts/smoke-start.ts
 *
 * Mede a divisao e o clube de estreia por faixa de potencial. O que se espera
 * ver: a joia com chance real de comecar na primeira divisao, o jogador
 * limitado quase sempre embaixo, e ninguem preso a uma unica resposta.
 */
import { startCareer } from '../lib/sim/career'
import { clubById, leagueOf } from '../lib/sim/data/clubs'
import { overallFor } from '../lib/sim/positions'
import { currentOverall } from '../lib/sim/progression'
import { createRng } from '../lib/sim/rng'
import { ALL_ATTRS, type PlayerAttrs, type Position } from '../lib/sim/types'

const RUNS = 2000

/**
 * Um jogador cujo auge fica proximo de `peak`.
 *
 * Os atributos brutos nao estao na escala do OVR — `overallFor` calibra e
 * aplica uma curva por posicao — entao o nivel base e encontrado por busca
 * binaria. Sem isso, "58" viraria um OVR 95 e a comparacao seria falsa.
 */
function attrsFor(peak: number, position: Position, rng: () => number): PlayerAttrs {
  const spread: Record<string, number> = {}
  for (const attr of ALL_ATTRS) spread[attr] = rng() * 12 - 6

  const build = (base: number): PlayerAttrs => {
    const attrs = {} as PlayerAttrs
    for (const attr of ALL_ATTRS) {
      attrs[attr] = attr.endsWith('Star')
        ? 3
        : Math.max(1, Math.min(99, Math.round(base + spread[attr])))
    }
    return attrs
  }

  let low = 1
  let high = 99
  for (let step = 0; step < 12; step++) {
    const mid = (low + high) / 2
    if (overallFor(build(mid), position) < peak) low = mid
    else high = mid
  }

  return build((low + high) / 2)
}

function measure(label: string, peak: number, nationality: string): void {
  const tiers = new Map<number, number>()
  const clubs = new Map<string, number>()
  let strength = 0
  let debut = 0

  for (let index = 0; index < RUNS; index++) {
    const rng = createRng(`s${index}`)
    const attrs = attrsFor(peak, 'ATA', rng)

    const state = startCareer({
      seed: `s${index}`,
      name: 'Teste',
      nationality,
      position: 'ATA',
      shirtNumber: 10,
      peakAttrs: attrs,
    })

    const club = clubById(state.clubId)
    if (!club) continue

    const tier = leagueOf(club).tier
    tiers.set(tier, (tiers.get(tier) ?? 0) + 1)
    clubs.set(club.name, (clubs.get(club.name) ?? 0) + 1)
    strength += club.strength
    debut += currentOverall(attrs, 'ATA', 16)
  }

  console.log(`\n── ${label} (potencial ~${peak}, ${nationality}) ──`)
  console.log(`  OVR de estreia aos 16     ${(debut / RUNS).toFixed(0)}`)

  for (const tier of [...tiers.keys()].sort()) {
    const share = ((tiers.get(tier) ?? 0) / RUNS) * 100
    const bar = '█'.repeat(Math.round(share / 2))
    console.log(`  divisao ${tier}                 ${share.toFixed(0).padStart(3)}%  ${bar}`)
  }

  console.log(`  forca media do clube      ${(strength / RUNS).toFixed(1)}`)
  console.log(`  clubes distintos          ${clubs.size}`)

  const top = [...clubs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  console.log(
    `  mais comuns               ${top
      .map(([name, count]) => `${name} ${((count / RUNS) * 100).toFixed(0)}%`)
      .join(' · ')}`,
  )
}

// Brasil e o unico pais com tres divisoes — e onde a regra aparece inteira.
measure('joia', 92, 'BR')
measure('promessa forte', 84, 'BR')
measure('promessa media', 76, 'BR')
measure('regular', 68, 'BR')
measure('limitado', 58, 'BR')

// Pais de duas divisoes: o peso da terceira precisa cair na segunda.
measure('joia', 92, 'EN')
measure('limitado', 58, 'EN')

// Pais de uma divisao so: todo mundo estreia nela, mas em clubes diferentes.
measure('joia', 92, 'PT')
measure('limitado', 58, 'PT')

// Sem liga no proprio pais: comeca fora.
measure('joia', 92, 'HR')
measure('limitado', 58, 'HR')
