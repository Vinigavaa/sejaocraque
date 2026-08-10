'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

import type { Award } from '@/lib/sim/awards'
import {
  fieldOf,
  playSeason,
  resolveTransfer,
  seasonLabel,
  setPreferences,
  startCareer,
  type CareerMode,
  type CareerState,
  type PlayedLeague,
  type SeasonRecord,
} from '@/lib/sim/career'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
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
import {
  advanceLiveMatch,
  buildTimeline,
  chooseLiveOption,
  finishLiveMatch,
  moraleAfterMatch,
  simulateRestOfMatch,
  startLiveMatch,
  type LiveMatchState,
} from '@/lib/sim/liveMatch'
import {
  completeRound,
  finishMatchdaySeason,
  isSeasonOver,
  nextFixture,
  setupForNext,
  startMatchdaySeason,
  type MatchdaySeason,
} from '@/lib/sim/matchday'
import { overallByPosition, overallFor } from '@/lib/sim/positions'
import { applyTraining, currentOverall } from '@/lib/sim/progression'
import { createRng, randomSeed, type Rng } from '@/lib/sim/rng'
import { averageStrength, type LeagueOutcome } from '@/lib/sim/season'
import type { TransferPreferences } from '@/lib/sim/transfers'
import { ALL_ATTRS, type Attr, type Position } from '@/lib/sim/types'
import {
  newsFromMatch,
  newsFromSeason,
  transferNews,
  type NewsContext,
  type NewsItem,
} from './news'

export type Screen =
  | 'home'
  | 'create'
  | 'draft'
  | 'reveal'
  | 'club'
  | 'match'
  | 'live'
  | 'review'
  | 'career'
  | 'end'
  | 'history'
  | 'agent'

export type Overlay =
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

/** O feed guarda uma temporada inteira de acontecimentos, e não mais que isso. */
const MAX_NEWS = 40

export function useGame() {
  const [screen, setScreen] = useState<Screen>('home')

  // — criação
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState<string | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [shirtNumber, setShirtNumber] = useState<number | null>(null)
  const [mode, setMode] = useState<DraftMode | null>(null)
  const [careerMode, setCareerMode] = useState<CareerMode | null>(null)

  // — draft
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [finalPosition, setFinalPosition] = useState<Position | null>(null)

  // — carreira
  const [career, setCareer] = useState<CareerState | null>(null)
  const [lastRecord, setLastRecord] = useState<SeasonRecord | null>(null)
  const [lastTable, setLastTable] = useState<LeagueOutcome | null>(null)
  const [overlayQueue, setOverlayQueue] = useState<Overlay[]>([])
  const [trainingFocus, setTrainingFocus] = useState<Attr | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  /**
   * Se o aviso do empresário está na tela.
   *
   * Uma vez por temporada, e só no modo Clássico: no Jogo a Jogo o jogador
   * passa pela tela de carreira a cada rodada e o botão já se apresenta
   * sozinho. Reaparece a cada temporada nova, porque é a cada ano que a janela
   * de transferências volta a valer.
   */
  const [agentHint, setAgentHint] = useState(false)

  // — modo Jogo a Jogo
  const [matchday, setMatchday] = useState<MatchdaySeason | null>(null)
  const [live, setLive] = useState<LiveMatchState | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])

  /**
   * O sorteio da partida em curso.
   *
   * Fica num ref, e nao no estado, porque um gerador e mutavel por natureza:
   * cada chamada muda o proximo numero. Guardado como estado ele seria
   * duplicado a cada render do React 18 em modo estrito, e a mesma decisao
   * daria resultados diferentes dependendo de quantas vezes a tela desenhou.
   */
  const matchRng = useRef<Rng | null>(null)

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
    name.trim().length > 0 &&
    !!nationality &&
    !!position &&
    !!shirtNumber &&
    !!mode &&
    !!careerMode

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
        // O modo e escolhido na criacao e nao muda mais: ele decide como cada
        // temporada e apurada, e trocar no meio misturaria duas apuracoes.
        careerMode: careerMode ?? 'classico',
      }),
    )
    setScreen('club')
  }, [peakAttrs, finalPosition, nationality, shirtNumber, draft, name, careerMode])

  const beginCareer = useCallback(() => {
    setAgentHint(career?.config.careerMode === 'classico')
    setScreen('career')
  }, [career])

  const dismissAgentHint = useCallback(() => setAgentHint(false), [])

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

  /** Fecha a temporada e abre o resumo. */
  const openReview = useCallback(() => {
    setPending((current) => (current ? { ...current, stage: 'post' } : current))
    setScreen('review')
  }, [])

  /**
   * O contexto que a imprensa usa para dimensionar uma notícia.
   *
   * Sai sempre do estado atual da carreira — divisão, clube, reputação, idade
   * — porque é exatamente isso que separa uma nota no jornal da cidade de uma
   * chamada internacional.
   */
  const newsContext = useCallback(
    (state: CareerState): NewsContext => {
      const club = clubById(state.clubId)
      const league = leagueById(state.leagueId)

      return {
        playerName: state.config.name,
        clubName: club?.name ?? 'clube',
        leagueName: league?.name ?? 'campeonato',
        leagueTier: league?.tier ?? 3,
        clubStrength: club?.strength ?? 60,
        reputation: state.morale.reputation,
        age: state.age,
        overall: currentOverall(state.peakAttrs, state.config.position, state.age),
        position: state.config.position,
        season: seasonLabel(state.seasonIndex),
      }
    },
    [],
  )

  const pushNews = useCallback((items: NewsItem[]) => {
    if (items.length === 0) return
    setNews((current) => [...items, ...current].slice(0, MAX_NEWS))
  }, [])

  /**
   * Fecha a temporada.
   *
   * `playedLeague` só vem preenchido no modo Jogo a Jogo, e carrega a liga que
   * já foi disputada partida a partida. Do fechamento em diante — copas,
   * seleção, prêmios, mercado, evolução — os dois modos correm pelo mesmo
   * caminho, que é o que mantém as duas carreiras comparáveis.
   */
  const closeSeason = useCallback(
    (playedLeague?: PlayedLeague) => {
      if (!career || career.retired) return

      const focus = trainingFocus ?? suggestedFocus(career)
      const result = playSeason(career, focus, playedLeague)
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
      pushNews(
        newsFromSeason(
          { ...newsContext(career), season: record.label },
          record,
          createRng(`${career.config.seed}:imprensa:${record.label}`),
        ),
      )
      setMatchday(null)
      setTrainingFocus(null)
      setPending({ stage: 'pre', post, retired: result.state.retired })

      // No modo Jogo a Jogo a última rodada já foi disputada pelo jogador —
      // reexibi-la como "o jogo que decidiu a temporada" seria mostrar de novo
      // o que ele acabou de jogar. Final de copa continua valendo: essas o
      // motor resolve fora do calendário da liga.
      const worthWatching =
        record.decisive &&
        (career.config.careerMode === 'classico' || record.decisive.stage === 'Final')

      if (worthWatching) {
        setScreen('match')
        return
      }

      openReview()
    },
    [career, trainingFocus, suggestedFocus, openReview, newsContext, pushNews],
  )

  const advance = useCallback(() => closeSeason(), [closeSeason])

  /** O sorteio da rodada: o mesmo para a partida do jogador e para as outras. */
  const roundRng = useCallback(
    (state: CareerState, roundIndex: number): Rng =>
      createRng(`${state.config.seed}:rodada:${state.seasonIndex}:${roundIndex}`),
    [],
  )

  /**
   * Abre a próxima partida da temporada.
   *
   * Rodadas em que o clube está de folga — o que acontece em liga de número
   * ímpar de clubes — correm sozinhas até aparecer um jogo dele. Sem isso o
   * botão de "próximo jogo" não faria nada em algumas rodadas.
   */
  const playNextMatch = useCallback(() => {
    if (!career || career.retired || career.config.careerMode !== 'jogoAJogo') return

    const club = clubById(career.clubId)
    const league = leagueById(career.leagueId)
    if (!club || !league) return

    const clubs = fieldOf(league, club)

    let season =
      matchday ??
      startMatchdaySeason({
        league,
        clubs,
        clubId: club.id,
        seed: career.config.seed,
        seasonIndex: career.seasonIndex,
      })

    while (!isSeasonOver(season) && !nextFixture(season)) {
      season = completeRound(season, null, roundRng(career, season.roundIndex))
    }

    if (isSeasonOver(season)) {
      const { outcome, stats } = finishMatchdaySeason(season, league)
      setMatchday(season)
      closeSeason({ outcome, stats, morale: career.morale })
      return
    }

    const setup = setupForNext(
      season,
      {
        name: career.config.name,
        position: career.config.position,
        overall: currentOverall(career.peakAttrs, career.config.position, career.age),
        attrs: career.peakAttrs,
      },
      club,
      league.name,
      averageStrength(clubs),
    )

    if (!setup) return

    matchRng.current = createRng(
      `${career.config.seed}:partida:${career.seasonIndex}:${season.roundIndex}`,
    )

    setMatchday(season)
    setLive(startLiveMatch(setup, career.morale, matchRng.current))
    setScreen('live')
  }, [career, matchday, roundRng, closeSeason])

  const advanceLive = useCallback(() => {
    const rng = matchRng.current
    if (!rng) return
    setLive((state) => (state ? advanceLiveMatch(state, rng) : state))
  }, [])

  const chooseLive = useCallback((index: number) => {
    const rng = matchRng.current
    if (!rng) return
    setLive((state) => (state ? chooseLiveOption(state, index, rng) : state))
  }, [])

  /** Simula o resto da partida. As consequências continuam valendo. */
  const skipLive = useCallback(() => {
    const rng = matchRng.current
    if (!rng) return
    setLive((state) => (state ? simulateRestOfMatch(state, rng) : state))
  }, [])

  /**
   * Apito final: grava a partida na tabela, na moral e na imprensa.
   *
   * É aqui, e não durante a partida, que a carreira muda — uma partida
   * abandonada no meio do caminho não pode deixar metade das consequências
   * aplicadas.
   */
  const finishLive = useCallback(() => {
    if (!career || !live || !matchday) return

    const done = finishLiveMatch(live)
    const league = leagueById(career.leagueId)
    if (!league) return

    const roundIndex = matchday.roundIndex

    const season = completeRound(
      matchday,
      {
        teamGoals: done.teamGoals,
        opponentGoals: done.opponentGoals,
        player: done.player,
      },
      roundRng(career, roundIndex),
    )

    const morale = moraleAfterMatch(done)
    const updated = { ...career, morale }

    setCareer(updated)
    setMatchday(season)
    setLive(null)

    pushNews(
      newsFromMatch(
        newsContext(updated),
        season.log,
        createRng(`${career.config.seed}:imprensa:${career.seasonIndex}:${roundIndex}`),
      ),
    )

    if (isSeasonOver(season)) {
      const { outcome, stats } = finishMatchdaySeason(season, league)
      closeSeason({ outcome, stats, morale })
      return
    }

    setScreen('career')
  }, [career, live, matchday, roundRng, pushNews, newsContext, closeSeason])

  /** Fim da narração do jogo decisivo. */
  const finishMatch = useCallback(() => {
    if (!career || !lastRecord) return
    openReview()
  }, [career, lastRecord, openReview])

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

    // O ano virou: a janela de transferências volta a valer, e o aviso do
    // empresário volta com ela.
    setAgentHint(!retired && career?.config.careerMode === 'classico')
  }, [pending, career])

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
      pushNews([
        transferNews(
          newsContext(career),
          club.name,
          createRng(`${career.config.seed}:mercado:${career.seasonIndex}`),
        ),
      ])
    }

    closeOverlay()
  }, [career, overlay, closeOverlay, newsContext, pushNews])

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

  const openAgent = useCallback(() => {
    setAgentHint(false)
    setScreen('agent')
  }, [])
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
    setCareerMode(null)
    setDraft(null)
    setFinalPosition(null)
    setCareer(null)
    setLastRecord(null)
    setLastTable(null)
    setOverlayQueue([])
    setTrainingFocus(null)
    setPending(null)
    setHistoryOrigin('career')
    setAgentHint(false)
    setMatchday(null)
    setLive(null)
    setNews([])
    matchRng.current = null
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
    careerMode,
    setCareerMode,
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
    trainingFocus,
    setTrainingFocus,
    advance,
    news,
    matchday,
    live,
    playNextMatch,
    advanceLive,
    chooseLive,
    skipLive,
    finishLive,
    decisiveTimeline,
    finishMatch,
    finishReview,
    skipToEnd,
    openHistory,
    closeHistory,


    openAgent,
    closeAgent,
    agentHint,
    dismissAgentHint,
    updatePreferences,

    overlay,
    closeOverlay,
    acceptTransfer,
    declineTransfer,

    reset,
  }
}

export type Game = ReturnType<typeof useGame>
