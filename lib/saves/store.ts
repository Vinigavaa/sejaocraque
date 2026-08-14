/**
 * As carreiras salvas na nuvem.
 *
 * Um documento por vaga, em `usuarios/{uid}/carreiras/{vaga}`. O estado do
 * jogo vai em um único campo de texto, com o JSON da carreira inteira: o
 * Firestore não aceita lista dentro de lista, e o calendário da temporada
 * (`rounds`) é exatamente isso. Serializar em texto também deixa o formato
 * sob controle do jogo, e não da forma como o banco resolveu quebrar o objeto.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore'

import { firestore } from '@/lib/firebase/client'

import {
  isSaveSlot,
  SAVE_SLOTS,
  SNAPSHOT_VERSION,
  type CareerSnapshot,
  type SaveSlot,
  type SaveSlotView,
  type SaveSummary,
} from './types'

/**
 * Teto do estado serializado, com folga para o resto do documento.
 *
 * Um documento do Firestore vai até 1 MiB. Uma carreira de 17 temporadas fica
 * muito abaixo disso — o teto existe para falhar com uma mensagem clara caso
 * algum dia deixe de ficar, em vez de tomar um erro do SDK no meio da
 * gravação.
 */
const MAX_STATE_BYTES = 900_000

function savesRef(db: Firestore, uid: string) {
  return collection(db, 'usuarios', uid, 'carreiras')
}

/** Converte o carimbo do servidor para milissegundos, tolerando ausência. */
function savedAtOf(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null
}

function toSummary(slot: SaveSlot, data: Record<string, unknown>): SaveSummary | null {
  const { playerName, clubName, season, age, overall } = data

  // Documento sem os campos do cartão é documento corrompido: melhor mostrar a
  // vaga como livre do que desenhar um cartão vazio.
  if (typeof playerName !== 'string' || typeof clubName !== 'string') return null

  return {
    slot,
    playerName,
    clubName,
    season: typeof season === 'string' ? season : '',
    age: typeof age === 'number' ? age : 0,
    overall: typeof overall === 'number' ? overall : 0,
    savedAt: savedAtOf(data.savedAt),
  }
}

/**
 * As três vagas do jogador, na ordem, com as vazias incluídas.
 *
 * A tela sempre desenha três cartões — quem nunca salvou vê três vagas
 * livres —, então a lista já sai completa daqui.
 */
export async function listSaves(uid: string): Promise<SaveSlotView[]> {
  const snapshot = await getDocs(savesRef(firestore(), uid))

  const found = new Map<SaveSlot, SaveSummary>()

  for (const document of snapshot.docs) {
    if (!isSaveSlot(document.id)) continue

    const summary = toSummary(document.id, document.data())
    if (summary) found.set(document.id, summary)
  }

  return SAVE_SLOTS.map((slot) => ({ slot, summary: found.get(slot) ?? null }))
}

/** Grava (ou sobrescreve) uma vaga. O cartão sai do próprio estado. */
export async function writeSave(
  uid: string,
  slot: SaveSlot,
  snapshot: CareerSnapshot,
  card: Omit<SaveSummary, 'slot' | 'savedAt'>,
): Promise<void> {
  const state = JSON.stringify(snapshot)

  if (state.length > MAX_STATE_BYTES) {
    throw new Error(
      'Esta carreira ficou grande demais para ser salva. Avance a temporada e tente de novo.',
    )
  }

  await setDoc(doc(savesRef(firestore(), uid), slot), {
    version: SNAPSHOT_VERSION,
    ...card,
    savedAt: serverTimestamp(),
    state,
  })
}

/**
 * Lê uma vaga e devolve a carreira pronta para retomar.
 *
 * Recusa o que não sabe carregar — vaga vazia, documento sem estado, formato
 * de outra versão do jogo — sempre com o motivo em texto de tela.
 */
export async function readSave(uid: string, slot: SaveSlot): Promise<CareerSnapshot> {
  const found = await getDoc(doc(savesRef(firestore(), uid), slot))

  if (!found.exists()) throw new Error('Esta vaga está vazia.')

  const data = found.data()

  if (typeof data.state !== 'string') {
    throw new Error('O save desta vaga está corrompido e não pode ser carregado.')
  }

  if (data.version !== SNAPSHOT_VERSION) {
    throw new Error('Este save é de uma versão anterior do jogo e não pode ser carregado.')
  }

  let snapshot: CareerSnapshot

  try {
    snapshot = JSON.parse(data.state) as CareerSnapshot
  } catch (cause) {
    console.error('[saves] estado ilegível na vaga', slot, cause)
    throw new Error('O save desta vaga está corrompido e não pode ser carregado.')
  }

  if (!snapshot?.career) {
    throw new Error('O save desta vaga está corrompido e não pode ser carregado.')
  }

  return snapshot
}

export async function deleteSave(uid: string, slot: SaveSlot): Promise<void> {
  await deleteDoc(doc(savesRef(firestore(), uid), slot))
}
