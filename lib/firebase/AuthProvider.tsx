'use client'

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { firebaseAuth, isFirebaseConfigured } from './client'

export type AuthState = {
  /** `null` = ninguém logado. Só é confiável depois de `loading` virar `false`. */
  user: User | null
  /** A sessão ainda está sendo restaurada do armazenamento local. */
  loading: boolean
  /** A última falha de login ou logout, em texto de tela. `null` quando não há. */
  error: string | null
  /** Se o build tem as variáveis do Firebase. Sem elas, conta não existe. */
  configured: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Traduz o código do erro do Firebase para uma frase que serve de tela. */
function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Login cancelado.'
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela do Google. Libere os pop-ups e tente de novo.'
    case 'auth/network-request-failed':
      return 'Sem conexão com o Google. Verifique a internet e tente de novo.'
    case 'auth/unauthorized-domain':
      return 'Este endereço não está liberado no Firebase Authentication.'
    case 'auth/operation-not-allowed':
      return 'O login com Google não está habilitado no projeto do Firebase.'
    default:
      return 'Não foi possível entrar com o Google. Tente de novo em instantes.'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured()

  const [user, setUser] = useState<User | null>(null)
  // Sem Firebase configurado não há sessão para esperar: a tela já pode dizer
  // que não existe conta, em vez de girar para sempre.
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured) return

    // A sessão é restaurada do armazenamento local pelo próprio SDK; este
    // ouvinte é o que avisa quando isso terminou — daí `loading` só cair aqui.
    return onAuthStateChanged(
      firebaseAuth(),
      (next) => {
        setUser(next)
        setLoading(false)
      },
      (cause) => {
        console.error('[auth] falha ao observar a sessão', cause)
        setError('Não foi possível verificar sua sessão.')
        setLoading(false)
      },
    )
  }, [configured])

  const signIn = useCallback(async () => {
    if (!configured) {
      setError('Login indisponível: o Firebase não está configurado neste ambiente.')
      return
    }

    setError(null)

    try {
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider())
    } catch (cause) {
      console.error('[auth] falha no login com Google', cause)
      setError(authErrorMessage(cause))
    }
  }, [configured])

  const signOut = useCallback(async () => {
    if (!configured) return
    setError(null)

    try {
      await firebaseSignOut(firebaseAuth())
    } catch (cause) {
      console.error('[auth] falha ao sair', cause)
      setError('Não foi possível sair da conta. Tente de novo.')
    }
  }, [configured])

  const value = useMemo<AuthState>(
    () => ({ user, loading, error, configured, signIn, signOut }),
    [user, loading, error, configured, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  return value
}
