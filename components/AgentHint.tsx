import type { Game } from '@/lib/game/useGame'

import { scaled, t } from './shared'

/**
 * O aviso do empresario, no comeco de cada temporada do modo Classico.
 *
 * O botao EMPRESARIO fica na coluna de acoes secundarias, e no celular ela
 * aparece depois do conteudo da tela — quem nunca rolou ate la nao descobre
 * que pode pedir destinos e receber propostas. O aviso existe para dizer isso
 * uma vez por temporada.
 *
 * Nao e um overlay: nao bloqueia, nao entra na fila de `Overlays` e nao
 * atrasa nada. Some ao tocar nele, ao dispensar, ou quando a proxima
 * temporada comeca.
 */
export function AgentHint({ game }: { game: Game }) {
  if (!game.agentHint) return null

  return (
    <div
      data-motion="event"
      style={{
        position: 'fixed',
        left: scaled(12),
        right: scaled(12),
        bottom: scaled(12),
        zIndex: 15,
        maxWidth: scaled(420),
        marginInline: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: scaled(10),
        background: t.card,
        border: `1px solid ${t.accent}`,
        borderRadius: 8,
        padding: `${scaled(10)} ${scaled(12)}`,
      }}
    >
      <div style={{ fontSize: scaled(18), lineHeight: 1 }}>💼</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: scaled(12), fontWeight: 800 }}>Fale com seu empresário</div>
        <div style={{ marginTop: scaled(2), fontSize: scaled(11), color: t.mutedStrong, lineHeight: 1.4 }}>
          No botão <strong>EMPRESÁRIO</strong> você pede destinos e acompanha as propostas de
          clubes.
        </div>
      </div>
      <button
        onClick={game.openAgent}
        style={{
          background: t.accent,
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: `${scaled(8)} ${scaled(12)}`,
          fontWeight: 800,
          fontSize: scaled(11),
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ABRIR
      </button>
      <button
        onClick={game.dismissAgentHint}
        aria-label="Dispensar aviso"
        style={{
          background: 'transparent',
          border: 'none',
          color: t.faintText,
          fontSize: scaled(14),
          cursor: 'pointer',
          padding: scaled(4),
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
