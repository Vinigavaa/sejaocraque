/**
 * Saves antigos continuam carregando.
 *
 *   npx tsx scripts/smoke-migracao.ts
 *
 * Monta carreiras no formato de hoje, remove delas exatamente os campos que
 * cada versao anterior nao tinha, passa por `migrateSnapshot` e segue jogando.
 * O que este script protege e a promessa de que nenhuma carreira salva morre
 * quando o motor cresce.
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
  completeDate,
  finishMatchdaySeason,
  isSeasonOver,
  nextFixture,
  startMatchdaySeason,
  type MatchdaySeason,
} from '../lib/sim/matchday'
import { createRng } from '../lib/sim/rng'
import { migrateSnapshot } from '../lib/saves/migrate'
import type { CareerSnapshot } from '../lib/saves/types'
import { clubsInDivision } from '../lib/sim/world'
import { ALL_ATTRS, type PlayerAttrs } from '../lib/sim/types'

const attrs = {} as PlayerAttrs
for (const attr of ALL_ATTRS) attrs[attr] = 84

function career(mode: 'classico' | 'jogoAJogo', seasons: number): CareerState {
  let state = startCareer({
    seed: 'migracao',
    name: 'Craque',
    nationality: 'BR',
    position: 'ATA',
    shirtNumber: 9,
    peakAttrs: attrs,
    careerMode: mode,
    startClubId: 'coritiba',
  })

  for (let index = 0; index < seasons && !state.retired; index++) {
    state = playSeason(state, null).state
  }

  return state
}

/** Uma temporada Jogo a Jogo parada no meio, como um save de verdade estaria. */
function halfSeason(state: CareerState): MatchdaySeason {
  const league = leagueById(state.leagueId)!
  let season = startMatchdaySeason({
    league,
    clubs: clubsInDivision(state.world, league.id),
    clubId: state.clubId,
    seed: state.config.seed,
    seasonIndex: state.seasonIndex,
    competitions: clubCompetitions(state, league),
    national: nationalCalendarFor(state),
  })

  for (let index = 0; index < 12 && !isSeasonOver(season); index++) {
    const rng = createRng(`m:${index}`)
    if (!nextFixture(season)) {
      season = completeDate(season, null, rng)
      continue
    }
    season = completeDate(
      season,
      {
        teamGoals: 1,
        opponentGoals: 0,
        player: {
          played: true,
          minutes: 90,
          goals: 1,
          assists: 0,
          rating: 7.4,
          yellow: 0,
          red: false,
          injured: false,
        },
      },
      rng,
    )
  }

  return season
}

/** Remove os campos que a versao indicada ainda nao tinha. */
function downgrade(snapshot: CareerSnapshot, version: 1 | 2): CareerSnapshot {
  const raw = JSON.parse(JSON.stringify(snapshot)) as Record<string, never>
  const state = raw as unknown as CareerSnapshot
  const loose = (value: unknown) => value as Record<string, unknown>

  if (state.matchday) delete loose(state.matchday).national

  if (version === 1) {
    delete loose(state.career).world

    for (const season of state.career.seasons) {
      const tournament = season.national?.tournament
      if (tournament) delete loose(tournament).id
    }

    if (state.matchday) {
      const md = loose(state.matchday)
      delete md.leagueName
      delete md.campaigns
      delete md.dates
      delete md.dateIndex
      for (const entry of state.matchday.log) {
        delete loose(entry).competitionId
        delete loose(entry).competitionName
        delete loose(entry).stage
      }
    }

    for (const entry of state.seasonLog) {
      delete loose(entry).competitionId
      delete loose(entry).competitionName
      delete loose(entry).stage
    }
  }

  return { ...state, version }
}

function check(label: string, snapshot: CareerSnapshot, version: 1 | 2): void {
  const old = downgrade(snapshot, version)
  const migrated = migrateSnapshot(old)

  const problems: string[] = []

  if (!migrated.career.world?.divisions) problems.push('sem mundo')
  if (Object.keys(migrated.career.world.divisions).length === 0) problems.push('mundo vazio')

  // A divisão em que o jogador estava tem que sobreviver à migração.
  if (migrated.career.world.divisions[migrated.career.clubId] !== migrated.career.leagueId) {
    problems.push('divisão do jogador perdida')
  }

  for (const season of migrated.career.seasons) {
    if (season.national?.tournament && !season.national.tournament.id) {
      problems.push(`torneio sem id em ${season.label}`)
    }
  }

  if (migrated.matchday) {
    const md = migrated.matchday
    if (!md.dates || md.dates.length === 0) problems.push('calendário vazio')
    if (md.dateIndex === undefined) problems.push('sem data corrente')
    if (!md.campaigns) problems.push('sem campanhas')
    if (md.national === undefined) problems.push('seleção indefinida')
    for (const entry of md.log) {
      if (!entry.competitionId) problems.push('partida sem competição')
    }
  }

  // E o teste que importa: a carreira migrada ainda joga.
  let state = migrated.career
  try {
    // Uma temporada parada no meio precisa chegar ao fim antes de qualquer
    // outra coisa — e ali que um calendário mal reconstruído trava.
    if (migrated.matchday) {
      let season = migrated.matchday
      let guard = 0

      while (!isSeasonOver(season) && guard++ < 500) {
        const rng = createRng(`retomada:${season.dateIndex}`)
        season = completeDate(season, null, rng)
      }

      if (!isSeasonOver(season)) problems.push('temporada retomada não termina')
      const { outcome } = finishMatchdaySeason(season, leagueById(state.leagueId)!)
      if (outcome.standings.length === 0) problems.push('tabela vazia ao fechar')
    }

    for (let index = 0; index < 3 && !state.retired; index++) {
      state = playSeason(state, null).state
    }
  } catch (error) {
    problems.push(`quebrou ao jogar: ${String(error)}`)
  }

  const club = clubById(state.clubId)?.name ?? state.clubId
  console.log(
    problems.length === 0
      ? `  ok   ${label.padEnd(34)} → seguiu até ${state.seasonIndex} no ${club}`
      : `  FALHA ${label.padEnd(34)} → ${problems.join('; ')}`,
  )
}

console.log('\n── saves antigos ──\n')

const classic = career('classico', 6)
const live = career('jogoAJogo', 3)

const classicSnapshot: CareerSnapshot = {
  version: 3,
  career: classic,
  matchday: null,
  news: [],
  social: [],
  seasonLog: [],
}

const liveSeason = halfSeason(live)
const liveSnapshot: CareerSnapshot = {
  version: 3,
  career: live,
  matchday: liveSeason,
  news: [],
  social: [],
  seasonLog: liveSeason.log,
}

check('v1 · clássico, 6 temporadas', classicSnapshot, 1)
check('v2 · clássico, 6 temporadas', classicSnapshot, 2)
check('v1 · jogo a jogo no meio do ano', liveSnapshot, 1)
check('v2 · jogo a jogo no meio do ano', liveSnapshot, 2)

console.log()
