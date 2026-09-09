import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authRedirectTo, cloudConfigured, supabase } from './supabase'

export interface AuthState {
  /** True while we are still working out whether someone is signed in. */
  loading: boolean
  /** Null when signed out, or when no backend is configured at all. */
  user: User | null
  session: Session | null
  /** False when the app was built without cloud credentials. */
  enabled: boolean
  error: string | null

  signInWithGoogle: () => Promise<void>
  /** Passwordless: we email a one-time link rather than storing a password. */
  signInWithEmail: (email: string) => Promise<{ sent: boolean; error?: string }>
  signOut: () => Promise<void>
  clearError: () => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(cloudConfigured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectTo(),
        // Ask Google to show the account chooser rather than silently reusing
        // whichever account the browser happens to be signed into.
        queryParams: { prompt: 'select_account' },
      },
    })
    if (err) setError(err.message)
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) return { sent: false, error: 'Accounts are not configured for this deployment.' }
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectTo() },
    })
    if (err) {
      setError(err.message)
      return { sent: false, error: err.message }
    }
    return { sent: true }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      enabled: cloudConfigured,
      error,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      clearError: () => setError(null),
    }),
    [loading, session, error, signInWithGoogle, signInWithEmail, signOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Display name for the account menu: real name, else the email local part. */
export function displayName(user: User | null): string {
  if (!user) return 'Guest'
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const full = typeof meta?.full_name === 'string' ? meta.full_name : undefined
  const name = typeof meta?.name === 'string' ? meta.name : undefined
  return full || name || user.email?.split('@')[0] || 'Account'
}

export function avatarUrl(user: User | null): string | null {
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const url = meta?.avatar_url ?? meta?.picture
  return typeof url === 'string' ? url : null
}
