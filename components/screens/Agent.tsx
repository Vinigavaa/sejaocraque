'use client'

import type { Game } from '@/lib/game/useGame'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { destinationGroups, FAREWELL_AGE, MAX_PREFERENCES } from '@/lib/sim/transfers'

import { LeagueCrest } from '../Crest'
import { ScreenLayout } from '../ScreenLayout'
import { Display, GhostButton, scaled, SectionLabel, t } from '../shared'

/**
 * Onde o jogador diz ao empresario para onde quer ir.
 *
 * Marcar um pais cobre todas as divisoes dele; marcar uma liga e mais
 * especifico. Sao ambicoes diferentes — "quero jogar na Espanha" aceita a
 * Segunda, "quero La Liga" nao.
 *
 * O pedido vale da proxima janela em diante. As propostas da temporada que
 * acabou ja estao decididas, e mudar o pedido agora nao as reescreve.
 */
export function Agent({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  const preferences = career.preferences
  const full = preferences.length >= MAX_PREFERENCES
  const club = clubById(career.clubId)

  // No fim da carreira o pedido deixa de ser uma lista de desejos e vira uma
  // decisao unica: onde pendurar as chuteiras.
  if (career.age >= FAREWELL_AGE) return <Farewell game={game} />

  const toggle = (id: string) => {
    if (preferences.includes(id)) {
      game.updatePreferences(preferences.filter((entry) => entry !== id))
      return
    }

    if (full) return
    game.updatePreferences([...preferences, id])
  }

  return (
    <ScreenLayout mobileOrder={['center']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(16) }}>
        <div>
          <SectionLabel>SEU EMPRESÁRIO</SectionLabel>
          <Display size={24} style={{ marginTop: scaled(4) }}>
            PARA ONDE VOCÊ QUER IR?
          </Display>
          <div
            style={{
              marginTop: scaled(8),
              fontSize: scaled(12),
              color: t.muted,
              lineHeight: 1.5,
            }}
          >
            Escolha até {MAX_PREFERENCES} destinos e seu empresário vai procurar
            propostas principalmente neles. Sem nenhum escolhido, ele ouve o mundo
            inteiro.
          </div>
          {!!club && (
            <div style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.faintText }}>
              Hoje no {club.name}. O pedido vale para a próxima janela.
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: scaled(11),
            fontWeight: 800,
            color: full ? t.goldText : t.mutedStrong,
          }}
        >
          {preferences.length}/{MAX_PREFERENCES} escolhidos
          {full && ' · desmarque um para trocar'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(10) }}>
          {destinationGroups().map((group) => {
            const countryOn = preferences.includes(group.country)

            return (
              <div
                key={group.country}
                style={{
                  border: `1px solid ${t.lineSoft}`,
                  borderRadius: 6,
                  background: t.card,
                  padding: scaled(10),
                }}
              >
                <Choice
                  label={`${group.flag} ${group.label} — qualquer divisão`}
                  selected={countryOn}
                  disabled={full && !countryOn}
                  onClick={() => toggle(group.country)}
                  strong
                />

                {/* Com o país inteiro pedido, a divisão específica é redundante. */}
                {!countryOn && (
                  <div
                    style={{
                      marginTop: scaled(8),
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: scaled(6),
                    }}
                  >
                    {group.leagues.map((league) => {
                      const on = preferences.includes(league.id)

                      return (
                        <Choice
                          key={league.id}
                          label={league.name}
                          crest={league.id}
                          selected={on}
                          disabled={full && !on}
                          onClick={() => toggle(league.id)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <GhostButton onClick={game.closeAgent}>VOLTAR</GhostButton>
      </div>
    </ScreenLayout>
  )
}

/**
 * A escolha da liga onde a carreira termina, dos {FAREWELL_AGE} anos em diante.
 *
 * Diferente do pedido de destinos, aqui e uma liga so — e o empresario passa a
 * trabalhar aquele mercado especificamente, trazendo pelo menos uma proposta de
 * la por temporada enquanto o jogador tiver nivel para algum clube da liga.
 *
 * Trocar de ideia e permitido a qualquer momento: a nova liga vale da proxima
 * janela em diante, como todo pedido.
 */
function Farewell({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  const chosen = career.farewellLeagueId
  const chosenLeague = chosen ? leagueById(chosen) : undefined
  const club = clubById(career.clubId)

  return (
    <ScreenLayout mobileOrder={['center']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(16) }}>
        <div>
          <SectionLabel>SEU EMPRESÁRIO</SectionLabel>
          <Display size={24} style={{ marginTop: scaled(4) }}>
            ONDE VOCÊ QUER TERMINAR?
          </Display>
          <div
            style={{
              marginTop: scaled(8),
              fontSize: scaled(12),
              color: t.muted,
              lineHeight: 1.5,
            }}
          >
            Escolha uma liga e seu empresário trabalha só aquele mercado. A cada
            temporada ele traz pelo menos uma proposta de lá, enquanto você tiver
            nível para algum clube da liga.
          </div>
          {!!club && (
            <div style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.faintText }}>
              {career.age} anos, hoje no {club.name}. O pedido vale para a próxima
              janela.
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: scaled(11),
            fontWeight: 800,
            color: chosenLeague ? t.goldText : t.mutedStrong,
          }}
        >
          {chosenLeague
            ? `Destino: ${chosenLeague.name} · toque de novo para desfazer`
            : 'Nenhuma liga escolhida — o empresário ouve o mundo inteiro'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(10) }}>
          {destinationGroups().map((group) => (
            <div
              key={group.country}
              style={{
                border: `1px solid ${t.lineSoft}`,
                borderRadius: 6,
                background: t.card,
                padding: scaled(10),
              }}
            >
              <div
                style={{
                  fontSize: scaled(12),
                  fontWeight: 800,
                  color: t.mutedStrong,
                }}
              >
                {group.flag} {group.label}
              </div>

              <div
                style={{
                  marginTop: scaled(8),
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: scaled(6),
                }}
              >
                {group.leagues.map((league) => {
                  const on = chosen === league.id

                  return (
                    <Choice
                      key={league.id}
                      label={league.name}
                      crest={league.id}
                      selected={on}
                      disabled={false}
                      onClick={() => game.chooseFarewellLeague(on ? null : league.id)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <GhostButton onClick={game.closeAgent}>VOLTAR</GhostButton>
      </div>
    </ScreenLayout>
  )
}

function Choice({
  label,
  crest,
  selected,
  disabled,
  onClick,
  strong,
}: {
  label: string
  crest?: string
  selected: boolean
  disabled: boolean
  onClick: () => void
  strong?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: scaled(6),
        background: selected ? t.accentSoft : 'transparent',
        border: `1px solid ${selected ? t.accent : t.lineSoft}`,
        borderRadius: 6,
        padding: `${scaled(6)} ${scaled(10)}`,
        color: disabled ? t.faintText : selected ? t.text : t.mutedStrong,
        fontWeight: strong ? 800 : 700,
        fontSize: scaled(strong ? 12 : 11),
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: strong ? '100%' : undefined,
        textAlign: 'left',
      }}
    >
      {crest && <LeagueCrest leagueId={crest} size={14} />}
      {label}
    </button>
  )
}
