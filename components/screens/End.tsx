'use client'

import { useState } from 'react'

import type { Game } from '@/lib/game/useGame'
import { clubById } from '@/lib/sim/data/clubs'
import { careerTotals, ladderLabel, ladderRung, LADDER_LABELS } from '@/lib/sim/ladder'
import { POSITION_LABEL } from '@/lib/sim/types'

import { ClubCrest } from '../Crest'
import { ScreenLayout } from '../ScreenLayout'
import { Display, GhostButton, PrimaryButton, scaled, SectionLabel, Stat, t } from '../shared'

export function End({ game }: { game: Game }) {
  const career = game.career
  const [copied, setCopied] = useState(false)

  if (!career) return null

  const totals = careerTotals(career)
  const rung = ladderRung(totals)
  const label = ladderLabel(totals)

  const share = async () => {
    const text =
      `${career.config.name} — ${label}\n` +
      `${totals.goals} gols · ${totals.titles} títulos · ${totals.ballonDOrs} bolas de ouro\n` +
      `CRAQUE · seed ${career.config.seed}`

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard bloqueado (contexto não seguro, permissão negada). O card
      // segue na tela para print, que é como o compartilhamento acontece.
      setCopied(false)
    }
  }

  return (
    <ScreenLayout
      mobileOrder={['center', 'right', 'left']}
      left={
        <>
      <SectionLabel >Retrospecto</SectionLabel>
          <div style={{ marginTop: scaled(8), display: 'flex', flexDirection: 'column' }}>
            {career.seasons.map((season) => (
              <div
                key={season.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: scaled(11),
                  padding: `${scaled(6)} ${scaled(2)}`,
                  borderBottom: `1px solid oklch(95% 0.01 70 / 0.1)`,
                  gap: scaled(8),
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: scaled(6),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <ClubCrest clubId={season.clubId} size={14} />
                  {season.label} · {season.age}a · {clubById(season.clubId)?.name}
                </div>
                <div style={{ whiteSpace: 'nowrap', color: t.muted }}>
                  {season.stats.matches}j {season.stats.goals}g {season.stats.rating.toFixed(1)}
                </div>
              </div>
            ))}
          </div>

        </>
      }
      right={
        <>
      <SectionLabel >Classificação</SectionLabel>
          <div
            style={{ marginTop: scaled(8), display: 'flex', flexDirection: 'column-reverse', gap: scaled(4) }}
          >
            {LADDER_LABELS.map((rungLabel, index) => {
              const number = index + 1
              const reached = number <= rung
              const current = number === rung

              return (
                <div
                  key={rungLabel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: scaled(10),
                    padding: `${scaled(8)} ${scaled(12)}`,
                    borderRadius: 6,
                    background: current ? t.accentSoft : 'transparent',
                    opacity: reached ? 1 : 0.35,
                    border: `2px solid ${current ? t.accent : 'transparent'}`,
                  }}
                >
                  <Display size={14} style={{ width: 22 }}>
                    {number}
                  </Display>
                  <div style={{ fontSize: scaled(13), fontWeight: current ? 800 : 500 }}>{rungLabel}</div>
                </div>
              )
            })}
          </div>

          <SectionLabel style={{ marginTop: scaled(24) }}>Números da carreira</SectionLabel>
          <div
            style={{
              marginTop: scaled(10),
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: scaled(12),
            }}
          >
            <Stat value={totals.goals} label="gols" />
            <Stat value={totals.assists} label="assist." />
            <Stat value={totals.matches} label="jogos" />
            <Stat value={totals.titles} label="títulos" />
            <Stat value={totals.ballonDOrs} label="bolas de ouro" />
            <Stat value={totals.clubs} label="clubes" />
          </div>

        </>
      }
    >
      <SectionLabel>FIM DE CARREIRA</SectionLabel>
      <Display size={26} style={{ marginTop: scaled(6) }}>
        {career.config.name}
      </Display>

      <SectionLabel style={{ marginTop: scaled(28) }}>Card de compartilhamento</SectionLabel>
      <div
        style={{
          marginTop: scaled(8),
          background: t.shareBg,
          color: t.text,
          borderRadius: 12,
          padding: `${scaled(28)} ${scaled(20)}`,
          textAlign: 'center',
          aspectRatio: '9 / 14',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: scaled(11),
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'oklch(78% 0.17 50)',
          }}
        >
          {label}
        </div>
        <Display size={44} style={{ marginTop: scaled(12), lineHeight: 1.05 }}>
          {career.config.name}
        </Display>
        <div style={{ marginTop: scaled(4), fontSize: scaled(13), color: 'oklch(65% 0.02 70)' }}>
          {POSITION_LABEL[career.config.position]} · OVR {game.peakOverall}
        </div>

        <div style={{ marginTop: scaled(24), display: 'flex', justifyContent: 'center', gap: scaled(20) }}>
          {[
            { value: totals.goals, label: 'gols' },
            { value: totals.titles, label: 'títulos' },
            { value: totals.ballonDOrs, label: 'bolas de ouro' },
          ].map((item) => (
            <div key={item.label}>
              <Display size={22}>{item.value}</Display>
              <div
                style={{
                  fontSize: scaled(8),
                  color: 'oklch(65% 0.02 70)',
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: scaled(24),
            fontSize: scaled(10),
            letterSpacing: '0.1em',
            color: 'oklch(50% 0.02 70)',
          }}
        >
          CRAQUE
        </div>
      </div>

      {copied && (
        <div style={{ marginTop: scaled(8), textAlign: 'center', fontSize: scaled(11), color: t.muted }}>
          Copiado!
        </div>
      )}

      <GhostButton onClick={share} style={{ marginTop: scaled(16), padding: scaled(16) }}>
        COMPARTILHAR
      </GhostButton>
      <GhostButton onClick={game.openHistory} style={{ marginTop: scaled(8) }}>
        VER HISTÓRICO
      </GhostButton>
      <PrimaryButton onClick={game.reset} style={{ marginTop: scaled(8) }}>
        JOGAR DE NOVO
      </PrimaryButton>
    </ScreenLayout>
  )
}
