import type { SeasonLine } from '@/lib/sim/career'

import { CompetitionCrest } from './Crest'
import { Flag } from './Flag'
import { scaled, t } from './shared'

/**
 * Uma competicao disputada numa temporada. Nasceu no resumo de temporada e
 * mudou para ca quando o historico passou a mostrar a mesma linha — e a mesma
 * pergunta ("o que ele fez nesta competicao"), entao e a mesma linha.
 */
export function CompetitionRow({ line }: { line: SeasonLine }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: scaled(10),
        padding: `${scaled(8)} ${scaled(10)}`,
        borderRadius: 6,
        background: line.won ? t.goldSoft : t.card,
        border: `1px solid ${t.lineSoft}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(8), minWidth: 0 }}>
        {/* A seleção sem torneio no ano não tem emblema de competição — ali
            quem identifica é a bandeira. */}
        {line.badgeId ? (
          <CompetitionCrest competitionId={line.badgeId} size={22} />
        ) : (
          <Flag nationality={line.nationId ?? undefined} size={18} />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: scaled(12),
              fontWeight: 700,
              color: line.won ? t.goldText : t.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {line.name}
          </div>
          <div style={{ fontSize: scaled(10), color: line.won ? t.goldText : t.muted }}>
            {line.reached}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: scaled(11),
          color: line.won ? t.goldText : t.mutedStrong,
          whiteSpace: 'nowrap',
        }}
      >
        {line.matches}j {line.goals}g {line.assists}a
      </div>
    </div>
  )
}
