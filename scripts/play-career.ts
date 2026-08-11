/**
 * Joga uma carreira inteira automaticamente e imprime o arco.
 *
 * Serve para responder a unica pergunta que importa antes da UI: a carreira
 * conta uma historia? Tem que ter comeco fraco, subida, auge e queda, com
 * clube e divisao mudando por consequencia e nao por sorteio.
 *
 * npx tsx scripts/play-career.ts [seed]
 */
import {
  playSeason,
  renewContract,
  resolveTransfer,
  startCareer,
  type CareerState,
} from '../lib/sim/career'
import { formatSalary } from '../lib/sim/contracts'
import { clubById, leagueOf } from '../lib/sim/data/clubs'
import { COUNTRY_LABEL } from '../lib/sim/data/leagues'
import { LEGENDS } from '../lib/sim/data/legends'
import { nationalTotals } from '../lib/sim/national'
import {
  attrsFromPicks,
  availableAttrs,
  isComplete,
  pickAttr,
  startDraft,
  DEFAULT_REROLLS,
} from '../lib/sim/draft'
import { careerTotals, ladderLabel, ladderRung, ladderScore } from '../lib/sim/ladder'
import { overallByPosition, overallFor } from '../lib/sim/positions'
import { applyTraining } from '../lib/sim/progression'
import { createRng, randomSeed } from '../lib/sim/rng'
import { ALL_ATTRS, ATTR_LABEL, type Attr } from '../lib/sim/types'

const seed = process.argv[2] ?? randomSeed()
const rng = createRng(`auto:${seed}`)

// ── Draft automatico ─────────────────────────────────────────────────
let draft = startDraft({ seed, mode: 'amador', rerolls: DEFAULT_REROLLS.amador }, LEGENDS)

while (!isComplete(draft)) {
  const options = availableAttrs(draft)
  // Rouba o maior valor disponivel — jogador ganancioso, nao estrategico.
  const best = [...options].sort((a, b) => draft.currentLegend[b] - draft.currentLegend[a])[0]
  draft = pickAttr(draft, best, LEGENDS)
}

const peakAttrs = attrsFromPicks(draft.picks)
const bestPosition = overallByPosition(peakAttrs)[0]

console.log(`\nDRAFT · seed ${seed}\n`)
for (const pick of draft.picks) {
  const label = ATTR_LABEL[pick.attr]
  const value = pick.attr === 'fintas' || pick.attr === 'pernaRuim' ? `${pick.value}★` : pick.value
  console.log(`  ${label.short.padEnd(5)} ${String(value).padStart(3)}   de ${pick.fromLegendName}`)
}
console.log(`\n  auge ${bestPosition.overall} como ${bestPosition.position}`)

// ── Carreira ─────────────────────────────────────────────────────────
let state: CareerState = startCareer({
  seed,
  name: 'Auto',
  nationality: 'BR',
  position: bestPosition.position,
  shirtNumber: 10,
  peakAttrs,
  careerMode: 'classico',
})

const first = clubById(state.clubId)!
console.log(
  `  comeca no ${first.name} · ${leagueOf(first).name} · aposenta aos ${state.retiresAt}\n`,
)

console.log('TEMPORADA   IDADE  OVR  CLUBE                   LIGA                  J   G   A  NOTA')

const titles: string[] = []
let transfers = 0

while (!state.retired) {
  const focus = bestTrainingFocus(state)
  const result = playSeason(state, focus)
  const { record } = result
  const club = clubById(record.clubId)!
  const league = leagueOf(club)

  const marks = [
    record.champion ? '★ CAMPEÃO' : '',
    record.promoted ? '▲ acesso' : '',
    record.relegated ? '▼ queda' : '',
  ]
    .filter(Boolean)
    .join('  ')

  console.log(
    `  ${record.label}    ${String(record.age).padStart(2)}   ${String(record.overall).padStart(2)}  ` +
      `${club.name.slice(0, 22).padEnd(23)}${league.name.slice(0, 20).padEnd(21)}` +
      `${String(record.stats.matches).padStart(2)} ${String(record.stats.goals).padStart(3)} ` +
      `${String(record.stats.assists).padStart(3)}  ${record.stats.rating.toFixed(1)}` +
      `${marks ? '   ' + marks : ''}`,
  )

  if (record.champion) titles.push(`${league.name} ${record.label}`)

  for (const run of record.cups) {
    if (run.matches === 0) continue

    if (run.won) titles.push(`${run.name} ${record.label}`)

    const notable = run.won || run.reached === 'Final' || run.reached === 'Semifinal'
    if (notable) {
      console.log(
        `              ${run.won ? '★' : '·'} ${run.name}: ${run.reached}` +
          ` (${run.matches}J ${run.goals}G ${run.assists}A)`,
      )
    }
  }

  const national = record.national
  if (national?.tournament) {
    const played = national.matches.filter(
      (match) => match.competition === national.tournament?.name && match.played,
    )
    const goals = played.reduce((sum, match) => sum + match.goals, 0)
    const assists = played.reduce((sum, match) => sum + match.assists, 0)

    if (national.tournament.won) titles.push(`${national.tournament.name} ${record.label}`)
    console.log(
      `              ${national.tournament.won ? '★' : '·'} ${national.tournament.name}:` +
        ` ${national.tournament.reached} (${played.length}J ${goals}G ${assists}A)`,
    )
  }

  state = result.state

  // Decisao de transferencia: o clube mais forte que ainda nao encosta o
  // jogador. Com o contrato vencido a regra muda — ai vale qualquer clube em
  // que ele caiba, porque a alternativa e ficar sem time.
  const expiring = state.contract.seasonsLeft <= 0

  if (state.offers.length > 0 || state.renewal) {
    const viable = state.offers
      .map((offer) => clubById(offer.clubId)!)
      .filter((club) => club.strength <= record.overall + 5)
      .sort((a, b) => b.strength - a.strength)

    const current = clubById(state.clubId)!
    const target = viable[0]

    if (target && (expiring || target.strength > current.strength)) {
      state = resolveTransfer(state, target.id)
      transfers++
      console.log(`              → transferido para o ${target.name}`)
    } else if (state.renewal) {
      state = renewContract(state, state.renewal)
      console.log(
        `              → renovou com o ${current.name} por ${state.contract.years} temporada(s)`,
      )
    } else {
      state = resolveTransfer(state, null)
    }
  }
}

// ── Resumo ───────────────────────────────────────────────────────────
const totals = state.seasons.reduce(
  (sum, season) => {
    const cups = season.cups.reduce(
      (cupSum, run) => ({
        matches: cupSum.matches + run.matches,
        goals: cupSum.goals + run.goals,
        assists: cupSum.assists + run.assists,
      }),
      { matches: 0, goals: 0, assists: 0 },
    )

    return {
      matches: sum.matches + season.stats.matches + cups.matches,
      goals: sum.goals + season.stats.goals + cups.goals,
      assists: sum.assists + season.stats.assists + cups.assists,
    }
  },
  { matches: 0, goals: 0, assists: 0 },
)

const peakValue = Math.max(...state.seasons.map((season) => season.marketValue))
const clubs = new Set(state.seasons.map((season) => season.clubId))

const totalsFromEngine = careerTotals(state)

console.log(`\nFIM DE CARREIRA\n`)
console.log(
  `  ${ladderLabel(totalsFromEngine)} · degrau ${ladderRung(totalsFromEngine)}/11 · ` +
    `score ${ladderScore(totalsFromEngine)}`,
)
console.log(
  `  ${totalsFromEngine.ballonDOrs} bola(s) de ouro · ` +
    `${totalsFromEngine.goldenBoots} chuteira(s) de ouro · ` +
    `${totalsFromEngine.worldCups} copa(s) do mundo`,
)
console.log(`  ${state.seasons.length} temporadas · ${COUNTRY_LABEL.BR.flag} ${state.config.position}`)
console.log(`  ${totals.matches} jogos · ${totals.goals} gols · ${totals.assists} assistencias`)
console.log(`  ${clubs.size} clubes · ${transfers} transferencias · pico de €${peakValue}M`)
console.log(
  `  ganhos ${formatSalary(state.earnings)} · maior salario ` +
    `${formatSalary(Math.max(...state.seasons.map((season) => season.salary)))} por temporada`,
)

const national = state.seasons.reduce(
  (sum, season) => {
    const caps = season.national ? nationalTotals(season.national) : null

    return {
      caps: sum.caps + (caps?.caps ?? 0),
      goals: sum.goals + (caps?.goals ?? 0),
      seasons: sum.seasons + (season.national ? 1 : 0),
    }
  },
  { caps: 0, goals: 0, seasons: 0 },
)

console.log(
  `  selecao: ${national.caps} jogos · ${national.goals} gols · ` +
    `convocado em ${national.seasons} de ${state.seasons.length} temporadas`,
)
console.log(`  ${titles.length} titulos`)
for (const title of titles) console.log(`    ★ ${title}`)
console.log()

/** Testa cada atributo e escolhe o que mais sobe o auge. */
function bestTrainingFocus(state: CareerState): Attr {
  let best: Attr = ALL_ATTRS[0]
  let bestOverall = -1

  for (const attr of ALL_ATTRS) {
    const trained = applyTraining(state.peakAttrs, attr, state.age)
    const overall = overallFor(trained, state.config.position)

    if (overall > bestOverall) {
      bestOverall = overall
      best = attr
    }
  }

  return best
}

void rng
