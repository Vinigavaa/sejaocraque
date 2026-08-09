import { clamp } from './positions'

/**
 * Quanto a presenca do jogador soma a forca do clube nas partidas.
 *
 * Sem isso o jogador e passageiro da propria carreira: a tabela sai de
 * `Club.strength` e mais nada, e um OVR 92 no Botafogo-PB termina a Serie C
 * exatamente onde o Botafogo-PB terminaria sem ele.
 *
 * ATENCAO: este valor serve **so para simular partidas**. Ele nao pode ser
 * somado em `Club.strength` nem entrar nas regras que descrevem o elenco.
 * `matchesPlayed` decide quem e titular comparando o OVR com a forca do clube:
 * com o reforco somado ali, ser bom aumentaria a forca do elenco e a forca
 * maior mandaria o jogador para o banco. Em `ratingFor` seria pior — o reforco
 * anularia exatamente o bonus de "esta acima do elenco" que a nota concede, e
 * ficar melhor derrubaria a nota.
 */

/** Pontos de forca ganhos por ponto de superioridade sobre o elenco. */
const LIFT_WEIGHT = 0.22

/**
 * Teto do reforco. Um jogador e 1 de 11: ele leva o clube pequeno a brigar
 * numa faixa acima, nao a ganhar sozinho.
 */
const MAX_LIFT = 5

/**
 * @param overall OVR do jogador na temporada.
 * @param clubStrength Forca real do elenco.
 * @param participation Fracao dos jogos daquela competicao que ele disputou.
 */
export function clubLift(
  overall: number,
  clubStrength: number,
  participation: number,
): number {
  // Jogador abaixo do elenco ja e punido com menos minutos e nota menor. O
  // clube nao e punido junto.
  const edge = Math.max(0, overall - clubStrength)

  return clamp(edge * LIFT_WEIGHT, 0, MAX_LIFT) * clamp(participation, 0, 1)
}

export { LIFT_WEIGHT, MAX_LIFT }
