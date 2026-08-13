import { useState } from 'react'

import type { CareerMode } from '@/lib/sim/career'
import { CLUBS } from '@/lib/sim/data/clubs'
import { LEAGUES } from '@/lib/sim/data/leagues'
import { NATIONS } from '@/lib/sim/data/nations'
import type { DraftMode } from '@/lib/sim/draft'
import { POSITIONS, POSITION_LABEL, type Position } from '@/lib/sim/types'
import type { Game } from '@/lib/game/useGame'

import { Flag } from '../Flag'
import { ScreenLayout } from '../ScreenLayout'
import { Display, PrimaryButton, scaled, SectionLabel, SelectCard, t } from '../shared'

const SHIRT_NUMBERS = [7, 9, 10, 11, 17, 23]

const MODES: { id: DraftMode; title: string; description: string }[] = [
  { id: 'amador', title: 'AMADOR', description: 'Vê as notas das lendas. 3 re-sorteios.' },
  { id: 'pro', title: 'PRO', description: 'Notas escondidas. 1 re-sorteio.' },
]

const CAREER_MODE_OPTIONS: { id: CareerMode; title: string; description: string }[] = [
  {
    id: 'classico',
    title: 'CLÁSSICO',
    description: 'A temporada é resolvida de uma vez. Você assiste ao jogo que a decidiu.',
  },
  {
    id: 'jogoAJogo',
    title: 'JOGO A JOGO',
    description: 'Cada partida do campeonato, minuto a minuto, com decisões que mudam a carreira.',
  },
]

/**
 * Os clubes agrupados por liga, do mais forte para o mais fraco dentro de cada
 * uma.
 *
 * Calculado uma vez, fora do componente: sao 400 clubes, e refazer a lista a
 * cada tecla digitada no campo de nome nao muda nada na tela.
 */
const CLUBS_BY_LEAGUE = LEAGUES.map((league) => ({
  id: league.id,
  name: league.name,
  clubs: CLUBS.filter((club) => club.leagueId === league.id).sort(
    (a, b) => b.strength - a.strength,
  ),
})).filter((group) => group.clubs.length > 0)

export function Create({ game }: { game: Game }) {
  // Fica na tela, e nao no estado do jogo: o motor só precisa saber o clube
  // (ou `null`, que é o sorteio). "Ainda estou escolhendo" é uma etapa da
  // interface, e guardá-la no jogo criaria um terceiro estado para uma
  // pergunta que só tem duas respostas.
  const [choosingClub, setChoosingClub] = useState(false)

  const missingClub = choosingClub && !game.startClubId

  return (
    <ScreenLayout>
      {/* Sem o trilho da previa o centro passa a valer a largura toda, e um
          campo de texto de 1000px nao se preenche. O formulario fica numa
          coluna propria, centrada. */}
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          marginInline: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
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

        <SectionLabel style={{ marginTop: scaled(24) }}>Como você vai jogar</SectionLabel>
        <div
          style={{ marginTop: scaled(8), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: scaled(8) }}
        >
          {CAREER_MODE_OPTIONS.map((option) => (
            <SelectCard
              key={option.id}
              selected={game.careerMode === option.id}
              onClick={() => game.setCareerMode(option.id)}
              style={{ padding: scaled(14) }}
            >
              <Display size={16}>{option.title}</Display>
              <div
                style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.mutedStrong, lineHeight: 1.4 }}
              >
                {option.description}
              </div>
              <div style={{ marginTop: scaled(8), fontSize: scaled(12), minHeight: scaled(16) }}>
                {game.careerMode === option.id ? '✓ selecionado' : ''}
              </div>
            </SelectCard>
          ))}
        </div>
        <div style={{ marginTop: scaled(8), fontSize: scaled(10), color: t.faintText, lineHeight: 1.5 }}>
          A escolha vale para a carreira inteira e não pode ser trocada depois.
        </div>

        <SectionLabel style={{ marginTop: scaled(24) }}>Clube inicial</SectionLabel>
        <div
          style={{ marginTop: scaled(8), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: scaled(8) }}
        >
          <SelectCard
            selected={!choosingClub}
            onClick={() => {
              setChoosingClub(false)
              game.setStartClubId(null)
            }}
            style={{ padding: scaled(14) }}
          >
            <Display size={16}>ALEATÓRIO</Display>
            <div
              style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.mutedStrong, lineHeight: 1.4 }}
            >
              O jogo sorteia um clube do seu país, sem favorecer ninguém.
            </div>
            <div style={{ marginTop: scaled(8), fontSize: scaled(12), minHeight: scaled(16) }}>
              {!choosingClub ? '✓ selecionado' : ''}
            </div>
          </SelectCard>

          <SelectCard
            selected={choosingClub}
            onClick={() => setChoosingClub(true)}
            style={{ padding: scaled(14) }}
          >
            <Display size={16}>ESCOLHER CLUBE</Display>
            <div
              style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.mutedStrong, lineHeight: 1.4 }}
            >
              Você diz onde a carreira começa, em qualquer liga do jogo.
            </div>
            <div style={{ marginTop: scaled(8), fontSize: scaled(12), minHeight: scaled(16) }}>
              {choosingClub ? '✓ selecionado' : ''}
            </div>
          </SelectCard>
        </div>

        {choosingClub && (
          <select
            value={game.startClubId ?? ''}
            onChange={(event) => game.setStartClubId(event.target.value || null)}
            aria-label="Clube inicial"
            style={{
              marginTop: scaled(8),
              width: '100%',
              border: `2px solid ${missingClub ? t.accent : t.line}`,
              borderRadius: 6,
              padding: scaled(12),
              fontSize: scaled(15),
              fontFamily: 'inherit',
              background: t.card,
              color: game.startClubId ? t.text : t.faintText,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">onde tudo começa</option>
            {CLUBS_BY_LEAGUE.map((group) => (
              <optgroup key={group.id} label={group.name}>
                {group.clubs.map((club) => (
                  <option key={club.id} value={club.id} style={{ color: t.text }}>
                    {club.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        <div style={{ marginTop: scaled(8), fontSize: scaled(10), color: t.faintText, lineHeight: 1.5 }}>
          {choosingClub
            ? 'Escolher um clube grande facilita o começo, e disputar posição com um elenco melhor que você cobra o preço.'
            : 'Vale só para a estreia. Daí em diante quem move você de clube é o mercado.'}
        </div>

        <SectionLabel style={{ marginTop: scaled(24) }}>Dificuldade do draft</SectionLabel>
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
          disabled={!game.canStartDraft || missingClub}
          style={{ marginTop: scaled(28) }}
        >
          COMEÇAR DRAFT
        </PrimaryButton>
      </div>
    </ScreenLayout>
  )
}
