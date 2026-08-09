import { clamp } from './positions'
import { pick, sample, type Rng } from './rng'

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
export type LiveEventType = 'gol' | 'chance' | 'defesa' | 'falta' | 'penaltis'

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

/** Lance sem gol, so para a narracao ter respiro entre um placar e outro. */
function fillerEvent(
  minute: number,
  match: NarratableMatch,
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
