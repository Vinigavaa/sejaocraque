/**
 * Integridade do dataset. Roda antes de confiar nos dados.
 *
 * npx tsx scripts/check-data.ts
 */
import { CLUBS, clubsInLeague, leagueOf } from '../lib/sim/data/clubs'
import { LEAGUES, leagueBelow, COUNTRY_LABEL } from '../lib/sim/data/leagues'
import { NATIONS, WORLD_CUP_SLOTS } from '../lib/sim/data/nations'
import { LEGENDS } from '../lib/sim/data/legends'
import { buildSchedule, matchesInLeague } from '../lib/sim/season'
import { ALL_ATTRS, STAR_ATTRS, NUMERIC_ATTRS } from '../lib/sim/types'

const errors: string[] = []
const warnings: string[] = []

// ── Ids unicos ───────────────────────────────────────────────────────
reportDuplicates('clube', CLUBS.map((club) => club.id))
reportDuplicates('liga', LEAGUES.map((league) => league.id))
reportDuplicates('lenda', LEGENDS.map((legend) => legend.id))

// Nome repetido nao quebra nada, mas quase sempre e copiar-colar errado.
reportDuplicates('nome de clube', CLUBS.map((club) => club.name), warnings)

// ── Referencias ──────────────────────────────────────────────────────
for (const club of CLUBS) {
  try {
    leagueOf(club)
  } catch {
    errors.push(`Clube "${club.name}" aponta para liga inexistente: ${club.leagueId}`)
  }
}

for (const league of LEAGUES) {
  if (!COUNTRY_LABEL[league.country]) {
    errors.push(`Liga "${league.name}" usa pais sem label: ${league.country}`)
  }
  if (clubsInLeague(league.id).length === 0) {
    errors.push(`Liga "${league.name}" nao tem nenhum clube`)
  }
}

// ── Selecoes ─────────────────────────────────────────────────────────
reportDuplicates('selecao', NATIONS.map((nation) => nation.id))

for (const nation of NATIONS) {
  if (nation.strength < 1 || nation.strength > 99) {
    errors.push(`Selecao "${nation.name}" tem forca fora de 1-99: ${nation.strength}`)
  }
}

if (NATIONS.length < WORLD_CUP_SLOTS) {
  errors.push(
    `So ha ${NATIONS.length} selecoes para ${WORLD_CUP_SLOTS} vagas na Copa do Mundo`,
  )
}

// Todo pais com liga precisa existir como selecao, senao quem nasce ali nunca
// e convocado e a Copa do Mundo some da carreira sem explicacao.
for (const league of LEAGUES) {
  if (!NATIONS.some((nation) => nation.id === league.country)) {
    errors.push(
      `Pais "${league.country}" tem liga mas nao tem selecao — jogador nascido ali nunca e convocado`,
    )
  }
}

// ── Escalas ──────────────────────────────────────────────────────────
for (const club of CLUBS) {
  if (club.strength < 1 || club.strength > 99) {
    errors.push(`Clube "${club.name}" tem strength fora de 1-99: ${club.strength}`)
  }
}

for (const legend of LEGENDS) {
  for (const attr of NUMERIC_ATTRS) {
    if (legend[attr] < 1 || legend[attr] > 99) {
      errors.push(`Lenda "${legend.name}" tem ${attr} fora de 1-99: ${legend[attr]}`)
    }
  }
  for (const attr of STAR_ATTRS) {
    if (legend[attr] < 1 || legend[attr] > 5) {
      errors.push(`Lenda "${legend.name}" tem ${attr} fora de 1-5: ${legend[attr]}`)
    }
  }
}

// ── Coerencia entre divisoes ─────────────────────────────────────────
// A segunda divisao nao pode ser mais forte que a primeira do mesmo pais,
// senao acesso vira rebaixamento na pratica.
for (const league of LEAGUES) {
  const below = leagueBelow(league)
  if (!below) continue

  const top = average(clubsInLeague(league.id).map((club) => club.strength))
  const bottom = average(clubsInLeague(below.id).map((club) => club.strength))

  if (bottom >= top) {
    errors.push(
      `"${below.name}" (media ${bottom.toFixed(1)}) nao e mais fraca que ` +
        `"${league.name}" (media ${top.toFixed(1)})`,
    )
  }
}

// ── Calendario ───────────────────────────────────────────────────────
// Todo clube precisa jogar o mesmo numero de partidas, e esse numero precisa
// bater com o que `matchesInLeague` promete — e dele que sai quantos jogos o
// jogador disputa na temporada.
for (const league of LEAGUES) {
  const clubs = clubsInLeague(league.id)
  const rounds = buildSchedule(clubs, clubs.length <= 24)
  const played = new Map<string, number>(clubs.map((club) => [club.id, 0]))

  for (const round of rounds) {
    const seen = new Set<string>()

    for (const [home, away] of round) {
      for (const club of [home, away]) {
        if (seen.has(club.id)) {
          errors.push(`"${league.name}" escala ${club.name} duas vezes na mesma rodada`)
        }
        seen.add(club.id)
        played.set(club.id, played.get(club.id)! + 1)
      }
    }
  }

  const counts = new Set(played.values())
  const expected = matchesInLeague(clubs.length)

  if (counts.size > 1) {
    errors.push(
      `"${league.name}" tem clubes com numero de jogos diferente: ` +
        [...counts].sort((a, b) => a - b).join(', '),
    )
  } else if (!counts.has(expected)) {
    errors.push(
      `"${league.name}" joga ${[...counts][0]} rodadas mas matchesInLeague promete ${expected}`,
    )
  }
}

// ── Relatorio ────────────────────────────────────────────────────────
console.log(`\nDATASET\n`)
console.log(`  ligas    ${LEAGUES.length}`)
console.log(`  clubes   ${CLUBS.length}`)
console.log(`  lendas   ${LEGENDS.length}`)
console.log(`  selecoes ${NATIONS.length}`)
console.log(`  paises   ${new Set(LEAGUES.map((l) => l.country)).size}`)
console.log(`  atributos ${ALL_ATTRS.length}`)

console.log(`\nCLUBES POR LIGA\n`)
for (const league of LEAGUES) {
  const clubs = clubsInLeague(league.id)
  const strengths = clubs.map((club) => club.strength)
  const flag = COUNTRY_LABEL[league.country]?.flag ?? '  '

  console.log(
    `  ${flag} ${league.name.padEnd(24)} ${String(clubs.length).padStart(2)} clubes  ` +
      `forca ${Math.min(...strengths)}-${Math.max(...strengths)} ` +
      `(media ${average(strengths).toFixed(1)})`,
  )
}

if (warnings.length > 0) {
  console.log(`\nAVISOS\n`)
  for (const warning of warnings) console.log(`  ! ${warning}`)
}

if (errors.length > 0) {
  console.log(`\nERROS\n`)
  for (const error of errors) console.log(`  x ${error}`)
  console.log(`\n${errors.length} erro(s).\n`)
  process.exit(1)
}

console.log(`\nDataset integro.\n`)

function reportDuplicates(label: string, values: string[], into = errors) {
  const seen = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      into.push(`Id/nome de ${label} duplicado: "${value}"`)
    }
    seen.add(value)
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
