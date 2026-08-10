'use client'

import { useRef, useState } from 'react'

import { careerShareText } from '@/lib/game/shareText'
import type { Game } from '@/lib/game/useGame'
import { clubById } from '@/lib/sim/data/clubs'
import { careerTotals, ladderRung, LADDER_LABELS } from '@/lib/sim/ladder'
import { shareCardImage } from '@/lib/ui/shareImage'

import { ClubCrest } from '../Crest'
import { ScreenLayout } from '../ScreenLayout'
import { ShareCard } from '../ShareCard'
import { Display, GhostButton, PrimaryButton, scaled, SectionLabel, Stat, t } from '../shared'

export function End({ game }: { game: Game }) {
  const career = game.career
  const cardRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  if (!career) return null

  const totals = careerTotals(career)
  const rung = ladderRung(totals)

  /** A mensagem some sozinha: ela confirma uma ação, não é estado da tela. */
  const flash = (message: string) => {
    setStatus(message)
    setTimeout(() => setStatus(null), 2600)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(careerShareText(career, game.peakOverall))
      flash('Resumo copiado!')
    } catch (error) {
      // Clipboard bloqueado (contexto não seguro, permissão negada). O card
      // segue na tela para print, que é como o compartilhamento acontece.
      console.error('End: falha ao copiar o resumo para a área de transferência', error)
      flash('Não foi possível copiar. Tente compartilhar a imagem.')
    }
  }

  const shareImage = async () => {
    const node = cardRef.current
    if (!node || working) return

    setWorking(true)
    const result = await shareCardImage(
      node,
      `craque-${career.config.name.trim().toLowerCase().replace(/\s+/g, '-') || 'carreira'}.png`,
      t.shareBg,
    )
    setWorking(false)

    if (result === 'shared') flash('Imagem compartilhada!')
    if (result === 'downloaded') flash('Imagem salva nos seus downloads.')
    if (result === 'failed') flash('Não foi possível gerar a imagem. Tente o resumo em texto.')
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
      {/* A `ref` fica neste wrapper e não dentro do card: é exatamente este nó
          que vira PNG, então o que estiver fora dele não entra na imagem. */}
      <div ref={cardRef} style={{ marginTop: scaled(8) }}>
        <ShareCard career={career} peakOverall={game.peakOverall} />
      </div>

      {status && (
        <div
          style={{
            marginTop: scaled(8),
            textAlign: 'center',
            fontSize: scaled(11),
            color: t.muted,
          }}
        >
          {status}
        </div>
      )}

      {/* Destacado entre os secundários, mas ainda um `GhostButton`: o botão
          cheio da tela é JOGAR DE NOVO, e dois primários competiriam. */}
      <GhostButton
        onClick={shareImage}
        disabled={working}
        style={{
          marginTop: scaled(16),
          padding: scaled(16),
          borderColor: t.accent,
          color: t.goldText,
        }}
      >
        {working ? 'GERANDO IMAGEM…' : 'COMPARTILHAR IMAGEM'}
      </GhostButton>
      <GhostButton onClick={copy} style={{ marginTop: scaled(8), padding: scaled(14) }}>
        COPIAR RESUMO
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
