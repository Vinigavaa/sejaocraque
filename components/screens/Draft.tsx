import type { Game } from '@/lib/game/useGame'
import { availableAttrs, DRAFT_ROUNDS } from '@/lib/sim/draft'
import { ALL_ATTRS, ATTR_LABEL, isStarAttr, type Attr } from '@/lib/sim/types'

import { PlayerSheet } from '../PlayerSheet'
import { ScreenLayout } from '../ScreenLayout'
import { Display, scaled, SectionLabel, t } from '../shared'

function stars(value: number): string {
  return '★'.repeat(value) + '☆'.repeat(5 - value)
}

export function Draft({ game }: { game: Game }) {
  const draft = game.draft
  if (!draft) return null

  const legend = draft.currentLegend
  const available = new Set<Attr>(availableAttrs(draft))
  const filled = draft.picks.length
  const isPro = draft.config.mode === 'pro'

  return (
    <ScreenLayout
      mobileOrder={['left', 'center', 'right']}
      right={<PlayerSheet game={game} />}
      left={
        <>
          <SectionLabel>
            SLOTS PREENCHIDOS {filled}/{DRAFT_ROUNDS}
          </SectionLabel>

          <div
            style={{
              marginTop: scaled(8),
              height: 6,
              background: 'oklch(95% 0.01 70 / 0.1)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(filled / DRAFT_ROUNDS) * 100}%`,
                background: t.accent,
                borderRadius: 999,
                transition: 'width 220ms ease',
              }}
            />
          </div>

          <button
            onClick={game.reroll}
            disabled={draft.rerollsLeft <= 0}
            style={{
              marginTop: scaled(16),
              alignSelf: 'flex-start',
              background: 'transparent',
              border: `2px solid oklch(95% 0.01 70 / 0.2)`,
              color: draft.rerollsLeft <= 0 ? t.faintText : t.text,
              borderRadius: 999,
              padding: `${scaled(10)} ${scaled(18)}`,
              fontWeight: 700,
              fontSize: scaled(13),
              cursor: draft.rerollsLeft <= 0 ? 'default' : 'pointer',
            }}
          >
            ↺ OUTRA LENDA · {draft.rerollsLeft} RESTANTES
          </button>

          <div style={{ marginTop: scaled(20), fontSize: scaled(10), color: t.faintText }}>
            SEED · {draft.config.seed}
          </div>
        </>
      }
    >
      <Display size={34} style={{ marginTop: scaled(20) }}>
        {legend.name}
      </Display>
      <div style={{ marginTop: scaled(4), fontSize: scaled(13), color: t.muted }}>
        Escolha um atributo para roubar
      </div>

      <div
        style={{ marginTop: scaled(16), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: scaled(8) }}
      >
        {ALL_ATTRS.map((attr) => {
          const open = available.has(attr)
          const raw = legend[attr]
          const display = !open ? '·' : isPro ? '—' : isStarAttr(attr) ? stars(raw) : raw

          return (
            <div
              key={attr}
              onClick={() => open && game.steal(attr)}
              role="button"
              tabIndex={open ? 0 : -1}
              onKeyDown={(event) => {
                if (open && (event.key === 'Enter' || event.key === ' ')) game.steal(attr)
              }}
              style={{
                cursor: open ? 'pointer' : 'default',
                border: `2px solid ${open ? t.accent : t.line}`,
                background: open ? t.card : t.faint,
                opacity: open ? 1 : 0.4,
                borderRadius: 6,
                padding: `${scaled(10)} ${scaled(12)}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: scaled(6),
                }}
              >
                <Display size={14} style={{ letterSpacing: '0.02em' }}>
                  {ATTR_LABEL[attr].short}
                </Display>
                <Display size={isStarAttr(attr) && open && !isPro ? 13 : 22}>{display}</Display>
              </div>
              <div style={{ fontSize: scaled(9), color: 'oklch(60% 0.015 70)', marginTop: scaled(2) }}>
                {ATTR_LABEL[attr].full}
              </div>
            </div>
          )
        })}
      </div>
    </ScreenLayout>
  )
}
