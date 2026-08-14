/**
 * Frequencia e coerencia das transferencias.
 *
 *   npx tsx scripts/smoke-transfers.ts
 *
 * Roda muitas carreiras completas e mede o que o jogador vai sentir: quantas
 * vezes ele troca de clube numa carreira, quanto tempo fica em cada um, e se
 * as propostas respeitam os destinos pedidos ao empresario.
 */
import { leagueOfClub } from '../lib/sim/world'
import { clubById } from '../lib/sim/data/clubs'
import { leagueOf } from '../lib/sim/data/clubs'
import {
  playSeason,
  resolveTransfer,
  renewContract,
  setFarewellLeague,
  setPreferences,
  startCareer,
  type CareerState,
} from '../lib/sim/career'
import { currentOverall } from '../lib/sim/progression'
import { createRng } from '../lib/sim/rng'
import {
  FAREWELL_AGE,
  matchesPreference,
  type TransferPreferences,
} from '../lib/sim/transfers'
import { overallFor } from '../lib/sim/positions'
import { ALL_ATTRS, type PlayerAttrs, type Position } from '../lib/sim/types'

const CAREERS = 300

type Sample = {
  clubs: number
  seasons: number
  offers: number
  offSpec: number
  transfers: number
  /** Forca do clube em que o jogador terminou a carreira. */
  finalStrength: number
  /** Maior forca de clube alcancada. */
  peakStrength: number
  interest: number
}

/**
 * Um jogador cujo auge e proximo de `peak`.
 *
 * Os atributos brutos nao estao na mesma escala do OVR — `overallFor` calibra
 * e aplica uma curva por posicao, entao atributos na casa dos 58 podem virar
 * um OVR 95. Por isso o nivel bruto e encontrado por busca binaria: e o unico
 * jeito de comparar de fato um craque com um coadjuvante.
 */
function attrsFor(peak: number, position: Position, rng: () => number): PlayerAttrs {
  // Desvios sorteados uma vez e reaproveitados: mudar o nivel base nao pode
  // mudar o formato do jogador, senao a busca nao converge.
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

function runCareer(
  seed: string,
  peak: number,
  position: Position,
  preferences: TransferPreferences,
): Sample {
  const rng = createRng(seed)

  let state = startCareer({
    seed,
    name: 'Teste',
    nationality: 'BR',
    position,
    shirtNumber: 10,
    peakAttrs: attrsFor(peak, position, rng),
    careerMode: 'classico',
    startClubId: null,
  })

  state = setPreferences(state, preferences)

  const clubs = new Set<string>([state.clubId])
  const sample: Sample = {
    clubs: 0,
    seasons: 0,
    offers: 0,
    offSpec: 0,
    transfers: 0,
    finalStrength: 0,
    peakStrength: 0,
    interest: 0,
  }
  let guard = 0

  while (!state.retired && guard < 30) {
    const result = playSeason(state, null)
    state = result.state
    sample.seasons++

    sample.offers += state.offers.length

    for (const offer of state.offers) {
      const club = clubById(offer.clubId)
      const league = club ? leagueOfClub(state.world, club.id) : undefined
      if (club && league && !matchesPreference(club, preferences, league)) sample.offSpec++
    }

    // Aceita a melhor proposta que nao rebaixe o jogador de nivel — o mesmo
    // criterio do "pular para o fim" do jogo.
    const overall = currentOverall(state.peakAttrs, position, state.age)
    const best = state.offers
      .map((offer) => clubById(offer.clubId))
      .filter((club) => club && club.strength >= overall - 4)
      .sort((a, b) => (b?.strength ?? 0) - (a?.strength ?? 0))[0]

    // Sem proposta aceitavel, renova. Recusar tudo com o contrato vencido
    // encerraria a carreira, e o que este teste mede e o mercado ao longo de
    // uma carreira inteira.
    const before = state.clubId
    if (best) state = resolveTransfer(state, best.id)
    else if (state.renewal) state = renewContract(state, state.renewal)
    else state = resolveTransfer(state, null)
    if (state.clubId !== before) sample.transfers++

    clubs.add(state.clubId)
    const now = clubById(state.clubId)?.strength ?? 0
    sample.peakStrength = Math.max(sample.peakStrength, now)
    sample.finalStrength = now
    guard++
  }

  sample.clubs = clubs.size
  return sample
}

function report(title: string, samples: Sample[]): void {
  const total = samples.length
  const avg = (of: (s: Sample) => number) =>
    samples.reduce((sum, s) => sum + of(s), 0) / total

  const seasons = avg((s) => s.seasons)
  const transfers = avg((s) => s.transfers)
  const offers = avg((s) => s.offers)
  const offSpec = samples.reduce((sum, s) => sum + s.offSpec, 0)
  const allOffers = samples.reduce((sum, s) => sum + s.offers, 0)
  const never = samples.filter((s) => s.transfers === 0).length

  console.log(`\n── ${title} ──`)
  console.log(`  temporadas por carreira   ${seasons.toFixed(1)}`)
  console.log(`  transferencias            ${transfers.toFixed(1)}`)
  console.log(`  clubes na carreira        ${avg((s) => s.clubs).toFixed(1)}`)
  console.log(`  anos por clube            ${(seasons / (transfers + 1)).toFixed(1)}`)
  console.log(`  propostas recebidas       ${offers.toFixed(1)}`)
  console.log(
    `  propostas por temporada   ${(offers / seasons).toFixed(2)}` +
      ` (chance de mercado ${((offers / seasons) * 100).toFixed(0)}%)`,
  )
  console.log(`  carreiras sem trocar      ${((never / total) * 100).toFixed(0)}%`)
  console.log(`  forca do clube final      ${avg((s) => s.finalStrength).toFixed(1)}`)
  console.log(`  maior clube alcancado     ${avg((s) => s.peakStrength).toFixed(1)}`)
  if (allOffers > 0) {
    console.log(
      `  fora do destino pedido    ${offSpec}/${allOffers}` +
        ` (${((offSpec / allOffers) * 100).toFixed(0)}%)`,
    )
  }
}

const profiles: { title: string; peak: number; preferences: TransferPreferences }[] = [
  { title: 'craque (peak ~88), sem preferencia', peak: 88, preferences: [] },
  { title: 'medio (peak ~72), sem preferencia', peak: 72, preferences: [] },
  { title: 'limitado (peak ~58), sem preferencia', peak: 58, preferences: [] },
  { title: 'craque pedindo Espanha', peak: 88, preferences: ['ES'] },
  { title: 'craque pedindo Premier League', peak: 88, preferences: ['en-1'] },
  { title: 'medio pedindo Premier League', peak: 72, preferences: ['en-1'] },
]

for (const profile of profiles) {
  const samples: Sample[] = []

  for (let index = 0; index < CAREERS; index++) {
    samples.push(runCareer(`t${index}`, profile.peak, 'ATA', profile.preferences))
  }

  report(profile.title, samples)
}

// Onde os clubes procurados de fato ficam, para conferir se o pedido pesa.
const destinations = new Map<string, number>()
for (let index = 0; index < CAREERS; index++) {
  const seed = `d${index}`
  const rng = createRng(seed)
  let state: CareerState = startCareer({
    seed,
    name: 'Teste',
    nationality: 'BR',
    position: 'ATA',
    shirtNumber: 10,
    peakAttrs: attrsFor(88, 'ATA', rng),
    careerMode: 'classico',
    startClubId: null,
  })
  state = setPreferences(state, ['it-1'])

  let guard = 0
  while (!state.retired && guard < 30) {
    state = playSeason(state, null).state
    for (const offer of state.offers) {
      const club = clubById(offer.clubId)
      if (!club) continue
      const country = leagueOf(club).country
      destinations.set(country, (destinations.get(country) ?? 0) + 1)
    }
    state = state.offers[0]
      ? resolveTransfer(state, state.offers[0].clubId)
      : state.renewal
        ? renewContract(state, state.renewal)
        : resolveTransfer(state, null)
    guard++
  }
}

console.log('\n── craque pedindo Serie A italiana: de onde vieram as propostas ──')
const ranked = [...destinations.entries()].sort((a, b) => b[1] - a[1])
const totalOffers = ranked.reduce((sum, [, count]) => sum + count, 0)
for (const [country, count] of ranked.slice(0, 6)) {
  console.log(`  ${country}  ${count}  (${((count / totalOffers) * 100).toFixed(0)}%)`)
}

/**
 * A promessa do fim de carreira: dos 31 anos em diante, o jogador que escolheu
 * uma liga recebe pelo menos uma proposta de la por temporada — enquanto tiver
 * nivel para algum clube de la.
 *
 * As temporadas sem proposta sao esperadas e devem ser as do jogador que ja
 * caiu abaixo do teto da liga escolhida. O numero util aqui e a cobertura entre
 * quem ainda tem nivel.
 */
{
  let seasons = 0
  let covered = 0

  for (let index = 0; index < CAREERS; index++) {
    const seed = `f${index}`
    const rng = createRng(seed)
    let state: CareerState = startCareer({
      seed,
      name: 'Teste',
      nationality: 'BR',
      position: 'ATA',
      shirtNumber: 10,
      peakAttrs: attrsFor(80, 'ATA', rng),
      careerMode: 'classico',
    startClubId: null,
    })

    let guard = 0
    while (!state.retired && guard < 30) {
      if (state.age >= FAREWELL_AGE && !state.farewellLeagueId) {
        state = setFarewellLeague(state, 'sa-1')
      }

      const before = state.age
      state = playSeason(state, null).state

      if (before >= FAREWELL_AGE) {
        seasons++
        const fromLeague = state.offers.some(
          (offer) => clubById(offer.clubId)?.leagueId === 'sa-1',
        )
        if (fromLeague) covered++
      }

      // Fica onde esta, mas renova quando o contrato acaba: sem isso a
      // carreira encerraria por falta de clube antes dos 31 e o teste mediria
      // uma amostra vazia.
      state = state.renewal
        ? renewContract(state, state.renewal)
        : resolveTransfer(state, null)
      guard++
    }
  }

  console.log('\n── veterano pedindo a Saudi Pro League (a partir dos 31) ──')
  console.log(`  temporadas apos a escolha  ${seasons}`)
  console.log(
    `  com proposta da liga       ${covered}/${seasons}` +
      ` (${((covered / Math.max(1, seasons)) * 100).toFixed(0)}%)`,
  )
}
