/**
 * Quanto um craque muda a temporada do clube.
 *
 * Roda a mesma liga muitas vezes com e sem o jogador e compara colocacao media
 * e taxa de titulo. E o unico jeito de calibrar o teto do reforco: baixo demais
 * e escolher um clube pequeno continua sendo so competicao mais fraca, alto
 * demais e a carreira em clube grande perde o sentido.
 *
 * npx tsx scripts/smoke-impact.ts
 */
import { clubById, clubsInLeague } from '../lib/sim/data/clubs'
import { leagueById } from '../lib/sim/data/leagues'
import { clubLift, MAX_LIFT } from '../lib/sim/impact'
import { createRng } from '../lib/sim/rng'
import {
  averageStrength,
  matchesInLeague,
  positionInTable,
  simulateLeague,
  simulatePlayerSeason,
} from '../lib/sim/season'

const SEASONS = 300

const CASES = [
  { clubId: 'botafogo-pb', overall: 92, label: 'craque na Serie C' },
  { clubId: 'fortaleza', overall: 85, label: 'craque em meio de tabela' },
  { clubId: 'arsenal', overall: 85, label: 'craque em clube de elite' },
]

const errors: string[] = []

console.log(`\nREFORCO DO JOGADOR · ${SEASONS} temporadas por caso · teto +${MAX_LIFT}\n`)

for (const testCase of CASES) {
  const club = clubById(testCase.clubId)

  if (!club) {
    errors.push(`Clube inexistente: ${testCase.clubId}`)
    continue
  }

  const league = leagueById(club.leagueId)!
  const clubs = clubsInLeague(league.id)
  const lift = clubLift(testCase.overall, club.strength, 1)

  const without = run(club.id, league.id, clubs, undefined)
  const with_ = run(club.id, league.id, clubs, { clubId: club.id, amount: lift })

  console.log(`  ${testCase.label.toUpperCase()}`)
  console.log(`  ${club.name} · forca ${club.strength} · OVR ${testCase.overall} · reforco +${lift.toFixed(1)}`)
  console.log(
    `    colocacao media   ${without.averagePosition.toFixed(1)}º  →  ` +
      `${with_.averagePosition.toFixed(1)}º`,
  )
  console.log(
    `    titulos           ${pct(without.titles)}  →  ${pct(with_.titles)}`,
  )
  console.log(
    `    top 4             ${pct(without.top4)}  →  ${pct(with_.top4)}\n`,
  )

  if (with_.averagePosition > without.averagePosition) {
    errors.push(`${club.name}: o reforco piorou a colocacao media`)
  }

  if (lift > 0 && with_.averagePosition >= without.averagePosition - 0.2) {
    errors.push(`${club.name}: reforco de +${lift.toFixed(1)} nao mudou nada`)
  }
}

// Subir para um clube muito acima do proprio nivel zera o reforco — e nao pode
// custar um minuto sequer em campo, porque os minutos leem a forca real do
// elenco e nao enxergam reforco nenhum.
const small = clubById('botafogo-pb')!
const big = clubById('liverpool') ?? clubById('arsenal')!

for (const [label, club, overall] of [
  ['craque no clube pequeno', small, 88],
  ['o mesmo craque no clube grande', big, 88],
] as const) {
  const lift = clubLift(overall, club.strength, 1)
  const league = leagueById(club.leagueId)!
  const clubs = clubsInLeague(league.id)
  const total = matchesInLeague(clubs.length)

  // Mesma seed: o unico jeito de a comparacao significar alguma coisa.
  const season = simulatePlayerSeason(
    {
      overall,
      position: 'ATA',
      club,
      leagueAverageStrength: averageStrength(clubs),
      totalMatches: total,
    },
    createRng('minutos'),
  )

  console.log(
    `  ${label.padEnd(32)} ${club.name.padEnd(14)} forca ${club.strength}  ` +
      `reforco +${lift.toFixed(1)}  ${season.matches}/${total} jogos`,
  )

  if (club === big && lift > 0) {
    errors.push(`${club.name}: OVR ${overall} abaixo do elenco nao deveria reforcar`)
  }
}

console.log()

// A liga sem jogador nenhum precisa continuar exatamente como era: o reforco e
// opcional, e sem ele o comportamento nao pode ter mudado.
const control = clubsInLeague('br-1')
const a = simulateLeague(leagueById('br-1')!, createRng('controle'), control)
const b = simulateLeague(leagueById('br-1')!, createRng('controle'), control, undefined)

if (a.championId !== b.championId) {
  errors.push('Passar boost undefined mudou o resultado da liga')
}

if (errors.length > 0) {
  console.log(`ERROS\n`)
  for (const error of errors) console.log(`  x ${error}`)
  console.log(`\n${errors.length} erro(s).\n`)
  process.exit(1)
}

console.log(`Reforco coerente.\n`)

function run(
  clubId: string,
  leagueId: string,
  clubs: ReturnType<typeof clubsInLeague>,
  boost: { clubId: string; amount: number } | undefined,
) {
  const league = leagueById(leagueId)!
  let positions = 0
  let titles = 0
  let top4 = 0

  for (let season = 0; season < SEASONS; season++) {
    // Mesma seed nos dois cenarios: a diferenca medida e so o reforco.
    const outcome = simulateLeague(
      league,
      createRng(`impacto:${leagueId}:${season}`),
      clubs,
      boost,
    )
    const position = positionInTable(outcome, clubId)

    positions += position
    if (position === 1) titles++
    if (position <= 4) top4++
  }

  return {
    averagePosition: positions / SEASONS,
    titles: titles / SEASONS,
    top4: top4 / SEASONS,
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`.padStart(6)
}
