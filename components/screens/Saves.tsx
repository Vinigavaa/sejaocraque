'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/lib/firebase/AuthProvider'
import type { Game } from '@/lib/game/useGame'
import { cardFor } from '@/lib/saves/card'
import { deleteSave, listSaves, readSave, writeSave } from '@/lib/saves/store'
import type { SaveSlot, SaveSlotView } from '@/lib/saves/types'

import { ScreenLayout } from '../ScreenLayout'
import { Display, GhostButton, PrimaryButton, scaled, SectionLabel, t } from '../shared'

/**
 * A tela de conta e das carreiras salvas.
 *
 * Entra pelo cabeçalho, de qualquer ponto do jogo, e faz as duas pontas do
 * mesmo assunto: entrar com o Google e administrar as três vagas. Salvar e
 * carregar moram juntos porque são a mesma decisão vista de dois lados — qual
 * das três vagas é esta carreira.
 */
export function Saves({ game }: { game: Game }) {
  const { user, loading, error: authError, configured, signIn, signOut } = useAuth()

  const [slots, setSlots] = useState<SaveSlotView[] | null>(null)
  const [busy, setBusy] = useState<SaveSlot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const uid = user?.uid ?? null

  const refresh = useCallback(async () => {
    if (!uid) return

    try {
      const list = await listSaves(uid)
      setError(null)
      setSlots(list)
    } catch (cause) {
      console.error('[saves] falha ao listar as carreiras', cause)
      setError('Não foi possível carregar suas carreiras salvas. Verifique a conexão.')
      setSlots(null)
    }
  }, [uid])

  /**
   * A primeira leitura das vagas, e uma nova a cada troca de conta.
   *
   * A escrita no estado acontece dentro do retorno da promessa, e não no corpo
   * do efeito: o efeito só dispara a busca, e quem responde é a nuvem. `alive`
   * descarta a resposta de uma conta que já saiu da tela.
   */
  useEffect(() => {
    if (!uid) return

    let alive = true

    listSaves(uid).then(
      (list) => {
        if (alive) setSlots(list)
      },
      (cause) => {
        console.error('[saves] falha ao listar as carreiras', cause)
        if (!alive) return
        setError('Não foi possível carregar suas carreiras salvas. Verifique a conexão.')
        setSlots(null)
      },
    )

    return () => {
      alive = false
    }
  }, [uid])

  const save = useCallback(
    async (slot: SaveSlot, occupied: boolean) => {
      const snapshot = game.snapshot()
      const career = game.career
      if (!uid || !snapshot || !career) return

      if (occupied && !window.confirm('Sobrescrever a carreira que está nesta vaga?')) return

      setBusy(slot)
      setError(null)
      setNotice(null)

      try {
        await writeSave(uid, slot, snapshot, cardFor(career))

        // A carreira passa a morar nesta vaga: daqui em diante cada partida
        // terminada é gravada sozinha.
        game.setSlot(slot)
        setNotice('Carreira salva. As próximas partidas serão gravadas automaticamente aqui.')
        await refresh()
      } catch (cause) {
        console.error('[saves] falha ao salvar na vaga', slot, cause)
        setError(
          cause instanceof Error && cause.message.startsWith('Esta carreira')
            ? cause.message
            : 'Não foi possível salvar. Verifique a conexão e tente de novo.',
        )
      } finally {
        setBusy(null)
      }
    },
    [uid, game, refresh],
  )

  const load = useCallback(
    async (slot: SaveSlot) => {
      if (!uid) return

      // Carregar substitui o que está em andamento — e o que está em andamento
      // pode nunca ter sido salvo.
      if (game.career && !window.confirm('Abandonar a carreira atual e carregar esta?')) return

      setBusy(slot)
      setError(null)
      setNotice(null)

      try {
        game.restore(await readSave(uid, slot), slot)
      } catch (cause) {
        console.error('[saves] falha ao carregar a vaga', slot, cause)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível carregar esta carreira. Tente de novo.',
        )
      } finally {
        setBusy(null)
      }
    },
    [uid, game],
  )

  const remove = useCallback(
    async (slot: SaveSlot) => {
      if (!uid) return
      if (!window.confirm('Apagar esta carreira salva? Não dá para desfazer.')) return

      setBusy(slot)
      setError(null)
      setNotice(null)

      // Desamarra antes de apagar: se a carreira em curso mora nesta vaga, a
      // próxima partida a gravaria de volta logo depois.
      if (game.slot === slot) game.setSlot(null)

      try {
        await deleteSave(uid, slot)
        setNotice('Carreira apagada.')
        await refresh()
      } catch (cause) {
        console.error('[saves] falha ao apagar a vaga', slot, cause)
        setError('Não foi possível apagar esta carreira. Tente de novo.')
      } finally {
        setBusy(null)
      }
    },
    [uid, game, refresh],
  )

  return (
    <ScreenLayout>
      <SectionLabel style={{ color: t.accent }}>CONTA</SectionLabel>
      <Display size={44} style={{ marginTop: scaled(10) }}>
        MINHAS CARREIRAS
      </Display>

      <p style={{ marginTop: scaled(14), fontSize: scaled(15), color: t.muted, maxWidth: '58ch' }}>
        Entre com o Google para guardar até três carreiras do modo Jogo a Jogo e continuar de
        onde parou, em qualquer aparelho. Depois de escolher a vaga, cada partida terminada é
        gravada nela automaticamente.
      </p>

      {(error ?? authError) && <Message tone="danger">{error ?? authError}</Message>}
      {notice && !error && <Message tone="ok">{notice}</Message>}

      <div style={{ marginTop: scaled(24), flex: 1 }}>
        {!configured ? (
          <Message tone="danger">
            O login não está disponível neste ambiente: faltam as variáveis do Firebase.
          </Message>
        ) : loading ? (
          <div style={{ color: t.muted, fontSize: scaled(15) }}>Verificando sua conta…</div>
        ) : !user ? (
          <PrimaryButton onClick={() => void signIn()} style={{ alignSelf: 'flex-start' }}>
            ENTRAR COM O GOOGLE
          </PrimaryButton>
        ) : (
          <>
            <Account
              name={user.displayName ?? user.email ?? 'jogador'}
              onSignOut={() => void signOut()}
            />

            {!game.canSave && (
              <div style={{ marginTop: scaled(16), fontSize: scaled(13), color: t.muted }}>
                {game.career
                  ? 'Só carreiras do modo Jogo a Jogo em andamento podem ser salvas.'
                  : 'Comece uma carreira no modo Jogo a Jogo para poder salvá-la aqui.'}
              </div>
            )}

            <div
              style={{
                marginTop: scaled(20),
                display: 'grid',
                gap: scaled(12),
              }}
            >
              {slots === null
                ? [1, 2, 3].map((n) => (
                    <div key={n} style={{ color: t.muted, fontSize: scaled(14) }}>
                      Carregando vaga {n}…
                    </div>
                  ))
                : slots.map((view) => (
                    <SlotCard
                      key={view.slot}
                      view={view}
                      busy={busy === view.slot}
                      canSave={game.canSave}
                      active={game.slot === view.slot}
                      onSave={() => void save(view.slot, !!view.summary)}
                      onLoad={() => void load(view.slot)}
                      onDelete={() => void remove(view.slot)}
                    />
                  ))}
            </div>
          </>
        )}
      </div>

      <GhostButton onClick={game.closeSaves} style={{ marginTop: scaled(28) }}>
        VOLTAR
      </GhostButton>
    </ScreenLayout>
  )
}

function Account({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: scaled(12),
        flexWrap: 'wrap',
        paddingBottom: scaled(16),
        borderBottom: `1px solid ${t.lineSoft}`,
      }}
    >
      <div style={{ fontSize: scaled(15), fontWeight: 800 }}>{name}</div>
      <GhostButton
        onClick={onSignOut}
        style={{ marginLeft: 'auto', padding: `${scaled(8)} ${scaled(14)}`, fontSize: scaled(12) }}
      >
        SAIR
      </GhostButton>
    </div>
  )
}

function SlotCard({
  view,
  busy,
  canSave,
  active,
  onSave,
  onLoad,
  onDelete,
}: {
  view: SaveSlotView
  busy: boolean
  canSave: boolean
  /** A carreira em curso mora nesta vaga e é gravada nela a cada partida. */
  active: boolean
  onSave: () => void
  onLoad: () => void
  onDelete: () => void
}) {
  const { summary } = view

  return (
    <div
      style={{
        border: `1px solid ${active ? t.accent : t.line}`,
        background: t.card,
        borderRadius: 6,
        padding: scaled(16),
        display: 'flex',
        alignItems: 'center',
        gap: scaled(16),
        flexWrap: 'wrap',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Display size={26} style={{ color: t.accent, minWidth: scaled(28) }}>
        {view.slot}
      </Display>

      <div style={{ flex: 1, minWidth: scaled(180) }}>
        {summary ? (
          <>
            <div style={{ fontSize: scaled(16), fontWeight: 800 }}>{summary.playerName}</div>
            <div style={{ marginTop: 2, fontSize: scaled(12), color: t.muted }}>
              {summary.clubName} · {summary.season} · {summary.age} anos · OVR {summary.overall}
            </div>
            {summary.savedAt && (
              <div style={{ marginTop: 2, fontSize: scaled(11), color: t.faintText }}>
                Salvo em {new Date(summary.savedAt).toLocaleString('pt-BR')}
              </div>
            )}
            {active && (
              <div style={{ marginTop: scaled(6), fontSize: scaled(11), color: t.accent }}>
                Gravando aqui a cada partida
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: scaled(14), color: t.muted }}>Vaga livre</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: scaled(8), flexWrap: 'wrap' }}>
        {summary && (
          <GhostButton
            onClick={onLoad}
            disabled={busy}
            style={{ padding: `${scaled(10)} ${scaled(16)}`, fontSize: scaled(13) }}
          >
            CARREGAR
          </GhostButton>
        )}
        {canSave && (
          <GhostButton
            onClick={onSave}
            disabled={busy}
            style={{ padding: `${scaled(10)} ${scaled(16)}`, fontSize: scaled(13) }}
          >
            {summary ? 'SOBRESCREVER' : 'SALVAR AQUI'}
          </GhostButton>
        )}
        {summary && (
          <GhostButton
            onClick={onDelete}
            disabled={busy}
            style={{
              padding: `${scaled(10)} ${scaled(16)}`,
              fontSize: scaled(13),
              color: t.dangerText,
            }}
          >
            APAGAR
          </GhostButton>
        )}
      </div>
    </div>
  )
}

function Message({ tone, children }: { tone: 'danger' | 'ok'; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: scaled(16),
        padding: scaled(12),
        borderRadius: 6,
        fontSize: scaled(13),
        background: tone === 'danger' ? t.danger : t.greenSoft,
        color: tone === 'danger' ? t.dangerText : t.greenText,
      }}
    >
      {children}
    </div>
  )
}
