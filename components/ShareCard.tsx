import { bestSeason, type SeasonHighlight } from '@/lib/game/shareText'
import type { CareerState } from '@/lib/sim/career'
import { trophyCase } from '@/lib/sim/history'
import { careerTotals, ladderLabel } from '@/lib/sim/ladder'
import { ATTR_LABEL, NUMERIC_ATTRS, POSITION_LABEL, type NumericAttr } from '@/lib/sim/types'

import { ClubCrest } from './Crest'
import { Flag } from './Flag'
import { Display, scaled, t } from './shared'

/**
 * O card de fim de carreira, feito para virar print.
 *
 * E a unica peca do jogo que sai da tela: o compartilhamento acontece por
 * captura, entao tudo que resume a carreira precisa caber aqui dentro, sem
 * rolagem e sem interacao. Nada e calculado de novo — cada bloco le o que o
 * motor ja registrou em `state.seasons`.
 *
 * A moldura em degrade dourado e o unico ornamento: fora dela valem os mesmos
 * tokens das outras telas, para o card parecer o jogo e nao um cartaz a parte.
 */
export function ShareCard({
  career,
  peakOverall,
}: {
  career: CareerState
  peakOverall: number
}) {
  const totals = careerTotals(career)
  const seasons = career.seasons
  const trophies = trophyCase(career).slice(0, 4)
  const best = bestSeason(career)

  const firstAge = seasons[0]?.age ?? career.age
  const lastAge = seasons[seasons.length - 1]?.age ?? career.age
  const peakValue = seasons.reduce((top, season) => Math.max(top, season.marketValue), 0)

  return (
    <div
      style={{
        borderRadius: 14,
        padding: 2,
        background: `linear-gradient(160deg, ${t.gold}, ${t.accent} 45%, ${t.line})`,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          background: `radial-gradient(120% 80% at 50% 0%, oklch(18% 0.03 55), ${t.shareBg} 70%)`,
          padding: `${scaled(18)} ${scaled(18)} ${scaled(14)}`,
          display: 'flex',
          flexDirection: 'column',
          gap: scaled(14),
          textAlign: 'left',
        }}
      >
        <Header career={career} />
        <Hero career={career} peakOverall={peakOverall} label={ladderLabel(totals)} />

        <Meta
          fintas={career.peakAttrs.fintas}
          pernaRuim={career.peakAttrs.pernaRuim}
          ages={[firstAge, lastAge]}
          peakValue={peakValue}
        />

        <Attrs attrs={career.peakAttrs} />

        {totals.titles + totals.ballonDOrs + totals.goldenBoots + totals.worldCups > 0 && (
          <Honours totals={totals} />
        )}

        <Totals
          matches={totals.matches}
          goals={totals.goals}
          assists={totals.assists}
          seasons={seasons.length}
        />

        {seasons.length > 1 && <Curve career={career} best={best} />}

        {trophies.length > 0 && (
          <Chips items={trophies.map((trophy) => `${trophy.name} ${trophy.count}×`)} />
        )}

        <Footer clubIds={clubIds(career)} clubs={totals.clubs} />
      </div>
    </div>
  )
}

function Header({ career }: { career: CareerState }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(7) }}>
        <Flag nationality={career.config.nationality} size={12} />
        <Display size={13} style={{ letterSpacing: '0.04em' }}>
          CRAQUE
        </Display>
      </div>
      <div
        style={{
          border: `1px solid ${t.accent}`,
          color: t.gold,
          borderRadius: 999,
          padding: `${scaled(3)} ${scaled(9)}`,
          fontSize: scaled(9),
          fontWeight: 800,
          letterSpacing: '0.1em',
        }}
      >
        {career.config.position}
      </div>
    </div>
  )
}

function Hero({
  career,
  peakOverall,
  label,
}: {
  career: CareerState
  peakOverall: number
  label: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: scaled(14) }}>
      <OverallRing value={peakOverall} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: scaled(6),
            color: t.muted,
            fontSize: scaled(11),
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              color: t.text,
              fontWeight: 800,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {career.config.name}
          </span>
          <span>#{career.config.shirtNumber}</span>
        </div>
        <Display
          size={26}
          style={{
            marginTop: scaled(4),
            color: t.gold,
            lineHeight: 1.05,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Display>
        <div style={{ marginTop: scaled(4), fontSize: scaled(10), color: t.faintText }}>
          {POSITION_LABEL[career.config.position]}
        </div>
      </div>
    </div>
  )
}

/**
 * O OVR de auge dentro de um anel que se fecha na proporcao do valor.
 *
 * O SVG desenha em coordenadas fixas e escala pelo `width` — assim o anel
 * acompanha a escala de interface sem recalcular raio nem tracejado.
 */
function OverallRing({ value }: { value: number }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius

  return (
    <div style={{ position: 'relative', width: scaled(78), height: scaled(78), flexShrink: 0 }}>
      <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%', display: 'block' }}>
        <circle cx="40" cy="40" r={radius} fill="none" stroke={t.faint} strokeWidth="5" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={t.gold}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * value) / 99} ${circumference}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: scaled(8),
            color: t.muted,
            letterSpacing: '0.1em',
          }}
        >
          GERAL
        </div>
        <Display size={28}>{value}</Display>
      </div>
    </div>
  )
}

function Meta({
  fintas,
  pernaRuim,
  ages,
  peakValue,
}: {
  fintas: number
  pernaRuim: number
  ages: [number, number]
  peakValue: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scaled(8),
        borderTop: `1px solid ${t.lineSoft}`,
        borderBottom: `1px solid ${t.lineSoft}`,
        padding: `${scaled(8)} 0`,
        fontSize: scaled(10),
        color: t.muted,
        letterSpacing: '0.04em',
      }}
    >
      <span>
        FINTAS <span style={{ color: t.gold }}>{stars(fintas)}</span>
      </span>
      <span>
        PR <span style={{ color: t.gold }}>{stars(pernaRuim)}</span>
      </span>
      <span>
        {ages[0]}–{ages[1]} ANOS
      </span>
      <span style={{ color: t.text, fontWeight: 800 }}>€{peakValue}M</span>
    </div>
  )
}

function Attrs({ attrs }: { attrs: Record<NumericAttr, number> }) {
  return (
    <div style={{ display: 'flex', gap: scaled(6) }}>
      {NUMERIC_ATTRS.map((attr) => {
        const value = attrs[attr]

        return (
          <div key={attr} style={{ flex: 1, minWidth: 0 }}>
            <Display size={22} style={{ color: value >= 90 ? t.gold : t.text }}>
              {value}
            </Display>
            <div
              style={{
                marginTop: scaled(3),
                fontSize: scaled(8),
                color: t.muted,
                letterSpacing: '0.06em',
              }}
            >
              {ATTR_LABEL[attr].short}
            </div>
            <div style={{ marginTop: scaled(4), height: 2, background: t.faint }}>
              <div
                style={{
                  width: `${value}%`,
                  height: '100%',
                  background: value >= 90 ? t.gold : t.accent,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * So o que a carreira de fato conquistou: linha vazia nao entra no card.
 *
 * Cada item vem escrito. So o icone nao serve: 🥇 e 🏆 lado a lado, sem nome,
 * nao dizem qual e a Bola de Ouro — e ela e justamente o premio que decide o
 * topo da escada.
 */
function Honours({
  totals,
}: {
  totals: { titles: number; ballonDOrs: number; goldenBoots: number; worldCups: number }
}) {
  const items = [
    { icon: '🏆', count: totals.titles, label: totals.titles === 1 ? 'título' : 'títulos' },
    {
      icon: '🌍',
      count: totals.worldCups,
      label: totals.worldCups === 1 ? 'copa do mundo' : 'copas do mundo',
    },
    {
      icon: '🥇',
      count: totals.ballonDOrs,
      label: totals.ballonDOrs === 1 ? 'bola de ouro' : 'bolas de ouro',
    },
    {
      icon: '👟',
      count: totals.goldenBoots,
      label: totals.goldenBoots === 1 ? 'chuteira de ouro' : 'chuteiras de ouro',
    },
  ].filter((item) => item.count > 0)

  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', gap: scaled(6) }}>
      {items.map((item) => (
        <div key={item.label} style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: scaled(18), lineHeight: 1 }}>{item.icon}</div>
          <Display size={15} style={{ marginTop: scaled(4), color: t.gold }}>
            {item.count}
          </Display>
          <div
            style={{
              marginTop: scaled(2),
              fontSize: scaled(8),
              color: t.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1.2,
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function Totals({
  matches,
  goals,
  assists,
  seasons,
}: {
  matches: number
  goals: number
  assists: number
  seasons: number
}) {
  const items = [
    { value: matches, label: 'jogos', gold: false },
    { value: goals, label: 'gols', gold: true },
    { value: assists, label: 'assist.', gold: false },
    { value: seasons, label: 'temps.', gold: false },
  ]

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: scaled(8),
        background: t.faint,
        borderRadius: 8,
        padding: `${scaled(10)} ${scaled(12)}`,
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          <Display size={20} style={{ color: item.gold ? t.gold : t.text }}>
            {item.value}
          </Display>
          <div
            style={{
              marginTop: scaled(2),
              fontSize: scaled(8),
              color: t.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

/** A linha do OVR temporada a temporada, com a melhor delas escrita embaixo. */
function Curve({ career, best }: { career: CareerState; best: SeasonHighlight | null }) {
  const values = career.seasons.map((season) => season.overall)
  const floor = Math.min(...values)
  const ceiling = Math.max(...values)
  const span = Math.max(1, ceiling - floor)

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100
      const y = 30 - ((value - floor) / span) * 26
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <div>
      <div
        style={{
          fontSize: scaled(9),
          color: t.faintText,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Temporada a temporada
      </div>
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        style={{ width: '100%', height: scaled(36), display: 'block', marginTop: scaled(6) }}
      >
        <polyline
          points={points}
          fill="none"
          stroke={t.gold}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {best && (
        <div style={{ marginTop: scaled(6), fontSize: scaled(10), color: t.mutedStrong }}>
          <span style={{ color: t.gold }}>★</span> {best.label} · {best.rating.toFixed(1)} ·{' '}
          {best.goals}G {best.assists}A · {best.club}
        </div>
      )}
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: scaled(6) }}>
      {items.map((item) => (
        <div
          key={item}
          style={{
            border: `1px solid ${t.goldSoft}`,
            color: t.goldText,
            borderRadius: 999,
            padding: `${scaled(4)} ${scaled(9)}`,
            fontSize: scaled(9),
            fontWeight: 700,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

function Footer({ clubIds, clubs }: { clubIds: string[]; clubs: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scaled(8),
        borderTop: `1px solid ${t.lineSoft}`,
        paddingTop: scaled(10),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(4) }}>
        {clubIds.map((clubId) => (
          <ClubCrest key={clubId} clubId={clubId} size={16} />
        ))}
      </div>
      <div style={{ fontSize: scaled(9), color: t.faintText, letterSpacing: '0.08em' }}>
        {clubs} {clubs === 1 ? 'CLUBE' : 'CLUBES'}
      </div>
    </div>
  )
}

/** Os clubes da carreira, na ordem em que apareceram, sem repetir. */
function clubIds(career: CareerState): string[] {
  return [...new Set(career.seasons.map((season) => season.clubId))]
}

function stars(value: number): string {
  return '★'.repeat(value) + '☆'.repeat(5 - value)
}
