/**
 * Quem ganha a liga ao longo de muitas temporadas.
 *
 * E o unico jeito de calibrar a variacao de forma. Spread baixo demais faz o
 * mesmo clube ganhar sempre e titulo perder significado; alto demais faz time
 * de meio de tabela ser campeao e a forca do clube nao valer nada.
 *
 * Referencia do mundo real, em 20 anos: o dominante da liga leva algo entre
 * 35% e 60% dos titulos, e 4 a 8 clubes diferentes ganham pelo menos um.
 *
 * npx tsx scripts/smoke-titles.ts
 */
import { clubById, clubsInLeague } from '../lib/sim/data/clubs'
import { leagueById } from '../lib/sim/data/leagues'
import { simulateLeague } from '../lib/sim/season'
import { createRng } from '../lib/sim/rng'

const SEASONS = 200
const LEAGUE_IDS = ['es-1', 'fr-1', 'de-1', 'en-1', 'it-1', 'br-1']

for (const leagueId of LEAGUE_IDS) {
  const league = leagueById(leagueId)!
  const clubs = clubsInLeague(leagueId)
  const wins = new Map<string, number>()

  for (let season = 0; season < SEASONS; season++) {
    const rng = createRng(`titulos:${leagueId}:${season}`)
    const outcome = simulateLeague(league, rng, clubs)
    wins.set(outcome.championId, (wins.get(outcome.championId) ?? 0) + 1)
  }

  const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1])

  console.log(`\n${league.name.toUpperCase()} · ${SEASONS} temporadas · ${wins.size} campeoes diferentes\n`)

  for (const [clubId, count] of ranked.slice(0, 6)) {
    const club = clubById(clubId)!
    const share = (count / SEASONS) * 100
    console.log(
      `  ${club.name.padEnd(22)}${String(club.strength).padStart(3)}  ` +
        `${share.toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(share / 2))}`,
    )
  }

  if (ranked.length > 6) {
    const tail = ranked.slice(6).reduce((sum, [, count]) => sum + count, 0)
    console.log(`  ${`+ ${ranked.length - 6} outros`.padEnd(27)}${((tail / SEASONS) * 100).toFixed(1).padStart(5)}%`)
  }
}

console.log()
