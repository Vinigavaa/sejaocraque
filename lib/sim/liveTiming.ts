import { clamp } from './positions'
import type { Rng } from './rng'

/**
 * A barra de timing — a parte jogada de um lance decisivo.
 *
 * Ate aqui o modo Jogo a Jogo resolvia tudo no sorteio: o jogador escolhia
 * entre chutar e passar, e um `rng()` dizia se saiu. A escolha continua sendo
 * dele, mas a **execucao** agora tambem: um cursor atravessa a barra e ele
 * clica: dentro do verde, o lance sai; no centro do verde, sai perfeito; fora,
 * erra.
 *
 * A largura do verde e proporcional a chance do lance — lance improvavel, alvo
 * estreito. Nao e mais *igual* a chance: o alvo e uma fatia dela (`ZONE_SHARE`),
 * porque a barra passou a ter uma zona so, e a antiga faixa larga saiu. Isso
 * torna a barra decisiva: quem nao acerta o timing rende bem abaixo do sorteio
 * antigo, e quem acerta rende acima. E o lugar onde a habilidade do usuario, e
 * nao a do jogador, entra no placar.
 *
 * Este modulo e puro: nao tem relogio, nao tem React, nao sabe o que e um
 * clique. A interface e quem move o cursor e informa a posicao onde parou.
 */

/** O que a barra representa: a bola no passe, a trave na finalizacao. */
export type TimingKind = 'passe' | 'finalizacao'

export type TimingChallenge = {
  kind: TimingKind
  /** Centro da zona verde, 0..1. */
  center: number
  /** Largura da zona verde, 0..1. Proporcional a chance do lance. */
  green: number
  /** A chance original do lance, 0..1. So o clique cego usa. */
  chance: number
  /** Milissegundos de uma travessia completa da barra. */
  sweepMs: number
}

/** `perdido` e o estouro da janela: ele nao chegou a bater. */
export type TimingBand = 'perfeito' | 'bom' | 'errado' | 'perdido'

export type TimingOutcome = {
  band: TimingBand
  /** Onde ele clicou, 0..1. -1 quando o tempo acabou sem clique. */
  cursor: number
  /** 0 quando errou; 0,5 a 1 dentro do verde. Modula nota e moral. */
  quality: number
}

/**
 * Quanto tempo o lance espera pelo clique.
 *
 * Cinco segundos dao de cinco a doze travessias, dependendo da velocidade da
 * barra — espaco de sobra para escolher a passada, e pouco demais para ficar
 * esperando a passada perfeita. Sem janela, um lance podia ficar aberto para
 * sempre, e a decisao de bater ou nao deixava de ter custo.
 */
export const TIMING_WINDOW_MS = 5000

/** Se o lance saiu. Estouro de tempo conta como erro, e nao como acerto. */
export function connected(band: TimingBand): boolean {
  return band === 'perfeito' || band === 'bom'
}

/** O que sobra quando os cinco segundos passam sem clique. */
export function missedTiming(): TimingOutcome {
  return { band: 'perdido', cursor: -1, quality: 0 }
}

/**
 * A zona de acerto e uma fatia da chance, e nao a chance inteira.
 *
 * A barra tinha duas faixas — uma larga do tamanho da chance e um miolo vivo
 * dentro dela. Ficou so a do meio, e ela e o acerto: o alvo encolheu para
 * cerca de um terco, e errar o timing agora custa o lance.
 *
 * A fatia subiu de 0,3 para 0,37 depois de jogar: numa barra de uns 350px o
 * alvo ganhou cerca de dez pixels, o suficiente para o clique ter margem sem
 * devolver a folga que a faixa larga dava.
 */
const ZONE_SHARE = 0.37

/** Nem o lance mais improvavel fica impossivel de acertar na barra. */
const MIN_GREEN = 0.09
const MAX_GREEN = 0.37

/** O centro do verde ainda rende o lance perfeito — sem marca propria. */
const PERFECT_SHARE = 0.34

/**
 * A faixa de velocidade da barra.
 *
 * Uma travessia leva de pouco menos de meio segundo a pouco menos de um. Um
 * cobrador de penalti tranquilo ainda tem o tempo de cima; uma finalizacao
 * dificil na final, aos 88 minutos, tem o de baixo. A faixa ja foi mais lenta
 * duas vezes — em ambas dava tempo de olhar, decidir e clicar, e acertar o
 * miolo virava rotina.
 */
const MIN_SWEEP_MS = 400
const MAX_SWEEP_MS = 930

/**
 * Quanto cada coisa pesa na velocidade.
 *
 * A dificuldade do lance pesa mais que o peso do jogo — o que esta em jogo
 * aperta a mao, mas quem decide se o lance e dificil continua sendo o lance.
 */
const DIFFICULTY_WEIGHT = 0.62
const PRESSURE_WEIGHT = 0.38

/**
 * @param chance   Chance do lance. Da a largura do verde e a velocidade.
 * @param pressure Peso do momento, 0 a 1: fase da competicao, minuto, placar
 *                 apertado e forca do adversario. Ver `momentPressure`.
 */
export function buildTiming(
  kind: TimingKind,
  chance: number,
  pressure: number,
  rng: Rng,
): TimingChallenge {
  const odds = clamp(chance, 0, 1)
  const green = clamp(odds * ZONE_SHARE, MIN_GREEN, MAX_GREEN)

  // A zona nao encosta na borda: com o verde colado na ponta, segurar o clique
  // no fim da travessia acertaria sempre.
  const margin = green / 2 + 0.04
  const center = margin + rng() * Math.max(0, 1 - margin * 2)

  // Lance dificil passa mais rapido, e jogo decisivo passa mais rapido ainda.
  // As duas coisas somam de proposito: e o lance improvavel no momento pesado
  // que precisa ser o mais dificil de acertar da partida inteira.
  // A dificuldade vem da chance do lance, e nao da largura ja encolhida: e a
  // chance que diz se o lance e improvavel.
  const hardness = clamp(
    (1 - odds) * DIFFICULTY_WEIGHT + clamp(pressure, 0, 1) * PRESSURE_WEIGHT,
    0,
    1,
  )
  const sweepMs = Math.round(MAX_SWEEP_MS - (MAX_SWEEP_MS - MIN_SWEEP_MS) * hardness)

  return { kind, center, green, chance: odds, sweepMs }
}

/** Onde o clique caiu. `cursor` vem da interface, em 0..1. */
export function resolveTiming(
  challenge: TimingChallenge,
  cursor: number,
): TimingOutcome {
  const position = clamp(cursor, 0, 1)
  const distance = Math.abs(position - challenge.center)
  const perfect = challenge.green * PERFECT_SHARE

  if (distance <= perfect / 2) {
    return { band: 'perfeito', cursor: position, quality: 1 }
  }

  if (distance <= challenge.green / 2) {
    // Dentro do verde a qualidade cai do centro para a borda, de 1 a 0,5. E ela
    // que separa "entrou" de "entrou no angulo" na nota e na moral.
    const span = Math.max(challenge.green / 2 - perfect / 2, 0.0001)
    const off = (distance - perfect / 2) / span

    return { band: 'bom', cursor: position, quality: 1 - off * 0.5 }
  }

  return { band: 'errado', cursor: position, quality: 0 }
}

/**
 * O clique de quem nao esta olhando.
 *
 * Usado quando a partida e simulada — pelo botao "simular o resto" ou pelo
 * modo que joga a temporada inteira sozinho. Cai no verde exatamente `chance`
 * das vezes, que e o que o sorteio antigo fazia: simular a partida rende o
 * mesmo de sempre, independente de quanto o alvo encolheu na tela.
 */
export function blindCursor(challenge: TimingChallenge, rng: Rng): number {
  const half = challenge.green / 2

  if (rng() < challenge.chance) {
    return clamp(challenge.center + (rng() - 0.5) * challenge.green, 0, 1)
  }

  // Fora do verde, uniforme: o eixo e a barra menos a zona, e o que cai depois
  // do inicio dela e empurrado para o outro lado.
  const point = rng() * Math.max(1 - challenge.green, 0)

  return point < challenge.center - half ? point : point + challenge.green
}
