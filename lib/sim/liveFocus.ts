/**
 * O foco tatico do jogador dentro da partida.
 *
 * E a unica alavanca que o jogador tem **antes** de o lance existir: a barra
 * responde ao que ja esta acontecendo, o foco decide o que tende a acontecer.
 * Ataque troca participacao defensiva por chance de gol, Defesa faz o caminho
 * inverso, e Equilibrado e a referencia — a producao dele e a que fecha com a
 * do modo classico.
 *
 * Aqui so mora **dado e proporcao**. Quem sorteia a oportunidade e quem
 * calcula a chance esta em `liveMatch.ts`.
 */

export type MatchFocus = 'ataque' | 'equilibrado' | 'defesa'

export const MATCH_FOCUSES: readonly MatchFocus[] = ['ataque', 'equilibrado', 'defesa']

export const FOCUS_LABEL: Record<MatchFocus, string> = {
  ataque: 'Ataque',
  equilibrado: 'Equilibrado',
  defesa: 'Defesa',
}

export const FOCUS_DETAIL: Record<MatchFocus, string> = {
  ataque: 'Mais chances de gol e assistência. Some da marcação.',
  equilibrado: 'Participa dos dois lados, sem exagero em nenhum.',
  defesa: 'Desarme, cobertura e interceptação. Menos bola na frente.',
}

/**
 * Quanto de uma oportunidade ofensiva sobrevive ao foco, de 0 a 1.
 *
 * O orcamento da partida e montado no teto — o que um jogador em Ataque
 * receberia — e cada oportunidade e filtrada por este numero na hora de
 * acontecer. E isso que permite trocar de foco no intervalo sem reescrever o
 * roteiro do segundo tempo: o slot ja esta la, o que muda e a chance de ele
 * virar chance de gol em vez de lance defensivo.
 *
 * Equilibrado vale 0,78 porque e ele que ancora a paridade com o modo
 * classico: o orcamento e dividido por este mesmo valor antes de virar
 * contagem, entao uma carreira jogada em Equilibrado produz o que a simulacao
 * produziria.
 */
export const FOCUS_ATTACK_SHARE: Record<MatchFocus, number> = {
  ataque: 1,
  equilibrado: 0.78,
  defesa: 0.5,
}

/** A ancora da paridade. Ver `FOCUS_ATTACK_SHARE`. */
export const NEUTRAL_ATTACK_SHARE = FOCUS_ATTACK_SHARE.equilibrado

/**
 * Quanto o foco inclina a chance de um lance dar certo.
 *
 * Pequeno de proposito: o foco decide **quantas** oportunidades aparecem, e so
 * de leve o quanto o jogador rende nelas. Se ele decidisse as duas com peso,
 * escolher Ataque com um atacante viraria a unica jogada possivel.
 */
export function focusEdge(focus: MatchFocus, side: FieldSide): number {
  if (side === 'neutro') return 0

  const attacking = side === 'ataque'

  if (focus === 'ataque') return attacking ? 0.05 : -0.06
  if (focus === 'defesa') return attacking ? -0.05 : 0.06

  return 0
}

/** De que lado do campo o lance acontece. */
export type FieldSide = 'ataque' | 'defesa' | 'neutro'
