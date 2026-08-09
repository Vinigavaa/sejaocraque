/**
 * Sanidade do motor de temporada.
 *
 * O que precisa bater com a realidade:
 *  - campeao de liga de 38 jogos entre ~80 e ~95 pontos
 *  - media de gols por jogo entre 2,5 e 3,2
 *  - artilheiro de elite entre 20 e 35 gols
 *  - garoto de Serie C com numeros modestos, nao de videogame
 *
 * npx tsx scripts/smoke-season.ts
 */
import { CLUBS, clubById, clubsInLeague } from '../lib/sim/data/clubs'
import { LEAGUES, leagueById } from '../lib/sim/data/leagues'
import {
  averageStrength,
  matchesInLeague,
  positionInTable,
  simulateLeague,
  simulatePlayerSeason,
} from '../lib/sim/season'
import { createRng } from '../lib/sim/rng'
import type { Position } from '../lib/sim/types'

const rng = createRng('smoke-temporada')

// ── Tabelas ──────────────────────────────────────────────────────────
console.log('\nTABELAS · uma temporada de cada liga\n')
console.log(
  '  liga                     jogos  campeao (pts)              gols/jogo  lanterna',
)

for (const league of LEAGUES) {
  const clubs = clubsInLeague(league.id)
  const outcome = simulateLeague(league, rng, clubs)
  const champion = outcome.standings[0]
  const last = outcome.standings[outcome.standings.length - 1]

  const totalGoals = outcome.standings.reduce((sum, s) => sum + s.goalsFor, 0)
  const totalMatches = outcome.standings.reduce((sum, s) => sum + s.played, 0) / 2

  console.log(
    `  ${league.name.padEnd(24)}${String(champion.played).padStart(4)}   ` +
      `${clubById(champion.clubId)!.name.slice(0, 20).padEnd(21)}${String(champion.points).padStart(3)}` +
      `${(totalGoals / totalMatches).toFixed(2).padStart(10)}   ` +
      `${clubById(last.clubId)!.name.slice(0, 18)} (${last.points})`,
  )
}

// ── Tabela detalhada ─────────────────────────────────────────────────
const premier = leagueById('en-1')!
const premierOutcome = simulateLeague(premier, rng)

console.log(`\n${premier.name.toUpperCase()} · tabela completa\n`)
premierOutcome.standings.forEach((standing, index) => {
  const club = clubById(standing.clubId)!
  const diff = standing.goalsFor - standing.goalsAgainst
  const mark = premierOutcome.relegatedIds.includes(standing.clubId) ? ' ▼' : ''

  console.log(
    `  ${String(index + 1).padStart(2)}  ${club.name.padEnd(22)}` +
      `${String(standing.points).padStart(3)} pts   ` +
      `${standing.won}V ${standing.drawn}E ${standing.lost}D   ` +
      `${String(standing.goalsFor).padStart(2)}:${String(standing.goalsAgainst).padEnd(2)} ` +
      `${(diff >= 0 ? '+' : '') + diff}${mark}`,
  )
})

// ── Jogadores ────────────────────────────────────────────────────────
console.log('\nTEMPORADAS DE JOGADOR · media de 200 simulacoes\n')

const cases: { label: string; overall: number; position: Position; clubId: string }[] = [
  { label: 'Craque no auge (ATA 88)', overall: 88, position: 'ATA', clubId: 'man-city' },
  { label: 'Bom titular (ATA 78)', overall: 78, position: 'ATA', clubId: 'flamengo' },
  { label: 'Meia armador (MEI 84)', overall: 84, position: 'MEI', clubId: 'barcelona' },
  { label: 'Zagueiro (ZAG 82)', overall: 82, position: 'ZAG', clubId: 'inter' },
  { label: 'Volante (VOL 80)', overall: 80, position: 'VOL', clubId: 'porto' },
  { label: 'Garoto na Serie C (ATA 49)', overall: 49, position: 'ATA', clubId: 'volta-redonda' },
  { label: 'Garoto num clube grande (ATA 49)', overall: 49, position: 'ATA', clubId: 'flamengo' },
]

console.log('  cenario                            jogos   gols   assist   nota')

for (const testCase of cases) {
  const club = clubById(testCase.clubId)!
  const league = leagueById(club.leagueId)!
  const clubs = clubsInLeague(league.id)
  const totals = { matches: 0, goals: 0, assists: 0, rating: 0 }

  const RUNS = 200
  for (let i = 0; i < RUNS; i++) {
    const stats = simulatePlayerSeason(
      {
        overall: testCase.overall,
        position: testCase.position,
        club,
        leagueAverageStrength: averageStrength(clubs),
        totalMatches: matchesInLeague(clubs.length),
      },
      rng,
    )
    totals.matches += stats.matches
    totals.goals += stats.goals
    totals.assists += stats.assists
    totals.rating += stats.rating
  }

  console.log(
    `  ${testCase.label.padEnd(34)}` +
      `${(totals.matches / RUNS).toFixed(0).padStart(5)}` +
      `${(totals.goals / RUNS).toFixed(1).padStart(7)}` +
      `${(totals.assists / RUNS).toFixed(1).padStart(9)}` +
      `${(totals.rating / RUNS).toFixed(2).padStart(7)}`,
  )
}

// ── Acesso ───────────────────────────────────────────────────────────
const serieC = leagueById('br-3')!
const serieCOutcome = simulateLeague(serieC, rng)

console.log(`\nACESSO · ${serieC.name}\n`)
for (const clubId of serieCOutcome.promotedIds) {
  console.log(`  ▲ ${clubById(clubId)!.name} (${positionInTable(serieCOutcome, clubId)}º)`)
}

console.log(`\n  ${CLUBS.length} clubes · ${LEAGUES.length} ligas simuladas\n`)
