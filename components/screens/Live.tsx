'use client'

import { useEffect } from 'react'

import type { Game } from '@/lib/game/useGame'
import {
  FOCUS_DETAIL,
  FOCUS_LABEL,
  MATCH_FOCUSES,
  type MatchFocus,
} from '@/lib/sim/liveFocus'
import { MATCH_MINUTES } from '@/lib/sim/liveMatch'
import type { TimingOutcome } from '@/lib/sim/liveTiming'

import { ClubCrest } from '../Crest'
import { PlayerSheet } from '../PlayerSheet'
import { ScreenLayout } from '../ScreenLayout'
import { Display, GhostButton, PrimaryButton, scaled, SectionLabel, Stat, t } from '../shared'
import { TimingBar } from '../TimingBar'

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

  // O relógio só corre quando nada depende do jogador: decisão aberta, barra
  // de timing correndo, apito inicial e intervalo congelam a partida — é a
  // razão de o modo existir.
  const running =
    Boolean(live) &&
    !live?.opportunity &&
    !live?.timing &&
    !live?.kickoff &&
    !live?.halftime &&
    !live?.finished

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

      {(live.kickoff || live.halftime) && (
        <FocusPanel
          title={live.kickoff ? 'Antes do apito' : `Intervalo · ${live.minute}'`}
          focus={live.focus}
          locked={live.halftime && live.focusChanged}
          onChoose={game.chooseFocus}
          onConfirm={live.kickoff ? game.kickOffLive : game.resumeLive}
          confirmLabel={live.kickoff ? 'COMEÇAR A PARTIDA →' : 'VOLTAR PARA O SEGUNDO TEMPO →'}
        />
      )}

      {live.opportunity && (
        <div
          data-motion="event"
          style={{
            marginTop: scaled(16),
            border: `2px solid ${t.accent}`,
            borderRadius: 8,
            background: t.card,
            padding: scaled(16),
            textAlign: 'center',
          }}
        >
          <SectionLabel>{live.minute}&apos;</SectionLabel>
          <Display size={26} style={{ marginTop: scaled(6), color: t.accent }}>
            {live.opportunity.kind === 'finalizacao'
              ? 'CHANCE DE GOL'
              : 'CHANCE DE ASSISTÊNCIA'}
          </Display>
          <div
            style={{
              marginTop: scaled(8),
              fontSize: scaled(13),
              lineHeight: 1.45,
              color: t.mutedStrong,
            }}
          >
            {live.opportunity.prompt}
          </div>

          <PrimaryButton onClick={game.startTiming} style={{ marginTop: scaled(14) }}>
            CONTINUAR →
          </PrimaryButton>
        </div>
      )}

      {live.timing && (
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
          <TimingBar
            challenge={live.timing.challenge}
            label={live.timing.kind === 'finalizacao' ? 'FINALIZAR' : 'PASSAR'}
            onHit={game.resolveTiming}
            onExpire={game.expireTiming}
          />
          <div
            style={{
              marginTop: scaled(8),
              fontSize: scaled(11),
              color: t.mutedStrong,
              lineHeight: 1.4,
            }}
          >
            {live.timing.kind === 'finalizacao'
              ? 'Acerte a trave para mandar no canto. Quanto mais no meio, melhor a finalização.'
              : 'Acerte a bola para o passe sair na medida. Quanto mais no meio, melhor o passe.'}
          </div>
        </div>
      )}

      {!live.opportunity &&
        !live.timing &&
        !live.finished &&
        !live.kickoff &&
        !live.halftime && (
          <div
            style={{
              marginTop: scaled(16),
              fontSize: scaled(11),
              color: t.faintText,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {live.lastTiming && <TimingFeedback outcome={live.lastTiming} />}
            <div>
              {live.onPitch
                ? `Foco: ${FOCUS_LABEL[live.focus]}. O jogo para quando a bola for sua.`
                : 'Você saiu da partida. O resto do jogo corre sem você.'}
            </div>
          </div>
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

/**
 * A escolha do foco, antes do apito e no intervalo.
 *
 * É o único lugar onde ela acontece. Deixar trocar durante o jogo faria do
 * foco um botão de otimização — bastava mudar para Ataque assim que a chance
 * aparecesse na tela, e a leitura de jogo deixaria de existir.
 */
function FocusPanel({
  title,
  focus,
  locked,
  onChoose,
  onConfirm,
  confirmLabel,
}: {
  title: string
  focus: MatchFocus
  locked: boolean
  onChoose: (focus: MatchFocus) => void
  onConfirm: () => void
  confirmLabel: string
}) {
  return (
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
      <SectionLabel>{title} · foco tático</SectionLabel>

      <div
        style={{
          marginTop: scaled(10),
          display: 'flex',
          flexDirection: 'column',
          gap: scaled(8),
        }}
      >
        {MATCH_FOCUSES.map((option) => {
          const active = option === focus

          return (
            <button
              key={option}
              onClick={() => onChoose(option)}
              disabled={locked && !active}
              style={{
                textAlign: 'left',
                background: active ? t.accentSoft : 'transparent',
                border: `2px solid ${active ? t.accent : t.line}`,
                borderRadius: 6,
                padding: scaled(11),
                color: t.text,
                cursor: locked && !active ? 'default' : 'pointer',
                opacity: locked && !active ? 0.4 : 1,
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: scaled(14), fontWeight: 800 }}>
                {FOCUS_LABEL[option]}
              </div>
              <div
                style={{
                  marginTop: scaled(3),
                  fontSize: scaled(11),
                  color: t.mutedStrong,
                  lineHeight: 1.4,
                }}
              >
                {FOCUS_DETAIL[option]}
              </div>
            </button>
          )
        })}
      </div>

      <div
        style={{
          marginTop: scaled(10),
          fontSize: scaled(10),
          color: t.faintText,
          lineHeight: 1.4,
        }}
      >
        {locked
          ? 'Você já mexeu no foco nesta partida.'
          : 'Dá para mudar uma vez, no intervalo.'}
      </div>

      <PrimaryButton onClick={onConfirm} style={{ marginTop: scaled(12) }}>
        {confirmLabel}
      </PrimaryButton>
    </div>
  )
}

/** O que saiu do último clique na barra. */
function TimingFeedback({ outcome }: { outcome: TimingOutcome }) {
  const [text, color] =
    outcome.band === 'perfeito'
      ? ['No ponto exato.', t.greenText]
      : outcome.band === 'bom'
        ? ['Timing bom.', t.goldText]
        : outcome.band === 'perdido'
          ? ['Você perdeu a chance.', t.dangerText]
          : ['Timing errado.', t.dangerText]

  return (
    <div style={{ color, fontWeight: 700, marginBottom: scaled(4) }}>{text}</div>
  )
}

function statusOf(live: NonNullable<Game['live']>): string {
  if (live.player.red) return 'EXP.'
  if (live.player.injured) return 'LES.'
  if (!live.onPitch) return 'FORA'
  return `${live.player.yellow > 0 ? 'AMAR.' : 'EM CAMPO'}`
}
