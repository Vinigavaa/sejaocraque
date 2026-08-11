import { clamp } from './positions'
import type { Rng } from './rng'

/**
 * A barra de timing — a parte jogada de um lance decisivo.
 *
 * Ate aqui o modo Jogo a Jogo resolvia tudo no sorteio: o jogador escolhia
 * entre chutar e passar, e um `rng()` dizia se saiu. A escolha continua sendo
 * dele, mas a **execucao** agora tambem: um cursor atravessa a barra e ele
 * clica: no miolo, e o lance perfeito; dentro do verde, sai; fora, erra.
 *
 * A regra que mantem o balanceamento de pe: a **largura do verde e a propria
 * chance do lance**. Um clique aleatorio acerta o verde exatamente `chance`
 * das vezes, que e o que o sorteio antigo fazia. Quem tem timing rende acima
 * disso — e essa margem e o unico lugar onde a habilidade do usuario, e nao a
 * do jogador, entra no placar.
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
  /** Largura da zona verde, 0..1. Igual a chance do lance. */
  green: number
  /** Largura do miolo perfeito, 0..1, sempre dentro do verde. */
  perfect: number
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
 * Cinco segundos dao de duas a dez travessias, dependendo da velocidade da
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

/** Nem o lance mais improvavel fica impossivel de acertar na barra. */
const MIN_GREEN = 0.1
const MAX_GREEN = 0.86

/** O miolo perfeito e uma fatia do verde, nunca um alvo absoluto. */
const PERFECT_SHARE = 0.3

/**
 * A faixa de velocidade da barra.
 *
 * Uma travessia leva de meio segundo a pouco mais de um. O piso anterior era
 * de 1050ms e a barra inteira vivia na metade lenta da faixa: dava tempo de
 * olhar, decidir e clicar, e o miolo perfeito virava rotina. Um cobrador de
 * penalti tranquilo ainda tem o tempo de cima; uma finalizacao dificil na
 * final, aos 88 minutos, tem o de baixo.
 */
const MIN_SWEEP_MS = 480
const MAX_SWEEP_MS = 1120

/**
 * Quanto cada coisa pesa na velocidade.
 *
 * A dificuldade do lance pesa mais que o peso do jogo — o que esta em jogo
 * aperta a mao, mas quem decide se o lance e dificil continua sendo o lance.
 */
const DIFFICULTY_WEIGHT = 0.62
const PRESSURE_WEIGHT = 0.38

/**
 * @param chance   Chance do lance. Vira a largura do verde.
 * @param pressure Peso do momento, 0 a 1: fase da competicao, minuto, placar
 *                 apertado e forca do adversario. Ver `momentPressure`.
 */
export function buildTiming(
  kind: TimingKind,
  chance: number,
  pressure: number,
  rng: Rng,
): TimingChallenge {
  const green = clamp(chance, MIN_GREEN, MAX_GREEN)

  // A zona nao encosta na borda: com o verde colado na ponta, segurar o clique
  // no fim da travessia acertaria sempre.
  const margin = green / 2 + 0.04
  const center = margin + rng() * Math.max(0, 1 - margin * 2)

  // Lance dificil passa mais rapido, e jogo decisivo passa mais rapido ainda.
  // As duas coisas somam de proposito: e o lance improvavel no momento pesado
  // que precisa ser o mais dificil de acertar da partida inteira.
  const hardness = clamp(
    (1 - green) * DIFFICULTY_WEIGHT + clamp(pressure, 0, 1) * PRESSURE_WEIGHT,
    0,
    1,
  )
  const sweepMs = Math.round(MAX_SWEEP_MS - (MAX_SWEEP_MS - MIN_SWEEP_MS) * hardness)

  return { kind, center, green, perfect: green * PERFECT_SHARE, sweepMs }
}

/** Onde o clique caiu. `cursor` vem da interface, em 0..1. */
export function resolveTiming(
  challenge: TimingChallenge,
  cursor: number,
): TimingOutcome {
  const position = clamp(cursor, 0, 1)
  const distance = Math.abs(position - challenge.center)

  if (distance <= challenge.perfect / 2) {
    return { band: 'perfeito', cursor: position, quality: 1 }
  }

  if (distance <= challenge.green / 2) {
    // Dentro do verde a qualidade cai do miolo para a borda, de 1 a 0,5. E ela
    // que separa "entrou" de "entrou no angulo" na nota e na moral.
    const span = Math.max(challenge.green / 2 - challenge.perfect / 2, 0.0001)
    const off = (distance - challenge.perfect / 2) / span

    return { band: 'bom', cursor: position, quality: 1 - off * 0.5 }
  }

  return { band: 'errado', cursor: position, quality: 0 }
}

/**
 * O clique de quem nao esta olhando.
 *
 * Usado quando a partida e simulada — pelo botao "simular o resto" ou pelo
 * modo que joga a temporada inteira sozinho. Um ponto uniforme na barra
 * devolve exatamente a chance original do lance, e por isso pular a partida
 * nunca e melhor nem pior do que joga-la sem habilidade nenhuma.
 */
export function blindCursor(rng: Rng): number {
  return rng()
}
