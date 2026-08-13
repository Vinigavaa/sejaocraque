import { ScreenLayout } from '../ScreenLayout'
import { Display, PrimaryButton, scaled, SectionLabel, t } from '../shared'

/** Os tres numeros que resumem a carreira. Vive no trilho direito no desktop. */
const FACTS = [
  { number: '01', text: 'Estreia aos 16, o primeiro contrato profissional.' },
  { number: '17', text: 'Temporadas até o apito final da carreira.' },
  { number: '1', text: 'Clique cronometrado decide cada gol.' },
]

export function Home({ onPlay }: { onPlay: () => void }) {
  return (
    <ScreenLayout mobileOrder={['center', 'right']} right={<Facts />}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 0,
        }}
      >
        <SectionLabel style={{ color: t.accent, letterSpacing: '0.16em' }}>
          16 ANOS — APOSENTADORIA · 17 TEMPORADAS
        </SectionLabel>

        <Display
          size={88}
          style={{ marginTop: scaled(18), lineHeight: 0.95, letterSpacing: '-0.01em' }}
        >
          SEJA O
          <br />
          CRAQUE !
        </Display>

        <p
          style={{
            marginTop: scaled(28),
            marginBottom: 0,
            fontSize: scaled(17),
            lineHeight: 1.5,
            color: 'oklch(80% 0.015 70)',
            maxWidth: '52ch',
          }}
        >
          Do primeiro contrato à aposentadoria. Você joga, evolui, negocia salário, é convocado
          — ou não — e envelhece. Sem campo, sem bola na tela: cada temporada se decide em
          números, manchetes e decisões.
        </p>

        <PrimaryButton
          onClick={onPlay}
          style={{
            marginTop: scaled(28),
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-anton), Anton, sans-serif',
            fontWeight: 400,
            fontSize: scaled(22),
            letterSpacing: '0.04em',
            color: t.bg,
            borderRadius: 0,
            padding: `${scaled(14)} ${scaled(48)}`,
          }}
        >
          JOGAR
        </PrimaryButton>
      </div>

      <div
        style={{
          marginTop: scaled(32),
          paddingTop: scaled(18),
          borderTop: `1px solid ${t.lineSoft}`,
          fontSize: scaled(11),
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'oklch(56% 0.015 70)',
        }}
      >
        SEJAOCRAQUE.COM — sem afiliação com liga, clube ou jogador
      </div>
    </ScreenLayout>
  )
}

/** Os tres numeros do design, separados por filete. */
function Facts() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: scaled(28),
        minHeight: '100%',
      }}
    >
      {FACTS.map((fact, index) => (
        <div key={fact.number}>
          {index > 0 && (
            <div
              style={{ borderTop: `1px solid ${t.lineSoft}`, marginBottom: scaled(28) }}
            />
          )}
          <Display size={40} style={{ color: t.accent }}>
            {fact.number}
          </Display>
          <div style={{ marginTop: scaled(8), fontSize: scaled(14), color: t.muted }}>
            {fact.text}
          </div>
        </div>
      ))}
    </div>
  )
}
