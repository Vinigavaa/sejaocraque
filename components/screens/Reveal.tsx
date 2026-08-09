'use client'

import { useEffect, useState } from 'react'

import type { Game } from '@/lib/game/useGame'
import { POSITION_LABEL } from '@/lib/sim/types'

import { PlayerCard } from '../PlayerCard'
import { ScreenLayout } from '../ScreenLayout'
import { Display, PrimaryButton, scaled, SectionLabel, SelectCard, t } from '../shared'

/**
 * Contagem do OVR. O numero e o clima da tela, entao ele sobe em vez de
 * aparecer.
 *
 * Usa timer, nao `requestAnimationFrame`: rAF nao dispara em aba que nao esta
 * compondo quadros, e o numero ficava travado em zero para sempre. Com timer o
 * pior caso e a contagem sair truncada — nunca sumir. O valor final tambem e
 * garantido por um timeout, para a tela nunca terminar em estado intermediario.
 */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const final = Math.max(0, target)
    // Um unico passo cobre os casos sem animacao: alvo zerado ou movimento
    // reduzido. Evita setState sincrono dentro do efeito.
    const steps = final <= 0 || reduceMotion ? 1 : 24
    let current = 0

    const interval = setInterval(
      () => {
        current += 1
        setValue(Math.min(final, Math.round((final / steps) * current)))
        if (current >= steps) clearInterval(interval)
      },
      steps === 1 ? 0 : duration / steps,
    )

    const settle = setTimeout(() => setValue(final), duration + 120)

    return () => {
      clearInterval(interval)
      clearTimeout(settle)
    }
  }, [target, duration])

  return value
}

export function Reveal({ game }: { game: Game }) {
  const shown = useCountUp(game.peakOverall)

  const draft = game.draft
  const position = game.finalPosition ?? game.position
  const attrs = game.peakAttrs

  // A revelacao so existe depois do draft; sem atributos nao ha o que revelar.
  if (!attrs || !position || game.shirtNumber === null) return null

  return (
    <ScreenLayout
      mobileOrder={['center', 'left']}
      left={
        draft ? (
          <>
            <SectionLabel>De onde veio cada atributo</SectionLabel>
            <div
              style={{ marginTop: scaled(10), display: 'flex', flexDirection: 'column', gap: scaled(6) }}
            >
              {draft.picks.map((pick) => (
                <div
                  key={pick.attr}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: scaled(8),
                    fontSize: scaled(11),
                    color: t.muted,
                    padding: `${scaled(6)} 0`,
                    borderBottom: `1px solid ${t.lineSoft}`,
                  }}
                >
                  <span>{pick.attr.toUpperCase()}</span>
                  <span style={{ color: t.text }}>{pick.fromLegendName}</span>
                </div>
              ))}
            </div>
          </>
        ) : undefined
      }
    >
      <SectionLabel>DRAFT COMPLETO</SectionLabel>
      <Display size={26} style={{ marginTop: scaled(6) }}>
        {game.name}
      </Display>

      <div style={{ marginTop: scaled(20) }}>
        <PlayerCard
          name={game.name}
          shirtNumber={game.shirtNumber}
          position={position}
          nationality={game.nationality ?? undefined}
          overall={shown}
          attrs={attrs}
        />
      </div>
      <div style={{ marginTop: scaled(8), fontSize: scaled(11), color: t.muted, lineHeight: 1.4 }}>
        O OVR é o teto que você atinge por volta dos 27. Aos 16 você começa bem abaixo dele.
      </div>

      <SectionLabel style={{ marginTop: scaled(24) }}>Onde essa combinação rende mais</SectionLabel>
      <div style={{ marginTop: scaled(8), display: 'flex', flexDirection: 'column', gap: scaled(6) }}>
        {game.positionRanking.map((entry) => (
          <SelectCard
            key={entry.position}
            selected={game.finalPosition === entry.position}
            onClick={() => game.setFinalPosition(entry.position)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${scaled(10)} ${scaled(14)}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: scaled(10) }}>
              <Display size={18} style={{ width: 44 }}>
                {entry.position}
              </Display>
              <div style={{ fontSize: scaled(12), color: t.muted }}>
                {POSITION_LABEL[entry.position]}
              </div>
            </div>
            <Display size={20}>{entry.overall}</Display>
          </SelectCard>
        ))}
      </div>

      <PrimaryButton onClick={game.goToClub} style={{ marginTop: scaled(24) }}>
        PRÓXIMO →
      </PrimaryButton>
    </ScreenLayout>
  )
}
