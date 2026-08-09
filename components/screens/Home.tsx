import { ScreenLayout } from '../ScreenLayout'
import { Display, PrimaryButton, scaled, SectionLabel, t } from '../shared'

/** O que a carreira pode virar. Fixo, ilustrativo — vende o espectro do jogo. */
const EXAMPLES = [
  {
    badge: 'JOGADOR COMUM',
    badgeBg: 'oklch(95% 0.01 70 / 0.08)',
    badgeColor: t.mutedStrong,
    ovr: 74,
    goals: 86,
    titles: 1,
    ballon: 0,
  },
  {
    badge: 'CRAQUE',
    badgeBg: t.goldSoft,
    badgeColor: t.goldText,
    ovr: 90,
    goals: 360,
    titles: 9,
    ballon: 1,
  },
  {
    badge: 'O TOPO',
    badgeBg: t.danger,
    badgeColor: t.accent,
    ovr: 99,
    goals: 720,
    titles: 24,
    ballon: 8,
  },
]

export function Home({ onPlay }: { onPlay: () => void }) {
  return (
    <ScreenLayout mobileOrder={['center', 'right']} right={<Examples />}>
      <SectionLabel style={{ letterSpacing: '0.1em' }}>
        SIMULADOR DE CARREIRA · 16 — APOSENTADORIA
      </SectionLabel>

      <Display size={56} style={{ marginTop: scaled(10), lineHeight: 0.92, letterSpacing: '-0.01em' }}>
        VOCÊ É
        <br />O CRAQUE?
      </Display>

      <div
        style={{
          marginTop: scaled(16),
          fontSize: scaled(16),
          lineHeight: 1.5,
          color: 'oklch(75% 0.015 70)',
          maxWidth: '38ch',
        }}
      >
        Roube um atributo de cada lenda que aparece no draft. Monte seu jogador do zero. Viva
        uma carreira inteira e descubra onde você fica entre os maiores.
      </div>

      <PrimaryButton onClick={onPlay} style={{ marginTop: scaled(24) }}>
        JOGAR →
      </PrimaryButton>

      <div style={{ marginTop: scaled(24), display: 'flex', alignItems: 'center', gap: scaled(8) }}>
        {['ROLE', 'MONTE', 'VIVA'].map((step, index) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: scaled(8) }}>
            {index > 0 && <div style={{ color: t.faintText }}>→</div>}
            <Display size={18} style={{ color: t.gold }}>
              {step}
            </Display>
          </div>
        ))}
      </div>

      <div style={{ marginTop: scaled(6), fontSize: scaled(12), color: t.muted }}>
        Role uma lenda por rodada, monte seu jogador roubando atributos, viva a carreira
        temporada a temporada.
      </div>

      <div
        style={{
          marginTop: scaled(32),
          fontSize: scaled(11),
          color: 'oklch(60% 0.015 70)',
          lineHeight: 1.5,
          borderTop: `1px solid ${t.lineSoft}`,
          paddingTop: scaled(16),
        }}
      >
        CRAQUE não possui afiliação com nenhuma liga, clube ou jogador. Nomes citados a título
        de referência histórica.
      </div>
    </ScreenLayout>
  )
}

/** Vitrine do espectro do jogo. No desktop vive no trilho direito. */
function Examples() {
  return (
    <>
      <SectionLabel>O que você pode virar</SectionLabel>

      <div style={{ marginTop: scaled(12), display: 'flex', flexDirection: 'column', gap: scaled(10) }}>
        {EXAMPLES.map((example) => (
          <div
            key={example.badge}
            style={{
              border: `2px solid ${t.lineSoft}`,
              borderRadius: 8,
              padding: scaled(16),
              background: t.card,
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div
                style={{
                  fontSize: scaled(11),
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: example.badgeBg,
                  color: example.badgeColor,
                  padding: `${scaled(4)} ${scaled(10)}`,
                  borderRadius: 999,
                }}
              >
                {example.badge}
              </div>
              <Display size={32}>{example.ovr}</Display>
            </div>

            <div
              style={{
                marginTop: scaled(10),
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: scaled(8),
              }}
            >
              {[
                { value: example.goals, label: 'gols' },
                { value: example.titles, label: 'títulos' },
                { value: example.ballon, label: 'bolas de ouro' },
              ].map((item) => (
                <div key={item.label}>
                  <Display size={20}>{item.value}</Display>
                  <div
                    style={{
                      fontSize: scaled(10),
                      color: t.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </>
  )
}
