'use client'

import { useEffect } from 'react'

import { useAuth } from '@/lib/firebase/AuthProvider'
import type { Game } from '@/lib/game/useGame'

import { cardFor } from './card'
import { writeSave } from './store'

/**
 * Grava sozinho a carreira amarrada a uma vaga.
 *
 * Salvar à mão entre uma rodada e outra é frágil por natureza: basta fechar a
 * aba depois de um jogo bom para o progresso sumir, e o jogador só descobre
 * isso ao carregar. Depois que a carreira tem uma vaga — porque foi salva ou
 * porque veio de lá —, cada partida terminada e cada temporada fechada vão
 * para a nuvem sem pedir nada.
 *
 * A escrita acompanha a identidade de `career` e de `matchday`: são
 * justamente os dois objetos que o motor troca ao fim de uma partida. Uma
 * falha aqui é registrada e engolida — perder a rede não pode interromper a
 * carreira de quem está jogando.
 */
export function useAutosave(game: Game) {
  const { user } = useAuth()

  const uid = user?.uid ?? null
  const { slot, canSave, career, matchday, snapshot } = game

  useEffect(() => {
    if (!uid || !slot || !canSave || !career) return

    const saved = snapshot()
    if (!saved) return

    writeSave(uid, slot, saved, cardFor(career)).catch((cause) => {
      console.error('[saves] falha ao gravar automaticamente na vaga', slot, cause)
    })
    // `snapshot` muda a cada alteração do estado do jogo, e usá-lo como
    // dependência gravaria a cada tecla. Quem manda aqui são a carreira e a
    // temporada — o que o fim de uma partida realmente troca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, slot, canSave, career, matchday])
}
