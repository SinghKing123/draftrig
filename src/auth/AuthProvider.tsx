import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { Auth0Provider, useAuth0, type User } from '@auth0/auth0-react'
import { cloudConfigured, provideAccessToken, supabase } from './supabase'

/**
 * Sign-in, by Auth0.
 *
 * The app never sees a password and never handles a social callback itself.
 * Pressing sign-in sends the browser to Auth0's hosted login, which offers
 * whichever connections the tenant has switched on — Google, email, whatever
 * is added later — and sends it back to /auth/callback with a code the SDK
 * exchanges for a session.
 *
 * The interface below is deliberately the same shape the rest of the app was
 * already written against, so the account menu, the projects page and the
 * sign-in screen did not have to change when the provider did.
 */

export interface AuthState {
  /** True while we are still working out whether someone is signed in. */
  loading: boolean
  /** Null when signed out, or when sign-in is not configured at all. */
  user: User | null
  /** False when the app was built without Auth0 credentials. */
  enabled: boolean
  error: string | null

  signIn: () => void
  /** Same trip as signIn, but asks Auth0 for the sign-up screen first. */
  signUp: () => void
  signOut: () => void
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined
/**
 * The API the access token is minted for.
 *
 * Without an audience Auth0 hands back an opaque token, which Supabase cannot
 * verify because there is nothing in it to verify — no issuer, no subject, no
 * signature it can check against the tenant's keys. It has to name the API
 * registered in Auth0, and the same string has to be what Supabase is told to
 * expect. This is the single most common way to get a setup that logs in
 * perfectly and then cannot read a row.
 */
const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined

export const authConfigured = Boolean(domain && clientId && audience)

/** The signed-in user's id, as Auth0 knows them. Null when signed out. */
let currentSub: string | null = null
export const currentUserId = (): string | null => currentSub

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!authConfigured) return <>{children}</>
  return (
    <Auth0Provider
      domain={domain!}
      clientId={clientId!}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/auth/callback`,
        audience,
      }}
      // Survives a reload and a new tab, which is what somebody expects of
      // being signed in to a site. Without it every refresh is a silent
      // round trip to Auth0, and a browser that blocks third-party cookies
      // signs the person out instead.
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <TokenBridge />
      {children}
    </Auth0Provider>
  )
}

/**
 * Hands Supabase a way to get the current Auth0 token.
 *
 * Renders nothing. It exists because the Supabase client is created when its
 * module is first imported, long before any of this is mounted, so the token
 * has to arrive by a back channel rather than as a constructor argument.
 */
function TokenBridge() {
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0()

  useEffect(() => {
    currentSub = isAuthenticated ? (user?.sub ?? null) : null
  }, [isAuthenticated, user])

  useEffect(() => {
    provideAccessToken(async () => {
      if (!isAuthenticated) return null
      try {
        return (await getAccessTokenSilently()) ?? null
      } catch {
        // Refresh failed, most often an expired session. Anonymous is the
        // honest answer; the policies will decline and the UI will show the
        // signed-out state rather than a page of errors.
        return null
      }
    })
  }, [isAuthenticated, getAccessTokenSilently])

  return null
}

export function useAuth(): AuthState {
  // Hooks cannot be called conditionally, and useAuth0 throws outside a
  // provider — so the unconfigured build gets a fixed signed-out state.
  if (!authConfigured) return SIGNED_OUT
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAuthLive()
}

const SIGNED_OUT: AuthState = {
  loading: false,
  user: null,
  enabled: false,
  error: null,
  signIn: () => {},
  signUp: () => {},
  signOut: () => {},
}

function useAuthLive(): AuthState {
  const { isLoading, isAuthenticated, user, error, loginWithRedirect, logout } = useAuth0()

  const signIn = useCallback(() => {
    void loginWithRedirect()
  }, [loginWithRedirect])

  const signUp = useCallback(() => {
    void loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } })
  }, [loginWithRedirect])

  const signOut = useCallback(() => {
    currentSub = null
    logout({ logoutParams: { returnTo: window.location.origin } })
  }, [logout])

  return useMemo(
    () => ({
      loading: isLoading,
      user: isAuthenticated ? (user ?? null) : null,
      // Sign-in works on its own; the database is what needs Supabase, and
      // the projects layer already falls back to this browser without it.
      enabled: true,
      error: error ? error.message : null,
      signIn,
      signUp,
      signOut,
    }),
    [isLoading, isAuthenticated, user, error, signIn, signUp, signOut],
  )
}

/** True when there is somewhere to sync to as well as someone to sync for. */
export const cloudSyncAvailable = (): boolean => Boolean(supabase) && cloudConfigured

/** Display name for the account menu: real name, else the email local part. */
export function displayName(user: User | null): string {
  if (!user) return 'Guest'
  return user.name || user.nickname || user.email?.split('@')[0] || 'Account'
}

export function avatarUrl(user: User | null): string | null {
  return typeof user?.picture === 'string' ? user.picture : null
}
