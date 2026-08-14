'use client'

import { useState } from 'react'

import { RENEWAL_KEY, type Game, type NegotiationResult } from '@/lib/game/useGame'
import {
  BAND_LABEL,
  chanceBand,
  formatSalary,
  MAX_YEARS,
  MIN_YEARS,
  paysAboveMarket,
  ROLE_LABEL,
  squadRole,
  successChance,
  type ChanceBand,
  type ContractTerms,
  type Negotiation,
} from '@/lib/sim/contracts'
import { clubById } from '@/lib/sim/data/clubs'
import { leagueById } from '@/lib/sim/data/leagues'
import { matchesPreference } from '@/lib/sim/transfers'
import { leagueOfClub } from '@/lib/sim/world'

import { ClubCrest } from '../Crest'
import { ScreenLayout } from '../ScreenLayout'
import { Badge, Display, GhostButton, scaled, SectionLabel, t } from '../shared'

const BAND_COLOR: Record<ChanceBand, string> = {
  aceita: t.greenText,
  provavel: t.greenText,
  limite: t.goldText,
  arriscada: t.dangerText,
  recusa: t.dangerText,
}

/**
 * A janela de transferencias.
 *
 * Aqui o jogador ve as duas propostas lado a lado — e, no ultimo ano de
 * contrato, tambem a renovacao do clube atual. Cada mesa mostra o que
 * realmente decide a escolha: salario, duracao, o papel que ele teria naquele
 * elenco e em que liga isso acontece.
 *
 * A tela nao decide nada por conta propria. Chance de sucesso, teto e termos
 * vem todos do motor; o que ela faz e deixar o jogador enxergar o risco antes
 * de correr.
 */
export function Market({ game }: { game: Game }) {
  const career = game.career
  if (!career) return null

  const club = clubById(career.clubId)
  const expired = career.contract.seasonsLeft <= 0

  // A recusa apaga a proposta do estado, mas ela nao pode sumir da tela: o
  // jogador precisa ver que aquele clube levantou da mesa, e por causa de que.
  const refused = Object.entries(game.negotiated)
    .filter(([, result]) => result === 'recusa')
    .map(([target]) => target)

  return (
    <ScreenLayout mobileOrder={['center']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: scaled(16) }}>
        <div>
          <SectionLabel>JANELA DE TRANSFERÊNCIAS</SectionLabel>
          <Display size={24} style={{ marginTop: scaled(4) }}>
            {expired ? 'SEU CONTRATO ACABOU' : 'O QUE HÁ NA MESA'}
          </Display>
          <div
            style={{
              marginTop: scaled(8),
              fontSize: scaled(12),
              color: expired ? t.dangerText : t.muted,
              lineHeight: 1.5,
            }}
          >
            {expired
              ? `Você está livre no mercado. Sem assinar com alguém agora, sua carreira
                 termina aqui.`
              : `Contrato com o ${club?.name}: ${formatSalary(career.contract.salary)} por
                 temporada, ${career.contract.seasonsLeft} ${
                   career.contract.seasonsLeft === 1 ? 'temporada' : 'temporadas'
                 } até o fim.`}
          </div>
          <div style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.faintText }}>
            Cada clube aceita uma exigência. Pediu além do que eles consideram justo, o
            risco é perder a proposta.
          </div>
        </div>

        {!!career.renewal && (
          <Table
            game={game}
            target={RENEWAL_KEY}
            clubId={career.clubId}
            terms={career.renewal}
            renewal
          />
        )}

        {career.offers.map((offer) => (
          <Table
            key={offer.clubId}
            game={game}
            target={offer.clubId}
            clubId={offer.clubId}
            terms={offer.terms}
          />
        ))}

        {refused.map((target) => (
          <Refused
            key={target}
            clubId={target === RENEWAL_KEY ? career.clubId : target}
            renewal={target === RENEWAL_KEY}
          />
        ))}

        <GhostButton
          onClick={game.leaveMarket}
          style={expired ? { borderColor: t.dangerText, color: t.dangerText } : undefined}
        >
          {expired ? 'ENCERRAR A CARREIRA' : 'FICAR ONDE ESTOU'}
        </GhostButton>
      </div>
    </ScreenLayout>
  )
}

/** Uma mesa: a proposta de um clube e a negociação dela. */
function Table({
  game,
  target,
  clubId,
  terms,
  renewal,
}: {
  game: Game
  target: string
  clubId: string
  terms: ContractTerms
  renewal?: boolean
}) {
  const career = game.career
  const club = clubById(clubId)
  const mesa = game.mesaFor(target)

  const [open, setOpen] = useState(false)

  if (!career || !club || !mesa) return null

  const league = leagueById(club.leagueId)
  const result: NegotiationResult | undefined = game.negotiated[target]
  const role = squadRole(game.liveOverall, club)

  // Fecha o ciclo do pedido feito ao empresário: quando a proposta vem de um
  // destino escolhido, o jogador precisa ver que foi por isso.
  const farewell = career.farewellLeagueId
  const preferences = farewell ? [farewell] : career.preferences
  // A divisão vem do mundo, e não dos dados: um clube que subiu conta como
  // clube da divisão nova no pedido feito ao empresário.
  const clubLeague = leagueOfClub(career.world, club.id)
  const asked =
    !renewal &&
    preferences.length > 0 &&
    clubLeague !== undefined &&
    matchesPreference(club, preferences, clubLeague)

  return (
    <div
      style={{
        border: `1px solid ${result === 'acerto' ? t.green : t.lineSoft}`,
        borderRadius: 8,
        background: t.card,
        padding: scaled(12),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(10) }}>
        <ClubCrest clubId={club.id} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Display size={17}>{club.name}</Display>
          <div style={{ marginTop: scaled(2), fontSize: scaled(11), color: t.muted }}>
            {league?.name} · {ROLE_LABEL[role]}
          </div>
        </div>
        {renewal && (
          <Badge bg={t.accentSoft} color={t.text}>
            Renovação
          </Badge>
        )}
        {asked && (
          <Badge bg={t.goldSoft} color={t.goldText}>
            ★ Você pediu
          </Badge>
        )}
        {/* O salário é o argumento desses clubes, e ele fica na primeira
            linha do card para ser comparado antes de qualquer outra coisa. */}
        {!renewal && paysAboveMarket(club) && (
          <Badge bg={t.greenSoft} color={t.greenText}>
            Paga acima do mercado
          </Badge>
        )}
      </div>

      <div
        style={{
          marginTop: scaled(12),
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: scaled(8),
        }}
      >
        <Field label="salário / temporada" value={formatSalary(terms.salary)} />
        <Field
          label="duração"
          value={`${terms.years} ${terms.years === 1 ? 'temporada' : 'temporadas'}`}
        />
      </div>

      <div
        style={{
          marginTop: scaled(8),
          fontSize: scaled(11),
          color: role === 'reserva' ? t.dangerText : t.mutedStrong,
          lineHeight: 1.4,
        }}
      >
        {conditionText(role, renewal ?? false)}
      </div>

      {result === 'acerto' && (
        <div
          style={{
            marginTop: scaled(8),
            fontSize: scaled(11),
            fontWeight: 800,
            color: t.greenText,
          }}
        >
          Acertado na negociação — falta só assinar.
        </div>
      )}

      {open && !result && <Bargain mesa={mesa} target={target} game={game} />}

      <div
        style={{
          marginTop: scaled(12),
          display: 'grid',
          gridTemplateColumns: result ? '1fr' : '1fr 1fr',
          gap: scaled(8),
        }}
      >
        {!result && (
          <GhostButton onClick={() => setOpen((current) => !current)}>
            {open ? 'DESISTIR' : 'NEGOCIAR'}
          </GhostButton>
        )}
        <GhostButton
          onClick={renewal ? game.acceptRenewal : () => game.acceptOffer(clubId)}
          style={{ background: t.accent, border: 'none', color: 'white' }}
        >
          {renewal ? 'RENOVAR' : 'ASSINAR'}
        </GhostButton>
      </div>
    </div>
  )
}

/**
 * O painel de exigencia.
 *
 * A barra de chance e o coracao da tela: ela e recalculada a cada arrastada,
 * pela mesma funcao que o motor usa para sortear o resultado. O jogador ve o
 * risco exato que esta correndo — nao uma aproximacao feita para a interface.
 */
function Bargain({
  mesa,
  target,
  game,
}: {
  mesa: Negotiation
  target: string
  game: Game
}) {
  const [salary, setSalary] = useState(mesa.offer.salary)
  const [years, setYears] = useState(mesa.offer.years)

  // Deixa passar do teto de proposito: ver a barra zerar ensina onde o limite
  // esta muito melhor do que um slider que simplesmente trava.
  const max = Math.max(mesa.ceiling * 1.2, mesa.offer.salary * 1.3)
  const min = Math.max(0.01, mesa.offer.salary * 0.7)

  const ask: ContractTerms = { salary, years }
  const chance = successChance(mesa, ask)
  const band = chanceBand(chance)

  return (
    <div
      style={{
        marginTop: scaled(12),
        borderTop: `1px solid ${t.lineSoft}`,
        paddingTop: scaled(12),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: scaled(11), color: t.muted }}>Você exige</div>
        <Display size={18}>{formatSalary(salary)}</Display>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={(max - min) / 60}
        value={salary}
        onChange={(event) => setSalary(Number(event.target.value))}
        aria-label="Salário exigido"
        style={{ width: '100%', marginTop: scaled(6), accentColor: t.accent }}
      />

      <div
        style={{
          marginTop: scaled(10),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: scaled(11), color: t.muted }}>
          Duração · o clube quer {mesa.preferredYears}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: scaled(8) }}>
          <Step label="−" onClick={() => setYears((y) => Math.max(MIN_YEARS, y - 1))} />
          <Display size={16}>{years}</Display>
          <Step label="+" onClick={() => setYears((y) => Math.min(MAX_YEARS, y + 1))} />
        </div>
      </div>

      <div
        style={{
          marginTop: scaled(12),
          height: 6,
          borderRadius: 999,
          background: t.line,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(chance * 100)}%`,
            height: '100%',
            background: BAND_COLOR[band],
            transition: 'width 120ms linear',
          }}
        />
      </div>
      <div
        style={{
          marginTop: scaled(6),
          fontSize: scaled(11),
          fontWeight: 800,
          color: BAND_COLOR[band],
        }}
      >
        {Math.round(chance * 100)}% · {BAND_LABEL[band]}
      </div>

      <GhostButton
        onClick={() => game.negotiate(target, ask)}
        style={{ marginTop: scaled(10), width: '100%', borderColor: BAND_COLOR[band] }}
      >
        ENVIAR EXIGÊNCIA
      </GhostButton>
    </div>
  )
}

/** O que sobra de uma mesa em que o clube levantou. */
function Refused({ clubId, renewal }: { clubId: string; renewal: boolean }) {
  const club = clubById(clubId)

  return (
    <div
      style={{
        border: `1px solid ${t.lineSoft}`,
        borderRadius: 8,
        padding: scaled(12),
        opacity: 0.55,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(10) }}>
        <ClubCrest clubId={club?.id} size={28} />
        <div style={{ fontSize: scaled(12), fontWeight: 800 }}>{club?.name}</div>
      </div>
      <div style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.dangerText }}>
        {renewal
          ? 'A diretoria não aceitou seus termos e retirou a proposta de renovação.'
          : 'Acharam a exigência alta demais e desistiram da contratação.'}
      </div>
    </div>
  )
}

function conditionText(role: ReturnType<typeof squadRole>, renewal: boolean): string {
  if (role === 'reserva') {
    return renewal
      ? 'O elenco cresceu acima de você — deve sobrar banco nesta temporada.'
      : 'Elenco muito acima do seu nível: você provavelmente começa no banco.'
  }

  if (role === 'rotacao') return 'Elenco forte — você deve alternar entre time e banco.'
  if (role === 'titular') return 'Você entra como titular neste elenco.'
  return 'Você seria a referência do elenco, e o salário reflete isso.'
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${t.lineSoft}`,
        borderRadius: 6,
        padding: `${scaled(8)} ${scaled(10)}`,
      }}
    >
      <div style={{ fontSize: scaled(9), color: t.faintText, textTransform: 'uppercase' }}>
        {label}
      </div>
      <Display size={16} style={{ marginTop: scaled(4) }}>
        {value}
      </Display>
    </div>
  )
}

function Step({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: scaled(28),
        height: scaled(28),
        borderRadius: 6,
        border: `1px solid ${t.lineSoft}`,
        background: 'transparent',
        color: t.text,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
