import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase, holding the data but not the identities.
 *
 * Sign-in is Auth0's job now; Supabase is the database. The two are joined by
 * a token rather than by a shared user table: Auth0 issues an access token,
 * every Supabase request carries it, and Supabase is configured to trust
 * Auth0's signing keys (Dashboard -> Authentication -> Third-Party Auth). The
 * row-level policies then read the caller out of that token with
 * `auth.jwt() ->> 'sub'`, which is the Auth0 user id.
 *
 * What this replaced is worth knowing, because it explains the schema.
 * Supabase's own auth issues its own tokens, and `auth.uid()` reads the user
 * id out of those. Once the tokens come from somewhere else `auth.uid()` is
 * null for every request, so a policy written against it silently matches
 * nothing and every read comes back empty. Every policy in schema.sql is
 * written against the token's subject instead, and `projects.owner` is text
 * holding an Auth0 subject like `google-oauth2|10769150350006150715`, not a
 * uuid pointing into a table Supabase no longer fills in.
 *
 * Everything downstream still treats cloud as additive: with no credentials
 * the editor runs, projects save to the browser, and the account UI hides
 * itself.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudConfigured = Boolean(url && anonKey)

/**
 * How the client gets a token, set by the auth provider once Auth0 is ready.
 *
 * It is a slot rather than an argument because the client is a module
 * singleton created at import time, and the token comes from a React context
 * that does not exist yet. supabase-js calls this before every request, so by
 * the time it matters the provider has filled it in. Returning null makes the
 * request anonymous, which is correct while signed out — the policies will
 * refuse the rows rather than the app having to remember not to ask.
 */
type TokenSource = () => Promise<string | null>

let tokenSource: TokenSource = async () => null

export function provideAccessToken(fn: TokenSource): void {
  tokenSource = fn
}

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, anonKey!, {
      // No session of its own to persist, refresh, or parse out of the URL.
      // Auth0 owns all three, and leaving these on makes supabase-js compete
      // for the same query parameters on the callback route.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: async () => (await tokenSource()) ?? '',
    })
  : null

if (!cloudConfigured && import.meta.env.DEV) {
  console.info(
    '[cloud] Running without a database. Projects save to this browser only.\n' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable sync.',
  )
}
