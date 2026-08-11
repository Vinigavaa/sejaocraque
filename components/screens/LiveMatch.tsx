'use client'

import { useEffect, useState } from 'react'

import type { Game } from '@/lib/game/useGame'
import { MATCH_MINUTES, type LiveEvent } from '@/lib/sim/liveMatch'

import { ClubCrest } from '../Crest'
import { ScreenLayout } from '../ScreenLayout'
import { Display, GhostButton, PrimaryButton, scaled, SectionLabel, t } from '../shared'

/** ~17 segundos para os 90 minutos. Rápido o bastante para não cansar. */
const MINUTE_MS = 190

export function LiveMatch({ game }: { game: Game }) {
  const match = game.lastRecord?.decisive
  const events = game.decisiveTimeline
  const { minute, done, skip } = useClock()

  if (!match) return null

  const shown = events.filter((event) => event.minute <= minute)
  const teamGoals = countGoals(shown, 'team')
  const opponentGoals = countGoals(shown, 'opponent')

  return (
    <ScreenLayout
      mobileOrder={['center', 'left', 'right']}
      left={
        <>
      <SectionLabel >Lances</SectionLabel>
          <div style={{ marginTop: scaled(8), display: 'flex', flexDirection: 'column', gap: scaled(6) }}>
            {shown.length === 0 && (
              <div style={{ fontSize: scaled(12), color: t.faintText }}>Bola rolando…</div>
            )}
            {[...shown].reverse().map((event, index) => (
              <div
                key={`${event.minute}-${index}`}
                data-motion="event"
                style={{
                  display: 'flex',
                  gap: scaled(10),
                  alignItems: 'baseline',
                  padding: `${scaled(7)} ${scaled(10)}`,
                  borderRadius: 6,
                  background: event.byPlayer ? t.accentSoft : t.card,
                  border: `1px solid ${event.type === 'gol' ? t.line : 'transparent'}`,
                }}
              >
                <Display size={13} style={{ width: 28, color: t.mutedStrong }}>
                  {event.minute}&apos;
                </Display>
                <div
                  style={{
                    fontSize: scaled(12),
                    lineHeight: 1.4,
                    fontWeight: event.type === 'gol' ? 700 : 400,
                    color: event.type === 'gol' ? t.text : t.mutedStrong,
                  }}
                >
                  {event.text}
                </div>
              </div>
            ))}
          </div>

        </>
      }
    >
      <SectionLabel>{match.competition}</SectionLabel>
      <Display size={22} style={{ marginTop: scaled(4) }}>
        {match.stage.toUpperCase()}
      </Display>
      <div style={{ marginTop: scaled(4), fontSize: scaled(10), color: t.faintText, lineHeight: 1.4 }}>
        A reprise do jogo que fechou a temporada. O resultado já está decidido.
      </div>

      <div
        style={{
          marginTop: scaled(16),
          border: `2px solid ${t.line}`,
          borderRadius: 8,
          background: t.card,
          padding: scaled(18),
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: scaled(10),
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: scaled(8),
              fontSize: scaled(13),
              fontWeight: 800,
              textAlign: 'right',
            }}
          >
            {match.teamName}
            <ClubCrest clubId={match.teamClubId ?? undefined} size={26} />
          </div>
          <Display size={38} style={{ letterSpacing: '0.02em' }}>
            {teamGoals}–{opponentGoals}
          </Display>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: scaled(8),
              fontSize: scaled(13),
              color: t.mutedStrong,
            }}
          >
            <ClubCrest clubId={match.opponentClubId ?? undefined} size={26} />
            {match.opponentName}
          </div>
        </div>

        <div
          style={{
            marginTop: scaled(12),
            textAlign: 'center',
            fontSize: scaled(11),
            color: t.muted,
            letterSpacing: '0.08em',
          }}
        >
          {done ? 'FIM DE JOGO' : `${minute}'`}
        </div>

        {/* A barra é o relógio: dá a noção de quanto falta sem precisar ler. */}
        <div
          style={{
            marginTop: scaled(8),
            height: 3,
            borderRadius: 999,
            background: t.line,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(minute / MATCH_MINUTES) * 100}%`,
              height: '100%',
              background: t.accent,
            }}
          />
        </div>
      </div>

      {!match.played && (
        <div
          style={{
            marginTop: scaled(12),
            fontSize: scaled(11),
            color: t.mutedStrong,
            textAlign: 'center',
          }}
        >
          Você não esteve em campo nesse jogo.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 16 }} />

      {done ? (
        <PrimaryButton onClick={game.finishMatch} style={{ marginTop: scaled(16) }}>
          RESUMO DA TEMPORADA →
        </PrimaryButton>
      ) : (
        <GhostButton onClick={skip} style={{ marginTop: scaled(16) }}>
          PULAR PARA O RESULTADO
        </GhostButton>
      )}
    </ScreenLayout>
  )
}

/**
 * O relógio da partida.
 *
 * Usa `setInterval`, não `requestAnimationFrame`: rAF não dispara em aba que
 * não está compondo quadros, e isso já travou um contador em zero antes. Com
 * movimento reduzido a partida chega pronta, num único passo.
 */
function useClock() {
  const [tick, setTick] = useState(0)
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    if (skipped) return

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // Um passo só cobre o caso sem animação, evitando setState síncrono aqui.
    const step = reduceMotion ? MATCH_MINUTES : 1
    let current = 0

    const interval = setInterval(
      () => {
        current = Math.min(MATCH_MINUTES, current + step)
        setTick(current)
        if (current >= MATCH_MINUTES) clearInterval(interval)
      },
      reduceMotion ? 0 : MINUTE_MS,
    )

    return () => clearInterval(interval)
  }, [skipped])

  const minute = skipped ? MATCH_MINUTES : tick

  return { minute, done: minute >= MATCH_MINUTES, skip: () => setSkipped(true) }
}

function countGoals(events: LiveEvent[], side: LiveEvent['side']): number {
  return events.filter((event) => event.type === 'gol' && event.side === side).length
}
