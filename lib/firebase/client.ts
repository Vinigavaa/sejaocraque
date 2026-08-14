/**
 * O Firebase do Craque — autenticação e nuvem das carreiras salvas.
 *
 * Tudo aqui é preguiçoso de propósito: o SDK só é inicializado na primeira vez
 * que alguém pede `firebaseAuth()` ou `firestore()`, e isso só acontece no
 * navegador. Inicializar no topo do módulo quebraria a renderização no
 * servidor, onde não há `window` nem sessão para restaurar.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

/**
 * A configuração pública do app web.
 *
 * Estes valores viajam no pacote do navegador — não são segredo, e a proteção
 * real está nas regras do Firestore. Ainda assim moram em variáveis de
 * ambiente: é o que permite apontar um build para outro projeto sem editar
 * código.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/**
 * Se o jogo foi construído com as variáveis do Firebase.
 *
 * Sem elas o jogo continua jogável — apenas sem conta e sem carreira salva.
 * A tela de contas usa isto para explicar o que está faltando em vez de
 * estourar um erro de SDK sem contexto.
 */
export function isFirebaseConfigured(): boolean {
  return Object.values(config).every((value) => !!value)
}

function firebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase não configurado: defina as variáveis NEXT_PUBLIC_FIREBASE_* no ambiente.',
    )
  }

  // `getApps` evita reinicializar durante o hot reload do `next dev`, que
  // reexecuta o módulo com o app anterior ainda registrado.
  return getApps().length > 0 ? getApp() : initializeApp(config as Required<typeof config>)
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp())
}

export function firestore(): Firestore {
  return getFirestore(firebaseApp())
}
