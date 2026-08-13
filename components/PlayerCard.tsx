import {
  ALL_ATTRS,
  ATTR_LABEL,
  isStarAttr,
  POSITION_LABEL,
  type Attr,
  type Position,
} from '@/lib/sim/types'

import { Flag } from './Flag'
import { Display, scaled, t } from './shared'

export type CardAttrs = Record<Attr, number>

function stars(value: number): string {
  return '★'.repeat(value) + '☆'.repeat(5 - value)
}

/**
 * O cartao do jogador — a unica peca grafica do projeto.
 *
 * Tipografico de proposito: `theme.ts` registra que a identidade vem do Anton
 * e do laranja, sem escudo e sem foto. Uma figurinha com imagem exigiria
 * direito de uso e contradiria o aviso de nao-afiliacao da tela inicial.
 */
export function PlayerCard({
  name,
  shirtNumber,
  position,
  nationality,
  overall,
  attrs,
}: {
  name: string
  shirtNumber: number
  position: Position
  nationality?: string
  overall: number
  attrs: CardAttrs
}) {
  return (
    <div
      style={{
        border: `2px solid ${t.line}`,
        borderRadius: 10,
        background: t.card,
        padding: scaled(24),
        display: 'flex',
        flexDirection: 'column',
        gap: scaled(18),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: scaled(14) }}>
        <Display size={76} style={{ color: t.accent, letterSpacing: '-0.02em' }}>
          {shirtNumber}
        </Display>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Display size={30} style={{ lineHeight: 1.05 }}>
            {name}
          </Display>
          <div
            style={{
              marginTop: scaled(4),
              fontSize: scaled(12),
              color: t.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'flex',
              alignItems: 'center',
              gap: scaled(6),
            }}
          >
            <Flag nationality={nationality} size={13} />
            {POSITION_LABEL[position]}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Display size={44}>{overall}</Display>
          <div
            style={{
              fontSize: scaled(9),
              color: t.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            OVR
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: scaled(8),
          borderTop: `1px solid ${t.lineSoft}`,
          paddingTop: scaled(16),
        }}
      >
        {ALL_ATTRS.map((attr) => (
          <div key={attr}>
            <div
              style={{
                fontSize: scaled(9),
                color: t.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {ATTR_LABEL[attr].short}
            </div>
            <Display size={isStarAttr(attr) ? 14 : 24}>
              {isStarAttr(attr) ? stars(attrs[attr]) : attrs[attr]}
            </Display>
          </div>
        ))}
      </div>
    </div>
  )
}
