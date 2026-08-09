import type { ReactNode } from 'react'

/**
 * Entrada de tela.
 *
 * A animacao em si esta em `globals.css`, dentro de
 * `prefers-reduced-motion: no-preference` — aqui so marca-se o que anima.
 *
 * A `key` e o que faz a tela animar uma vez por entrada: trocar de tela
 * remonta o no, atualizar dentro da mesma tela nao.
 */
export function ScreenTransition({
  screen,
  children,
}: {
  screen: string
  children: ReactNode
}) {
  return (
    <div key={screen} data-motion="screen">
      {children}
    </div>
  )
}
