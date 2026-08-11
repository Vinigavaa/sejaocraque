'use client'

import { useEffect, useRef, useState } from 'react'

import { TIMING_WINDOW_MS, type TimingChallenge } from '@/lib/sim/liveTiming'

import { Display, scaled, t } from './shared'

/**
 * As duas cores proprias da barra.
 *
 * Nao vem do tema porque nao existem em nenhum outro lugar do jogo: o trilho e
 * mais escuro que qualquer superficie da interface para que o verde salte dele,
 * e a faixa de acerto e um verde opaco, e nao o verde do tema com transparencia
 * — translucido sobre o trilho escuro ele ficava perto demais do fundo.
 */
const TRACK = 'oklch(26% 0.01 55)'
const ZONE = 'oklch(42% 0.09 150)'

/**
 * A barra de timing: a parte jogada de um lance decisivo.
 *
 * O cursor vai e volta, e o clique devolve a posicao dele no instante em que
 * o jogador tocou. A tela nao decide nada — quem le a posicao e diz se saiu
 * gol e `resolveLiveTiming`, no motor.
 *
 * A posicao e calculada a partir do relogio, e nao acumulada quadro a quadro:
 * uma aba que perde alguns quadros teria o cursor andando devagar, e o mesmo
 * clique valeria coisas diferentes dependendo da carga da maquina.
 */
export function TimingBar({
  challenge,
  label,
  onHit,
  onExpire,
}: {
  challenge: TimingChallenge
  label: string
  onHit: (cursor: number) => void
  onExpire: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [left, setLeft] = useState(TIMING_WINDOW_MS)
  const startedAt = useRef(0)
  const fired = useRef(false)
  const latest = useRef(0)

  // Num ref, e nao na dependencia do efeito: `onExpire` costuma ser uma funcao
  // nova a cada render, e depender dela reiniciaria o relogio do lance —
  // dando cinco segundos novos a cada quadro.
  const expire = useRef(onExpire)

  useEffect(() => {
    expire.current = onExpire
  }, [onExpire])

  useEffect(() => {
    fired.current = false
    startedAt.current = performance.now()

    let frame = 0

    const tick = (now: number) => {
      const elapsed = now - startedAt.current

      // Vai e volta: o ciclo tem duas travessias, e a segunda e a primeira ao
      // contrario. Sem isso o cursor saltaria da direita para a esquerda, e um
      // salto no meio de um jogo de timing e injusto.
      const phase = (elapsed % (challenge.sweepMs * 2)) / challenge.sweepMs
      const position = phase <= 1 ? phase : 2 - phase

      latest.current = position
      setCursor(position)
      setLeft(Math.max(0, TIMING_WINDOW_MS - elapsed))

      if (elapsed >= TIMING_WINDOW_MS) {
        if (!fired.current) {
          fired.current = true
          expire.current()
        }
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [challenge])

  // O clique e uma vez so. Sem a trava, um toque duplo mandava duas posicoes
  // e a segunda chegava com o lance ja resolvido.
  const hit = () => {
    if (fired.current) return
    fired.current = true
    onHit(latest.current)
  }

  const seconds = left / 1000
  // Vermelho no ultimo segundo e meio, que e quando ainda da para reagir.
  const urgent = left <= 1500

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      hit()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const greenLeft = (challenge.center - challenge.green / 2) * 100
  const perfectLeft = (challenge.center - challenge.perfect / 2) * 100

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: scaled(10),
        }}
      >
        <Display size={15}>{label}</Display>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: scaled(8),
          }}
        >
          <div style={{ fontSize: scaled(10), color: t.faintText, letterSpacing: '0.06em' }}>
            TOQUE NO VERDE
          </div>
          <Display size={18} style={{ color: urgent ? t.dangerText : t.text }}>
            {seconds.toFixed(1)}s
          </Display>
        </div>
      </div>

      {/* A janela que se esgota. Fica acima da barra de timing, e não junto,
          para não competir com o verde pela atenção no momento do clique. */}
      <div
        style={{
          marginTop: scaled(8),
          height: 4,
          borderRadius: 999,
          background: t.line,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(left / TIMING_WINDOW_MS) * 100}%`,
            height: '100%',
            background: urgent ? t.dangerText : t.accent,
          }}
        />
      </div>

      <button
        type="button"
        onClick={hit}
        aria-label={label}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          height: scaled(34),
          marginTop: scaled(10),
          padding: 0,
          borderRadius: 8,
          border: 'none',
          background: TRACK,
          cursor: 'pointer',
          overflow: 'hidden',
          // Um toque na barra nao pode rolar a tela junto: no celular a rolagem
          // engolia o clique e o lance se resolvia sozinho no fim do tempo.
          touchAction: 'manipulation',
        }}
      >
        {/* Duas faixas chapadas, sem borda: a escura e o acerto, a viva e o
            miolo perfeito. Blocos solidos leem mais rapido que contorno — e a
            uma travessia de meio segundo, ler rapido e o jogo inteiro. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            left: `${greenLeft}%`,
            width: `${challenge.green * 100}%`,
            background: ZONE,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            left: `${perfectLeft}%`,
            width: `${challenge.perfect * 100}%`,
            background: t.green,
          }}
        />

        {/* O alvo: a bola no passe, a trave na finalizacao. É ele que diz de
            que tipo de lance se trata sem precisar de legenda. Discreto, para
            não disputar com o verde a atenção no momento do clique. */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${challenge.center * 100}%`,
            transform: 'translate(-50%, -50%)',
            lineHeight: 1,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        >
          {challenge.kind === 'finalizacao' ? <Goalpost /> : <Ball />}
        </div>

        {/* O cursor é a única coisa laranja na barra. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${cursor * 100}%`,
            width: 3,
            marginLeft: -1.5,
            background: t.accent,
          }}
        />
      </button>
    </div>
  )
}

function Ball() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="8" fill={t.text} stroke={t.bg} strokeWidth="1.5" />
      <path d="M10 4l3 2.4-1.2 3.6H8.2L7 6.4z" fill={t.bg} />
    </svg>
  )
}

function Goalpost() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden>
      <path
        d="M3 19V3h20v16"
        fill="none"
        stroke={t.text}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
