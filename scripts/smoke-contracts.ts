/**
 * Salarios, contratos e negociacao.
 *
 *   npx tsx scripts/smoke-contracts.ts
 *
 * Tres perguntas, nesta ordem:
 *
 * 1. Os salarios sao plausiveis? Um craque na Premier League tem de ganhar
 *    muito mais que o mesmo craque na Serie B — e nenhum clube pode pagar
 *    acima do proprio teto por melhor que o jogador negocie.
 * 2. A negociacao tem margem real? Se pedir 20% a mais sempre falha, ninguem
 *    negocia; se sempre da certo, negociar deixa de ser decisao.
 * 3. Uma carreira inteira fecha com numeros coerentes?
 */
import { playSeason, renewContract, resolveTransfer, startCareer, type CareerState } from '../lib/sim/career'
import {
  chanceBand,
  clubTopSalary,
  fairSalary,
  formatSalary,
  negotiation,
  successChance,
  squadRole,
  ROLE_LABEL,
} from '../lib/sim/contracts'
import { clubById } from '../lib/sim/data/clubs'
import { leagueById } from '../lib/sim/data/leagues'
import { currentOverall } from '../lib/sim/progression'
import { createRng } from '../lib/sim/rng'
import { overallFor } from '../lib/sim/positions'
import { ALL_ATTRS, type PlayerAttrs, type Position } from '../lib/sim/types'

/** Um jogador cujo auge e proximo de `peak`. Mesma busca do smoke-transfers. */
function attrsFor(peak: number, position: Position, rng: () => number): PlayerAttrs {
  const spread: Record<string, number> = {}
  for (const attr of ALL_ATTRS) spread[attr] = rng() * 12 - 6

  const build = (base: number): PlayerAttrs => {
    const attrs = {} as PlayerAttrs
    for (const attr of ALL_ATTRS) {
      attrs[attr] = Math.max(1, Math.min(99, Math.round(base + spread[attr])))
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

console.log('── teto salarial dos clubes ──')
for (const id of ['real-madrid', 'manchester-city', 'flamengo', 'al-hilal', 'porto', 'sport']) {
  const club = clubById(id)
  if (!club) continue
  const league = leagueById(club.leagueId)
  console.log(
    `  ${club.name.padEnd(18)} ${String(club.strength).padStart(2)}  ${(league?.name ?? '').padEnd(22)}` +
      ` teto ${formatSalary(clubTopSalary(club))}`,
  )
}

console.log('\n── salario justo por perfil (25 anos, reputacao media) ──')
for (const id of ['real-madrid', 'flamengo', 'al-hilal', 'sport']) {
  const club = clubById(id)
  if (!club) continue

  console.log(`  ${club.name} (${club.strength})`)
  for (const overall of [club.strength - 8, club.strength, club.strength + 6]) {
    const input = {
      overall,
      potential: overall + 4,
      age: 25,
      reputation: 4,
      club,
      form: { matches: 30, rating: 7.1 },
    }
    console.log(
      `    OVR ${overall}  ${ROLE_LABEL[squadRole(overall, club)].padEnd(18)}` +
        ` ${formatSalary(fairSalary(input))}`,
    )
  }
}

console.log('\n── margem de negociacao (craque OVR 84 em clubes diferentes) ──')
for (const id of ['real-madrid', 'flamengo', 'sport']) {
  const club = clubById(id)
  if (!club) continue

  const input = {
    overall: 84,
    potential: 88,
    age: 26,
    reputation: 6,
    club,
    form: { matches: 32, rating: 7.4 },
  }
  const offer = { salary: fairSalary(input), years: 3 }
  const mesa = negotiation(input, offer, true)

  const line = [1, 1.1, 1.25, 1.5, 1.8]
    .map((factor) => {
      const chance = successChance(mesa, { salary: offer.salary * factor, years: 3 })
      return `x${factor.toFixed(2)}=${Math.round(chance * 100)}%`
    })
    .join('  ')

  console.log(
    `  ${club.name.padEnd(16)} oferta ${formatSalary(offer.salary).padStart(9)}` +
      ` teto ${formatSalary(mesa.ceiling).padStart(9)}  ${line}`,
  )
  console.log(
    `    no teto: ${chanceBand(successChance(mesa, { salary: mesa.ceiling, years: 3 }))}` +
      ` · um ano a mais que o clube quer: ` +
      `${Math.round(successChance(mesa, { salary: offer.salary, years: mesa.preferredYears + 1 }) * 100)}%`,
  )
}

console.log('\n── carreiras completas: contratos e ganhos ──')
for (const peak of [88, 74, 60]) {
  let earnings = 0
  let contracts = 0
  let free = 0
  let seasons = 0
  const runs = 60

  for (let index = 0; index < runs; index++) {
    const seed = `c${index}`
    const rng = createRng(seed)
    let state: CareerState = startCareer({
      seed,
      name: 'Teste',
      nationality: 'BR',
      position: 'ATA',
      shirtNumber: 10,
      peakAttrs: attrsFor(peak, 'ATA', rng),
      careerMode: 'classico',
    startClubId: null,
    })

    let guard = 0
    while (!state.retired && guard < 30) {
      state = playSeason(state, null).state
      if (state.retired) break

      // Sem negociar: aceita a melhor proposta que nao encoste no banco, senao
      // renova, senao fica. E o piso de comportamento do jogador.
      const overall = currentOverall(state.peakAttrs, 'ATA', state.age)
      const best = state.offers
        .map((offer) => clubById(offer.clubId))
        .filter((club) => club && club.strength <= overall + 5)
        .sort((a, b) => (b?.strength ?? 0) - (a?.strength ?? 0))[0]

      if (best) {
        state = resolveTransfer(state, best.id)
        contracts++
      } else if (state.renewal) {
        state = renewContract(state, state.renewal)
        contracts++
      } else {
        state = resolveTransfer(state, null)
      }

      guard++
    }

    earnings += state.earnings
    seasons += state.seasons.length
    if (state.retiredFree) free++
  }

  console.log(
    `  auge ~${peak}: ${(seasons / runs).toFixed(1)} temporadas · ` +
      `${(contracts / runs).toFixed(1)} contratos assinados · ` +
      `ganhos ${formatSalary(earnings / runs)} · ` +
      `sem clube ${Math.round((free / runs) * 100)}%`,
  )
}
