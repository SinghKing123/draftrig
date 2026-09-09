import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client, or null when the app has not been given any credentials.
 *
 * Everything downstream treats cloud as *additive*: with no keys configured the
 * editor still runs, projects still save to the browser, and only the account
 * and sync features are hidden. That keeps local development, self-hosting and
 * an offline user on exactly the same code path as production.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

if (!cloudConfigured && import.meta.env.DEV) {
  console.info(
    '[cloud] Running without an account backend. Projects save to this browser only.\n' +
      'To enable sign-in and cloud sync, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
  )
}

/** Where Google should send people back to after they approve sign-in. */
export function authRedirectTo(): string {
  return `${window.location.origin}/auth/callback`
}
