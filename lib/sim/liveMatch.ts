import {
  blindCursor,
  buildTiming,
  connected,
  missedTiming,
  resolveTiming,
  type TimingChallenge,
  type TimingKind,
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
import { goalExpectation } from './season'
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
  /** Intervalo e lances sem bola — o que a narracao precisa dizer e nao cabe
   *  em nenhuma das categorias acima. */
  | 'aviso'

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
 * O modo tem **uma** interacao, e ela e sempre a mesma: quando o jogador tem
 * participacao direta num lance, a partida para, anuncia a oportunidade e
 * entrega a barra de timing. Nao ha menu, nao ha escolha entre alternativas e
 * nao ha decisao de contexto — o catalogo de momentos que existia aqui pedia
 * uma leitura a cada dois minutos e afogava as duas mecanicas que importam,
 * finalizar e passar.
 *
 * Por que a producao esperada do jogador e descontada do time: se o placar
 * base ja embutia os gols que ele costuma fazer, e as oportunidades
 * acrescentassem mais gols por cima, o modo Jogo a Jogo entregaria placares
 * muito maiores que o modo classico — e as duas carreiras deixariam de ser
 * comparaveis. Aqui a expectativa dele sai do bolo do time e volta como
 * oportunidade.
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

/** O que um lance mexe na partida e no jogador. */
type LiveEffect = {
  goals?: number
  assists?: number
  opponentGoals?: number
  rating?: number
  morale?: MoraleDelta
  card?: 'amarelo' | 'vermelho'
  injury?: boolean
  /** Deixa o campo: lesao ou expulsao. */
  off?: boolean
  text: string
}

/**
 * A oportunidade anunciada, esperando o "continuar".
 *
 * O aviso existe para separar o susto da execucao: a barra corre em menos de
 * um segundo por travessia, e cair nela no mesmo instante em que o lance
 * aparece na tela nao e reflexo, e sorte. Com o aviso, o jogador chega na
 * barra sabendo o que vai tentar.
 */
export type LiveOpportunity = {
  kind: TimingKind
  /** A narracao do lance. */
  prompt: string
  /** Chance de o lance sair, ja com atributo, confianca e adversario. */
  chance: number
}

/** A barra aberta, esperando o clique. */
export type LiveTiming = {
  kind: TimingKind
  chance: number
  challenge: TimingChallenge
}

type ScriptKind =
  | 'gol-time'
  | 'gol-adversario'
  /** Participacao direta do jogador: a unica coisa que ele joga. */
  | 'chance'
  /** Cartao, lesao ou nada — narrado, nunca escolhido. */
  | 'incidente'
  | 'lance'
  /** Intervalo: a partida para e o foco pode mudar. */
  | 'intervalo'

type ScriptEntry = { minute: number; kind: ScriptKind }

export type LiveMatchState = {
  setup: MatchSetup
  minute: number
  events: LiveEvent[]
  teamGoals: number
  opponentGoals: number
  /** Se ele esta em campo agora. Comeca sempre em campo; so sai por vermelho
   *  ou lesao. */
  onPitch: boolean
  player: PlayerMatchResult
  /** Moral no inicio da partida — a base sobre a qual os lances somam. */
  morale: Morale
  /** O que esta partida mexeu na moral. Aplicado so no apito final. */
  moraleDelta: MoraleDelta
  /** O aviso aberto. Congela a partida ate o jogador continuar. */
  opportunity: LiveOpportunity | null
  /** A barra aberta. Congela a partida ate o clique ou o fim do tempo. */
  timing: LiveTiming | null
  /** O resultado do ultimo clique, para a interface poder mostrar o que saiu. */
  lastTiming: TimingOutcome | null
  script: ScriptEntry[]
  /** Antes do apito inicial: a partida espera a confirmacao do jogador. */
  kickoff: boolean
  /** No intervalo: a partida espera a confirmacao para o segundo tempo. */
  halftime: boolean
  finished: boolean
}

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
 * sem graca. Com o piso ele recebe uma a cada sete ou oito partidas, o que
 * mantem a producao dele perto da do modo classico.
 */
const MIN_CHANCE_RATE = 0.13

/**
 * Aproveitamento medio de uma oportunidade.
 *
 * Serve para converter **producao esperada** em **numero de chances**: se o
 * jogador costuma produzir 0,68 por jogo e cada chance se converte perto de
 * 45% das vezes, ele precisa de ~1,5 chance por partida para chegar la.
 *
 * Sem essa conversao o modo Jogo a Jogo produzia quase o dobro do classico, e
 * as duas carreiras deixavam de ser comparaveis. O numero e calibrado contra
 * `scripts/smoke-matchday.ts`, que joga as duas temporadas lado a lado.
 */
const AVERAGE_CONVERSION = 0.48

/** Quantos incidentes — cartao, lesao ou nada — a partida sorteia. */
const MIN_INCIDENTS = 1
const MAX_INCIDENTS = 3

/** O apito do intervalo. */
const HALFTIME_MINUTE = 45

/**
 * Fatia do orcamento ofensivo que de fato vira oportunidade clara — o resto
 * fica em lance defensivo.
 *
 * Ancora a paridade com o modo classico: o orcamento e dividido por este
 * mesmo valor antes de virar contagem de chances, entao a producao do Jogo a
 * Jogo bate com a que a simulacao completa produziria.
 */
const ATTACK_SHARE = 0.78

export function startLiveMatch(
  setup: MatchSetup,
  morale: Morale,
  rng: Rng,
): LiveMatchState {
  const [forExpectation, againstExpectation] = sideExpectations(setup)

  const teamPlan = poisson(rng, forExpectation)
  const opponentPlan = poisson(rng, againstExpectation)

  // A producao esperada dele sai do plano do time e volta como oportunidade.
  // Como ele joga a partida inteira, e a esperada cheia.
  const expected = setup.expected.goals + setup.expected.assists

  const script = buildScript(
    {
      teammateGoals: Math.max(0, teamPlan - stochasticRound(expected, rng)),
      opponentGoals: opponentPlan,
      chances: chanceBudget(setup, morale, expected, rng),
      incidents: range(rng, MIN_INCIDENTS, MAX_INCIDENTS),
    },
    rng,
  )

  return {
    setup,
    minute: 0,
    events: [],
    teamGoals: 0,
    opponentGoals: 0,
    onPitch: true,
    player: {
      played: true,
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
    opportunity: null,
    timing: null,
    lastTiming: null,
    script,
    kickoff: true,
    halftime: false,
    finished: false,
  }
}

/**
 * Quantas oportunidades claras a partida oferece ao jogador.
 *
 * O ponto de partida e a producao esperada dele convertida em numero de
 * lances. Em cima disso entra o **contexto**: contra um time muito superior
 * aparecem menos oportunidades claras, contra um mais fraco aparecem mais, e
 * nem uma coisa nem outra e determinista — o arredondamento e sorteado, entao
 * o mesmo confronto nao devolve sempre o mesmo numero.
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
 * O resultado e o teto de lances que o roteiro reserva; `ATTACK_SHARE` decide
 * quantos deles de fato viram oportunidade quando a partida chega la (ver
 * `openOpportunity`), e o resto fica em lance defensivo.
 */
function chanceBudget(
  setup: MatchSetup,
  morale: Morale,
  expected: number,
  rng: Rng,
): number {
  const base = expected / AVERAGE_CONVERSION / ATTACK_SHARE

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

/** Expectativa de gols dos dois lados, ja pelo ponto de vista do jogador. */
function sideExpectations(setup: MatchSetup): [number, number] {
  const lift = clamp(Math.max(0, setup.overall - setup.team.strength) * 0.22, 0, 5)
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
    incidents: number
  },
  rng: Rng,
): ScriptEntry[] {
  const fillers = 4
  const total =
    input.teammateGoals +
    input.opponentGoals +
    input.chances +
    input.incidents +
    fillers

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
  take('chance', input.chances)
  take('incidente', input.incidents)
  take('lance', fillers)

  // O intervalo entra sempre no mesmo minuto e nao consome nenhum slot: ele
  // nao e um lance, e uma pausa que mostra o placar parcial antes do segundo
  // tempo.
  entries.push({ minute: HALFTIME_MINUTE, kind: 'intervalo' })

  return entries.sort((a, b) => a.minute - b.minute)
}

/**
 * Avanca ate o proximo acontecimento.
 *
 * Devolve um estado novo a cada chamada — a interface controla o ritmo, e o
 * motor nao sabe nada de relogio. Quando o proximo acontecimento e uma
 * oportunidade, `opportunity` volta preenchido e nada mais avanca ate o
 * jogador continuar.
 */
export function advanceLiveMatch(state: LiveMatchState, rng: Rng): LiveMatchState {
  if (state.finished || state.opportunity || state.timing) return state
  // Antes do apito e no intervalo quem destrava e o jogador, confirmando que
  // quer seguir. O relogio nao corre por cima dessa pausa.
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

    case 'intervalo':
      return {
        ...at,
        halftime: true,
        events: [
          ...at.events,
          {
            minute: HALFTIME_MINUTE,
            type: 'aviso',
            side: 'team',
            text: `Intervalo: ${at.teamGoals} a ${at.opponentGoals}.`,
            byPlayer: false,
          },
        ],
      }

    case 'chance':
      return openOpportunity(at, rng)

    case 'incidente':
      return openIncident(at, rng)

    case 'lance':
    default:
      return withEvent(at, filler(at, rng))
  }
}

/** O lance narrado, sem participacao do jogador. */
function filler(state: LiveMatchState, rng: Rng): LiveEvent {
  return fillerEvent(
    state.minute,
    {
      teamName: state.setup.team.name,
      opponentName: state.setup.opponent.name,
      played: state.onPitch,
    },
    state.setup.playerName,
    rng,
  )
}

/** Textos do aviso, por tipo de oportunidade. */
const OPPORTUNITY_PROMPT: Record<TimingKind, readonly string[]> = {
  finalizacao: [
    '{jogador} recebe nas costas da zaga e fica de frente para o goleiro.',
    'A bola sobra na entrada da area e {jogador} ja esta com o pe armado.',
    'Cruzamento na medida e {jogador} aparece livre na segunda trave.',
    '{jogador} corta para o meio e ve o espaco abrir para o chute.',
  ],
  passe: [
    '{jogador} pega a bola no meio com espaco e dois companheiros correndo.',
    '{jogador} levanta a cabeca e ve o camisa 9 pedindo nas costas do zagueiro.',
    '{jogador} chega a linha de fundo com o companheiro livre na area.',
    'A defesa do {adversario} sobe demais e {jogador} tem o lancamento na mao.',
  ],
}

/**
 * Abre a oportunidade — ou a transforma em lance defensivo.
 *
 * O orcamento foi montado no teto (ver `chanceBudget`), e e aqui que
 * `ATTACK_SHARE` filtra: nem todo slot reservado vira chance de fato, parte
 * fica em lance defensivo.
 */
function openOpportunity(state: LiveMatchState, rng: Rng): LiveMatchState {
  if (!state.onPitch) return withEvent(state, filler(state, rng))

  if (rng() >= ATTACK_SHARE) {
    return withEvent(state, {
      minute: state.minute,
      type: 'aviso',
      side: 'team',
      text: fill(
        pick(rng, [
          '{jogador} volta para marcar e fecha o corredor.',
          '{jogador} antecipa o lancamento e devolve a bola para o time.',
          '{jogador} some da frente para ajudar na saida de bola.',
        ]),
        state.setup,
      ),
      byPlayer: true,
    })
  }

  const kind = opportunityKind(state, rng)

  return {
    ...state,
    // O resultado do clique anterior sai da tela quando um lance novo comeca.
    lastTiming: null,
    opportunity: {
      kind,
      prompt: fill(pick(rng, OPPORTUNITY_PROMPT[kind]), state.setup),
      chance: conversionChance(state, kind),
    },
  }
}

/**
 * Se a oportunidade e de gol ou de assistencia.
 *
 * Sai da mesma expectativa que o modo classico usa: um centroavante recebe
 * quatro chances de gol para cada uma de assistencia, e um meia armador o
 * contrario. Sem isso todo jogador terminaria a temporada com a mesma
 * proporcao entre as duas coisas.
 */
function opportunityKind(state: LiveMatchState, rng: Rng): TimingKind {
  const { goals, assists } = state.setup.expected
  const total = goals + assists

  if (total <= 0) return rng() < 0.5 ? 'finalizacao' : 'passe'

  return rng() < goals / total ? 'finalizacao' : 'passe'
}

/**
 * Chance de o lance sair.
 *
 * Quatro parcelas: a dificuldade do tipo de lance, o atributo que o decide, a
 * confianca do momento e a qualidade de quem esta do outro lado. Passe tambem
 * depende do elenco — nao adianta lancar quando ninguem se movimenta para
 * receber.
 *
 * Este numero nao aparece na tela: ele e a **largura do verde** da barra. Um
 * lance dificil chega com o alvo estreito, e e isso que o jogador enxerga.
 */
function conversionChance(state: LiveMatchState, kind: TimingKind): number {
  const shooting = kind === 'finalizacao'

  const base = shooting ? 0.4 : 0.45
  const attribute = attributeEdge(state.setup.attrs, shooting ? 'fin' : 'pas')
  const confidence = moraleFactor(state.morale.confidence) * 0.08
  const squad = shooting ? 0 : moraleFactor(state.morale.squad) * 0.06
  const opposition = (state.setup.opponent.strength - state.setup.team.strength) / 400

  return clamp(base + attribute + confidence + squad - opposition, 0.05, 0.95)
}

/** ±0,2 no maximo: o atributo inclina o lance, nao decide sozinho. */
function attributeEdge(attrs: PlayerAttrs, attr: NumericAttr): number {
  return clamp((attrs[attr] - 70) / 140, -0.2, 0.2)
}

/**
 * O jogador viu o aviso e quer continuar: a barra abre.
 *
 * A dificuldade da barra e montada aqui, e nao no aviso, porque o cursor
 * comeca a correr no instante em que ela aparece — e o `sweepMs` precisa vir
 * do mesmo momento de partida que o jogador esta lendo.
 */
export function startLiveTiming(state: LiveMatchState, rng: Rng): LiveMatchState {
  const open = state.opportunity
  if (!open) return state

  return {
    ...state,
    opportunity: null,
    timing: {
      kind: open.kind,
      chance: open.chance,
      challenge: buildTiming(open.kind, open.chance, momentPressure(state), rng),
    },
  }
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
  if (!open) return state

  return applyOutcome(state, open, resolveTiming(open.challenge, cursor), rng)
}

/**
 * A janela de cinco segundos passou sem clique.
 *
 * Vale como erro, e nao como lance neutro: se ficar de graca, esperar viraria
 * a jogada segura em todo lance dificil.
 */
export function missLiveTiming(state: LiveMatchState, rng: Rng): LiveMatchState {
  const open = state.timing
  if (!open) return state

  return applyOutcome(state, open, missedTiming(), rng)
}

/**
 * O peso do momento, de 0 a 1.
 *
 * E o que faz a barra correr mais rapido num lance decisivo do que num lance
 * qualquer de meio de tabela. Nao mexe na chance do lance — o verde continua
 * do tamanho que era, e por isso o balanceamento nao se move. O que muda e o
 * tempo que o jogador tem para acertar o verde, que e a parte da mao dele.
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
 * Aplica o que saiu da barra.
 *
 * Dentro do verde o lance sai; no miolo ele sai melhor, e o extra e pequeno de
 * proposito: o gol vale o mesmo, o que muda e a nota e a cabeca do jogador.
 */
function applyOutcome(
  state: LiveMatchState,
  timing: LiveTiming,
  outcome: TimingOutcome,
  rng: Rng,
): LiveMatchState {
  const shooting = timing.kind === 'finalizacao'
  const succeeded = connected(outcome.band)

  const effect: LiveEffect = succeeded
    ? scoredEffect(shooting)
    : outcome.band === 'perdido'
      ? hesitationEffect(shooting)
      : missedEffect(shooting, rng)

  const bonus =
    outcome.band === 'perfeito'
      ? { rating: 0.25, morale: { confidence: 3 } as MoraleDelta }
      : { rating: 0, morale: {} as MoraleDelta }

  // A nota mede o que ele fez **alem do que a jogada prometia**: converter um
  // lance improvavel rende muito, e acertar o obvio rende quase nada.
  const expectedRating =
    timing.chance * SCORED_RATING[timing.kind] +
    (1 - timing.chance) * MISSED_RATING[timing.kind]

  const applied = applyEffect(
    { ...state, opportunity: null, timing: null, lastTiming: outcome },
    {
      ...effect,
      rating: (effect.rating ?? 0) + bonus.rating,
      morale: mergeDeltas([effect.morale ?? {}, bonus.morale]),
    },
    expectedRating,
  )

  return withEvent(applied, {
    minute: state.minute,
    type: effect.goals || effect.assists ? 'gol' : 'chance',
    side: 'team',
    text: fill(effect.text, state.setup),
    byPlayer: true,
  })
}

/** Nota bruta de cada saida. Fica fora dos efeitos porque a expectativa da
 *  nota precisa dos dois numeros antes de saber qual deles aconteceu. */
const SCORED_RATING: Record<TimingKind, number> = { finalizacao: 0.5, passe: 0.4 }
const MISSED_RATING: Record<TimingKind, number> = { finalizacao: -0.2, passe: -0.15 }

function scoredEffect(shooting: boolean): LiveEffect {
  return shooting
    ? {
        goals: 1,
        rating: SCORED_RATING.finalizacao,
        morale: { confidence: 7, squad: 2, reputation: 0.3 },
        text: 'GOL! {jogador} finaliza no canto e o goleiro so olha.',
      }
    : {
        assists: 1,
        rating: SCORED_RATING.passe,
        morale: { confidence: 4, squad: 7, reputation: 0.2 },
        text: '{jogador} entrega na medida e o companheiro conclui. Assistencia.',
      }
}

function missedEffect(shooting: boolean, rng: Rng): LiveEffect {
  return shooting
    ? {
        rating: MISSED_RATING.finalizacao,
        morale: { confidence: -4 },
        text: pick(rng, [
          '{jogador} finaliza torto e a bola sai pela linha de fundo.',
          '{jogador} bate em cima do goleiro e a chance se perde.',
        ]),
      }
    : {
        rating: MISSED_RATING.passe,
        morale: { confidence: -3, squad: -2 },
        text: pick(rng, [
          '{jogador} erra a medida do passe e a defesa afasta.',
          '{jogador} entrega forte demais e o goleiro sai para abafar.',
        ]),
      }
}

/** O lance que morreu na hesitacao — ele nem chegou a executar. */
function hesitationEffect(shooting: boolean): LiveEffect {
  return shooting
    ? {
        rating: -0.25,
        morale: { confidence: -5 },
        text: '{jogador} demora para bater e a zaga chega antes.',
      }
    : {
        rating: -0.2,
        morale: { confidence: -4, squad: -2 },
        text: '{jogador} segura demais e a janela do passe fecha.',
      }
}

/**
 * Cartao, lesao ou nada.
 *
 * Narrado, nunca escolhido: e o que sobrou dos momentos de contexto quando o
 * modo passou a ter uma interacao so. As probabilidades sao baixas de
 * proposito — sao poucos slots por partida, e uma temporada inteira nao pode
 * virar uma sequencia de lesoes.
 */
function openIncident(state: LiveMatchState, rng: Rng): LiveMatchState {
  if (!state.onPitch) return withEvent(state, filler(state, rng))

  const draw = rng()

  const effect: LiveEffect | null =
    draw < 0.02
      ? {
          card: 'vermelho',
          off: true,
          rating: -1.2,
          morale: { confidence: -10, coach: -10, squad: -6 },
          text: '{jogador} chega atrasado e o arbitro mostra o vermelho direto.',
        }
      : draw < 0.07
        ? {
            injury: true,
            off: true,
            rating: -0.2,
            morale: { confidence: -6 },
            text: '{jogador} sente a parte de tras da coxa e deixa o campo.',
          }
        : draw < 0.24
          ? {
              card: 'amarelo',
              rating: -0.1,
              morale: { coach: -1 },
              text: '{jogador} para o contra-ataque com falta e leva o amarelo.',
            }
          : null

  if (!effect) return withEvent(state, filler(state, rng))

  return withEvent(applyEffect(state, effect), {
    minute: state.minute,
    type: effect.card ? 'cartao' : 'lesao',
    side: 'team',
    text: fill(effect.text, state.setup),
    byPlayer: true,
  })
}

function applyEffect(
  state: LiveMatchState,
  effect: LiveEffect,
  expectedRating = 0,
): LiveMatchState {
  const scored = (effect.goals ?? 0) + (effect.assists ?? 0)

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
 * Joga o resto sozinho.
 *
 * O jogador pode sair da partida a qualquer momento; o que ele nao pode e
 * pular as consequencias. As oportunidades que sobrarem sao resolvidas com um
 * clique cego, que devolve exatamente a chance original do lance — pular a
 * partida nunca e melhor nem pior do que joga-la sem acertar o timing nenhuma
 * vez.
 */
export function simulateRestOfMatch(state: LiveMatchState, rng: Rng): LiveMatchState {
  let current = state
  let guard = 0

  while (!current.finished && guard < 400) {
    guard++

    if (current.timing) {
      current = resolveLiveTiming(current, blindCursor(current.timing.challenge, rng), rng)
      continue
    }

    if (current.opportunity) {
      current = startLiveTiming(current, rng)
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
 * ele produziu, com o que os lances renderam e com o resultado. Quem jogou
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
    opportunity: null,
    timing: null,
    kickoff: false,
    halftime: false,
    moraleDelta: mergeDeltas([state.moraleDelta, outcome]),
    player: { ...player, rating, minutes },
  }
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
 * Ele comeca jogando, entao a conta e o minuto em que saiu — se saiu. O motor
 * guarda a saida apenas como evento, e reconstruir a partir da lista e mais
 * honesto do que manter um contador paralelo que pode divergir dela.
 */
function playedMinutes(state: LiveMatchState): number {
  const exit = state.events.find(
    (event) =>
      event.type === 'lesao' || (event.type === 'cartao' && state.player.red),
  )

  return exit?.minute ?? MATCH_MINUTES
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

function fill(text: string, setup: MatchSetup): string {
  return text
    .replaceAll('{jogador}', setup.playerName)
    .replaceAll('{time}', setup.team.name)
    .replaceAll('{adversario}', setup.opponent.name)
}
