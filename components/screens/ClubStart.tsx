import type { Game } from '@/lib/game/useGame'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { POSITION_LABEL } from '@/lib/sim/types'

import { ClubCrest, LeagueCrest } from '../Crest'
import { Flag } from '../Flag'
import { ScreenLayout } from '../ScreenLayout'
import { Display, PrimaryButton, scaled, SectionLabel, t } from '../shared'

export function ClubStart({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  const club = clubById(career.clubId)
  const league = leagueById(career.leagueId)

  return (
    <ScreenLayout mobileOrder={['center']}>
      <div style={{ margin: 'auto 0' }}>
      <SectionLabel style={{ textAlign: 'center' }}>ONDE SUA HISTÓRIA COMEÇA?</SectionLabel>

      <div
        style={{
          marginTop: scaled(20),
          textAlign: 'center',
          border: `2px solid ${t.line}`,
          borderRadius: 8,
          padding: `${scaled(28)} ${scaled(20)}`,
          background: t.card,
        }}
      >
        <ClubCrest clubId={club?.id} size={72} style={{ margin: '0 auto', marginBottom: scaled(14) }} />
        <Display size={34} style={{ lineHeight: 1.1 }}>
          {club?.name ?? '—'}
        </Display>
        <div
          style={{
            marginTop: scaled(10),
            fontSize: scaled(13),
            color: t.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: scaled(6),
          }}
        >
          <LeagueCrest leagueId={career.leagueId} size={14} />
          {league?.name}
        </div>
        <div
          style={{
            marginTop: scaled(16),
            fontSize: scaled(12),
            color: t.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: scaled(6),
          }}
        >
          <Flag nationality={career.config.nationality} size={12} />
          {POSITION_LABEL[career.config.position]} · Nº
          {career.config.shirtNumber} · OVR {game.liveOverall}
        </div>
        <div style={{ marginTop: scaled(12), fontSize: scaled(11), color: t.faintText, lineHeight: 1.5 }}>
          16 anos. Você se aposenta aos {career.retiresAt}.
        </div>
      </div>

      <PrimaryButton onClick={game.beginCareer} style={{ marginTop: scaled(24) }}>
        COMEÇAR CARREIRA
      </PrimaryButton>
      </div>
    </ScreenLayout>
  )
}
