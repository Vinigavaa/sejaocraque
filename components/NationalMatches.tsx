'use client'

import { useState } from 'react'

import { nationById } from '@/lib/sim/data/nations'
import type { LiveEvent } from '@/lib/sim/liveMatch'
import {
  nationalTimeline,
  type NationalMatch,
  type NationalSeason,
} from '@/lib/sim/national'

import { Flag } from './Flag'
import { scaled, SectionLabel, t } from './shared'

/**
 * O ano de selecao, jogo a jogo.
 *
 * Cada partida abre a propria narracao minuto a minuto. Ela e gerada na hora a
 * partir da semente da carreira — o mesmo jogo narra igual toda vez, sem
 * ocupar memoria no estado do jogo.
 */
export function NationalMatches({
  national,
  seed,
  seasonLabel,
  playerName,
}: {
  national: NationalSeason
  seed: string
  seasonLabel: string
  playerName: string
}) {
  const nation = nationById(national.nationId)

  // Uma de cada vez: duas narracoes abertas viram um paredao de texto.
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section>
      <SectionLabel style={{ display: 'flex', alignItems: 'center', gap: scaled(6) }}>
        <Flag nationality={national.nationId} size={11} />
        {nation?.name ?? national.nationId}
        {national.tournament ? ` · ${national.tournament.name}` : ''}
      </SectionLabel>
      <div
        style={{
          marginTop: scaled(8),
          display: 'flex',
          flexDirection: 'column',
          gap: scaled(4),
        }}
      >
        {national.matches.map((match, index) => (
          <MatchRow
            key={`${match.competition}-${index}`}
            match={match}
            open={open === index}
            onToggle={() => setOpen(open === index ? null : index)}
            events={
              open === index
                ? nationalTimeline(national, index, { seed, seasonLabel, playerName })
                : []
            }
          />
        ))}
      </div>
    </section>
  )
}

function MatchRow({
  match,
  open,
  onToggle,
  events,
}: {
  match: NationalMatch
  open: boolean
  onToggle: () => void
  events: LiveEvent[]
}) {
  const drawn = match.forGoals === match.againstGoals && !match.onPenalties

  return (
    <div
      style={{
        borderRadius: 6,
        border: `1px solid ${open ? t.line : t.lineSoft}`,
        // Quem nao entrou em campo fica apagado: a partida aconteceu, mas nao
        // e uma partida dele.
        opacity: match.played ? 1 : 0.45,
      }}
    >
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onToggle()
        }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: scaled(10),
          padding: `${scaled(6)} ${scaled(10)}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: scaled(11),
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {match.opponentName}
          </div>
          <div style={{ fontSize: scaled(9), color: t.muted }}>
            {match.competition}
            {match.stage ? ` · ${match.stage}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: scaled(8) }}>
          {match.played && (match.goals > 0 || match.assists > 0) && (
            <div style={{ fontSize: scaled(10), color: t.mutedStrong, whiteSpace: 'nowrap' }}>
              {match.goals > 0 && `${match.goals}g`}
              {match.goals > 0 && match.assists > 0 && ' '}
              {match.assists > 0 && `${match.assists}a`}
            </div>
          )}
          <div
            style={{
              fontSize: scaled(12),
              fontWeight: 800,
              whiteSpace: 'nowrap',
              color: drawn ? t.mutedStrong : match.won ? t.greenText : t.dangerText,
            }}
          >
            {match.forGoals}-{match.againstGoals}
            {match.onPenalties ? ' (p)' : ''}
          </div>
          <span style={{ fontSize: scaled(9), color: t.faintText }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div
          style={{
            borderTop: `1px solid ${t.lineSoft}`,
            padding: scaled(10),
            display: 'flex',
            flexDirection: 'column',
            gap: scaled(5),
          }}
        >
          {events.map((event, index) => (
            <div
              key={`${event.minute}-${index}`}
              style={{ display: 'flex', gap: scaled(8), alignItems: 'baseline' }}
            >
              <div
                style={{
                  fontSize: scaled(10),
                  fontWeight: 800,
                  color: t.muted,
                  width: scaled(26),
                  flexShrink: 0,
                }}
              >
                {event.minute}&apos;
              </div>
              <div
                style={{
                  fontSize: scaled(11),
                  lineHeight: 1.4,
                  color: event.byPlayer ? t.text : t.mutedStrong,
                  fontWeight: event.byPlayer ? 700 : 400,
                }}
              >
                {event.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
