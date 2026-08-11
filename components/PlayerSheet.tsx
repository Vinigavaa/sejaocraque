import type { Game } from '@/lib/game/useGame'
import { careerTotals } from '@/lib/sim/ladder'
import { ALL_ATTRS, ATTR_LABEL, isStarAttr } from '@/lib/sim/types'

import { Display, scaled, SectionLabel, t } from './shared'

/**
 * A ficha do trilho direito — o "placar" sempre visivel do desktop.
 *
 * Recebe o `Game` inteiro em vez de seis props: ela aparece em varias telas, e
 * repassar os mesmos campos por todas seria repeticao pura. `useGame` ja e o
 * contrato unico de estado aqui.
 *
 * Enquanto nao ha jogador, mostra os oito espacos do draft sendo preenchidos;
 * depois, os totais da carreira. O cartao do jogador nao entra: nome, camisa,
 * posicao e overall ja estao no cabecalho, e os atributos na ficha de perfil.
 */
export function PlayerSheet({ game }: { game: Game }) {
  if (game.draft && !game.career) return <DraftSlots game={game} />
  if (!game.career) return null

  return <CareerSheet game={game} />
}

function DraftSlots({ game }: { game: Game }) {
  const draft = game.draft
  if (!draft) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(10) }}>
      <SectionLabel>Seu jogador</SectionLabel>
      {ALL_ATTRS.map((attr) => {
        const pick = draft.picks.find((entry) => entry.attr === attr)

        return (
          <div
            key={attr}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: scaled(8),
              border: `1px solid ${t.lineSoft}`,
              borderRadius: 6,
              padding: `${scaled(10)} ${scaled(12)}`,
              background: pick ? t.card : 'transparent',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Display size={14}>{ATTR_LABEL[attr].short}</Display>
              <div
                style={{
                  fontSize: scaled(10),
                  color: t.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pick ? `roubado de ${pick.fromLegendName}` : 'vazio'}
              </div>
            </div>
            <Display size={isStarAttr(attr) && pick ? 12 : 20}>
              {pick ? (isStarAttr(attr) ? stars(pick.value) : pick.value) : '—'}
            </Display>
          </div>
        )
      })}
    </div>
  )
}

function CareerSheet({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  const totals = careerTotals(career)

  return (
    <div>
      <SectionLabel>Carreira</SectionLabel>
      <div
        style={{
          marginTop: scaled(10),
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: scaled(10),
        }}
      >
        <Total value={totals.matches} label="jogos" />
        <Total value={totals.goals} label="gols" />
        <Total value={totals.assists} label="assistências" />
        <Total value={totals.titles} label="títulos" />
        <Total value={totals.ballonDOrs} label="bolas de ouro" gold />
      </div>
    </div>
  )
}

function Total({ value, label, gold }: { value: number; label: string; gold?: boolean }) {
  return (
    <div>
      <Display size={26} style={gold && value > 0 ? { color: t.gold } : undefined}>
        {value}
      </Display>
      <div
        style={{
          marginTop: 2,
          fontSize: scaled(9),
          color: t.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function stars(value: number): string {
  return '★'.repeat(value) + '☆'.repeat(5 - value)
}
