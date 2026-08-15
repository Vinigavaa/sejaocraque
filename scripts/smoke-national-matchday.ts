/**
 * O ano de selecao disputado partida a partida.
 *
 *   npx tsx scripts/smoke-national-matchday.ts
 *
 * As perguntas que este script responde: os jogos de selecao entram no
 * calendario do modo Jogo a Jogo? Em ano de Copa do Mundo a campanha aparece
 * com fase de grupos e mata-mata? E o numero de jogos pela selecao continua
 * parecido com o do modo Classico — que e o que mantem as duas carreiras
 * comparaveis?
 */
import {
  clubCompetitions,
  nationalCalendarFor,
  playSeason,
  startCareer,
  type CareerState,
} from '../lib/sim/career'
import { clubById } from '../lib/sim/data/clubs'
import { leagueById } from '../lib/sim/data/leagues'
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
  SELECAO,
  setupForNext,
  startMatchdaySeason,
} from '../lib/sim/matchday'
import { nationalTotals } from '../lib/sim/national'
import { currentOverall } from '../lib/sim/progression'
import { createRng } from '../lib/sim/rng'
import { averageStrength } from '../lib/sim/season'
import { clubsInDivision } from '../lib/sim/world'
import { ALL_ATTRS, type PlayerAttrs } from '../lib/sim/types'

const SEASONS = 8

function attrsFor(peak: number): PlayerAttrs {
  const attrs = {} as PlayerAttrs
  for (const attr of ALL_ATTRS) attrs[attr] = peak
  return attrs
}

/** Uma temporada inteira do modo Jogo a Jogo, sem ninguem para decidir. */
function playMatchdaySeason(state: CareerState) {
  const club = clubById(state.clubId)!
  const league = leagueById(state.leagueId)!
  const clubs = clubsInDivision(state.world, league.id)
  const average = averageStrength(clubs)

  let season = startMatchdaySeason({
    league,
    clubs,
    clubId: club.id,
    seed: state.config.seed,
    seasonIndex: state.seasonIndex,
    competitions: clubCompetitions(state, league),
    national: nationalCalendarFor(state),
  })

  let morale = state.morale
  let nationalPlayed = 0

  while (!isSeasonOver(season)) {
    const rng = createRng(
      `${state.config.seed}:data:${state.seasonIndex}:${season.dateIndex}`,
    )
    const next = nextFixture(season)

    if (!next) {
      season = completeDate(season, null, rng)
      continue
    }

    if (next.competitionId === SELECAO) nationalPlayed++

    const setup = setupForNext(
      season,
      {
        name: state.config.name,
        position: state.config.position,
        overall: currentOverall(state.peakAttrs, state.config.position, state.age),
        attrs: state.peakAttrs,
      },
      club,
      average,
    )!

    const done = finishLiveMatch(
      simulateRestOfMatch(startLiveMatch(setup, morale, rng), rng),
    )
    morale = moraleAfterMatch(done)

    season = completeDate(
      season,
      {
        teamGoals: done.teamGoals,
        opponentGoals: done.opponentGoals,
        player: done.player,
      },
      rng,
    )
  }

  return { season, morale, nationalPlayed }
}

let state = startCareer({
  seed: 'selecao',
  name: 'Craque',
  nationality: 'BR',
  position: 'ATA',
  shirtNumber: 9,
  peakAttrs: attrsFor(88),
  careerMode: 'jogoAJogo',
  startClubId: 'flamengo',
})

const classicCaps: number[] = []
const liveCaps: number[] = []

for (let year = 0; year < SEASONS && !state.retired; year++) {
  const calendar = nationalCalendarFor(state)
  const { season, morale, nationalPlayed } = playMatchdaySeason(state)
  const { outcome, stats, cups, winners, national } = finishMatchdaySeason(
    season,
    leagueById(state.leagueId)!,
  )

  const dates = season.dates.filter((date) => date.kind === 'selecao').length

  console.log(`\n=== temporada ${state.seasonIndex} · ${season.dates.length} datas ===`)

  if (!national || !calendar) {
    console.log('  sem convocação')
  } else {
    const totals = nationalTotals(national)
    console.log(
      `  seleção: ${dates} datas · ${nationalPlayed} jogadas · ` +
        `${national.matches.length} registradas · ${totals.caps} com o jogador em campo`,
    )
    console.log(
      `  torneio: ${national.tournament ? `${national.tournament.name} · ${national.tournament.reached}` : 'ano de preparação'}`,
    )
    const byCompetition = new Map<string, number>()
    for (const match of national.matches) {
      byCompetition.set(match.competition, (byCompetition.get(match.competition) ?? 0) + 1)
    }
    console.log(
      `  ${[...byCompetition].map(([name, count]) => `${name} ${count}`).join(' · ')}`,
    )
    liveCaps.push(totals.caps)
  }

  // O mesmo ano no modo Clássico, para comparar o volume de jogos.
  const classic = playSeason({ ...state, config: { ...state.config, careerMode: 'classico' } }, null)
  if (classic.record.national) classicCaps.push(nationalTotals(classic.record.national).caps)

  state = playSeason(state, null, { outcome, stats, cups, winners, national, morale }).state
}

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

console.log(
  `\nJogos pela seleção por temporada — Clássico ${mean(classicCaps).toFixed(1)} · ` +
    `Jogo a Jogo ${mean(liveCaps).toFixed(1)}\n`,
)
