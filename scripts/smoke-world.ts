/**
 * O mundo ao longo de uma carreira.
 *
 *   npx tsx scripts/smoke-world.ts
 *
 * As perguntas que este script responde: o calendario do modo Jogo a Jogo
 * inclui copa e continental? Todas as divisoes mudam de composicao a cada
 * temporada, mesmo as que o jogador nunca disputou? A classificacao
 * continental sai das tabelas de verdade?
 */
import {
  clubCompetitions,
  nationalCalendarFor,
  playSeason,
  startCareer,
} from '../lib/sim/career'
import { clubById } from '../lib/sim/data/clubs'
import { leagueById, LEAGUES } from '../lib/sim/data/leagues'
import {
  finishLiveMatch,
  moraleAfterMatch,
  simulateRestOfMatch,
  startLiveMatch,
} from '../lib/sim/liveMatch'
import {
  completeDate,
  finishMatchdaySeason,
  isSeasonOver,
  nextFixture,
  setupForNext,
  startMatchdaySeason,
} from '../lib/sim/matchday'
import { currentOverall } from '../lib/sim/progression'
import { createRng } from '../lib/sim/rng'
import { averageStrength } from '../lib/sim/season'
import { clubsInDivision, qualifiedFor } from '../lib/sim/world'
import { ALL_ATTRS, type PlayerAttrs } from '../lib/sim/types'

const attrs = {} as PlayerAttrs
for (const attr of ALL_ATTRS) attrs[attr] = 82

let state = startCareer({
  seed: 'mundo',
  name: 'Craque',
  nationality: 'BR',
  position: 'ATA',
  shirtNumber: 9,
  peakAttrs: attrs,
  careerMode: 'jogoAJogo',
  startClubId: 'flamengo',
})

const before = { ...state.world.divisions }

for (let year = 0; year < 5 && !state.retired; year++) {
  const club = clubById(state.clubId)!
  const league = leagueById(state.leagueId)!
  const clubs = clubsInDivision(state.world, league.id)

  let season = startMatchdaySeason({
    league,
    clubs,
    clubId: club.id,
    seed: state.config.seed,
    seasonIndex: state.seasonIndex,
    competitions: clubCompetitions(state, league),
    national: nationalCalendarFor(state),
  })

  console.log(
    `\n=== ${state.seasonIndex} · ${club.name} (${league.name}) · ` +
      `${season.dates.length} datas, ${season.rounds.length} de liga ===`,
  )
  console.log(
    '  competições:',
    season.campaigns.map((c) => `${c.name} (${c.dates} datas)`).join(', '),
  )

  let morale = state.morale

  while (!isSeasonOver(season)) {
    const rng = createRng(`${state.config.seed}:data:${state.seasonIndex}:${season.dateIndex}`)

    if (!nextFixture(season)) {
      season = completeDate(season, null, rng)
      continue
    }

    const setup = setupForNext(
      season,
      {
        name: state.config.name,
        position: state.config.position,
        overall: currentOverall(state.peakAttrs, state.config.position, state.age),
        attrs: state.peakAttrs,
      },
      club,
      averageStrength(clubs),
    )!

    const done = finishLiveMatch(
      simulateRestOfMatch(startLiveMatch(setup, morale, rng), rng),
    )
    morale = moraleAfterMatch(done)

    season = completeDate(
      season,
      { teamGoals: done.teamGoals, opponentGoals: done.opponentGoals, player: done.player },
      rng,
    )
  }

  const { outcome, stats, cups, winners, national } = finishMatchdaySeason(season, league)

  console.log(
    `  liga: ${stats.matches}j ${stats.goals}g · ${outcome.standings.findIndex((r) => r.clubId === club.id) + 1}º`,
  )
  for (const run of cups) {
    console.log(`  ${run.name}: ${run.matches}j ${run.goals}g · ${run.reached}`)
  }
  console.log('  campeões:', winners)

  const result = playSeason(state, null, { outcome, stats, cups, winners, national, morale })
  state = result.state

  const moved = Object.keys(state.world.divisions).filter(
    (id) => state.world.divisions[id] !== before[id],
  )
  console.log(`  clubes fora da divisão de origem: ${moved.length}`)
  console.log(
    '  Libertadores do ano que vem:',
    qualifiedFor(state.world, 'libertadores').map((c) => c.name).join(', '),
  )
}

console.log('\nComposição final das divisões brasileiras:')
for (const league of LEAGUES.filter((l) => l.country === 'BR')) {
  console.log(
    `  ${league.name}: ${clubsInDivision(state.world, league.id).map((c) => c.name).join(', ')}`,
  )
}
