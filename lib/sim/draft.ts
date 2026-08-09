import { createRng, sample, type Rng } from './rng'
import {
  ALL_ATTRS,
  type Attr,
  type DraftPick,
  type Legend,
  type PlayerAttrs,
} from './types'

export type DraftMode = 'amador' | 'pro'

export type DraftConfig = {
  seed: string
  mode: DraftMode
  /** Quantos re-sorteios de lenda o jogador tem na carreira inteira. */
  rerolls: number
}

export type DraftState = {
  config: DraftConfig
  /** Lendas ja sorteadas, para nao repetir. */
  usedLegendIds: string[]
  currentLegend: Legend
  picks: DraftPick[]
  rerollsLeft: number
}

/**
 * Um slot por atributo: ao fim do draft o jogador tem os oito preenchidos,
 * cada um roubado de uma lenda diferente.
 */
export const DRAFT_ROUNDS = ALL_ATTRS.length

export const DEFAULT_REROLLS: Record<DraftMode, number> = {
  amador: 3,
  pro: 1,
}

export function startDraft(config: DraftConfig, pool: Legend[]): DraftState {
  const rng = rngFor(config.seed, 0)
  const legend = drawLegend(rng, pool, [])

  return {
    config,
    usedLegendIds: [legend.id],
    currentLegend: legend,
    picks: [],
    rerollsLeft: config.rerolls,
  }
}

/** Atributos ainda disponiveis — os ja roubados somem da oferta. */
export function availableAttrs(state: DraftState): Attr[] {
  const taken = new Set(state.picks.map((pick) => pick.attr))
  return ALL_ATTRS.filter((attr) => !taken.has(attr))
}

export function isComplete(state: DraftState): boolean {
  return state.picks.length >= DRAFT_ROUNDS
}

/**
 * Rouba um atributo da lenda atual e avanca para a proxima.
 * Retorna o mesmo estado se a jogada for invalida — quem chama decide
 * se isso e erro de UI ou clique duplicado.
 */
export function pickAttr(
  state: DraftState,
  attr: Attr,
  pool: Legend[],
): DraftState {
  if (isComplete(state) || !availableAttrs(state).includes(attr)) {
    return state
  }

  const picks: DraftPick[] = [
    ...state.picks,
    {
      attr,
      value: state.currentLegend[attr],
      fromLegendId: state.currentLegend.id,
      fromLegendName: state.currentLegend.name,
    },
  ]

  if (picks.length >= DRAFT_ROUNDS) {
    return { ...state, picks }
  }

  const rng = rngFor(state.config.seed, picks.length)
  const legend = drawLegend(rng, pool, state.usedLegendIds)

  return {
    ...state,
    picks,
    currentLegend: legend,
    usedLegendIds: [...state.usedLegendIds, legend.id],
  }
}

/**
 * Troca a lenda atual sem gastar o slot. Limitado e visivel — e o que mantem
 * as ultimas rodadas com decisao, quando restam poucos atributos.
 */
export function rerollLegend(state: DraftState, pool: Legend[]): DraftState {
  if (state.rerollsLeft <= 0 || isComplete(state)) {
    return state
  }

  const used = state.usedLegendIds.length
  const rng = rngFor(state.config.seed, state.picks.length * 100 + used)
  const legend = drawLegend(rng, pool, state.usedLegendIds)

  return {
    ...state,
    currentLegend: legend,
    usedLegendIds: [...state.usedLegendIds, legend.id],
    rerollsLeft: state.rerollsLeft - 1,
  }
}

/** So faz sentido depois de `isComplete`. */
export function attrsFromPicks(picks: DraftPick[]): PlayerAttrs {
  const attrs = {} as PlayerAttrs

  for (const attr of ALL_ATTRS) {
    attrs[attr] = picks.find((pick) => pick.attr === attr)?.value ?? 0
  }

  return attrs
}

/**
 * Cada rodada tem seu proprio stream a partir da seed da carreira.
 * Assim a mesma seed sempre sorteia as mesmas lendas, e o desafio do dia
 * pode dar a todo mundo exatamente o mesmo material.
 */
function rngFor(seed: string, round: number): Rng {
  return createRng(`${seed}:${round}`)
}

function drawLegend(rng: Rng, pool: Legend[], usedIds: string[]): Legend {
  const used = new Set(usedIds)
  const candidates = pool.filter((legend) => !used.has(legend.id))
  const from = candidates.length > 0 ? candidates : pool

  return sample(rng, from, 1)[0]
}
