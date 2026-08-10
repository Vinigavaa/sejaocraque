'use client'

import { useEffect } from 'react'

import type { Game } from '@/lib/game/useGame'
import { MATCH_MINUTES } from '@/lib/sim/liveMatch'

import { ClubCrest } from '../Crest'
import { PlayerSheet } from '../PlayerSheet'
import { ScreenLayout } from '../ScreenLayout'
import { Display, GhostButton, PrimaryButton, scaled, SectionLabel, Stat, t } from '../shared'

/**
 * Ritmo da partida jogada.
 *
 * Mais lento que a reprise do modo classico (190ms por minuto) de proposito:
 * aqui o jogador precisa ler o que acontece antes de decidir, e um lance que
 * passa rapido demais vira ruido. Com 3 a 6 decisoes, a partida inteira leva
 * de dois a quatro minutos.
 */
const STEP_MS = 620

export function Live({ game }: { game: Game }) {
  const live = game.live

  // O relógio só corre quando não há decisão na mesa: um momento aberto
  // congela a partida até a escolha, que é a razão de o modo existir.
  const running = Boolean(live) && !live?.pending && !live?.finished

  // A dependência é a função, e não `game`: o hook devolve um objeto novo a
  // cada render, e depender dele derrubava e recriava o relógio a cada lance.
  const { advanceLive } = game

  useEffect(() => {
    if (!running) return

    const timer = setInterval(advanceLive, STEP_MS)
    return () => clearInterval(timer)
  }, [running, advanceLive])

  if (!live) return null

  const { setup, player } = live
  const events = [...live.events].reverse()

  return (
    <ScreenLayout
      mobileOrder={['center', 'left', 'right']}
      right={<PlayerSheet game={game} />}
      left={
        <>
          <SectionLabel>Lances</SectionLabel>
          <div
            style={{
              marginTop: scaled(8),
              display: 'flex',
              flexDirection: 'column',
              gap: scaled(6),
            }}
          >
            {events.length === 0 && (
              <div style={{ fontSize: scaled(12), color: t.faintText }}>Bola rolando…</div>
            )}
            {events.map((event, index) => (
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
      <SectionLabel>
        {setup.competition} · {setup.stage ?? `${setup.round}ª rodada`}
      </SectionLabel>
      <Display size={22} style={{ marginTop: scaled(4) }}>
        {setup.atHome ? 'EM CASA' : 'FORA DE CASA'}
      </Display>

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
            {setup.team.name}
            <ClubCrest clubId={setup.team.clubId ?? undefined} size={26} />
          </div>
          <Display size={38} style={{ letterSpacing: '0.02em' }}>
            {live.teamGoals}–{live.opponentGoals}
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
            <ClubCrest clubId={setup.opponent.clubId ?? undefined} size={26} />
            {setup.opponent.name}
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
          {live.finished ? 'FIM DE JOGO' : `${live.minute}'`}
        </div>

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
              width: `${(live.minute / MATCH_MINUTES) * 100}%`,
              height: '100%',
              background: t.accent,
            }}
          />
        </div>
      </div>

      {/* A sua partida, separada da do time: é ela que vira nota, estatística
          e notícia no fim. */}
      <div
        style={{
          marginTop: scaled(14),
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: scaled(8),
        }}
      >
        <Stat value={player.goals} label="Gols" size={20} />
        <Stat value={player.assists} label="Assist." size={20} />
        <Stat
          value={live.finished && player.played ? player.rating.toFixed(1) : '—'}
          label="Nota"
          size={20}
        />
        <Stat value={statusOf(live)} label="Situação" size={20} />
      </div>

      {live.pending ? (
        <div
          data-motion="event"
          style={{
            marginTop: scaled(16),
            border: `2px solid ${t.accent}`,
            borderRadius: 8,
            background: t.card,
            padding: scaled(16),
          }}
        >
          <SectionLabel>{live.minute}&apos; · sua decisão</SectionLabel>
          <div
            style={{
              marginTop: scaled(8),
              fontSize: scaled(14),
              lineHeight: 1.45,
              fontWeight: 600,
            }}
          >
            {live.pending.prompt}
          </div>

          <div
            style={{
              marginTop: scaled(14),
              display: 'flex',
              flexDirection: 'column',
              gap: scaled(8),
            }}
          >
            {live.pending.options.map((option, index) => (
              <button
                key={option.label}
                onClick={() => game.chooseLive(index)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: `2px solid ${t.line}`,
                  borderRadius: 6,
                  padding: scaled(12),
                  color: t.text,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: scaled(10),
                  }}
                >
                  <div style={{ fontSize: scaled(14), fontWeight: 800 }}>{option.label}</div>
                  {/* A chance aparece porque a decisão precisa ser informada:
                      arriscar tem que ser escolha, não surpresa. A opção sem
                      risco não mostra número — anunciar "100%" só sugeriria
                      que existe um sorteio ali. */}
                  {option.chance < 1 && (
                    <Display size={14} style={{ color: chanceColor(option.chance) }}>
                      {Math.round(option.chance * 100)}%
                    </Display>
                  )}
                </div>
                <div
                  style={{
                    marginTop: scaled(4),
                    fontSize: scaled(11),
                    color: t.mutedStrong,
                    lineHeight: 1.4,
                  }}
                >
                  {option.detail}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        !live.finished && (
          <div
            style={{
              marginTop: scaled(16),
              fontSize: scaled(11),
              color: t.faintText,
              textAlign: 'center',
            }}
          >
            {live.onPitch
              ? 'Você está em campo. O jogo para quando algo depender de você.'
              : 'No banco, esperando o treinador.'}
          </div>
        )
      )}

      <div style={{ flex: 1, minHeight: 16 }} />

      {live.finished ? (
        <PrimaryButton onClick={game.finishLive} style={{ marginTop: scaled(16) }}>
          FIM DE JOGO →
        </PrimaryButton>
      ) : (
        <GhostButton onClick={game.skipLive} style={{ marginTop: scaled(16) }}>
          SIMULAR O RESTO
        </GhostButton>
      )}
    </ScreenLayout>
  )
}

function statusOf(live: NonNullable<Game['live']>): string {
  if (live.player.red) return 'EXP.'
  if (live.player.injured) return 'LES.'
  if (!live.player.played) return 'BANCO'
  if (!live.onPitch) return 'SUBST.'
  return `${live.player.yellow > 0 ? 'AMAR.' : 'EM CAMPO'}`
}

function chanceColor(chance: number): string {
  if (chance >= 0.6) return t.greenText
  if (chance >= 0.35) return t.goldText
  return t.dangerText
}
