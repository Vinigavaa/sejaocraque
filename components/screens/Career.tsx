import type { Game } from '@/lib/game/useGame'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { seasonLabel } from '@/lib/sim/career'
import { formatSalary } from '@/lib/sim/contracts'
import {
  MORALE_LABEL,
  moraleLabel,
  reputationLabel,
  type MoraleKey,
} from '@/lib/sim/morale'
import { statsFromLog } from '@/lib/sim/matchday'
import { finalizeLeague } from '@/lib/sim/season'
import { ALL_ATTRS, ATTR_LABEL, type Attr } from '@/lib/sim/types'

import { AgentHint } from '../AgentHint'
import { ClubCrest, LeagueCrest } from '../Crest'
import { PlayerSheet } from '../PlayerSheet'
import { ScreenLayout } from '../ScreenLayout'
import { Badge, Display, scaled, SectionLabel, Stat, t } from '../shared'

/** O alcance da notícia vira cor: a barra lateral diz o tamanho do assunto. */
const REACH_COLOR: Record<string, string> = {
  local: t.line,
  nacional: t.accent,
  continental: t.gold,
  mundial: t.greenText,
}

const MORALE_KEYS: MoraleKey[] = ['confidence', 'coach', 'squad', 'reputation']

export function Career({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  // A divisão vem da carreira, não do clube: depois de um acesso o clube joga
  // uma divisão acima da que os dados estáticos registram.
  const league = leagueById(career.leagueId)
  const record = game.lastRecord
  const jogoAJogo = career.config.careerMode === 'jogoAJogo'

  // No Jogo a Jogo a tabela é do campeonato em andamento, e não a do ano
  // passado: ela é a razão de o jogador voltar para esta tela entre as
  // rodadas. Fechá-la aqui usa a mesma função do motor — ordenar de outro
  // jeito na interface faria a classificação exibida divergir da real.
  const table =
    jogoAJogo && game.matchday && league
      ? finalizeLeague(league, game.matchday.table, [])
      : game.lastTable

  // Durante a temporada os números são os do campeonato em andamento; fora
  // dela, os do ano que acabou. Mostrar o ano passado enquanto se joga o atual
  // é o tipo de detalhe que quebra a ilusão de estar vivendo a temporada.
  const running =
    jogoAJogo && game.matchday && game.matchday.log.length > 0
      ? statsFromLog(game.matchday.log)
      : null

  const shown = running ?? record?.stats ?? null
  const lastYear = career.contract.seasonsLeft <= 1

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
                const isPlayer = standing.clubId === career.clubId
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

        {game.news.length > 0 && (
          <section>
            <SectionLabel>Imprensa</SectionLabel>
            <div
              style={{
                marginTop: scaled(8),
                display: 'flex',
                flexDirection: 'column',
                gap: scaled(8),
              }}
            >
              {game.news.map((news) => (
                <article
                  key={news.id}
                  style={{
                    border: `1px solid ${t.lineSoft}`,
                    borderLeft: `2px solid ${REACH_COLOR[news.reach]}`,
                    borderRadius: 6,
                    background: t.card,
                    padding: `${scaled(8)} ${scaled(10)}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: scaled(9),
                      color: t.faintText,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {news.outlet} · {news.round ? `${news.round}ª rodada` : news.season}
                  </div>
                  <div
                    style={{
                      marginTop: scaled(3),
                      fontSize: scaled(12),
                      fontWeight: 700,
                      lineHeight: 1.35,
                    }}
                  >
                    {news.headline}
                  </div>
                  {news.body && (
                    <div
                      style={{
                        marginTop: scaled(4),
                        fontSize: scaled(11),
                        color: t.mutedStrong,
                        lineHeight: 1.4,
                      }}
                    >
                      {news.body}
                    </div>
                  )}
                </article>
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
            onClick={jogoAJogo ? game.playNextMatch : game.advance}
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
            {jogoAJogo ? 'PRÓXIMO JOGO' : 'AVANÇAR TEMPORADA'}
          </button>
          {/* No Jogo a Jogo o jogador precisa saber onde está no calendário
              antes de decidir se joga mais uma rodada agora. */}
          {jogoAJogo && <NextMatch game={game} />}
          {jogoAJogo && (
            <button
              onClick={game.skipSeason}
              style={{
                background: 'transparent',
                border: `1px solid ${t.gold}`,
                color: t.goldText,
                borderRadius: 6,
                padding: scaled(10),
                fontWeight: 700,
                fontSize: scaled(12),
                cursor: 'pointer',
              }}
            >
              PULAR PARA O FIM DA TEMPORADA
            </button>
          )}
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
      <AgentHint game={game} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(20) }}>
        <section>
          <SectionLabel style={{ display: 'flex', alignItems: 'center', gap: scaled(6) }}>
            <LeagueCrest leagueId={career.leagueId} size={16} />
            {running
              ? `Temporada ${seasonLabel(career.seasonIndex)} em curso`
              : record
                ? `Temporada ${record.label}`
                : `Temporada ${seasonLabel(0)}`}{' '}
            · {league?.name}
          </SectionLabel>
          <div
            style={{
              marginTop: scaled(10),
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: scaled(8),
            }}
          >
            <Stat value={shown?.matches ?? '—'} label="jogos" />
            <Stat value={shown?.goals ?? '—'} label="gols" />
            <Stat value={shown?.assists ?? '—'} label="assist." />
            <Stat value={shown?.rating ? shown.rating.toFixed(1) : '—'} label="nota" />
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

        <section>
          <SectionLabel>Contrato</SectionLabel>
          <div
            style={{
              marginTop: scaled(8),
              border: `1px solid ${lastYear ? t.gold : t.lineSoft}`,
              borderRadius: 6,
              background: t.card,
              padding: `${scaled(10)} ${scaled(12)}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: scaled(8),
            }}
          >
            <Stat value={formatSalary(career.contract.salary)} label="por temporada" size={18} />
            <Stat value={career.contract.seasonsLeft} label="temporadas restantes" size={18} />
            <Stat value={formatSalary(career.earnings)} label="já recebido" size={18} />
          </div>
          {/* O último ano é a única informação daqui que muda uma decisão: é
              quando a renovação aparece na janela — ou não aparece. */}
          {lastYear && (
            <div style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.goldText }}>
              Último ano de contrato. Na próxima janela o {clubById(career.clubId)?.name} decide
              se propõe renovação.
            </div>
          )}
        </section>

        <section>
          <SectionLabel>Como você está sendo visto</SectionLabel>
          <div
            style={{
              marginTop: scaled(8),
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: scaled(8),
            }}
          >
            {MORALE_KEYS.map((key) => {
              const value = career.morale[key]

              return (
                <div
                  key={key}
                  style={{
                    border: `1px solid ${t.lineSoft}`,
                    borderRadius: 6,
                    background: t.card,
                    padding: `${scaled(8)} ${scaled(10)}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <div style={{ fontSize: scaled(11), fontWeight: 700 }}>
                      {MORALE_LABEL[key]}
                    </div>
                    <div style={{ fontSize: scaled(10), color: t.mutedStrong }}>
                      {key === 'reputation' ? reputationLabel(value) : moraleLabel(value)}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: scaled(6),
                      height: 4,
                      borderRadius: 999,
                      background: t.line,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${value}%`,
                        height: '100%',
                        background: value >= 50 ? t.green : t.accent,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <TrainingPicker game={game} />
      </div>
    </ScreenLayout>
  )
}

/**
 * O próximo compromisso do jogador.
 *
 * Adversário, competição, rodada e mando ficam à vista antes de ele decidir
 * jogar: sem isso o botão de "próximo jogo" é um salto no escuro, e voltar de
 * uma partida não dizia nada sobre a seguinte.
 */
function NextMatch({ game }: { game: Game }) {
  const next = game.nextMatch

  if (!next) {
    return (
      <div style={{ fontSize: scaled(10), color: t.faintText, textAlign: 'center' }}>
        Temporada encerrada — o próximo jogo abre o fim de temporada.
      </div>
    )
  }

  return (
    <div
      style={{
        border: `1px solid ${t.lineSoft}`,
        borderRadius: 6,
        background: t.card,
        padding: `${scaled(8)} ${scaled(10)}`,
      }}
    >
      <div
        style={{
          fontSize: scaled(9),
          color: t.faintText,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Próximo jogo
      </div>
      <div
        style={{
          marginTop: scaled(4),
          display: 'flex',
          alignItems: 'center',
          gap: scaled(8),
        }}
      >
        <ClubCrest clubId={next.opponentId} size={20} />
        <div style={{ fontSize: scaled(13), fontWeight: 800, minWidth: 0 }}>
          {next.opponentName}
        </div>
        <Badge
          bg={next.atHome ? t.greenSoft : t.accentSoft}
          color={next.atHome ? t.greenText : t.text}
        >
          {next.atHome ? 'Em casa' : 'Fora'}
        </Badge>
      </div>
      <div style={{ marginTop: scaled(4), fontSize: scaled(10), color: t.mutedStrong }}>
        {next.competition} · {next.round}ª rodada de {next.totalRounds} · {next.season}
      </div>
    </div>
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
