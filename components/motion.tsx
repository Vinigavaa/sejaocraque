'use client'

import { useEffect, type ReactNode } from 'react'

/**
 * Entrada de tela.
 *
 * A animacao em si esta em `globals.css`, dentro de
 * `prefers-reduced-motion: no-preference` — aqui so marca-se o que anima.
 *
 * A `key` e o que faz a tela animar uma vez por entrada: trocar de tela
 * remonta o no, atualizar dentro da mesma tela nao.
 *
 * A remontagem tambem resolve a rolagem do desktop, onde quem rola e cada
 * `[data-slot]`: no comeca zerado. No celular quem rola e a janela, que
 * sobrevive a troca — por isso ela e zerada aqui, senao uma tela nova entra
 * na altura em que a anterior tinha parado.
 */
export function ScreenTransition({
  screen,
  children,
}: {
  screen: string
  children: ReactNode
}) {
  useEffect(() => {
    // `instant` de proposito: isto e uma tela nova chegando, nao uma volta ao
    // topo da mesma tela — animar a subida mostraria o conteudo anterior
    // passando. Respeita quem pediu movimento reduzido pelo mesmo motivo.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [screen])

  return (
    <div key={screen} data-motion="screen">
      {children}
    </div>
  )
}
