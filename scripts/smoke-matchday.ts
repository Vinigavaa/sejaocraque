/**
 * O modo Jogo a Jogo, jogado sem interface.
 *
 *   npx tsx scripts/smoke-matchday.ts
 *
 * A pergunta que este script responde: uma temporada disputada partida a
 * partida termina nos mesmos patamares de uma temporada simulada de uma vez?
 * Se o modo novo entregar o dobro de gols ou notas sistematicamente mais
 * altas, as duas carreiras deixam de ser comparaveis — e comparabilidade e a
 * razao de os dois modos compartilharem `playSeason`.
 *
 * O que se espera ver: producao e nota parecidas entre os dois modos, moral
 * andando nos dois sentidos, e nenhuma partida terminando com placar absurdo.
 */
import { fieldOf, playSeason, startCareer, type CareerState } from '../lib/sim/career'
import { clubById } from '../lib/sim/data/clubs'
import { leagueById } from '../lib/sim/data/leagues'
import {
  finishLiveMatch,
  simulateRestOfMatch,
  startLiveMatch,
  moraleAfterMatch,
} from '../lib/sim/liveMatch'
import {
  completeRound,
  finishMatchdaySeason,
  isSeasonOver,
  nextFixture,
  setupForNext,
  startMatchdaySeason,
} from '../lib/sim/matchday'
import { currentOverall } from '../lib/sim/progression'
import { createRng } from '../lib/sim/rng'
import { averageStrength } from '../lib/sim/season'
import { ALL_ATTRS, type PlayerAttrs, type Position } from '../lib/sim/types'

const CAREERS = 40

/** `npx tsx scripts/smoke-matchday.ts ZAG` mede outra posicao. */
const POSITION = (process.argv[2] as Position) ?? 'ATA'

function attrsFor(peak: number): PlayerAttrs {
  const attrs = {} as PlayerAttrs

  for (const attr of ALL_ATTRS) {
    attrs[attr] = attr === 'fintas' || attr === 'pernaRuim' ? 4 : peak
  }

  return attrs
}

/** Uma temporada de liga inteira, decidida partida a partida. */
function playMatchdaySeason(state: CareerState) {
  const club = clubById(state.clubId)!
  const league = leagueById(state.leagueId)!
  const clubs = fieldOf(league, club)

  let season = startMatchdaySeason({
    league,
    clubs,
    clubId: club.id,
    seed: state.config.seed,
    seasonIndex: state.seasonIndex,
  })

  let morale = state.morale
  let biggest = 0

  while (!isSeasonOver(season)) {
    const roundRng = createRng(
      `${state.config.seed}:rodada:${state.seasonIndex}:${season.roundIndex}`,
    )

    if (!nextFixture(season)) {
      season = completeRound(season, null, roundRng)
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
      league.name,
      averageStrength(clubs),
    )!

    const matchRng = createRng(
      `${state.config.seed}:partida:${state.seasonIndex}:${season.roundIndex}`,
    )

    // Sem ninguem para decidir, o motor joga seguro — que e exatamente o que
    // o botao "simular o resto" faz na interface.
    const done = finishLiveMatch(
      simulateRestOfMatch(
        startLiveMatch(setup, morale, 'equilibrado', matchRng),
        matchRng,
      ),
    )

    morale = moraleAfterMatch(done)
    biggest = Math.max(biggest, done.teamGoals + done.opponentGoals)

    season = completeRound(
      season,
      {
        teamGoals: done.teamGoals,
        opponentGoals: done.opponentGoals,
        player: done.player,
      },
      roundRng,
    )
  }

  const { outcome, stats } = finishMatchdaySeason(season, league)
  return { outcome, stats, morale, biggest }
}

const totals = {
  classico: { goals: 0, assists: 0, matches: 0, rating: 0 },
  jogoAJogo: { goals: 0, assists: 0, matches: 0, rating: 0 },
}

const moraleRange = { min: 100, max: 0, reputation: 0 }
let biggestScore = 0

for (let index = 0; index < CAREERS; index++) {
  const config = {
    seed: `matchday:${index}`,
    name: 'Craque',
    nationality: 'BR',
    position: POSITION,
    shirtNumber: 9,
    peakAttrs: attrsFor(80),
    careerMode: 'jogoAJogo' as const,
    startClubId: null,
  }

  // A mesma seed nos dois modos: o clube de estreia e a liga sao identicos, e
  // a unica diferenca entre as duas linhas e como a temporada foi apurada.
  const base = startCareer(config)

  const classic = playSeason(base, null)
  totals.classico.goals += classic.record.stats.goals
  totals.classico.assists += classic.record.stats.assists
  totals.classico.matches += classic.record.stats.matches
  totals.classico.rating += classic.record.stats.rating

  const played = playMatchdaySeason(base)
  const live = playSeason(base, null, {
    outcome: played.outcome,
    stats: played.stats,
    morale: played.morale,
  })

  totals.jogoAJogo.goals += live.record.stats.goals
  totals.jogoAJogo.assists += live.record.stats.assists
  totals.jogoAJogo.matches += live.record.stats.matches
  totals.jogoAJogo.rating += live.record.stats.rating

  moraleRange.min = Math.min(moraleRange.min, played.morale.confidence)
  moraleRange.max = Math.max(moraleRange.max, played.morale.confidence)
  moraleRange.reputation += live.record.morale.reputation
  biggestScore = Math.max(biggestScore, played.biggest)
}

const show = (label: string, row: (typeof totals)['classico']) =>
  console.log(
    `${label.padEnd(11)} ${(row.matches / CAREERS).toFixed(1).padStart(5)} jogos  ` +
      `${(row.goals / CAREERS).toFixed(1).padStart(5)} gols  ` +
      `${(row.assists / CAREERS).toFixed(1).padStart(5)} assist.  ` +
      `nota ${(row.rating / CAREERS).toFixed(2)}`,
  )

console.log(`\n${POSITION} de auge 80, ${CAREERS} temporadas por modo\n`)
show('Clássico', totals.classico)
show('Jogo a Jogo', totals.jogoAJogo)

console.log(
  `\nConfiança ao fim do ano: ${moraleRange.min} a ${moraleRange.max}` +
    `  ·  reputação média ${(moraleRange.reputation / CAREERS).toFixed(1)}`,
)
console.log(`Maior placar somado numa partida: ${biggestScore}\n`)
