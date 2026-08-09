'use client'

import { useCallback, useMemo, useState } from 'react'

import type { Award } from '@/lib/sim/awards'
import {
  playSeason,
  resolveTransfer,
  setPreferences,
  startCareer,
  type CareerState,
  type SeasonRecord,
} from '@/lib/sim/career'
import { clubById } from '@/lib/sim/data/clubs'
import { LEGENDS } from '@/lib/sim/data/legends'
import {
  attrsFromPicks,
  isComplete,
  pickAttr,
  rerollLegend,
  startDraft,
  DEFAULT_REROLLS,
  type DraftMode,
  type DraftState,
} from '@/lib/sim/draft'
import { buildTimeline } from '@/lib/sim/liveMatch'
import { overallByPosition, overallFor } from '@/lib/sim/positions'
import { convertsPenalty, hasPenaltyMoment } from '@/lib/sim/penalty'
import { applyTraining, currentOverall } from '@/lib/sim/progression'
import { createRng, randomSeed } from '@/lib/sim/rng'
import type { LeagueOutcome } from '@/lib/sim/season'
import type { TransferPreferences } from '@/lib/sim/transfers'
import { ALL_ATTRS, type Attr, type Position } from '@/lib/sim/types'
import { headlinesFor, transferHeadline } from './headlines'

export type Screen =
  | 'home'
  | 'create'
  | 'draft'
  | 'reveal'
  | 'club'
  | 'match'
  | 'review'
  | 'career'
  | 'end'
  | 'history'
  | 'agent'

export type Overlay =
  | { type: 'penalty'; stage: 'choose' | 'result'; scored: boolean }
  | { type: 'award'; award: Award }
  | { type: 'transfer'; clubId: string }

/**
 * A temporada em curso de fechamento.
 *
 * O fim de uma temporada deixou de ser um passo so: passa pelo jogo decisivo,
 * pelo penalti e pelo resumo antes de voltar a carreira. `post` guarda o que
 * so faz sentido depois do resumo — premio e proposta sao consequencia do ano,
 * nao parte dele.
 */
type Pending = {
  /** `pre` = antes do resumo (jogo decisivo, penalti). `post` = depois. */
  stage: 'pre' | 'post'
  post: Overlay[]
  retired: boolean
}

const MAX_HEADLINES = 6

export function useGame() {
  const [screen, setScreen] = useState<Screen>('home')

  // — criação
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState<string | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [shirtNumber, setShirtNumber] = useState<number | null>(null)
  const [mode, setMode] = useState<DraftMode | null>(null)

  // — draft
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [finalPosition, setFinalPosition] = useState<Position | null>(null)

  // — carreira
  const [career, setCareer] = useState<CareerState | null>(null)
  const [lastRecord, setLastRecord] = useState<SeasonRecord | null>(null)
  const [lastTable, setLastTable] = useState<LeagueOutcome | null>(null)
  const [headlines, setHeadlines] = useState<string[]>([])
  const [overlayQueue, setOverlayQueue] = useState<Overlay[]>([])
  const [trainingFocus, setTrainingFocus] = useState<Attr | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  /**
   * De onde o histórico foi aberto. Ele é um desvio, não um passo do fluxo:
   * sem guardar a origem, fechá-lo no fim de carreira devolveria o jogador
   * para a tela de carreira, que é uma tela do passado.
   */
  const [historyOrigin, setHistoryOrigin] = useState<Screen>('career')

  const peakAttrs = useMemo(
    () => (draft && isComplete(draft) ? attrsFromPicks(draft.picks) : null),
    [draft],
  )

  const positionRanking = useMemo(
    () => (peakAttrs ? overallByPosition(peakAttrs) : []),
    [peakAttrs],
  )

  const peakOverall = useMemo(
    () => (peakAttrs && finalPosition ? overallFor(peakAttrs, finalPosition) : 0),
    [peakAttrs, finalPosition],
  )

  const liveOverall = useMemo(() => {
    if (!career || !finalPosition) return peakOverall
    return currentOverall(career.peakAttrs, finalPosition, career.age)
  }, [career, finalPosition, peakOverall])

  const canStartDraft =
    name.trim().length > 0 && !!nationality && !!position && !!shirtNumber && !!mode

  const beginDraft = useCallback(() => {
    if (!canStartDraft || !mode) return

    const seed = randomSeed()
    setDraft(startDraft({ seed, mode, rerolls: DEFAULT_REROLLS[mode] }, LEGENDS))
    setScreen('draft')
  }, [canStartDraft, mode])

  const steal = useCallback(
    (attr: Attr) => {
      if (!draft) return

      const next = pickAttr(draft, attr, LEGENDS)
      setDraft(next)

      if (isComplete(next)) {
        // A posição escolhida na criação é o ponto de partida; o jogador ainda
        // pode trocar na tela de revelação.
        setFinalPosition(position)
        setScreen('reveal')
      }
    },
    [draft, position],
  )

  const reroll = useCallback(() => {
    if (draft) setDraft(rerollLegend(draft, LEGENDS))
  }, [draft])

  /**
   * A carreira nasce aqui, e nao ao entrar na tela seguinte: o clube inicial e
   * sorteado por `startCareer`, e a tela de clube precisa mostra-lo antes de o
   * jogador confirmar.
   */
  const goToClub = useCallback(() => {
    if (!peakAttrs || !finalPosition || !nationality || !shirtNumber || !draft) return

    setCareer(
      startCareer({
        seed: draft.config.seed,
        name: name.trim(),
        nationality,
        position: finalPosition,
        shirtNumber,
        peakAttrs,
      }),
    )
    setScreen('club')
  }, [peakAttrs, finalPosition, nationality, shirtNumber, draft, name])

  const beginCareer = useCallback(() => setScreen('career'), [])

  /** Melhor foco de treino, usado quando o jogador não escolhe nenhum. */
  const suggestedFocus = useCallback(
    (state: CareerState): Attr => {
      let best: Attr = ALL_ATTRS[0]
      let bestOverall = -1

      for (const attr of ALL_ATTRS) {
        const trained = applyTraining(state.peakAttrs, attr, state.age)
        const value = overallFor(trained, state.config.position)

        if (value > bestOverall) {
          bestOverall = value
          best = attr
        }
      }

      return best
    },
    [],
  )

  /**
   * O pênalti é o único momento que muda um número da temporada, então ele é
   * resolvido antes do resumo — senão o resumo mostraria um gol a menos.
   */
  const openPenaltyOrReview = useCallback(
    (state: CareerState, matches: number) => {
      const rng = createRng(`${state.config.seed}:momento:${state.seasonIndex - 1}`)

      if (hasPenaltyMoment(state.config.position, matches, rng)) {
        setOverlayQueue([{ type: 'penalty', stage: 'choose', scored: false }])
        return
      }

      setPending((current) => (current ? { ...current, stage: 'post' } : current))
      setScreen('review')
    },
    [],
  )

  const advance = useCallback(() => {
    if (!career || career.retired) return

    const focus = trainingFocus ?? suggestedFocus(career)
    const result = playSeason(career, focus)
    const record = result.record

    const post: Overlay[] = record.awards.map((award) => ({ type: 'award', award }))

    // Uma proposta por vez mantém a decisão legível.
    const offer = result.state.offers[0]
    if (offer && !result.state.retired) {
      post.push({ type: 'transfer', clubId: offer.clubId })
    }

    setCareer(result.state)
    setLastRecord(record)
    setLastTable(result.leagueOutcome)
    setHeadlines((current) =>
      [...headlinesFor(record, career.config.name), ...current].slice(0, MAX_HEADLINES),
    )
    setTrainingFocus(null)
    setPending({ stage: 'pre', post, retired: result.state.retired })

    if (record.decisive) {
      setScreen('match')
      return
    }

    openPenaltyOrReview(result.state, record.stats.matches)
  }, [career, trainingFocus, suggestedFocus, openPenaltyOrReview])

  /** Fim da narração do jogo decisivo. */
  const finishMatch = useCallback(() => {
    if (!career || !lastRecord) return
    openPenaltyOrReview(career, lastRecord.stats.matches)
  }, [career, lastRecord, openPenaltyOrReview])

  /**
   * Fim do resumo. Prêmio e proposta entram agora, sobre a tela de carreira —
   * ou sobre o fim de carreira, quando foi a última temporada.
   */
  const finishReview = useCallback(() => {
    const post = pending?.post ?? []
    const retired = pending?.retired ?? false

    setPending(null)
    setOverlayQueue(retired ? post.filter((item) => item.type === 'award') : post)
    setScreen(retired ? 'end' : 'career')
  }, [pending])

  const overlay = overlayQueue[0] ?? null

  /** A narração do jogo decisivo, construída a partir do placar já resolvido. */
  const decisiveTimeline = useMemo(() => {
    if (!career || !lastRecord?.decisive) return []

    return buildTimeline(
      lastRecord.decisive,
      career.config.name,
      createRng(`${career.config.seed}:narracao:${lastRecord.label}`),
    )
  }, [career, lastRecord])

  const kickPenalty = useCallback(() => {
    if (!career || overlay?.type !== 'penalty') return

    const rng = createRng(`${career.config.seed}:penalti:${career.seasonIndex}`)
    const scored = convertsPenalty(career.peakAttrs, career.age, rng)

    // O gol conta de verdade: entra na temporada que acabou de ser jogada.
    if (scored) {
      setCareer((state) =>
        state
          ? {
              ...state,
              seasons: state.seasons.map((season, index) =>
                index === state.seasons.length - 1
                  ? { ...season, stats: { ...season.stats, goals: season.stats.goals + 1 } }
                  : season,
              ),
            }
          : state,
      )
      setLastRecord((record) =>
        record ? { ...record, stats: { ...record.stats, goals: record.stats.goals + 1 } } : record,
      )
    }

    setOverlayQueue(([, ...rest]) => [{ type: 'penalty', stage: 'result', scored }, ...rest])
  }, [career, overlay])

  /**
   * Fechar o último overlay da etapa `pre` é o que abre o resumo. Fica aqui e
   * não num efeito: o efeito só saberia disso depois de renderizar a tela
   * vazia por um quadro.
   */
  const closeOverlay = useCallback(() => {
    setOverlayQueue(([, ...rest]) => rest)

    if (overlayQueue.length <= 1 && pending?.stage === 'pre') {
      setPending({ ...pending, stage: 'post' })
      setScreen('review')
    }
  }, [overlayQueue, pending])

  const acceptTransfer = useCallback(() => {
    if (!career || overlay?.type !== 'transfer') return

    // A proposta na tela pode não existir mais no estado — basta uma temporada
    // ter sido jogada entre uma coisa e outra. `resolveTransfer` estoura nesse
    // caso, e com razão: a invariante é do motor. Quem não pode depender de uma
    // referência velha é a interface.
    if (!career.offers.some((item) => item.clubId === overlay.clubId)) {
      closeOverlay()
      return
    }

    const club = clubById(overlay.clubId)
    setCareer(resolveTransfer(career, overlay.clubId))

    if (club) {
      setHeadlines((current) =>
        [transferHeadline(career.config.name, club.name), ...current].slice(0, MAX_HEADLINES),
      )
    }

    closeOverlay()
  }, [career, overlay, closeOverlay])

  const declineTransfer = useCallback(() => {
    if (!career) return
    setCareer(resolveTransfer(career, null))
    closeOverlay()
  }, [career, closeOverlay])

  const skipToEnd = useCallback(() => {
    if (!career) return

    let state = career
    let guard = 0

    while (!state.retired && guard < 40) {
      const result = playSeason(state, suggestedFocus(state))
      state = result.state

      // Sem supervisão, aceita a melhor proposta que não deixe o jogador no banco.
      const overall = currentOverall(state.peakAttrs, state.config.position, state.age)
      const best = state.offers
        .map((offer) => clubById(offer.clubId))
        .filter((club) => club && club.strength <= overall + 5)
        .sort((a, b) => (b?.strength ?? 0) - (a?.strength ?? 0))[0]

      state = resolveTransfer(state, best ? best.id : null)
      guard++
    }

    setCareer(state)
    setOverlayQueue([])
    setPending(null)
    setScreen('end')
  }, [career, suggestedFocus])

  const openHistory = useCallback(() => {
    setHistoryOrigin((current) => (screen === 'history' ? current : screen))
    setScreen('history')
  }, [screen])

  const closeHistory = useCallback(() => setScreen(historyOrigin), [historyOrigin])

  const openAgent = useCallback(() => setScreen('agent'), [])
  const closeAgent = useCallback(() => setScreen('career'), [])

  /**
   * Troca os destinos pedidos ao empresario.
   *
   * Vale da proxima janela em diante: as propostas da temporada que acabou de
   * ser jogada ja estao no estado, e reescreve-las aqui seria mudar o passado.
   */
  const updatePreferences = useCallback((preferences: TransferPreferences) => {
    setCareer((current) => (current ? setPreferences(current, preferences) : current))
  }, [])

  const reset = useCallback(() => {
    setScreen('home')
    setName('')
    setNationality(null)
    setPosition(null)
    setShirtNumber(null)
    setMode(null)
    setDraft(null)
    setFinalPosition(null)
    setCareer(null)
    setLastRecord(null)
    setLastTable(null)
    setHeadlines([])
    setOverlayQueue([])
    setTrainingFocus(null)
    setPending(null)
    setHistoryOrigin('career')
  }, [])

  return {
    screen,
    setScreen,

    name,
    setName,
    nationality,
    setNationality,
    position,
    setPosition,
    shirtNumber,
    setShirtNumber,
    mode,
    setMode,
    canStartDraft,
    beginDraft,

    draft,
    steal,
    reroll,

    peakAttrs,
    positionRanking,
    finalPosition,
    setFinalPosition,
    peakOverall,
    liveOverall,
    goToClub,
    beginCareer,

    career,
    lastRecord,
    lastTable,
    headlines,
    trainingFocus,
    setTrainingFocus,
    advance,
    decisiveTimeline,
    finishMatch,
    finishReview,
    skipToEnd,
    openHistory,
    closeHistory,

    openAgent,
    closeAgent,
    updatePreferences,

    overlay,
    kickPenalty,
    closeOverlay,
    acceptTransfer,
    declineTransfer,

    reset,
  }
}

export type Game = ReturnType<typeof useGame>
