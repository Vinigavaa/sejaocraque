/**
 * Selecoes nacionais.
 *
 * Nao ha elenco por selecao — e a informacao que eu nao conseguiria escrever
 * sem inventar, e o jogo nao precisa dela. Basta uma forca por pais e uma
 * regra de convocacao por OVR: o jogador so quer saber se foi chamado, quanto
 * jogou e ate onde a selecao foi.
 *
 * As forcas sao autorais e representam o patamar historico recente de cada
 * selecao. `code` casa com a nacionalidade escolhida na criacao do jogador.
 */
/**
 * A confederacao decide duas coisas: contra quem sao as Eliminatorias e qual
 * torneio continental a selecao disputa no meio do ciclo.
 */
export const CONFEDERATIONS = ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF'] as const

export type Confederation = (typeof CONFEDERATIONS)[number]

export type Nation = {
  id: string
  name: string
  /** Codigo do flag-icons (ISO 3166-1 alpha-2 minusculo; `gb-eng`/`gb-sct` para os reinos). */
  flagCode: string
  strength: number
  confederation: Confederation
}

type Row = [
  code: string,
  name: string,
  flagCode: string,
  strength: number,
  confederation: Confederation,
]

const ROWS: Row[] = [
  ['FR', 'França', 'fr', 92, 'UEFA'],
  ['AR', 'Argentina', 'ar', 91, 'CONMEBOL'],
  ['ES', 'Espanha', 'es', 91, 'UEFA'],
  ['BR', 'Brasil', 'br', 90, 'CONMEBOL'],
  ['EN', 'Inglaterra', 'gb-eng', 89, 'UEFA'],
  ['DE', 'Alemanha', 'de', 88, 'UEFA'],
  ['PT', 'Portugal', 'pt', 88, 'UEFA'],
  ['NL', 'Holanda', 'nl', 86, 'UEFA'],
  ['IT', 'Itália', 'it', 85, 'UEFA'],
  ['BE', 'Bélgica', 'be', 84, 'UEFA'],
  ['HR', 'Croácia', 'hr', 82, 'UEFA'],
  ['UY', 'Uruguai', 'uy', 82, 'CONMEBOL'],
  ['CO', 'Colômbia', 'co', 82, 'CONMEBOL'],
  ['MA', 'Marrocos', 'ma', 81, 'CAF'],
  ['CH', 'Suíça', 'ch', 79, 'UEFA'],
  ['DK', 'Dinamarca', 'dk', 79, 'UEFA'],
  ['JP', 'Japão', 'jp', 79, 'AFC'],
  ['NO', 'Noruega', 'no', 78, 'UEFA'],
  ['US', 'Estados Unidos', 'us', 78, 'CONCACAF'],
  ['MX', 'México', 'mx', 78, 'CONCACAF'],
  ['SN', 'Senegal', 'sn', 78, 'CAF'],
  ['AT', 'Áustria', 'at', 78, 'UEFA'],
  ['TR', 'Turquia', 'tr', 78, 'UEFA'],
  ['KR', 'Coreia do Sul', 'kr', 77, 'AFC'],
  ['EC', 'Equador', 'ec', 77, 'CONMEBOL'],
  ['NG', 'Nigéria', 'ng', 77, 'CAF'],
  ['IR', 'Irã', 'ir', 76, 'AFC'],
  ['CI', 'Costa do Marfim', 'ci', 76, 'CAF'],
  ['RS', 'Sérvia', 'rs', 76, 'UEFA'],
  ['UA', 'Ucrânia', 'ua', 76, 'UEFA'],
  ['DZ', 'Argélia', 'dz', 76, 'CAF'],
  ['SE', 'Suécia', 'se', 75, 'UEFA'],
  ['SCO', 'Escócia', 'gb-sct', 75, 'UEFA'],
  ['EG', 'Egito', 'eg', 75, 'CAF'],
  ['PL', 'Polônia', 'pl', 75, 'UEFA'],
  ['CM', 'Camarões', 'cm', 75, 'CAF'],
  ['CL', 'Chile', 'cl', 74, 'CONMEBOL'],
  ['GR', 'Grécia', 'gr', 74, 'UEFA'],
  ['GH', 'Gana', 'gh', 74, 'CAF'],
  ['AU', 'Austrália', 'au', 74, 'AFC'],
  ['CZ', 'Tchéquia', 'cz', 74, 'UEFA'],
  ['PE', 'Peru', 'pe', 73, 'CONMEBOL'],
  ['TN', 'Tunísia', 'tn', 73, 'CAF'],
  ['PY', 'Paraguai', 'py', 73, 'CONMEBOL'],
  ['ZA', 'África do Sul', 'za', 72, 'CAF'],
  ['SA', 'Arábia Saudita', 'sa', 71, 'AFC'],
  ['VE', 'Venezuela', 've', 71, 'CONMEBOL'],
  // A CONCACAF tinha duas selecoes so, e uma Copa Ouro de dois participantes e
  // uma final e mais nada. Estas quatro ficam abaixo do corte das 32 vagas da
  // Copa do Mundo: so vao ao Mundial quando o sorteio de forma as favorece.
  ['CR', 'Costa Rica', 'cr', 71, 'CONCACAF'],
  ['QA', 'Catar', 'qa', 70, 'AFC'],
  ['PA', 'Panamá', 'pa', 69, 'CONCACAF'],
  ['JM', 'Jamaica', 'jm', 69, 'CONCACAF'],
  ['HN', 'Honduras', 'hn', 68, 'CONCACAF'],
]

export const NATIONS: Nation[] = ROWS.map(
  ([id, name, flagCode, strength, confederation]) => ({
    id,
    name,
    flagCode,
    strength,
    confederation,
  }),
)

export function nationsIn(confederation: Confederation): Nation[] {
  return NATIONS.filter((nation) => nation.confederation === confederation)
}

export function nationById(id: string): Nation | undefined {
  return NATIONS.find((nation) => nation.id === id)
}

/** Quantas selecoes disputam a Copa do Mundo. */
export const WORLD_CUP_SLOTS = 32

/**
 * Forca media das selecoes.
 *
 * E a referencia de nivel de um jogo de selecao, do mesmo jeito que a media da
 * liga e a de um jogo de clube: e ela que diz se o adversario de hoje esta
 * acima ou abaixo do padrao do futebol internacional.
 */
export const NATIONS_AVERAGE =
  NATIONS.reduce((sum, nation) => sum + nation.strength, 0) / NATIONS.length
