'use client'

import type { Game } from '@/lib/game/useGame'
import { seasonTotals, type SeasonRecord } from '@/lib/sim/career'
import { AWARD_LABEL } from '@/lib/sim/awards'
import { clubById } from '@/lib/sim/data/clubs'
import { ATTR_LABEL, isStarAttr } from '@/lib/sim/types'

import { CompetitionRow } from '../CompetitionRow'
import { ClubCrest } from '../Crest'
import { NationalMatches } from '../NationalMatches'
import { PlayerSheet } from '../PlayerSheet'
import { ScreenLayout } from '../ScreenLayout'
import { Badge, Display, PrimaryButton, scaled, SectionLabel, Stat, t } from '../shared'

export function SeasonReview({ game }: { game: Game }) {
  const record = game.lastRecord
  const career = game.career
  if (!record || !career) return null

  const totals = seasonTotals(record)
  const club = clubById(record.clubId)
  const previous = previousSeason(career.seasons, record)
  const overallDelta = previous ? record.overall - previous.overall : null
  const titles = totals.lines.filter((line) => line.won)
  const last = career.retired

  return (
    <ScreenLayout
      mobileOrder={['center', 'left', 'right']}
      right={<PlayerSheet game={game} />}
      left={
        <>
      <SectionLabel >Competição a competição</SectionLabel>
          <div style={{ marginTop: scaled(8), display: 'flex', flexDirection: 'column', gap: scaled(4) }}>
            {totals.lines.map((line) => (
              <CompetitionRow key={line.name} line={line} />
            ))}
          </div>

          {record.national && (
            <div style={{ marginTop: scaled(20) }}>
              <NationalMatches
                national={record.national}
                seed={career.config.seed}
                seasonLabel={record.label}
                playerName={career.config.name}
              />
            </div>
          )}
        </>
      }
    >
      <SectionLabel>{last ? 'ÚLTIMA TEMPORADA' : 'FIM DE TEMPORADA'}</SectionLabel>
      <Display size={30} style={{ marginTop: scaled(4) }}>
        {record.label}
      </Display>
      <div
        style={{
          marginTop: scaled(4),
          fontSize: scaled(12),
          color: t.muted,
          display: 'flex',
          alignItems: 'center',
          gap: scaled(6),
        }}
      >
        <ClubCrest clubId={club?.id} size={16} />
        {club?.name} · {record.age} anos · €{record.marketValue}M
      </div>

      {/* Premio aparece mesmo sem titulo: a Bola de Ouro e da temporada, e ha
          temporada excepcional que termina sem taca nenhuma. */}
      {(titles.length > 0 || record.awards.length > 0) && (
        <div style={{ marginTop: scaled(12), display: 'flex', gap: scaled(6), flexWrap: 'wrap' }}>
          {titles.map((line) => (
            <Badge key={line.name} bg={t.goldSoft} color={t.goldText}>
              {line.name}
            </Badge>
          ))}
          {record.awards.map((award) =>
            // A Bola de Ouro nao divide o mesmo selo do resto: e o teto da
            // carreira, e no meio de cinco etiquetas iguais ela se perde.
            award === 'bola-de-ouro' ? (
              <Badge key={award} bg={t.gold} color={t.bg}>
                ★ {AWARD_LABEL[award]}
              </Badge>
            ) : (
              <Badge key={award} bg={t.goldSoft} color={t.goldText}>
                {AWARD_LABEL[award]}
              </Badge>
            ),
          )}
        </div>
      )}

      <SectionLabel style={{ marginTop: scaled(22) }}>A temporada inteira</SectionLabel>
      <div
        style={{
          marginTop: scaled(10),
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: scaled(8),
        }}
      >
        <Stat value={totals.matches} label="jogos" />
        <Stat value={totals.goals} label="gols" />
        <Stat value={totals.assists} label="assist." />
        <Stat value={record.stats.rating.toFixed(1)} label="nota" />
      </div>
      <div style={{ marginTop: scaled(6), fontSize: scaled(10), color: t.faintText }}>
        Somando liga, copas e seleção.
      </div>

      <SectionLabel style={{ marginTop: scaled(22) }}>Evolução</SectionLabel>
      <div
        style={{
          marginTop: scaled(8),
          border: `1px solid ${t.lineSoft}`,
          borderRadius: 6,
          background: t.card,
          padding: scaled(14),
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <div style={{ fontSize: scaled(12), color: t.muted }}>OVR</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: scaled(8) }}>
            <Display size={26}>{record.overall}</Display>
            {overallDelta !== null && (
              <div
                style={{
                  fontSize: scaled(13),
                  fontWeight: 800,
                  color:
                    overallDelta > 0
                      ? t.greenText
                      : overallDelta < 0
                        ? t.dangerText
                        : t.muted,
                }}
              >
                {overallDelta > 0 ? `+${overallDelta}` : overallDelta}
              </div>
            )}
          </div>
        </div>

        {record.clubLift > 0 && (
          <div
            style={{
              marginTop: scaled(8),
              paddingTop: scaled(8),
              borderTop: `1px solid ${t.lineSoft}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: scaled(12),
            }}
          >
            <div>Sua presença valeu ao {club?.name}</div>
            <Display size={15} style={{ color: t.greenText }}>
              +{record.clubLift.toFixed(1)}
            </Display>
          </div>
        )}

        <div style={{ marginTop: scaled(10), display: 'flex', flexDirection: 'column', gap: scaled(6) }}>
          {record.growth.length === 0 ? (
            <div style={{ fontSize: scaled(11), color: t.faintText, lineHeight: 1.4 }}>
              {record.trainingFocus
                ? `O treino em ${ATTR_LABEL[record.trainingFocus].full} não rendeu ganho neste ano.`
                : 'Nenhum atributo evoluiu neste ano.'}
            </div>
          ) : (
            record.growth.map((growth) => (
              <div
                key={growth.attr}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontSize: scaled(12),
                }}
              >
                <div>{ATTR_LABEL[growth.attr].full}</div>
                <div style={{ display: 'flex', gap: scaled(6), alignItems: 'baseline' }}>
                  <span style={{ color: t.muted }}>
                    {growth.from}
                    {isStarAttr(growth.attr) ? '★' : ''}
                  </span>
                  <span style={{ color: t.muted }}>→</span>
                  <Display size={15} style={{ color: t.greenText }}>
                    {growth.to}
                    {isStarAttr(growth.attr) ? '★' : ''}
                  </Display>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 20 }} />

      <PrimaryButton onClick={game.finishReview} style={{ marginTop: scaled(20) }}>
        {last ? 'VER FIM DE CARREIRA →' : 'PRÓXIMA TEMPORADA →'}
      </PrimaryButton>
    </ScreenLayout>
  )
}

/** A temporada anterior à mostrada — é dela que sai a variação de OVR. */
function previousSeason(
  seasons: SeasonRecord[],
  record: SeasonRecord,
): SeasonRecord | undefined {
  const index = seasons.findIndex((season) => season.label === record.label)
  return index > 0 ? seasons[index - 1] : undefined
}
