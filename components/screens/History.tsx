'use client'

import { useState } from 'react'

import type { Game } from '@/lib/game/useGame'
import { seasonTotals, type CareerState, type SeasonRecord } from '@/lib/sim/career'
import { clubById } from '@/lib/sim/data/clubs'
import { clubSpells, trophyCase, type ClubSpell, type Trophy } from '@/lib/sim/history'
import { careerTotals } from '@/lib/sim/ladder'

import { CompetitionRow } from '../CompetitionRow'
import { ClubCrest } from '../Crest'
import { NationalMatches } from '../NationalMatches'
import { ScreenLayout } from '../ScreenLayout'
import { Display, GhostButton, scaled, SectionLabel, Stat, t } from '../shared'

/**
 * O histórico da carreira.
 *
 * Não é um passo do fluxo: é um desvio que o jogador abre e fecha, e por isso
 * nada aqui altera estado nenhum do jogo.
 */
export function History({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  const spells = clubSpells(career)
  const trophies = trophyCase(career)
  const totals = careerTotals(career)

  return (
    <ScreenLayout
      mobileOrder={['center', 'left', 'right']}
      left={
        <section>
          <SectionLabel>Passagens</SectionLabel>
          <div
            style={{
              marginTop: scaled(8),
              display: 'flex',
              flexDirection: 'column',
              gap: scaled(6),
            }}
          >
            {spells.map((spell, index) => (
              <SpellRow key={`${spell.clubId}-${index}`} spell={spell} />
            ))}
          </div>
        </section>
      }
      right={
        <section>
          <SectionLabel>Sala de troféus</SectionLabel>
          {trophies.length === 0 ? (
            <div
              style={{
                marginTop: scaled(8),
                fontSize: scaled(12),
                color: t.faintText,
                lineHeight: 1.5,
              }}
            >
              Nenhum título até aqui.
            </div>
          ) : (
            <div
              style={{
                marginTop: scaled(8),
                display: 'flex',
                flexDirection: 'column',
                gap: scaled(6),
              }}
            >
              {trophies.map((trophy) => (
                <TrophyRow key={trophy.name} trophy={trophy} />
              ))}
            </div>
          )}
        </section>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(20) }}>
        <section>
          <SectionLabel>Histórico</SectionLabel>
          <Display size={26} style={{ marginTop: scaled(6) }}>
            {career.config.name}
          </Display>
          <div
            style={{
              marginTop: scaled(12),
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: scaled(8),
            }}
          >
            <Stat value={totals.matches} label="jogos" />
            <Stat value={totals.goals} label="gols" />
            <Stat value={totals.titles} label="títulos" />
            <Stat value={totals.caps} label="pela seleção" />
          </div>
        </section>

        <section>
          <SectionLabel>Temporada a temporada</SectionLabel>
          <div
            style={{
              marginTop: scaled(8),
              display: 'flex',
              flexDirection: 'column',
              gap: scaled(6),
            }}
          >
            {[...career.seasons].reverse().map((season) => (
              <SeasonBlock key={season.label} season={season} career={career} />
            ))}
          </div>
        </section>

        <GhostButton onClick={game.closeHistory}>← VOLTAR</GhostButton>
      </div>
    </ScreenLayout>
  )
}

function SpellRow({ spell }: { spell: ClubSpell }) {
  const club = clubById(spell.clubId)

  return (
    <div
      style={{
        border: `1px solid ${t.lineSoft}`,
        borderRadius: 6,
        background: t.card,
        padding: `${scaled(8)} ${scaled(10)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(8), minWidth: 0 }}>
        <ClubCrest clubId={spell.clubId} size={20} />
        <div
          style={{
            fontSize: scaled(12),
            fontWeight: 800,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {club?.name ?? spell.clubId}
        </div>
      </div>
      <div style={{ marginTop: scaled(4), fontSize: scaled(10), color: t.muted }}>
        {spell.from} – {spell.to ?? 'hoje'} · {spell.seasons}{' '}
        {spell.seasons === 1 ? 'temporada' : 'temporadas'}
      </div>
      <div
        style={{
          marginTop: scaled(6),
          display: 'flex',
          gap: scaled(10),
          fontSize: scaled(11),
          color: t.mutedStrong,
        }}
      >
        <span>{spell.matches}j</span>
        <span>{spell.goals}g</span>
        <span>{spell.assists}a</span>
        {spell.titles > 0 && (
          <span style={{ color: t.goldText, fontWeight: 700 }}>
            {spell.titles} {spell.titles === 1 ? 'título' : 'títulos'}
          </span>
        )}
      </div>
    </div>
  )
}

function TrophyRow({ trophy }: { trophy: Trophy }) {
  return (
    <div
      style={{
        border: `1px solid ${t.lineSoft}`,
        borderRadius: 6,
        background: t.goldSoft,
        padding: `${scaled(8)} ${scaled(10)}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: scaled(8),
        }}
      >
        <div
          style={{
            fontSize: scaled(12),
            fontWeight: 800,
            color: t.goldText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {trophy.name}
        </div>
        <Display size={16} style={{ color: t.goldText }}>
          {trophy.count}×
        </Display>
      </div>
      <div style={{ marginTop: scaled(4), fontSize: scaled(10), color: t.muted }}>
        {trophy.scope === 'selecao' ? 'Seleção' : 'Clube'} · {trophy.years.join(', ')}
      </div>
    </div>
  )
}

/**
 * Uma temporada. Fechada mostra a linha do ano; aberta abre competição a
 * competição — sem isso uma carreira de 20 anos vira um paredão de números.
 */
function SeasonBlock({ season, career }: { season: SeasonRecord; career: CareerState }) {
  const [open, setOpen] = useState(false)

  const totals = seasonTotals(season)
  const club = clubById(season.clubId)
  const titles = totals.lines.filter((line) => line.won).length

  return (
    <div style={{ border: `1px solid ${t.lineSoft}`, borderRadius: 6, background: t.card }}>
      <div
        onClick={() => setOpen((current) => !current)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setOpen((current) => !current)
        }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: scaled(10),
          padding: `${scaled(8)} ${scaled(10)}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: scaled(8), minWidth: 0 }}>
          <Display size={13} style={{ width: scaled(58) }}>
            {season.label}
          </Display>
          <ClubCrest clubId={season.clubId} size={16} />
          <div
            style={{
              fontSize: scaled(11),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {club?.name ?? season.clubId}
          </div>
          {titles > 0 && <div style={{ fontSize: scaled(11), color: t.goldText }}>★{titles}</div>}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: scaled(8),
            fontSize: scaled(11),
            color: t.mutedStrong,
            whiteSpace: 'nowrap',
          }}
        >
          {totals.matches}j {totals.goals}g {totals.assists}a
          <span style={{ color: t.faintText }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div
          style={{
            borderTop: `1px solid ${t.lineSoft}`,
            padding: scaled(10),
            display: 'flex',
            flexDirection: 'column',
            gap: scaled(6),
          }}
        >
          {totals.lines.map((line) => (
            <CompetitionRow key={line.name} line={line} />
          ))}
          {season.national && (
            <div style={{ marginTop: scaled(10) }}>
              <NationalMatches
                national={season.national}
                seed={career.config.seed}
                seasonLabel={season.label}
                playerName={career.config.name}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
