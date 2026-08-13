/** Os seis atributos numericos, escala 1-99. */
export const NUMERIC_ATTRS = ['vel', 'fin', 'pas', 'dri', 'def', 'fis'] as const

/** Atributos em estrela, escala 1-5. */
export const STAR_ATTRS = ['fintas', 'pernaRuim'] as const

export const ALL_ATTRS = [...NUMERIC_ATTRS, ...STAR_ATTRS] as const

export type NumericAttr = (typeof NUMERIC_ATTRS)[number]
export type StarAttr = (typeof STAR_ATTRS)[number]
export type Attr = (typeof ALL_ATTRS)[number]

/** Texto de tela — vai acentuado, ao contrario dos comentarios do motor. */
export const ATTR_LABEL: Record<Attr, { short: string; full: string }> = {
  vel: { short: 'VEL', full: 'Velocidade' },
  fin: { short: 'FIN', full: 'Finalização' },
  pas: { short: 'PAS', full: 'Passe' },
  dri: { short: 'DRI', full: 'Drible' },
  def: { short: 'DEF', full: 'Defesa' },
  fis: { short: 'FIS', full: 'Físico' },
  fintas: { short: 'FIN★', full: 'Fintas' },
  pernaRuim: { short: 'PR★', full: 'Perna ruim' },
}

export function isStarAttr(attr: Attr): attr is StarAttr {
  return attr === 'fintas' || attr === 'pernaRuim'
}

/**
 * Posicoes de linha. Goleiro fica de fora: os seis atributos nao descrevem
 * um goleiro, e um modo dedicado seria outro jogo.
 */
export const POSITIONS = [
  'ZAG',
  'ALA',
  'VOL',
  'MC',
  'MEI',
  'PON',
  'SA',
  'ATA',
] as const

export type Position = (typeof POSITIONS)[number]

export const POSITION_LABEL: Record<Position, string> = {
  ZAG: 'Zagueiro',
  ALA: 'Ala',
  VOL: 'Volante',
  MC: 'Meio-campo',
  MEI: 'Meia armador',
  PON: 'Ponta',
  SA: 'Segundo atacante',
  ATA: 'Atacante',
}

/** Valores autorais, nao derivados de base de terceiro. */
export type Legend = {
  id: string
  name: string
  vel: number
  fin: number
  pas: number
  dri: number
  def: number
  fis: number
  fintas: number
  pernaRuim: number
}

export type Club = {
  id: string
  name: string
  leagueId: string
  /** 1-99. Define nivel de competicao e teto de desempenho. */
  strength: number
  /**
   * Poder financeiro do clube, com 1 = o normal da liga dele.
   *
   * Separado da forca porque as duas coisas se descolam no futebol de
   * verdade: o Al-Hilal nao tem o elenco do Real Madrid e mesmo assim paga
   * mais que ele, e o Galatasaray paga acima do que a Süper Lig sugere.
   * Multiplica o teto salarial — ver `clubTopSalary`.
   */
  money: number
}

/** Um slot preenchido no draft: de qual lenda veio cada atributo. */
export type DraftPick = {
  attr: Attr
  value: number
  fromLegendId: string
  fromLegendName: string
}

export type PlayerAttrs = Record<Attr, number>
