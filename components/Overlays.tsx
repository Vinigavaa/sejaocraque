import type { Game, Overlay } from '@/lib/game/useGame'
import type { SeasonRecord } from '@/lib/sim/career'
import { AWARD_LABEL, type Award } from '@/lib/sim/awards'

import type { SeasonTitle } from '@/lib/sim/history'

import { Display, GhostButton, scaled, SectionLabel, t } from './shared'
import { Trophy } from './Trophy'

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
        {overlay.type === 'title' && (
          <Title
            game={game}
            title={overlay.title}
            teamName={overlay.teamName}
            season={overlay.season}
          />
        )}
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

/**
 * A volta olimpica.
 *
 * A taça é a da competição de verdade — imagem baixada em
 * `scripts/fetch-badges.ts` — e não um desenho genérico: o que faz o momento
 * valer é reconhecer qual troféu está na mão. Quando a competição não tem
 * imagem baixada, o painel continua funcionando sem ela.
 */
function Title({
  game,
  title,
  teamName,
  season,
}: {
  game: Game
  title: SeasonTitle
  teamName: string
  season: string
}) {
  return (
    <>
      <SectionLabel style={{ textAlign: 'center', fontWeight: 800, color: t.gold }}>
        {title.scope === 'selecao' ? 'TÍTULO PELA SELEÇÃO' : 'TÍTULO'}
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

        <div data-motion="ballon-trophy" style={{ position: 'relative' }}>
          <Trophy competitionId={title.imageId} size={130} />
        </div>
      </div>

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
        <Display size={24} style={{ textAlign: 'center', color: 'transparent' }}>
          {title.name.toUpperCase()}
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
        {teamName} · {season}
      </div>

      <div
        data-motion="ballon-line"
        style={{
          marginTop: scaled(4),
          fontSize: scaled(13),
          fontWeight: 800,
          color: t.goldText,
          textAlign: 'center',
        }}
      >
        CAMPEÃO
      </div>

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

/**
 * A Bola de Ouro no pedestal.
 *
 * A imagem nao vem do `fetch-badges.ts` como as outras tacas: a Bola de Ouro
 * nao e liga nem competicao, e por isso nao existe no TheSportsDB. Ela e um
 * arquivo proprio do projeto, e fica fora de `badges/trophies/` — aquela pasta
 * e escrita pelo script, e misturar as duas coisas esconderia qual arquivo
 * some quando alguem roda o download de novo.
 */
const BALLON_IMAGE = '/badges/bola-de-ouro.png'

function BallonTrophy() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-motion="ballon-trophy"
      src={BALLON_IMAGE}
      alt=""
      aria-hidden
      style={{
        position: 'relative',
        display: 'block',
        width: scaled(112),
        height: scaled(118),
        objectFit: 'contain',
        // A foto vem em fundo transparente; a sombra descola a bola do palco.
        filter: 'drop-shadow(0 6px 16px oklch(5% 0 0 / 0.55))',
      }}
    />
  )
}

function overlayKey(overlay: Overlay): string {
  switch (overlay.type) {
    case 'award':
      return `award-${overlay.award}`
    case 'title':
      return `title-${overlay.title.imageId}`
  }
}
