import type { SocialPost } from '@/lib/game/social'
import type { NewsItem } from '@/lib/game/news'
import type { CareerState } from '@/lib/sim/career'
import type { MatchdayLog, MatchdaySeason } from '@/lib/sim/matchday'

/**
 * As três vagas de carreira por conta.
 *
 * O limite não é só de tela: os ids das vagas são fixos, e é isso que as
 * regras do Firestore usam para impedir uma quarta carreira — um cliente
 * adulterado não consegue criar `carreiras/4`.
 */
export const SAVE_SLOTS = ['1', '2', '3'] as const

export type SaveSlot = (typeof SAVE_SLOTS)[number]

export function isSaveSlot(value: string): value is SaveSlot {
  return (SAVE_SLOTS as readonly string[]).includes(value)
}

/**
 * A versão do formato do estado salvo.
 *
 * O motor do jogo evolui, e um save antigo pode não fazer mais sentido para
 * ele. Guardar a versão é o que permite recusar o save com uma explicação em
 * vez de carregar uma carreira quebrada.
 */
export const SNAPSHOT_VERSION = 1

/**
 * A carreira congelada, do jeito que o jogo a retoma.
 *
 * Só o que não dá para recalcular entra aqui. Tudo que é derivado — overall,
 * próximo adversário, mesa de negociação — nasce de novo a partir da carreira
 * quando a tela monta.
 */
export type CareerSnapshot = {
  version: number
  career: CareerState
  /** A temporada em curso rodada a rodada. `null` entre uma temporada e outra. */
  matchday: MatchdaySeason | null
  news: NewsItem[]
  social: SocialPost[]
  seasonLog: MatchdayLog[]
}

/**
 * O cartão da vaga na tela de carreiras.
 *
 * Fica em campos próprios no documento, fora do estado serializado, para que
 * listar as três vagas não precise abrir e interpretar três carreiras
 * inteiras.
 */
export type SaveSummary = {
  slot: SaveSlot
  playerName: string
  clubName: string
  season: string
  age: number
  overall: number
  /** Milissegundos desde a época. Gravado pelo relógio do servidor. */
  savedAt: number | null
}

/** Uma vaga como a tela a enxerga: preenchida ou livre. */
export type SaveSlotView = {
  slot: SaveSlot
  summary: SaveSummary | null
}
