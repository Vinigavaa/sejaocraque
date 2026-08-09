import { NATIONS } from '@/lib/sim/data/nations'
import type { DraftMode } from '@/lib/sim/draft'
import { POSITIONS, POSITION_LABEL, type Position } from '@/lib/sim/types'
import type { Game } from '@/lib/game/useGame'

import { Flag } from '../Flag'
import { PlayerCard } from '../PlayerCard'
import { ScreenLayout } from '../ScreenLayout'
import { Display, PrimaryButton, scaled, SectionLabel, SelectCard, t } from '../shared'

const SHIRT_NUMBERS = [7, 9, 10, 11, 17, 23]

const MODES: { id: DraftMode; title: string; description: string }[] = [
  { id: 'amador', title: 'AMADOR', description: 'Vê as notas das lendas. 3 re-sorteios.' },
  { id: 'pro', title: 'PRO', description: 'Notas escondidas. 1 re-sorteio.' },
]

/** Previa neutra: mostra a forma do cartao antes de existir um jogador. */
const PREVIEW_ATTRS = { vel: 0, fin: 0, pas: 0, dri: 0, def: 0, fis: 0, fintas: 0, pernaRuim: 0 }

export function Create({ game }: { game: Game }) {
  return (
    <ScreenLayout
      mobileOrder={['center']}
      right={
        <>
          <SectionLabel>Prévia</SectionLabel>
          <div style={{ marginTop: scaled(10) }}>
            <PlayerCard
              variant="rail"
              name={game.name || 'SEU NOME'}
              shirtNumber={game.shirtNumber ?? 10}
              position={game.position ?? 'ATA'}
              nationality={game.nationality ?? undefined}
              overall={0}
              attrs={PREVIEW_ATTRS}
            />
          </div>
          <div style={{ marginTop: scaled(10), fontSize: scaled(11), color: t.faintText, lineHeight: 1.5 }}>
            Os atributos só existem depois do draft — é lá que você rouba cada um de uma lenda.
          </div>
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: scaled(12) }}>
        <button
          onClick={() => game.setScreen('home')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: scaled(20),
            cursor: 'pointer',
            color: t.text,
            padding: scaled(4),
          }}
          aria-label="Voltar"
        >
          ←
        </button>
        <Display size={20} style={{ letterSpacing: '0.01em' }}>
          CRIE SEU JOGADOR
        </Display>
      </div>

      <SectionLabel style={{ marginTop: scaled(24) }}>Nome</SectionLabel>
      <input
        value={game.name}
        onChange={(event) => game.setName(event.target.value)}
        placeholder="como o mundo vai te chamar"
        maxLength={22}
        style={{
          marginTop: scaled(8),
          border: `2px solid ${t.line}`,
          borderRadius: 6,
          padding: scaled(14),
          fontSize: scaled(16),
          fontFamily: 'inherit',
          background: t.card,
          color: t.text,
          outline: 'none',
        }}
      />

      <SectionLabel style={{ marginTop: scaled(24) }}>Nacionalidade</SectionLabel>

      {/* Desktop: uma lista de 50 paises em cartoes come metade da tela e ainda
          exige rolar uma caixa dentro da pagina. Um select resolve em uma linha
          — e o mesmo estado alimenta a grade do celular, onde o toque manda. */}
      <div data-nation-select>
        <Flag nationality={game.nationality ?? undefined} size={22} />
        <select
          value={game.nationality ?? ''}
          onChange={(event) => game.setNationality(event.target.value)}
          aria-label="Nacionalidade"
          style={{
            flex: 1,
            border: `2px solid ${t.line}`,
            borderRadius: 6,
            padding: scaled(12),
            fontSize: scaled(15),
            fontFamily: 'inherit',
            background: t.card,
            color: game.nationality ? t.text : t.faintText,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="" disabled>
            de onde você veio
          </option>
          {NATIONS.map((nation) => (
            <option key={nation.id} value={nation.id} style={{ color: t.text }}>
              {nation.name}
            </option>
          ))}
        </select>
      </div>

      <div data-nation-grid>
        {NATIONS.map((nation) => (
          <SelectCard
            key={nation.id}
            selected={game.nationality === nation.id}
            onClick={() => game.setNationality(nation.id)}
            style={{ textAlign: 'center', padding: `${scaled(10)} ${scaled(4)}` }}
          >
            <Flag nationality={nation.id} size={20} />
            <div style={{ marginTop: scaled(4), fontSize: scaled(10), fontWeight: 600 }}>{nation.name}</div>
          </SelectCard>
        ))}
      </div>

      <SectionLabel style={{ marginTop: scaled(24) }}>Posição</SectionLabel>
      <div
        style={{
          marginTop: scaled(8),
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: scaled(8),
        }}
      >
        {POSITIONS.map((code: Position) => (
          <SelectCard
            key={code}
            selected={game.position === code}
            onClick={() => game.setPosition(code)}
            style={{ textAlign: 'center', padding: `${scaled(12)} ${scaled(2)}` }}
          >
            <Display size={18}>{code}</Display>
            <div style={{ marginTop: scaled(2), fontSize: scaled(9), color: t.muted }}>
              {POSITION_LABEL[code]}
            </div>
          </SelectCard>
        ))}
      </div>

      <SectionLabel style={{ marginTop: scaled(24) }}>Número da camisa</SectionLabel>
      <div style={{ marginTop: scaled(8), display: 'flex', gap: scaled(8), flexWrap: 'wrap' }}>
        {SHIRT_NUMBERS.map((number) => (
          <SelectCard
            key={number}
            selected={game.shirtNumber === number}
            onClick={() => game.setShirtNumber(number)}
            style={{
              width: scaled(52),
              height: scaled(52),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Display size={22}>{number}</Display>
          </SelectCard>
        ))}
      </div>

      <SectionLabel style={{ marginTop: scaled(24) }}>Modo</SectionLabel>
      <div
        style={{ marginTop: scaled(8), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: scaled(8) }}
      >
        {MODES.map((option) => (
          <SelectCard
            key={option.id}
            selected={game.mode === option.id}
            onClick={() => game.setMode(option.id)}
            style={{ padding: scaled(14) }}
          >
            <Display size={16}>{option.title}</Display>
            <div
              style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.mutedStrong, lineHeight: 1.4 }}
            >
              {option.description}
            </div>
            <div style={{ marginTop: scaled(8), fontSize: scaled(12), minHeight: scaled(16) }}>
              {game.mode === option.id ? '✓ selecionado' : ''}
            </div>
          </SelectCard>
        ))}
      </div>

      <PrimaryButton
        onClick={game.beginDraft}
        disabled={!game.canStartDraft}
        style={{ marginTop: scaled(28) }}
      >
        COMEÇAR DRAFT
      </PrimaryButton>
    </ScreenLayout>
  )
}
