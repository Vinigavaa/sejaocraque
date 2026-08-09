import type { ReactNode } from 'react'

import type { Game } from '@/lib/game/useGame'
import { clubById } from '@/lib/sim/data/clubs'
import { POSITION_LABEL } from '@/lib/sim/types'

import { ClubCrest } from './Crest'
import { Display, scaled, t } from './shared'

/**
 * O painel do desktop.
 *
 * Um `<header>` fixo e uma grade de tres faixas — a grade em si vive no
 * `globals.css`, porque estilo inline nao tem media query e abaixo de 1024px
 * tudo isso precisa virar uma coluna so.
 *
 * O cabecalho mostra so a marca enquanto nao ha jogador; a identificacao
 * aparece quando a carreira comeca.
 */
export function DesktopShell({ game, children }: { game: Game; children: ReactNode }) {
  return (
    <div data-shell>
      <header data-shell-head>
        <Display size={20} style={{ letterSpacing: '0.02em' }}>
          CRAQUE
        </Display>
        <PlayerLine game={game} />
      </header>
      {children}
    </div>
  )
}

function PlayerLine({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  const club = clubById(career.clubId)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: scaled(12),
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      <Display size={16}>
        {career.config.name} · {career.config.shirtNumber}
      </Display>
      <div
        style={{
          fontSize: scaled(11),
          color: t.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'flex',
          alignItems: 'center',
          gap: scaled(6),
        }}
      >
        <ClubCrest clubId={club?.id} size={18} />
        {POSITION_LABEL[career.config.position]} · {club?.name} · {career.age} anos
      </div>
      <Display size={16} style={{ marginLeft: 'auto', color: t.accent }}>
        OVR {game.liveOverall}
      </Display>
    </div>
  )
}
