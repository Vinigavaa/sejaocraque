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
 * aparece quando a carreira comeca. No celular, com a carreira em andamento,
 * a marca sai (`data-has-player`, no `globals.css`) para o nome e o clube
 * caberem em uma linha legivel.
 */
export function DesktopShell({ game, children }: { game: Game; children: ReactNode }) {
  return (
    <div data-shell>
      <header data-shell-head data-has-player={game.career ? '' : undefined}>
        <div data-shell-brand>
          <Display size={22} style={{ letterSpacing: '0.01em', textTransform: 'lowercase' }}>
            seja<span style={{ color: t.accent }}>o</span>craque.com
          </Display>
        </div>
        {/* A assinatura so aparece enquanto nao ha carreira: com jogador em campo
            o lugar dela e da identificacao do jogador. */}
        {game.career ? (
          <PlayerLine game={game} />
        ) : (
          <div
            style={{
              // A regra do `globals.css` da `flex:1` ao ultimo filho: sem o
              // alinhamento a direita a assinatura ficaria colada na marca.
              marginLeft: 'auto',
              textAlign: 'right',
              fontSize: scaled(12),
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: t.muted,
            }}
          >
            Simulador de carreira
          </div>
        )}
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
      <Display size={22}>
        {career.config.name} · {career.config.shirtNumber}
      </Display>
      <div
        style={{
          fontSize: scaled(12),
          color: t.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'flex',
          alignItems: 'center',
          gap: scaled(6),
        }}
      >
        <ClubCrest clubId={club?.id} size={20} />
        {/* O clube e a informacao que o jogador procura aqui: fica na cor do
            texto e em negrito, e o resto da linha continua secundario. */}
        <span style={{ color: t.text, fontWeight: 800 }}>{club?.name}</span>
        <span>
          {POSITION_LABEL[career.config.position]} · {career.age} anos
        </span>
      </div>
      <Display size={18} style={{ marginLeft: 'auto', color: t.accent }}>
        OVR {game.liveOverall}
      </Display>
    </div>
  )
}
