import type { CareerState } from '@/lib/sim/career'
import { seasonLabel } from '@/lib/sim/career'
import { clubById } from '@/lib/sim/data/clubs'
import { currentOverall } from '@/lib/sim/progression'

import type { SaveSummary } from './types'

/**
 * O cartão que identifica uma vaga na lista.
 *
 * Sai sempre da carreira, e num lugar só: a gravação manual e a automática
 * precisam produzir o mesmo cartão, senão a lista mostraria dados diferentes
 * dependendo de quem gravou por último.
 */
export function cardFor(career: CareerState): Omit<SaveSummary, 'slot' | 'savedAt'> {
  return {
    playerName: career.config.name,
    clubName: clubById(career.clubId)?.name ?? 'sem clube',
    season: seasonLabel(career.seasonIndex),
    age: career.age,
    overall: currentOverall(career.peakAttrs, career.config.position, career.age),
  }
}
