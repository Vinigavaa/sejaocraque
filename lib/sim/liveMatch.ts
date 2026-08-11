import {
  DECISIONS,
  eligibleDecisions,
  timingKindOf,
  weightFor,
  type DecisionOption,
  type DecisionSpec,
  type LiveEffect,
} from './liveDecisions'
import {
  FOCUS_ATTACK_SHARE,
  NEUTRAL_ATTACK_SHARE,
  focusEdge,
  type DecisionSide,
  type MatchFocus,
} from './liveFocus'
import {
  blindCursor,
  buildTiming,
  connected,
  missedTiming,
  resolveTiming,
  type TimingChallenge,
  type TimingOutcome,
} from './liveTiming'
import {
  applyMorale,
  mergeDeltas,
  moraleFactor,
  type Morale,
  type MoraleDelta,
} from './morale'
import { clamp } from './positions'
import { pick, poisson, range, sample, type Rng } from './rng'
import { goalExpectation, MIN_PARTICIPATION, participationShare } from './season'
import type { NumericAttr, PlayerAttrs, Position } from './types'

/**
 * A narracao minuto a minuto de uma partida.
 *
 * Isto **nao simula** a partida: o placar ja foi decidido pela tabela ou pela
 * chave de mata-mata, e reabrir esse resultado significaria reabrir titulo,
 * classificacao e premios que ja foram resolvidos. O que este modulo faz e
 * distribuir os gols que ja existem ao longo dos 90 minutos e decidir quais
 * deles foram do jogador.
 *
 * Pelo mesmo motivo, os gols atribuidos ao jogador sao um **recorte** dos que
 * ele ja tem na competicao — nunca um acrescimo. Nenhum total de temporada
 * muda por causa da narracao.
 */
export type LiveEventType =
  | 'gol'
  | 'chance'
  | 'defesa'
  | 'falta'
  | 'penaltis'
  | 'cartao'
  | 'lesao'
  | 'substituicao'
  | 'decisao'

/**
 * O minimo que a narracao precisa saber de uma partida.
 *
 * Estreito de proposito: `DecisiveMatch` e estruturalmente um superconjunto
 * disto, e uma partida de selecao vira isto com `playerMatches: 1` — a taxa de
 * atribuicao fica exata em vez de ser a media da competicao inteira.
 */
export type NarratableMatch = {
  teamName: string
  opponentName: string
  teamGoals: number
  opponentGoals: number
  /** Fase, quando existe. So a final fala em titulo. */
  stage: string | null
  onPenalties: boolean
  won: boolean
  played: boolean
  playerMatches: number
  playerGoals: number
  playerAssists: number
}

export type LiveEvent = {
  /** 1 a 90. */
  minute: number
  type: LiveEventType
  /** De quem foi o lance. */
  side: 'team' | 'opponent'
  text: string
  /** Verdadeiro quando o lance e do jogador da carreira. */
  byPlayer: boolean
}

const MATCH_MINUTES = 90

/** Gols por time numa partida media — base da taxa de participacao do jogador. */
const TEAM_GOALS_PER_MATCH = 1.4

/** Teto da chance de o gol ser do jogador. Nem um artilheiro faz todos. */
const MAX_SHARE = 0.75

export function buildTimeline(
  match: NarratableMatch,
  playerName: string,
  rng: Rng,
): LiveEvent[] {
  const goalCount = match.teamGoals + match.opponentGoals
  const extras = goalCount >= 5 ? 2 : 4

  // Minutos distintos para tudo que acontece, sorteados de uma vez para dois
  // lances nunca cairem no mesmo minuto.
  const minutes = sample(rng, allMinutes(), Math.min(MATCH_MINUTES, goalCount + extras))
  const goalMinutes = minutes.slice(0, goalCount).sort(ascending)
  const extraMinutes = minutes.slice(goalCount)

  const sides = sample(
    rng,
    [
      ...Array<'team' | 'opponent'>(match.teamGoals).fill('team'),
      ...Array<'team' | 'opponent'>(match.opponentGoals).fill('opponent'),
    ],
    goalCount,
  )

  const goalShare = shareOf(match.playerGoals, match.playerMatches, match.played)
  const assistShare = shareOf(match.playerAssists, match.playerMatches, match.played)

  // Teto do que ele pode levar nesta partida. Sem isso o sorteio por gol podia
  // credita-lo com quatro gols num jogo em que ele fez um — a narracao e um
  // recorte do que ja existe, nunca um acrescimo.
  let goalBudget = budgetFor(match.playerGoals, match.playerMatches)
  let assistBudget = budgetFor(match.playerAssists, match.playerMatches)

  const events: LiveEvent[] = goalMinutes.map((minute, index) => {
    const side = sides[index]

    if (side === 'opponent') {
      return {
        minute,
        type: 'gol',
        side,
        text: `${match.opponentName} marca.`,
        byPlayer: false,
      }
    }

    if (goalBudget > 0 && rng() < goalShare) {
      goalBudget--
      return {
        minute,
        type: 'gol',
        side,
        text: `GOL! ${playerName} marca.`,
        byPlayer: true,
      }
    }

    if (assistBudget > 0 && rng() < assistShare) {
      assistBudget--
      return {
        minute,
        type: 'gol',
        side,
        text: `${match.teamName} marca, com assistência de ${playerName}.`,
        byPlayer: true,
      }
    }

    return {
      minute,
      type: 'gol',
      side,
      text: `${match.teamName} marca.`,
      byPlayer: false,
    }
  })

  for (const minute of extraMinutes) {
    events.push(fillerEvent(minute, match, playerName, rng))
  }

  events.sort((a, b) => ascending(a.minute, b.minute))

  if (match.onPenalties) {
    // Só a final decide título. Antes disso o texto falava em taça mesmo numa
    // semifinal, porque a narração só existia para o jogo decisivo do ano.
    const decidesTitle = match.stage === 'Final'
    const winner = match.won ? match.teamName : match.opponentName

    events.push({
      minute: MATCH_MINUTES,
      type: 'penaltis',
      side: match.won ? 'team' : 'opponent',
      text: decidesTitle
        ? `${winner} vence nos pênaltis e leva o título.`
        : `${winner} vence nos pênaltis e se classifica.`,
      byPlayer: false,
    })
  }

  return events
}

/**
 * Quantos gols (ou assistencias) ele pode levar nesta partida.
 *
 * Com dado de partida — `playerMatches` igual a 1 — o teto e exato. Com dado de
 * competicao inteira e a media por jogo arredondada para cima, para nao proibir
 * o jogo em que ele fez dois.
 */
function budgetFor(production: number, matches: number): number {
  if (matches <= 0) return 0
  return Math.ceil(production / matches)
}

/**
 * Com que frequencia um gol do time e do jogador.
 *
 * Sai da producao dele na competicao dividida pelos gols que o time fez no
 * mesmo periodo. Quem nao entrou em campo nao leva nenhum.
 */
function shareOf(production: number, matches: number, played: boolean): number {
  if (!played || matches <= 0) return 0

  return clamp(production / (matches * TEAM_GOALS_PER_MATCH), 0, MAX_SHARE)
}

/**
 * Lance sem gol, so para a narracao ter respiro entre um placar e outro.
 *
 * O parametro e o minimo que o texto usa, e nao `NarratableMatch` inteiro: os
 * dois motores desta pasta chamam esta funcao, e o modo Jogo a Jogo nao tem
 * placar final para oferecer quando o lance acontece.
 */
function fillerEvent(
  minute: number,
  match: { teamName: string; opponentName: string; played: boolean },
  playerName: string,
  rng: Rng,
): LiveEvent {
  const forTeam = rng() < 0.5
  const side = forTeam ? 'team' : 'opponent'
  const who = forTeam ? match.teamName : match.opponentName

  if (forTeam && match.played && rng() < 0.45) {
    return {
      minute,
      type: 'chance',
      side,
      text: pick(rng, [
        `${playerName} arrisca de fora da área e o goleiro espalma.`,
        `${playerName} deixa o marcador para trás e cruza rasteiro.`,
        `${playerName} aparece livre, mas a bola sai raspando a trave.`,
      ]),
      byPlayer: true,
    }
  }

  return {
    minute,
    type: pick(rng, ['chance', 'defesa', 'falta'] as const),
    side,
    // Sem artigo de proposito: a narracao agora tambem cobre selecao, e "o
    // Argentina" nao existe. Sem artigo funciona para clube e para pais.
    text: pick(rng, [
      `${who} chega com perigo e para no goleiro.`,
      `${who} cobra falta perigosa.`,
      `${who} pressiona, mas a defesa afasta.`,
      `${who} desperdiça o escanteio.`,
    ]),
    byPlayer: false,
  }
}

function allMinutes(): number[] {
  return Array.from({ length: MATCH_MINUTES }, (_, index) => index + 1)
}

function ascending(a: number, b: number): number {
  return a - b
}

export { MATCH_MINUTES }

/* -------------------------------------------------------------------------
 * Modo Jogo a Jogo — a partida jogada, e nao narrada.
 *
 * A diferenca para tudo o que esta acima e de direcao: `buildTimeline` recebe
 * um placar pronto e o distribui pelos 90 minutos; daqui para baixo o placar
 * **sai** da partida. O que a simulacao de temporada entrega e apenas a
 * expectativa de gols dos dois lados; o que o jogador faz em campo soma ou
 * subtrai em cima disso.
 *
 * Por que a producao esperada do jogador e descontada do time: se o placar
 * base ja embutia os gols que ele costuma fazer, e as decisoes acrescentassem
 * mais gols por cima, o modo Jogo a Jogo entregaria placares muito maiores que
 * o modo classico — e as duas carreiras deixariam de ser comparaveis. Aqui a
 * expectativa dele sai do bolo do time e volta como oportunidade de decisao.
 * ---------------------------------------------------------------------- */

export type MatchSide = {
  name: string
  /** Null em partida de selecao, onde quem identifica e a bandeira. */
  clubId: string | null
  strength: number
}

export type MatchSetup = {
  competition: string
  /** Fase, quando existe. Null em rodada de pontos corridos. */
  stage: string | null
  /** Rodada da temporada. Entra na seed e no texto das noticias. */
  round: number
  playerName: string
  position: Position
  overall: number
  attrs: PlayerAttrs
  team: MatchSide
  opponent: MatchSide
  atHome: boolean
  /** Producao esperada do jogador nesta partida — ver `expectedOutputPerMatch`. */
  expected: { goals: number; assists: number }
}

export type PlayerMatchResult = {
  /** Falso quando ele nem entrou. */
  played: boolean
  minutes: number
  goals: number
  assists: number
  /** Nota da partida, 1 casa. Zero enquanto a partida nao terminou. */
  rating: number
  yellow: number
  red: boolean
  injured: boolean
}

/** O momento aberto, esperando a escolha do jogador. */
export type LivePending = {
  id: string
  prompt: string
  side: DecisionSide
  options: {
    label: string
    detail: string
    /** Chance de dar certo, ja com atributo, confianca e adversario. */
    chance: number
    /** Preenchido quando a opcao abre a barra de timing em vez de sortear. */
    timing: TimingChallenge['kind'] | null
  }[]
}

/**
 * A barra aberta, esperando o clique.
 *
 * Guarda o indice da opcao porque o efeito so e aplicado depois do clique: o
 * jogador ja escolheu **o que** fazer, e a barra decide **como** saiu.
 */
export type LiveTiming = {
  optionIndex: number
  challenge: TimingChallenge
}

type ScriptKind =
  | 'gol-time'
  | 'gol-adversario'
  /** Momento que pode virar gol ou assistencia. */
  | 'decisao-gol'
  /** Momento de contexto: cartao, lesao, treinador, torcida, vestiario. */
  | 'decisao'
  | 'lance'
  | 'substituicao'
  /** Intervalo: a partida para e o foco pode mudar. */
  | 'intervalo'

type ScriptEntry = { minute: number; kind: ScriptKind }

export type LiveMatchState = {
  setup: MatchSetup
  minute: number
  events: LiveEvent[]
  teamGoals: number
  opponentGoals: number
  /** Se ele esta em campo agora. */
  onPitch: boolean
  started: boolean
  player: PlayerMatchResult
  /** Moral no inicio da partida — a base sobre a qual as decisoes somam. */
  morale: Morale
  /** O que esta partida mexeu na moral. Aplicado so no apito final. */
  moraleDelta: MoraleDelta
  pending: LivePending | null
  /** A barra aberta. Bloqueia a partida do mesmo jeito que `pending`. */
  timing: LiveTiming | null
  /** O resultado do ultimo clique, para a interface poder mostrar o que saiu. */
  lastTiming: TimingOutcome | null
  decisionsLeft: number
  usedDecisions: string[]
  script: ScriptEntry[]
  /** Foco tatico atual. Escolhido antes do apito e trocavel no intervalo. */
  focus: MatchFocus
  /** Antes do apito inicial: a partida espera a escolha do foco. */
  kickoff: boolean
  /** No intervalo: a partida espera a confirmacao do foco do segundo tempo. */
  halftime: boolean
  /** Se o foco ja foi trocado no intervalo. Uma troca por partida. */
  focusChanged: boolean
  finished: boolean
}

/** Quantos momentos de decisao uma partida pode abrir. */
const MIN_DECISIONS = 4
const MAX_DECISIONS = 7

/**
 * Quantas chances de gol o jogador recebe, no maximo.
 *
 * Quatro ja e uma partida excepcional; sem teto, um centroavante de clube
 * muito superior receberia sete e a partida viraria treino de finalizacao.
 */
const MAX_CHANCES = 4

/**
 * O piso de oportunidades claras, em chances por partida.
 *
 * Existe porque a producao esperada de um zagueiro e tao baixa que a conta
 * sozinha lhe daria uma chance de gol a cada dez ou quinze jogos — realista e
 * sem graca. Com o piso ele recebe uma a cada tres partidas, mais ou menos.
 *
 * E uma **taxa**, e nao um minimo de uma chance por jogo: garantir uma por
 * partida triplicava a producao de zagueiro e volante, que passavam a marcar
 * mais no modo Jogo a Jogo do que no classico. Quem garante que a partida
 * sempre tem o que decidir e o orcamento de contexto, que nunca e zero.
 */
const MIN_CHANCE_RATE = 0.26

/**
 * Aproveitamento medio das opcoes que podem virar gol ou assistencia.
 *
 * Serve para converter **producao esperada** em **numero de chances**: se o
 * jogador costuma produzir 0,68 por jogo e cada chance se converte perto de
 * 45% das vezes, ele precisa de ~1,5 chance por partida para chegar la.
 *
 * Sem essa conversao o modo Jogo a Jogo produzia quase o dobro do classico —
 * eram tres a seis decisoes por jogo, quase todas capazes de virar gol, e a
 * conta simplesmente nao fechava com a taxa de producao da posicao.
 *
 * Subiu de 0,30 para 0,36 quando a barra de timing entrou: o sorteio antigo
 * convertia exatamente a chance do lance, e um jogador com timing converte
 * acima dela. Sem esse ajuste, a mesma carreira renderia mais no modo Jogo a
 * Jogo do que no classico so por ser jogada a mao.
 */
const AVERAGE_CONVERSION = 0.29

/** Quanto um jogador que comeca no banco produz, em relacao a um titular. */
const BENCH_SHARE = 0.5

/** Minuto a partir do qual uma substituicao faz sentido. */
const SUB_WINDOW: [number, number] = [58, 84]

/** O apito do intervalo. */
const HALFTIME_MINUTE = 45

export function startLiveMatch(
  setup: MatchSetup,
  morale: Morale,
  focus: MatchFocus,
  rng: Rng,
): LiveMatchState {
  const started = startsMatch(setup, morale, rng)

  const [forExpectation, againstExpectation] = sideExpectations(setup, started)

  const teamPlan = poisson(rng, forExpectation)
  const opponentPlan = poisson(rng, againstExpectation)

  // A producao esperada dele sai do plano do time e volta como oportunidade.
  //
  // Quem comeca no banco continua tendo chance de decidir: reserva faz gol, e
  // zerar a producao dele empurrava a temporada inteira para baixo do modo
  // classico. O que muda e a escala — meia hora em campo rende menos que
  // noventa minutos.
  const expected =
    (setup.expected.goals + setup.expected.assists) * (started ? 1 : BENCH_SHARE)
  const chances = chanceBudget(setup, morale, expected, rng)

  const script = buildScript(
    {
      teammateGoals: Math.max(0, teamPlan - stochasticRound(expected, rng)),
      opponentGoals: opponentPlan,
      chances,
      // O resto do orcamento e de contexto: cartao, lesao, treinador, torcida.
      // Sao eles que fazem a partida ter decisao mesmo para um zagueiro de
      // segunda divisao, que quase nao recebe chance de gol.
      context: clamp(range(rng, MIN_DECISIONS, MAX_DECISIONS) - chances, 1, MAX_DECISIONS),
      started,
    },
    rng,
  )

  return {
    setup,
    minute: 0,
    events: [],
    teamGoals: 0,
    opponentGoals: 0,
    onPitch: started,
    started,
    player: {
      played: started,
      minutes: 0,
      goals: 0,
      assists: 0,
      rating: 0,
      yellow: 0,
      red: false,
      injured: false,
    },
    morale,
    moraleDelta: {},
    pending: null,
    timing: null,
    lastTiming: null,
    // Conta os dois tipos de momento. Contar so os de contexto deixava o
    // orcamento menor que o roteiro: uma partida com tres chances de gol e
    // duas de contexto abria duas decisoes e transformava as outras tres em
    // lance narrado — exatamente as tres que o jogador tinha para decidir.
    decisionsLeft: script.filter(
      (entry) => entry.kind === 'decisao' || entry.kind === 'decisao-gol',
    ).length,
    usedDecisions: [],
    script,
    focus,
    kickoff: true,
    halftime: false,
    focusChanged: false,
    finished: false,
  }
}

/**
 * Quantas oportunidades claras a partida oferece ao jogador.
 *
 * O ponto de partida e a producao esperada dele convertida em numero de
 * lances. Em cima disso entra o **contexto**, que e o que o modo pedia: contra
 * um time muito superior aparecem menos oportunidades claras, contra um mais
 * fraco aparecem mais, e nem uma coisa nem outra e determinista — o
 * arredondamento e sorteado, entao o mesmo confronto nao devolve sempre o
 * mesmo numero.
 *
 * De onde vem cada fator:
 *
 * - **overall, posicao e forca do elenco** ja estao dentro de `expected`, que
 *   sai de `expectedOutputPerMatch` — a mesma funcao do modo classico.
 * - **adversario** e a diferenca de forca entre os dois clubes.
 * - **mando de campo** e pequeno de proposito: jogar fora nao apaga um craque.
 * - **desempenho recente** entra pela confianca, que e o que a moral guarda de
 *   como as ultimas partidas foram.
 * - **companheiros** entram pela moral de elenco: quem e procurado pelo time
 *   recebe mais bola.
 * - **competicao** entra pela fase: mata-mata e mais travado que pontos
 *   corridos.
 *
 * O resultado e o teto — o que um jogador em foco Ataque receberia. O foco
 * filtra cada oportunidade na hora em que ela acontece, o que e o que permite
 * trocar de foco no intervalo sem reescrever o segundo tempo.
 */
function chanceBudget(
  setup: MatchSetup,
  morale: Morale,
  expected: number,
  rng: Rng,
): number {
  const base = expected / AVERAGE_CONVERSION / NEUTRAL_ATTACK_SHARE

  const opposition = clamp(
    1 + (setup.team.strength - setup.opponent.strength) / 70,
    0.6,
    1.45,
  )
  const home = setup.atHome ? 1.08 : 0.94
  const confidence = 1 + moraleFactor(morale.confidence) * 0.12
  const squad = 1 + moraleFactor(morale.squad) * 0.08
  const knockout = setup.stage ? 0.95 : 1

  const raw = Math.max(base * opposition * home * confidence * squad * knockout, MIN_CHANCE_RATE)

  return Math.min(stochasticRound(raw, rng), MAX_CHANCES)
}

/**
 * Com que frequencia o jogador entra em campo, de 0 a 1.
 *
 * Deliberadamente a mesma conta de `participationShare`, no modo classico:
 * nivel contra elenco, com a margem de 10 porque a forca do clube descreve o
 * elenco e nao o titular medio. A relacao com o treinador desloca a linha — e
 * o caminho concreto pelo qual discutir na beira do campo custa minutos.
 *
 * Ter as duas contas iguais e o que impede os dois modos de divergirem: sem
 * isso um garoto de 16 anos disputava 37 dos 38 jogos num modo e 28 no outro,
 * e a carreira inteira andava em ritmos diferentes.
 */
export function appearanceShare(setup: MatchSetup, morale: Morale): number {
  return clamp(
    participationShare(setup.overall, setup.team.strength) +
      moraleFactor(morale.coach) * 0.08,
    MIN_PARTICIPATION,
    1,
  )
}

/**
 * Quanto da presenca vem de comecar jogando.
 *
 * O resto entra do banco. Quem esta acima do elenco e titular praticamente
 * sempre; quem esta abaixo ainda comeca a maioria das partidas, e a relacao
 * com o treinador move essa fronteira nos dois sentidos.
 *
 * O piso e alto de proposito. A versao anterior deixava um jogador jovem no
 * banco com frequencia realista e carreira chata: eram partidas inteiras
 * assistindo, sem nenhuma decisao para tomar. A disputa por posicao continua
 * existindo — ela aparece nos minutos e na substituicao, nao em ficar de fora.
 */
function startShare(setup: MatchSetup, morale: Morale): number {
  const gap = setup.overall - setup.team.strength

  return clamp(0.72 + gap / 40 + moraleFactor(morale.coach) * 0.15, 0.65, 0.97)
}

/** Se o jogador comeca jogando. */
export function startsMatch(setup: MatchSetup, morale: Morale, rng: Rng): boolean {
  return rng() < appearanceShare(setup, morale) * startShare(setup, morale)
}

/** Expectativa de gols dos dois lados, ja pelo ponto de vista do jogador. */
function sideExpectations(setup: MatchSetup, started: boolean): [number, number] {
  // Ele so reforca o time se estiver em campo desde o inicio.
  const lift = started ? clamp(Math.max(0, setup.overall - setup.team.strength) * 0.22, 0, 5) : 0
  const team = setup.team.strength + lift

  const [home, away] = setup.atHome
    ? goalExpectation(team, setup.opponent.strength)
    : goalExpectation(setup.opponent.strength, team)

  return setup.atHome ? [home, away] : [away, home]
}

/** Arredondamento que preserva a media: 0,4 vira 1 em 40% das vezes. */
function stochasticRound(value: number, rng: Rng): number {
  const floor = Math.floor(value)
  return floor + (rng() < value - floor ? 1 : 0)
}

function buildScript(
  input: {
    teammateGoals: number
    opponentGoals: number
    chances: number
    context: number
    started: boolean
  },
  rng: Rng,
): ScriptEntry[] {
  const fillers = 3
  const total =
    input.teammateGoals +
    input.opponentGoals +
    input.chances +
    input.context +
    fillers +
    1

  const minutes = sample(rng, allMinutes(), Math.min(MATCH_MINUTES, total))
  const entries: ScriptEntry[] = []
  let cursor = 0

  const take = (kind: ScriptKind, count: number) => {
    for (let index = 0; index < count && cursor < minutes.length; index++) {
      entries.push({ minute: minutes[cursor++], kind })
    }
  }

  take('gol-time', input.teammateGoals)
  take('gol-adversario', input.opponentGoals)
  take('decisao-gol', input.chances)
  take('decisao', input.context)
  take('lance', fillers)

  // A janela de substituicao e a mesma para quem sai e para quem entra: o
  // treinador mexe no time uma vez, e o que muda e de que lado o jogador esta.
  entries.push({ minute: range(rng, SUB_WINDOW[0], SUB_WINDOW[1]), kind: 'substituicao' })

  // O intervalo entra sempre no mesmo minuto e nao consome nenhum slot: ele
  // nao e um lance, e uma pausa. Sem ele o foco escolhido antes do apito
  // valeria para os noventa minutos, e o modo perderia a leitura de jogo —
  // que e o motivo de o foco ser trocavel.
  entries.push({ minute: HALFTIME_MINUTE, kind: 'intervalo' })

  return entries.sort((a, b) => a.minute - b.minute)
}

/**
 * Avanca ate o proximo acontecimento.
 *
 * Devolve um estado novo a cada chamada — a interface controla o ritmo, e o
 * motor nao sabe nada de relogio. Quando o proximo acontecimento e uma
 * decisao, `pending` volta preenchido e nada mais avanca ate a escolha.
 */
export function advanceLiveMatch(state: LiveMatchState, rng: Rng): LiveMatchState {
  if (state.finished || state.pending || state.timing) return state
  // Antes do apito e no intervalo quem destrava e o jogador, escolhendo o
  // foco. O relogio nao corre por cima de uma decisao dele.
  if (state.kickoff || state.halftime) return state

  const next = state.script[0]

  if (!next || next.minute >= MATCH_MINUTES) {
    return finishLiveMatch({ ...state, minute: MATCH_MINUTES })
  }

  const rest = state.script.slice(1)
  const at = { ...state, minute: next.minute, script: rest }

  switch (next.kind) {
    case 'gol-time':
      return withEvent(at, {
        minute: next.minute,
        type: 'gol',
        side: 'team',
        text: `${state.setup.team.name} marca.`,
        byPlayer: false,
      })

    case 'gol-adversario':
      return withEvent(at, {
        minute: next.minute,
        type: 'gol',
        side: 'opponent',
        text: `${state.setup.opponent.name} marca.`,
        byPlayer: false,
      })

    case 'substituicao':
      return resolveSubstitution(at, rng)

    case 'intervalo':
      return {
        ...at,
        halftime: true,
        events: [
          ...at.events,
          {
            minute: HALFTIME_MINUTE,
            type: 'decisao',
            side: 'team',
            text: `Intervalo: ${at.teamGoals} a ${at.opponentGoals}.`,
            byPlayer: false,
          },
        ],
      }

    case 'decisao-gol':
      return openDecision(at, rng, true)

    case 'decisao':
      return openDecision(at, rng, false)

    case 'lance':
    default:
      return withEvent(
        at,
        fillerEvent(
          next.minute,
          {
            teamName: state.setup.team.name,
            opponentName: state.setup.opponent.name,
            played: state.onPitch,
          },
          state.setup.playerName,
          rng,
        ),
      )
  }
}

/** Abre um momento de decisao, ou cai num lance comum quando nao ha nenhum. */
function openDecision(
  state: LiveMatchState,
  rng: Rng,
  productive: boolean,
): LiveMatchState {
  if (!state.onPitch || state.decisionsLeft <= 0) {
    return withEvent(
      state,
      fillerEvent(
        state.minute,
        {
          teamName: state.setup.team.name,
          opponentName: state.setup.opponent.name,
          played: state.onPitch,
        },
        state.setup.playerName,
        rng,
      ),
    )
  }

  const query = {
    position: state.setup.position,
    minute: state.minute,
    teamGoals: state.teamGoals,
    opponentGoals: state.opponentGoals,
    used: state.usedDecisions,
  }

  // O foco decide se a oportunidade ofensiva de fato acontece.
  //
  // O orcamento foi montado no teto — o que um jogador em Ataque receberia — e
  // e aqui, no instante do lance, que ele e filtrado. Fazer assim, e nao no
  // roteiro, e o que permite trocar de foco no intervalo: o slot ja existe, e
  // o que muda e no que ele se transforma. Uma oportunidade recusada pelo foco
  // vira lance defensivo em vez de sumir — quem joga em Defesa troca gol por
  // desarme, nao por tempo parado.
  const offensive = productive && rng() < FOCUS_ATTACK_SHARE[state.focus]

  // Um slot de contexto continua sendo de contexto. Deixar o filtro cair para
  // "qualquer momento" quando nao ha defensivo disponivel abria uma segunda
  // porta para chance de gol, fora do orcamento — e a producao da temporada
  // saia pelo teto sem que a conta de chances tivesse mudado.
  const options = offensive
    ? orEmpty(
        eligibleDecisions({ ...query, productive: true }),
        () => eligibleDecisions({ ...query, productive: false }),
      )
    : orEmpty(
        // O slot ofensivo recusado pelo foco vira lance defensivo; o de
        // contexto ja nasce assim.
        productive
          ? eligibleDecisions({ ...query, side: 'defesa' })
          : eligibleDecisions({ ...query, productive: false }),
        () => eligibleDecisions({ ...query, productive: false }),
      )

  if (options.length === 0) return { ...state, decisionsLeft: 0 }

  const spec = weightedPick(options, state.focus, rng)

  return {
    ...state,
    usedDecisions: [...state.usedDecisions, spec.id],
    // O resultado do clique anterior sai da tela quando um lance novo comeca.
    lastTiming: null,
    pending: {
      id: spec.id,
      prompt: fill(spec.prompt, state.setup),
      side: spec.side,
      options: spec.options.map((option) => ({
        label: option.label,
        detail: option.detail,
        chance: successChance(option, state, spec.side),
        timing: timingKindOf(option),
      })),
    },
  }
}

/**
 * Resolve a escolha do jogador.
 *
 * O efeito e aplicado na hora — placar, nota, cartao, lesao — mas a moral so
 * e somada em `moraleDelta`. Ela e gravada na carreira no apito final, para
 * que uma partida abandonada no meio nao deixe metade das consequencias.
 */
export function chooseLiveOption(
  state: LiveMatchState,
  index: number,
  rng: Rng,
): LiveMatchState {
  const pending = state.pending
  if (!pending) return state

  const spec = specById(pending.id)
  const option = spec?.options[index]
  if (!spec || !option) return state

  const kind = timingKindOf(option)

  // Lance de execucao nao se resolve aqui: a escolha diz o que ele vai tentar,
  // e a barra diz como saiu. O `pending` fica aberto para a interface poder
  // continuar mostrando o que ele escolheu enquanto o cursor corre.
  if (kind) {
    return {
      ...state,
      lastTiming: null,
      timing: {
        optionIndex: index,
        challenge: buildTiming(
          kind,
          successChance(option, state, spec.side),
          momentPressure(state),
          rng,
        ),
      },
    }
  }

  return applyChoice(state, spec, index, null, rng)
}

/**
 * O clique na barra.
 *
 * `cursor` e a posicao do cursor no instante do clique, em 0..1. Quem mede e a
 * interface — o motor nao tem relogio nem sabe quantos quadros passaram.
 */
export function resolveLiveTiming(
  state: LiveMatchState,
  cursor: number,
  rng: Rng,
): LiveMatchState {
  const open = state.timing
  const pending = state.pending
  if (!open || !pending) return state

  const spec = specById(pending.id)
  if (!spec) return state

  const outcome = resolveTiming(open.challenge, cursor)

  return applyChoice(state, spec, open.optionIndex, outcome, rng)
}

/**
 * A janela de cinco segundos passou sem clique.
 *
 * Vale como erro, e nao como lance neutro: o jogador ja tinha escolhido o que
 * ia tentar, e nao tentar tem o mesmo custo de tentar e errar. Se ficar de
 * graca, esperar viraria a jogada segura em todo lance dificil.
 */
export function missLiveTiming(state: LiveMatchState, rng: Rng): LiveMatchState {
  const open = state.timing
  const pending = state.pending
  if (!open || !pending) return state

  const spec = specById(pending.id)
  if (!spec) return state

  return applyChoice(state, spec, open.optionIndex, missedTiming(), rng)
}

/**
 * O peso do momento, de 0 a 1.
 *
 * E o que faz a barra correr mais rapido num lance decisivo do que num lance
 * qualquer de meio de tabela. Nao mexe na chance do lance — o verde continua
 * do tamanho que era, e por isso o balanceamento nao se move. O que muda e o
 * tempo que o jogador tem para acertar o verde, que e a parte da mao dele.
 *
 * As quatro parcelas sao as que um jogador de verdade sentiria: onde a partida
 * vale mais, quanto falta para acabar, se o placar ainda esta em disputa e o
 * tamanho de quem esta do outro lado.
 */
export function momentPressure(state: LiveMatchState): number {
  const { setup } = state

  // Mata-mata pesa; final pesa mais.
  const stage = setup.stage ? (setup.stage === 'Final' ? 0.5 : 0.3) : 0

  // Os ultimos quinze minutos. Antes disso ainda da para consertar.
  const late = state.minute >= 75 ? 0.25 : state.minute >= 60 ? 0.12 : 0

  // Placar em disputa. Goleada, para qualquer lado, alivia a mao.
  const margin = Math.abs(state.teamGoals - state.opponentGoals)
  const tight = margin <= 1 ? 0.2 : margin === 2 ? 0.08 : 0

  const opposition = clamp((setup.opponent.strength - setup.team.strength) / 30, 0, 1) * 0.3

  return clamp(stage + late + tight + opposition, 0, 1)
}

/**
 * Aplica a escolha, tenha ela passado pela barra ou nao.
 *
 * Com `outcome` nulo o lance e resolvido no sorteio, como sempre foi. Com
 * `outcome`, quem decide e o timing: dentro do verde o lance sai, e o miolo
 * ainda soma nota e confianca. O verde tem a largura da propria chance, entao
 * um clique aleatorio devolve exatamente o que o sorteio devolveria — e todo
 * o ganho de quem joga bem vem de mirar, nao de uma regra mais generosa.
 */
function applyChoice(
  state: LiveMatchState,
  spec: DecisionSpec,
  index: number,
  outcome: TimingOutcome | null,
  rng: Rng,
): LiveMatchState {
  const option = spec.options[index]

  const chance = successChance(option, state, spec.side)
  const succeeded = outcome ? connected(outcome.band) : rng() < chance
  const effect = succeeded ? option.success : option.failure

  // Execucao perfeita rende mais que execucao apenas correta. E pequeno de
  // proposito: o gol vale o mesmo, o que muda e a nota e a cabeca do jogador.
  const perfect = outcome?.band === 'perfeito'
  const bonus = perfect
    ? { rating: 0.25, morale: { confidence: 3 } as MoraleDelta }
    : { rating: 0, morale: {} as MoraleDelta }

  // A nota mede o que ele fez **alem do que a jogada prometia**.
  //
  // Sem isso a nota vira funcao de quantas decisoes apareceram: escolher
  // sempre a opcao mais segura somava nota a cada momento, e uma partida com
  // seis decisoes terminava melhor que uma com tres pelo simples fato de ter
  // tido mais oportunidades de somar. Descontando a expectativa, jogar o
  // obvio e acertar rende quase nada — e converter o lance dificil rende
  // muito, que e como um jogador de verdade e avaliado.
  const expectedRating =
    chance * (option.success.rating ?? 0) + (1 - chance) * (option.failure.rating ?? 0)

  const applied = applyEffect(
    {
      ...state,
      pending: null,
      timing: null,
      lastTiming: outcome,
      decisionsLeft: state.decisionsLeft - 1,
    },
    {
      ...effect,
      rating: (effect.rating ?? 0) + bonus.rating,
      morale: mergeDeltas([effect.morale ?? {}, bonus.morale]),
      // O texto de erro nao serve para quem nao chegou a executar: "bate
      // cruzado e passa raspando a trave" descreve um chute que nao houve.
      text: outcome?.band === 'perdido' ? hesitationText(option) : effect.text,
    },
    expectedRating,
  )

  return effect.text
    ? withEvent(applied, {
        minute: state.minute,
        type: effectType(effect),
        side: effect.opponentGoals ? 'opponent' : 'team',
        text: fill(effect.text, state.setup),
        byPlayer: true,
      })
    : applied
}

/** O lance que morreu na hesitacao. */
function hesitationText(option: DecisionOption): string {
  return timingKindOf(option) === 'finalizacao'
    ? '{jogador} demora para bater e a zaga chega antes.'
    : '{jogador} segura demais e a janela do passe fecha.'
}

function effectType(effect: LiveEffect): LiveEventType {
  if (effect.goals || effect.assists || effect.teamGoals || effect.opponentGoals) return 'gol'
  if (effect.card) return 'cartao'
  if (effect.injury) return 'lesao'
  if (effect.off) return 'substituicao'
  return 'decisao'
}

function applyEffect(
  state: LiveMatchState,
  effect: LiveEffect,
  expectedRating = 0,
): LiveMatchState {
  const scored = (effect.goals ?? 0) + (effect.assists ?? 0) + (effect.teamGoals ?? 0)

  return {
    ...state,
    teamGoals: state.teamGoals + scored,
    opponentGoals: state.opponentGoals + (effect.opponentGoals ?? 0),
    onPitch: state.onPitch && !effect.off,
    moraleDelta: mergeDeltas([state.moraleDelta, effect.morale ?? {}]),
    player: {
      ...state.player,
      goals: state.player.goals + (effect.goals ?? 0),
      assists: state.player.assists + (effect.assists ?? 0),
      yellow: state.player.yellow + (effect.card === 'amarelo' ? 1 : 0),
      red: state.player.red || effect.card === 'vermelho',
      injured: state.player.injured || Boolean(effect.injury),
      // A nota bruta se acumula aqui e e fechada no apito final.
      rating: state.player.rating + (effect.rating ?? 0) - expectedRating,
    },
  }
}

/**
 * Chance de a opcao dar certo.
 *
 * Quatro parcelas, todas visiveis para o jogador atraves do numero exibido:
 * a dificuldade do lance, o atributo que o decide, a confianca do momento e a
 * qualidade de quem esta do outro lado. Passe tambem depende do elenco — nao
 * adianta escolher tocar quando ninguem se movimenta para receber.
 */
export function successChance(
  option: DecisionOption,
  state: LiveMatchState,
  side: DecisionSide = 'neutro',
): number {
  // Algumas opcoes nao tem como dar errado — pedir substituicao, sair de campo
  // aplaudindo. Passa-las pelo `clamp` devolveria 95%, e a interface anunciaria
  // um risco que nao existe.
  if (option.base >= 1) return 1

  const attribute = option.attr ? attributeEdge(state.setup.attrs, option.attr) : 0
  const confidence = moraleFactor(state.morale.confidence) * 0.08
  const squad = option.attr === 'pas' ? moraleFactor(state.morale.squad) * 0.06 : 0
  const opposition =
    (state.setup.opponent.strength - state.setup.team.strength) / 400

  // O foco tambem inclina o lance, de leve: quem esta jogando pelo ataque
  // chega melhor na frente e pior no recuo, e vice-versa.
  const focus = focusEdge(state.focus, side)

  return clamp(
    option.base + attribute + confidence + squad + focus - opposition,
    0.05,
    0.95,
  )
}

/** ±0,2 no maximo: o atributo inclina o lance, nao decide sozinho. */
function attributeEdge(attrs: PlayerAttrs, attr: NumericAttr): number {
  return clamp((attrs[attr] - 70) / 140, -0.2, 0.2)
}

/**
 * Substituicao no meio do jogo.
 *
 * Para quem comecou, e o risco de ser sacado; para quem ficou no banco, e a
 * chance de entrar. Os dois lados dependem do treinador — e da nota ate ali,
 * porque ninguem tira quem esta decidindo a partida.
 */
function resolveSubstitution(state: LiveMatchState, rng: Rng): LiveMatchState {
  const coach = moraleFactor(state.morale.coach)

  if (!state.onPitch && !state.player.red && !state.player.injured) {
    // A chance de entrar e o que falta para fechar a presenca total. Assim a
    // soma "comecou jogando" + "entrou depois" bate com `appearanceShare`, e
    // nao existe presenca extra escondida na substituicao.
    const appearance = appearanceShare(state.setup, state.morale)
    const started = appearance * startShare(state.setup, state.morale)
    const chance = clamp((appearance - started) / Math.max(1 - started, 0.01), 0.02, 0.9)

    if (rng() >= chance) return state

    return withEvent(
      { ...state, onPitch: true, player: { ...state.player, played: true } },
      {
        minute: state.minute,
        type: 'substituicao',
        side: 'team',
        text: `${state.setup.playerName} entra em campo.`,
        byPlayer: true,
      },
    )
  }

  if (!state.onPitch) return state

  // Quem esta bem em campo nao sai. `rating` aqui ainda e o acumulado das
  // decisoes, entao ele mede exatamente o que aconteceu ate agora.
  const performance = state.player.rating + state.player.goals * 0.8
  const chance = clamp(0.3 - coach * 0.25 - performance * 0.12, 0.03, 0.75)

  if (rng() >= chance) return state

  return withEvent(
    { ...state, onPitch: false },
    {
      minute: state.minute,
      type: 'substituicao',
      side: 'team',
      text: `${state.setup.playerName} é substituído.`,
      byPlayer: true,
    },
  )
}

/**
 * Joga o resto sozinho.
 *
 * O jogador pode sair da partida a qualquer momento; o que ele nao pode e
 * pular as consequencias. As decisoes que sobrarem sao resolvidas por
 * `autoChoice`.
 */
export function simulateRestOfMatch(state: LiveMatchState, rng: Rng): LiveMatchState {
  let current = state
  let guard = 0

  while (!current.finished && guard < 400) {
    guard++

    // A barra tambem e resolvida — com um clique cego, que devolve exatamente
    // a chance original do lance. Pular a partida nunca e melhor nem pior do
    // que joga-la sem acertar o timing nenhuma vez.
    if (current.timing) {
      current = resolveLiveTiming(current, blindCursor(rng), rng)
      continue
    }

    if (current.pending) {
      current = chooseLiveOption(current, autoChoice(current, rng), rng)
      continue
    }

    if (current.kickoff || current.halftime) {
      current = { ...current, kickoff: false, halftime: false }
      continue
    }

    current = advanceLiveMatch(current, rng)
  }

  return current.finished ? current : finishLiveMatch(current)
}

/**
 * Apito final: fecha a nota e a moral.
 *
 * A nota parte de 6,0 — o "cumpriu o combinado" do futebol — e anda com o que
 * ele produziu, com o que as decisoes renderam e com o resultado. Quem jogou
 * pouco fica perto de 6: nao da para tirar 9 em quinze minutos.
 */
export function finishLiveMatch(state: LiveMatchState): LiveMatchState {
  if (state.finished) return state

  const { player } = state
  const won = state.teamGoals > state.opponentGoals
  const lost = state.teamGoals < state.opponentGoals

  const minutes = playedMinutes(state)

  let rating = 0

  if (player.played) {
    const raw =
      6 +
      (state.setup.overall - state.setup.team.strength) * 0.012 +
      player.goals * 1 +
      player.assists * 0.7 +
      player.rating +
      (won ? 0.2 : lost ? -0.15 : 0) -
      player.yellow * 0.25 -
      (player.red ? 1.2 : 0)

    // Pouco tempo em campo puxa a nota de volta para o meio, para os dois
    // lados: nem heroi nem vilao em dez minutos.
    const weight = clamp(minutes / 60, 0.35, 1)
    rating = Number(clamp(6 + (raw - 6) * weight, 3, 10).toFixed(1))
  }

  // O resultado da partida tambem mexe na cabeca de quem jogou.
  const outcome: MoraleDelta = player.played
    ? { confidence: won ? 2 : lost ? -2 : 0 }
    : { confidence: -1, coach: -1 }

  return {
    ...state,
    minute: MATCH_MINUTES,
    finished: true,
    pending: null,
    timing: null,
    kickoff: false,
    halftime: false,
    moraleDelta: mergeDeltas([state.moraleDelta, outcome]),
    player: { ...player, rating, minutes },
  }
}

/**
 * Troca o foco tatico.
 *
 * So vale com a partida parada — antes do apito ou no intervalo. Deixar trocar
 * a qualquer momento transformaria o foco em botao de otimizacao: bastava
 * mudar para Ataque quando a chance aparecesse na tela, e a escolha deixaria
 * de ser uma leitura de jogo.
 */
export function setLiveFocus(state: LiveMatchState, focus: MatchFocus): LiveMatchState {
  if (!state.kickoff && !state.halftime) return state
  if (focus === state.focus) return state
  // Uma troca por partida, e ela e a do intervalo. No apito inicial ainda nao
  // houve partida nenhuma para ler, entao escolher ali nao gasta a troca.
  if (state.halftime && state.focusChanged) return state

  return { ...state, focus, focusChanged: state.focusChanged || state.halftime }
}

/** Apito inicial. */
export function kickOffLiveMatch(state: LiveMatchState): LiveMatchState {
  return state.kickoff ? { ...state, kickoff: false } : state
}

/** Volta do intervalo. */
export function resumeLiveMatch(state: LiveMatchState): LiveMatchState {
  return state.halftime ? { ...state, halftime: false } : state
}

/** A moral da carreira depois desta partida. */
export function moraleAfterMatch(state: LiveMatchState): Morale {
  return applyMorale(state.morale, state.moraleDelta)
}

/**
 * Minutos em campo.
 *
 * Aproximacao de proposito: o motor guarda quando ele entrou ou saiu apenas
 * como evento, e reconstruir a partir da lista e mais honesto do que manter um
 * contador paralelo que pode divergir dela.
 */
function playedMinutes(state: LiveMatchState): number {
  if (!state.player.played) return 0

  const entry = state.events.find(
    (event) => event.type === 'substituicao' && event.text.includes('entra em campo'),
  )
  const exit = state.events.find(
    (event) =>
      (event.type === 'substituicao' && event.text.includes('substituído')) ||
      event.type === 'lesao' ||
      (event.type === 'cartao' && state.player.red),
  )

  return Math.max(0, (exit?.minute ?? MATCH_MINUTES) - (entry?.minute ?? 0))
}

function withEvent(state: LiveMatchState, event: LiveEvent): LiveMatchState {
  const goals =
    event.type === 'gol' && !event.byPlayer
      ? event.side === 'team'
        ? { teamGoals: state.teamGoals + 1 }
        : { opponentGoals: state.opponentGoals + 1 }
      : {}

  return { ...state, ...goals, events: [...state.events, event] }
}

/**
 * O momento pelo id.
 *
 * `pending` guarda o id, e nao o objeto inteiro, porque ele atravessa o estado
 * da interface — e estado de interface precisa continuar serializavel.
 */
const DECISION_INDEX = new Map(DECISIONS.map((spec) => [spec.id, spec]))

function specById(id: string): DecisionSpec | undefined {
  return DECISION_INDEX.get(id)
}

/**
 * O que o jogador faria sozinho.
 *
 * A primeira versao escolhia sempre a opcao de maior chance, e o resultado
 * denunciava o atalho: como tocar para o companheiro e quase sempre mais
 * seguro que finalizar, um centroavante terminava a temporada com dez
 * assistencias e dois gols. Ninguem joga assim.
 *
 * Aqui o peso e a chance vezes a afinidade da posicao: o que decide entre
 * chutar e passar e o mesmo `expected` que o modo classico usa para dizer que
 * um atacante faz quatro vezes mais gols do que da assistencias.
 */
function autoChoice(state: LiveMatchState, rng: Rng): number {
  const spec = specById(state.pending?.id ?? '')
  if (!spec) return 0

  const side = spec.side

  const { goals, assists } = state.setup.expected

  // A opcao que nao produz nada e uma saida, nao o padrao. Com ela pesando o
  // mesmo que as outras, um volante nunca chutava e nunca lancava — e a
  // producao dele no modo Jogo a Jogo ficava abaixo da do modo classico.
  const neutral = Math.max(goals, assists) * 0.35

  const weights = spec.options.map((option) => {
    const affinity = option.success.goals
      ? goals
      : option.success.assists || option.success.teamGoals
        ? assists
        : neutral

    return successChance(option, state, side) * Math.max(affinity, 0.02)
  })

  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let draw = rng() * total

  for (let index = 0; index < weights.length; index++) {
    draw -= weights[index]
    if (draw <= 0) return index
  }

  return 0
}

/** A primeira lista, ou a alternativa quando ela vem vazia. */
function orEmpty<T>(items: T[], fallback: () => T[]): T[] {
  return items.length > 0 ? items : fallback()
}

function weightedPick(specs: DecisionSpec[], focus: MatchFocus, rng: Rng): DecisionSpec {
  const weights = specs.map((spec) => weightFor(spec, focus))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let draw = rng() * total

  for (let index = 0; index < specs.length; index++) {
    draw -= weights[index]
    if (draw <= 0) return specs[index]
  }

  return specs[specs.length - 1]
}

function fill(text: string, setup: MatchSetup): string {
  return text
    .replaceAll('{jogador}', setup.playerName)
    .replaceAll('{time}', setup.team.name)
    .replaceAll('{adversario}', setup.opponent.name)
}
