import { AWARD_LABEL } from '@/lib/sim/awards'
import type { SeasonRecord } from '@/lib/sim/career'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { wonWorldCup } from '@/lib/sim/national'

/**
 * Manchetes da temporada.
 *
 * Camada de apresentacao: le o que a simulacao produziu e escreve em
 * portugues. Nao inventa fato nenhum — toda manchete corresponde a algo que
 * aconteceu de verdade na carreira.
 */
export function headlinesFor(record: SeasonRecord, playerName: string): string[] {
  const club = clubById(record.clubId)
  const league = leagueById(record.leagueId)
  const clubName = club?.name ?? 'clube'
  const out: string[] = []

  for (const award of record.awards) {
    out.push(`${playerName} conquista a ${AWARD_LABEL[award]}`)
  }

  const national = record.national

  if (national?.tournament?.won) {
    out.push(
      wonWorldCup(national)
        ? `${playerName} é campeão do mundo`
        : `${playerName} é campeão da ${national.tournament.name} pela seleção`,
    )
  }

  if (record.champion) {
    out.push(`${playerName} é campeão do ${league?.name ?? 'campeonato'} pelo ${clubName}`)
  }

  for (const run of record.cups) {
    if (run.won) out.push(`${clubName} levanta a ${run.name}`)
  }

  if (record.promoted) {
    out.push(`${clubName} garante acesso com ${playerName} em campo`)
  }

  if (record.relegated) {
    out.push(`${clubName} cai de divisão`)
  }

  if (out.length === 0) {
    if (record.stats.matches < 8) {
      out.push(`${playerName} soma poucos minutos no ${clubName}`)
    } else if (record.stats.goals > 0) {
      out.push(
        `${playerName} soma ${record.stats.goals} ${record.stats.goals === 1 ? 'gol' : 'gols'} na temporada pelo ${clubName}`,
      )
    } else {
      out.push(`${playerName} completa a temporada pelo ${clubName}`)
    }
  }

  return out
}

export function transferHeadline(playerName: string, clubName: string): string {
  return `${playerName} assina com o ${clubName}`
}
