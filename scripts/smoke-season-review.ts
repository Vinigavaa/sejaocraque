/**
 * O fechamento de temporada, temporada a temporada.
 *
 * Confere que os totais consolidados batem com a soma manual de liga, copas e
 * selecao — o resumo mostra esses numeros como "a temporada do jogador", e um
 * total errado ali seria invisivel na tela e mentiroso.
 *
 * npx tsx scripts/smoke-season-review.ts
 */
import { playSeason, resolveTransfer, seasonTotals, startCareer } from '../lib/sim/career'
import { clubById } from '../lib/sim/data/clubs'
import { LEGENDS } from '../lib/sim/data/legends'
import { attrsFromPicks, isComplete, pickAttr, startDraft } from '../lib/sim/draft'
import { buildTimeline } from '../lib/sim/liveMatch'
import { overallByPosition, overallFor } from '../lib/sim/positions'
import { applyTraining, currentOverall } from '../lib/sim/progression'
import { createRng, pick } from '../lib/sim/rng'
import { ALL_ATTRS, ATTR_LABEL, type Attr } from '../lib/sim/types'

const SEED = process.argv[2] ?? 'resumo01'
const errors: string[] = []

// Draft aleatorio: interessa a temporada, nao a montagem do jogador.
const rng = createRng(`${SEED}:draft`)
let draft = startDraft({ seed: SEED, mode: 'pro', rerolls: 0 }, LEGENDS)

while (!isComplete(draft)) {
  const open = ALL_ATTRS.filter((attr) => !draft.picks.some((p) => p.attr === attr))
  draft = pickAttr(draft, pick(rng, open), LEGENDS)
}

const peakAttrs = attrsFromPicks(draft.picks)
const position = overallByPosition(peakAttrs)[0].position

let state = startCareer({
  seed: SEED,
  name: 'Craque',
  nationality: 'BR',
  position,
  shirtNumber: 10,
  peakAttrs,
  careerMode: 'classico',
})

console.log(`\nCARREIRA · seed ${SEED} · ${position} · auge ${overallFor(peakAttrs, position)}\n`)

let decisiveCount = 0
let finalCount = 0
let playerGoalsNarrated = 0

while (!state.retired) {
  const focus = bestFocus(state.peakAttrs, position, state.age)
  const before = state.peakAttrs
  const result = playSeason(state, focus)
  const record = result.record
  const totals = seasonTotals(record)

  // Soma manual, independente de `seasonTotals` e de `nationalTotals`: as
  // partidas da selecao sao percorridas aqui na mao, de proposito.
  const capsPlayed = (record.national?.matches ?? []).filter((match) => match.played)

  const manual = {
    matches:
      record.stats.matches +
      record.cups.reduce((sum, run) => sum + run.matches, 0) +
      capsPlayed.length,
    goals:
      record.stats.goals +
      record.cups.reduce((sum, run) => sum + run.goals, 0) +
      capsPlayed.reduce((sum, match) => sum + match.goals, 0),
    assists:
      record.stats.assists +
      record.cups.reduce((sum, run) => sum + run.assists, 0) +
      capsPlayed.reduce((sum, match) => sum + match.assists, 0),
  }

  for (const key of ['matches', 'goals', 'assists'] as const) {
    if (totals[key] !== manual[key]) {
      errors.push(
        `${record.label}: ${key} consolidado ${totals[key]} != soma manual ${manual[key]}`,
      )
    }
  }

  // A evolucao registrada precisa refletir o treino de fato aplicado.
  const expected = applyTraining(before, focus, record.age)
  const registered = new Map(record.growth.map((g) => [g.attr, g.to]))

  for (const attr of ALL_ATTRS) {
    const grew = expected[attr] > before[attr]
    if (grew !== registered.has(attr)) {
      errors.push(`${record.label}: evolucao de ${attr} registrada errado`)
    }
  }

  const growth =
    record.growth.map((g) => `${ATTR_LABEL[g.attr].short} ${g.from}→${g.to}`).join(' ') || '—'

  const decisive = record.decisive
  if (decisive) {
    decisiveCount++
    if (decisive.stage === 'Final') finalCount++

    const seedFor = () => createRng(`${SEED}:narracao:${record.label}`)
    const timeline = buildTimeline(decisive, 'Craque', seedFor())
    const again = buildTimeline(decisive, 'Craque', seedFor())

    if (JSON.stringify(timeline) !== JSON.stringify(again)) {
      errors.push(`${record.label}: narracao nao e deterministica`)
    }

    const goals = timeline.filter((event) => event.type === 'gol')
    const forTeam = goals.filter((event) => event.side === 'team').length
    const against = goals.length - forTeam

    if (forTeam !== decisive.teamGoals || against !== decisive.opponentGoals) {
      errors.push(
        `${record.label}: narracao ${forTeam}-${against} != placar ` +
          `${decisive.teamGoals}-${decisive.opponentGoals}`,
      )
    }

    let previous = 0
    for (const event of timeline) {
      if (event.minute < 1 || event.minute > 90) {
        errors.push(`${record.label}: lance no minuto ${event.minute}`)
      }
      if (event.minute < previous) {
        errors.push(`${record.label}: lances fora de ordem`)
      }
      previous = event.minute
    }

    if (!decisive.played && timeline.some((event) => event.byPlayer)) {
      errors.push(`${record.label}: lance atribuido a jogador que nao atuou`)
    }

    playerGoalsNarrated += timeline.filter(
      (event) => event.type === 'gol' && event.byPlayer,
    ).length
  }

  console.log(
    `  ${record.label}  ${String(record.age).padStart(2)}a  ` +
      `${(clubById(record.clubId)?.name ?? '?').padEnd(22).slice(0, 22)} ` +
      `OVR ${String(record.overall).padStart(2)}  ` +
      `${String(totals.matches).padStart(2)}j ${String(totals.goals).padStart(2)}g ` +
      `${String(totals.assists).padStart(2)}a  ` +
      `${totals.lines.length} comp.  ` +
      `${growth.padEnd(14)}  ` +
      (decisive
        ? `${decisive.stage}: ${decisive.teamGoals}-${decisive.opponentGoals} ` +
          `vs ${decisive.opponentName}`
        : 'sem jogo decisivo'),
  )

  state = result.state

  const overall = currentOverall(state.peakAttrs, position, state.age)
  const best = state.offers
    .map((offer) => clubById(offer.clubId))
    .filter((club) => club && club.strength <= overall + 5)
    .sort((a, b) => (b?.strength ?? 0) - (a?.strength ?? 0))[0]

  state = resolveTransfer(state, best ? best.id : null)
}

console.log(
  `\n  ${state.seasons.length} temporadas · ${decisiveCount} com jogo decisivo · ` +
    `${finalCount} finais · ${playerGoalsNarrated} gols do jogador narrados\n`,
)

if (errors.length > 0) {
  console.log(`ERROS\n`)
  for (const error of errors.slice(0, 20)) console.log(`  x ${error}`)
  console.log(`\n${errors.length} erro(s).\n`)
  process.exit(1)
}

console.log(`Resumo coerente.\n`)

function bestFocus(attrs: Parameters<typeof applyTraining>[0], pos: typeof position, age: number): Attr {
  let best: Attr = ALL_ATTRS[0]
  let bestOverall = -1

  for (const attr of ALL_ATTRS) {
    const value = overallFor(applyTraining(attrs, attr, age), pos)
    if (value > bestOverall) {
      bestOverall = value
      best = attr
    }
  }

  return best
}
