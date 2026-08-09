import type { Game } from '@/lib/game/useGame'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { seasonLabel } from '@/lib/sim/career'
import { ALL_ATTRS, ATTR_LABEL, type Attr } from '@/lib/sim/types'

import { ClubCrest, LeagueCrest } from '../Crest'
import { PlayerSheet } from '../PlayerSheet'
import { ScreenLayout } from '../ScreenLayout'
import { Badge, Display, scaled, SectionLabel, Stat, t } from '../shared'

export function Career({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  // A divisão vem da carreira, não do clube: depois de um acesso o clube joga
  // uma divisão acima da que os dados estáticos registram.
  const league = leagueById(career.leagueId)
  const record = game.lastRecord
  const table = game.lastTable

  return (
    <ScreenLayout
      mobileOrder={['center', 'left', 'right']}
      left={<>        {table && (
          <section>
            <SectionLabel>Tabela da liga</SectionLabel>
            <div
              data-league-table
              style={{
                marginTop: scaled(8),
                border: `1px solid ${t.lineSoft}`,
                borderRadius: 6,
              }}
            >
              {table.standings.map((standing, index) => {
                const rowClub = clubById(standing.clubId)
                const isPlayer = standing.clubId === record?.clubId
                const promotionCut = table.promotedIds.length
                const relegationStart = table.standings.length - table.relegatedIds.length

                return (
                  <div
                    key={standing.clubId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${scaled(6)} ${scaled(10)}`,
                      fontSize: scaled(11),
                      background: isPlayer ? t.accentSoft : 'transparent',
                      borderTop:
                        index === promotionCut && promotionCut > 0
                          ? `2px solid ${t.gold}`
                          : index === relegationStart && table.relegatedIds.length > 0
                            ? `2px solid ${t.accent}`
                            : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: scaled(8), alignItems: 'center' }}>
                      <div style={{ width: 18, color: t.muted }}>{index + 1}</div>
                      <ClubCrest clubId={rowClub?.id} size={16} />
                      <div style={{ fontWeight: isPlayer ? 800 : 400 }}>{rowClub?.name}</div>
                    </div>
                    <Display size={13}>{standing.points}</Display>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <SectionLabel>Linha do tempo</SectionLabel>
          <div
            style={{
              marginTop: scaled(8),
              display: 'flex',
              gap: scaled(6),
              overflowX: 'auto',
              paddingBottom: scaled(4),
            }}
          >
            {career.seasons.map((season) => (
              <div
                key={season.label}
                style={{
                  flex: '0 0 auto',
                  textAlign: 'center',
                  background: t.card,
                  border: `1px solid ${t.lineSoft}`,
                  borderRadius: 6,
                  padding: `${scaled(6)} ${scaled(8)}`,
                }}
              >
                <Display size={13}>{season.age}</Display>
                <ClubCrest clubId={season.clubId} size={14} style={{ margin: '0 auto' }} />
                <div
                  style={{
                    fontSize: scaled(8),
                    color: 'oklch(60% 0.015 70)',
                    maxWidth: 60,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {clubById(season.clubId)?.name}
                </div>
              </div>
            ))}
            <div
              style={{
                flex: '0 0 auto',
                textAlign: 'center',
                border: `1px dashed oklch(95% 0.01 70 / 0.2)`,
                borderRadius: 6,
                padding: `${scaled(6)} ${scaled(10)}`,
                color: t.faintText,
                fontSize: scaled(9),
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              futuro
            </div>
          </div>
        </section>

        {game.headlines.length > 0 && (
          <section>
            <SectionLabel>A imprensa</SectionLabel>
            <div style={{ marginTop: scaled(8), display: 'flex', flexDirection: 'column', gap: scaled(6) }}>
              {game.headlines.map((headline, index) => (
                <div
                  key={`${headline}-${index}`}
                  style={{
                    fontSize: scaled(12),
                    color: 'oklch(80% 0.015 70)',
                    borderLeft: `2px solid ${t.gold}`,
                    paddingLeft: scaled(8),
                  }}
                >
                  “{headline}”
                </div>
              ))}
            </div>
          </section>
        )}

</>}
      right={
        <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(16) }}>
          <PlayerSheet game={game} />
          <div
          style={{
            padding: `${scaled(16)} ${scaled(20)}`,
            borderTop: `2px solid ${t.lineSoft}`,
            background: t.card,
            display: 'flex',
            flexDirection: 'column',
            gap: scaled(8),
            position: 'sticky',
            bottom: 0,
          }}
      >
          {/* A aposentadoria sai pelo resumo direto para o fim de carreira, entao
              esta tela nunca aparece com a carreira encerrada. */}
          <button
            onClick={game.advance}
            style={{
              background: t.accent,
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: `${scaled(16)} ${scaled(24)}`,
              fontWeight: 800,
              fontSize: scaled(16),
              cursor: 'pointer',
            }}
          >
            AVANÇAR TEMPORADA
          </button>
          <button
            onClick={game.openAgent}
            style={{
              background: 'transparent',
              border: `1px solid oklch(95% 0.01 70 / 0.2)`,
              color: t.mutedStrong,
              borderRadius: 6,
              padding: scaled(10),
              fontWeight: 700,
              fontSize: scaled(12),
              cursor: 'pointer',
            }}
          >
            EMPRESÁRIO
            {career.preferences.length > 0 && ` · ${career.preferences.length}`}
          </button>
          {/* Só depois da primeira temporada: antes disso não há histórico. */}
          {career.seasons.length > 0 && (
            <button
              onClick={game.openHistory}
              style={{
                background: 'transparent',
                border: `1px solid oklch(95% 0.01 70 / 0.2)`,
                color: t.mutedStrong,
                borderRadius: 6,
                padding: scaled(10),
                fontWeight: 700,
                fontSize: scaled(12),
                cursor: 'pointer',
              }}
            >
              HISTÓRICO
            </button>
          )}
          <button
            onClick={game.skipToEnd}
            style={{
              background: 'transparent',
              border: `1px solid oklch(95% 0.01 70 / 0.2)`,
              color: t.mutedStrong,
              borderRadius: 6,
              padding: scaled(10),
              fontWeight: 700,
              fontSize: scaled(12),
              cursor: 'pointer',
            }}
          >
            PULAR PARA O FIM
          </button>
            </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(20) }}>
        <section>
          <SectionLabel style={{ display: 'flex', alignItems: 'center', gap: scaled(6) }}>
            <LeagueCrest leagueId={career.leagueId} size={16} />
            {record ? `Temporada ${record.label}` : `Temporada ${seasonLabel(0)}`} ·{' '}
            {league?.name}
          </SectionLabel>
          <div
            style={{
              marginTop: scaled(10),
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: scaled(8),
            }}
          >
            <Stat value={record?.stats.matches ?? '—'} label="jogos" />
            <Stat value={record?.stats.goals ?? '—'} label="gols" />
            <Stat value={record?.stats.assists ?? '—'} label="assist." />
            <Stat value={record?.stats.rating ? record.stats.rating.toFixed(1) : '—'} label="nota" />
          </div>
          {/* Fica nesta seção, e não no cabeçalho: o cabeçalho mostra o clube da
              próxima temporada, e a frase falaria de um clube que não é este.
              Zero fica de fora — exibir "+0" só ensina que o mecanismo não existe. */}
          {!!record && record.clubLift > 0 && (
            <div style={{ marginTop: scaled(8), fontSize: scaled(11), color: t.greenText, fontWeight: 700 }}>
              Sua presença valeu +{record.clubLift.toFixed(1)} ao{' '}
              {clubById(record.clubId)?.name}
            </div>
          )}
        </section>

        {record && (
          <section>
            <SectionLabel>Resultado da liga</SectionLabel>
            <div
              style={{
                marginTop: scaled(8),
                display: 'flex',
                alignItems: 'center',
                gap: scaled(10),
                flexWrap: 'wrap',
              }}
            >
              <Display size={22}>
                {record.tablePosition}º/{table?.standings.length ?? 20}
              </Display>
              {record.champion && (
                <Badge bg={t.goldSoft} color={t.goldText}>
                  Campeão
                </Badge>
              )}
              {record.promoted && (
                <Badge bg={t.greenSoft} color={t.greenText}>
                  Acesso
                </Badge>
              )}
              {record.relegated && (
                <Badge bg={t.danger} color={t.dangerText}>
                  Rebaixamento
                </Badge>
              )}
              {record.cups
                .filter((run) => run.won)
                .map((run) => (
                  <Badge key={run.id} bg={t.goldSoft} color={t.goldText}>
                    {run.name}
                  </Badge>
                ))}
              {record.national?.tournament?.won && (
                <Badge bg={t.goldSoft} color={t.goldText}>
                  {record.national.tournament.name}
                </Badge>
              )}
            </div>
          </section>
        )}

        <TrainingPicker game={game} />
      </div>
    </ScreenLayout>
  )
}

/**
 * A decisao da temporada. Nao estava no design importado, mas e a unica
 * agencia do jogador entre um ano e outro — sem ela a carreira volta a ser
 * assistida, que era a falha do jogo de referencia.
 */
function TrainingPicker({ game }: { game: Game }) {
  const career = game.career
  if (!career || career.retired) return null

  return (
    <section>
      <SectionLabel>Foco de treino da próxima temporada</SectionLabel>
      <div
        style={{
          marginTop: scaled(8),
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: scaled(6),
        }}
      >
        {ALL_ATTRS.map((attr: Attr) => {
          const selected = game.trainingFocus === attr

          return (
            <div
              key={attr}
              onClick={() => game.setTrainingFocus(selected ? null : attr)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  game.setTrainingFocus(selected ? null : attr)
                }
              }}
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                border: `2px solid ${selected ? t.accent : t.line}`,
                background: selected ? t.accentSoft : t.card,
                borderRadius: 6,
                padding: `${scaled(8)} ${scaled(2)}`,
              }}
            >
              <Display size={13}>{ATTR_LABEL[attr].short}</Display>
              <div style={{ marginTop: scaled(2), fontSize: scaled(15), fontWeight: 700 }}>
                {career.peakAttrs[attr]}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: scaled(6), fontSize: scaled(10), color: t.faintText, lineHeight: 1.4 }}>
        Jovem evolui rápido, veterano quase não evolui. Sem escolha, o treino vai para onde
        rende mais.
      </div>
    </section>
  )
}
