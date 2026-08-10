import type { Game, Overlay } from '@/lib/game/useGame'
import type { SeasonRecord } from '@/lib/sim/career'
import { AWARD_LABEL, type Award } from '@/lib/sim/awards'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { matchesPreference } from '@/lib/sim/transfers'

import { ClubCrest } from './Crest'
import { Display, GhostButton, scaled, SectionLabel, t } from './shared'

export function Overlays({ game }: { game: Game }) {
  const overlay = game.overlay
  if (!overlay) return null

  return (
    <div
      data-motion="backdrop"
      // `fixed` e nao `absolute`: a coluna pode ser bem mais alta que a tela no
      // desktop, e um backdrop preso a ela abriria fora do campo de visao.
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(5% 0 0 / 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: scaled(24),
        zIndex: 20,
      }}
    >
      <div
        // A chave remonta o painel a cada overlay da fila, entao dois premios
        // seguidos animam duas vezes em vez de o segundo aparecer parado.
        key={overlayKey(overlay)}
        data-motion="overlay"
        style={{
          background: t.card,
          borderRadius: 10,
          padding: scaled(24),
          width: '100%',
          maxWidth: scaled(340),
          maxHeight: '100%',
          overflowY: 'auto',
        }}
      >
        {overlay.type === 'award' && <Award game={game} award={overlay.award} />}
        {overlay.type === 'transfer' && <Transfer game={game} clubId={overlay.clubId} />}
      </div>
    </div>
  )
}

/**
 * Dois premios, duas cerimonias.
 *
 * A Bola de Ouro e o teto da carreira e ganha palco proprio: bola dourada,
 * luz girando atras e a temporada que sustentou o voto. A Chuteira de Ouro
 * continua sendo o cartao seco de sempre — se tudo brilha igual, nada brilha.
 */
function Award({ game, award }: { game: Game; award: Award }) {
  const line = `${game.career?.config.name} · ${game.lastRecord?.label}`

  return (
    <>
      {award === 'bola-de-ouro' ? (
        <BallonCeremony line={line} record={game.lastRecord} />
      ) : (
        <>
          <SectionLabel style={{ textAlign: 'center', fontWeight: 800, color: t.gold }}>
            CERIMÔNIA DE PRÊMIO
          </SectionLabel>
          <Display size={26} style={{ marginTop: scaled(6), textAlign: 'center' }}>
            {AWARD_LABEL[award]}
          </Display>
          <div
            style={{
              marginTop: scaled(6),
              fontSize: scaled(12),
              color: t.muted,
              textAlign: 'center',
            }}
          >
            {line}
          </div>
        </>
      )}

      <GhostButton
        onClick={game.closeOverlay}
        style={{
          marginTop: scaled(16),
          width: '100%',
          background: t.accent,
          border: 'none',
          color: 'white',
        }}
      >
        CONTINUAR
      </GhostButton>
    </>
  )
}

/** As faiscas em volta da bola. Posicao em porcentagem do palco. */
const SPARKS = [
  { top: '14%', left: '18%', size: 5 },
  { top: '26%', left: '82%', size: 4 },
  { top: '58%', left: '10%', size: 3 },
  { top: '70%', left: '88%', size: 5 },
  { top: '8%', left: '58%', size: 3 },
  { top: '78%', left: '34%', size: 4 },
]

function BallonCeremony({ line, record }: { line: string; record: SeasonRecord | null }) {
  const goals = record
    ? record.stats.goals + record.cups.reduce((sum, run) => sum + run.goals, 0)
    : 0
  const assists = record
    ? record.stats.assists + record.cups.reduce((sum, run) => sum + run.assists, 0)
    : 0
  const titles = record
    ? (record.champion ? 1 : 0) + record.cups.filter((run) => run.won).length
    : 0

  return (
    <>
      <SectionLabel style={{ textAlign: 'center', fontWeight: 800, color: t.gold }}>
        CERIMÔNIA DE PRÊMIO
      </SectionLabel>

      <div
        data-motion="ballon-stage"
        style={{
          position: 'relative',
          height: scaled(150),
          marginTop: scaled(8),
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div data-motion="ballon-rays" />
        <div data-motion="ballon-glow" />

        {SPARKS.map((spark, index) => (
          <span
            key={index}
            data-motion="ballon-spark"
            style={{
              position: 'absolute',
              top: spark.top,
              left: spark.left,
              width: scaled(spark.size),
              height: scaled(spark.size),
              borderRadius: '50%',
              background: t.goldText,
              animationDelay: `${index * 320}ms`,
            }}
          />
        ))}

        <BallonTrophy />
      </div>

      {/* O degrade vive no envoltorio e o texto entra transparente: e assim
          que o reflexo atravessa as letras — o fundo do pai so e pintado onde
          existe glifo. */}
      <div
        data-motion="ballon-title"
        style={{
          marginTop: scaled(2),
          background: `linear-gradient(100deg, ${t.gold} 20%, oklch(99% 0.05 90) 42%, ${t.gold} 64%)`,
          backgroundSize: '260% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
        }}
      >
        <Display size={30} style={{ textAlign: 'center', color: 'transparent' }}>
          BOLA DE OURO
        </Display>
      </div>

      <div
        data-motion="ballon-line"
        style={{
          marginTop: scaled(6),
          fontSize: scaled(12),
          color: t.muted,
          textAlign: 'center',
        }}
      >
        {line}
      </div>

      {/* O que sustentou o voto. O premio e da temporada — mostrar a temporada
          e o que separa a cerimonia de um aviso generico. */}
      <div
        data-motion="ballon-line"
        style={{
          marginTop: scaled(12),
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: scaled(8),
          padding: `${scaled(10)} 0`,
          borderTop: `1px solid ${t.goldSoft}`,
          borderBottom: `1px solid ${t.goldSoft}`,
        }}
      >
        <CeremonyStat value={goals} label="GOLS" />
        <CeremonyStat value={assists} label="ASSIST." />
        <CeremonyStat value={titles} label="TÍTULOS" />
      </div>
    </>
  )
}

function CeremonyStat({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Display size={20} style={{ color: t.goldText }}>
        {value}
      </Display>
      <div
        style={{
          marginTop: scaled(2),
          fontSize: scaled(9),
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: t.faintText,
        }}
      >
        {label}
      </div>
    </div>
  )
}

/** A bola dourada no pedestal. Desenho proprio — o jogo nao usa imagem. */
function BallonTrophy() {
  return (
    <svg
      data-motion="ballon-trophy"
      viewBox="0 0 100 116"
      style={{ position: 'relative', width: scaled(96), height: scaled(112) }}
      aria-hidden
    >
      <defs>
        <radialGradient id="ballon-sphere" cx="36%" cy="30%" r="72%">
          <stop offset="0%" stopColor="oklch(97% 0.08 90)" />
          <stop offset="45%" stopColor="oklch(82% 0.15 78)" />
          <stop offset="100%" stopColor="oklch(52% 0.11 62)" />
        </radialGradient>
        <linearGradient id="ballon-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(74% 0.13 75)" />
          <stop offset="100%" stopColor="oklch(44% 0.08 60)" />
        </linearGradient>
      </defs>

      <ellipse cx="50" cy="110" rx="30" ry="5" fill="oklch(5% 0 0 / 0.45)" />
      <path d="M34 96 h32 l5 12 h-42 z" fill="url(#ballon-base)" />
      <rect x="44" y="82" width="12" height="16" rx="2" fill="url(#ballon-base)" />

      <circle cx="50" cy="46" r="38" fill="url(#ballon-sphere)" />

      {/* Os gomos da bola, no mesmo dourado escuro do sombreado. */}
      <g fill="none" stroke="oklch(40% 0.07 60 / 0.55)" strokeWidth="2.4">
        <path d="M50 14 l14 10 -5 17 h-18 l-5 -17 z" />
        <path d="M64 24 l16 5 M36 24 l-16 5 M41 41 l-9 16 M59 41 l9 16 M32 57 l7 17 M68 57 l-7 17 M39 74 h22" />
      </g>

      {/* O brilho especular: um arco claro no canto superior esquerdo. */}
      <path
        d="M28 26 a30 30 0 0 1 20 -12"
        fill="none"
        stroke="oklch(99% 0.03 90 / 0.75)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function overlayKey(overlay: Overlay): string {
  switch (overlay.type) {
    case 'award':
      return `award-${overlay.award}`
    case 'transfer':
      return `transfer-${overlay.clubId}`
  }
}

function Transfer({ game, clubId }: { game: Game; clubId: string }) {
  const club = clubById(clubId)
  const league = club ? leagueById(club.leagueId) : undefined
  const current = game.career ? clubById(game.career.clubId) : undefined

  // O jogador precisa saber se vai ser titular ou reserva antes de decidir.
  const risky = !!club && game.liveOverall < club.strength - 6

  // Fecha o ciclo do pedido feito ao empresario: quando a proposta vem de um
  // destino escolhido, o jogador precisa ver que foi por isso.
  const preferences = game.career?.preferences ?? []
  const asked = !!club && preferences.length > 0 && matchesPreference(club, preferences)

  return (
    <>
      <SectionLabel style={{ textAlign: 'center', fontWeight: 800, color: t.muted }}>
        PROPOSTA
      </SectionLabel>
      <ClubCrest clubId={club?.id} size={56} style={{ margin: `${scaled(10)} auto 0` }} />
      <Display size={24} style={{ marginTop: scaled(6), textAlign: 'center' }}>
        {club?.name}
      </Display>
      <div style={{ marginTop: scaled(6), fontSize: scaled(12), color: t.muted, textAlign: 'center' }}>
        {league?.name}
      </div>
      {asked && (
        <div
          style={{
            marginTop: scaled(6),
            fontSize: scaled(10),
            fontWeight: 800,
            color: t.goldText,
            textAlign: 'center',
          }}
        >
          ★ DESTINO QUE VOCÊ PEDIU
        </div>
      )}
      <div
        style={{
          marginTop: scaled(10),
          fontSize: scaled(11),
          color: risky ? t.dangerText : t.greenText,
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        {risky
          ? 'Elenco acima do seu nível — você pode ficar no banco.'
          : 'Você deve ser titular nesse elenco.'}
      </div>
      <div style={{ marginTop: scaled(4), fontSize: scaled(10), color: t.faintText, textAlign: 'center' }}>
        Hoje no {current?.name}
      </div>

      <div
        style={{ marginTop: scaled(16), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: scaled(8) }}
      >
        <GhostButton onClick={game.declineTransfer}>FICAR</GhostButton>
        <GhostButton
          onClick={game.acceptTransfer}
          style={{ background: t.accent, border: 'none', color: 'white' }}
        >
          ACEITAR
        </GhostButton>
      </div>
    </>
  )
}
