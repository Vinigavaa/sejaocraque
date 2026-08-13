import type { ReactNode } from 'react'

import { scaled } from '@/lib/ui/theme'

/** Ordem de empilhamento no celular. O desktop nao usa isso. */
export type Slot = 'left' | 'center' | 'right'

const DEFAULT_ORDER: Slot[] = ['center', 'left', 'right']

/**
 * Os tres lotes de uma tela.
 *
 * A tela decide o que vai em cada lote; este componente so sabe posicionar.
 * O mesmo DOM serve os dois breakpoints — no celular vira uma coluna, no
 * desktop uma grade — e a disposicao do desktop vem de `grid-area`, nao da
 * ordem do JSX. Por isso a ordem do celular pode ser declarada a parte, sem
 * amarrar uma coisa na outra.
 *
 * Um lote vazio nao reserva coluna: a grade do `globals.css` reage aos
 * atributos `data-has-left` / `data-has-right`.
 */
export function ScreenLayout({
  left,
  right,
  mobileOrder = DEFAULT_ORDER,
  children,
}: {
  left?: ReactNode
  right?: ReactNode
  mobileOrder?: Slot[]
  children: ReactNode
}) {
  const slots: Record<Slot, ReactNode> = { left, center: children, right }

  // `mobileOrder` ordena, nao seleciona: um lote passado e sempre renderizado.
  // Sem isso, esquecer um nome na lista sumia com o conteudo no desktop
  // tambem, e o sintoma nao aponta para a lista.
  const order: Slot[] = [
    ...mobileOrder,
    ...(['left', 'center', 'right'] as Slot[]).filter((slot) => !mobileOrder.includes(slot)),
  ]

  return (
    <div
      data-layout
      data-has-left={left ? '' : undefined}
      data-has-right={right ? '' : undefined}
    >
      {order.map((slot) =>
        slots[slot] ? (
          // `data-slot` e quem rola (o CSS lhe da `overflow-y: auto`), e por
          // isso precisa ocupar a faixa inteira do lote: e a borda dele que
          // vira a barra de rolagem. A centralizacao do centro mora num filho
          // à parte — se ficasse no proprio `data-slot`, a barra nascia na
          // borda do conteudo centralizado, flutuando longe da lateral real
          // da tela.
          <div key={slot} data-slot={slot} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                // Sem isso o item flex encolhe para caber nos 828px visiveis
                // do `data-slot`, e o conteudo que sobra (o botao final,
                // nestas telas) vaza por baixo em vez de esticar a altura
                // real e disparar a rolagem.
                flexShrink: 0,
                padding: slot === 'center' ? scaled(20) : scaled(16),
                // O centro nao cresce sem limite — uma linha de texto de 1800px
                // nao se le. O teto so passa a valer acima de ~1700px de
                // viewport; em 1440px o centro ja e menor que ele.
                ...(slot === 'center'
                  ? { maxWidth: 1100, width: '100%', marginInline: 'auto', minHeight: '100%' }
                  : null),
              }}
            >
              {slots[slot]}
            </div>
          </div>
        ) : null,
      )}
    </div>
  )
}
