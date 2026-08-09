import type { CSSProperties, ReactNode } from 'react'

import { displayFont, scaled, sectionLabel, t } from '@/lib/ui/theme'

/** Texto em Anton — usado em numero grande, sigla e titulo. */
export function Display({
  children,
  size,
  style,
}: {
  children: ReactNode
  size: number
  style?: CSSProperties
}) {
  return (
    <div style={{ fontFamily: displayFont, fontSize: scaled(size), lineHeight: 1, ...style }}>
      {children}
    </div>
  )
}

/** Rotulo de secao em caixa alta. Estrutura toda tela do jogo. */
export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return <div style={{ ...sectionLabel, ...style }}>{children}</div>
}

/** Numero grande com legenda embaixo. O bloco de estatistica do design. */
export function Stat({
  value,
  label,
  size = 26,
}: {
  value: ReactNode
  label: string
  size?: number
}) {
  return (
    <div>
      <Display size={size}>{value}</Display>
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

export function PrimaryButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? t.line : t.accent,
        color: 'white',
        border: 'none',
        borderRadius: 6,
        padding: `${scaled(18)} ${scaled(28)}`,
        fontWeight: 800,
        fontSize: scaled(18),
        letterSpacing: '0.01em',
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: `2px solid ${t.line}`,
        color: disabled ? t.faintText : t.text,
        borderRadius: 6,
        padding: scaled(14),
        fontWeight: 800,
        fontSize: scaled(15),
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** Cartao selecionavel — nacionalidade, posicao, numero, modo. */
export function SelectCard({
  selected,
  onClick,
  children,
  style,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick()
      }}
      style={{
        cursor: 'pointer',
        border: `2px solid ${selected ? t.accent : t.line}`,
        background: selected ? t.accentSoft : t.card,
        borderRadius: 6,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  bg,
  color,
}: {
  children: ReactNode
  bg: string
  color: string
}) {
  return (
    <div
      style={{
        fontSize: scaled(10),
        fontWeight: 800,
        background: bg,
        color,
        padding: `${scaled(4)} ${scaled(10)}`,
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  )
}
