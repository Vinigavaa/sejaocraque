/**
 * Tokens visuais, extraidos do design em Claude Design.
 *
 * Paleta em oklch, tema escuro unico. Sem escudo e sem foto: a identidade e
 * carregada pela tipografia (Anton nos numeros e titulos, Inter no texto) e
 * pelo laranja como unica cor de acao.
 */
export const t = {
  bg: 'oklch(15% 0.015 55)',
  card: 'oklch(21% 0.015 55)',
  text: 'oklch(95% 0.01 70)',
  muted: 'oklch(66% 0.015 70)',
  mutedStrong: 'oklch(62% 0.015 70)',
  faintText: 'oklch(56% 0.015 70)',

  line: 'oklch(95% 0.01 70 / 0.15)',
  lineSoft: 'oklch(95% 0.01 70 / 0.12)',
  faint: 'oklch(95% 0.01 70 / 0.06)',

  accent: 'oklch(58% 0.19 45)',
  accentSoft: 'oklch(70% 0.17 50 / 0.16)',

  gold: 'oklch(78% 0.15 75)',
  goldSoft: 'oklch(78% 0.15 75 / 0.3)',
  goldText: 'oklch(88% 0.1 75)',

  green: 'oklch(65% 0.15 150)',
  greenSoft: 'oklch(65% 0.15 150 / 0.25)',
  greenText: 'oklch(85% 0.12 150)',

  danger: 'oklch(70% 0.17 50 / 0.2)',
  dangerText: 'oklch(72% 0.17 30)',

  shareBg: 'oklch(10% 0.02 45)',
} as const

/**
 * Escala um tamanho base pela escala de interface vigente.
 *
 * A escala e uma custom property CSS (`--ui-scale`, em `globals.css`) e nao
 * estado React de proposito: resolvida no CSS ela funciona no SSR e nao tem
 * um primeiro frame com o valor errado na hidratacao. Chamadas continuam
 * passando numeros — `scaled(34)`, nao `'calc(...)'`.
 *
 * Vale para o que se le: titulo, numero, rotulo, corpo. Traco fica fixo —
 * escalar borda e raio produz meio-pixel e borra o desenho.
 */
export function scaled(px: number): string {
  return `calc(${px}px * var(--ui-scale))`
}

/** Rotulo de secao: caixa alta, pequeno, espacado. Repete em todas as telas. */
export const sectionLabel = {
  fontSize: scaled(11),
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: t.mutedStrong,
} as const

export const displayFont = "var(--font-anton), 'Anton', sans-serif"
