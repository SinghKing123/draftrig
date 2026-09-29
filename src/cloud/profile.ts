import { supabase } from '@/auth/supabase'
import type { User } from '@auth0/auth0-react'

/**
 * Make sure the signed-in user has a profile row.
 *
 * The old schema did this with a trigger on auth.users, which fired when
 * Supabase created the account. Supabase no longer creates accounts — Auth0
 * does, and it cannot reach into this database — so the app writes the row
 * itself, on the one occasion it knows a sign-in has just happened.
 *
 * Failure is deliberately quiet. A profile is a convenience: it is where a
 * plan and a billing id will live later, and nothing reads it today. Somebody
 * who has just signed in should not be shown an error about a table they have
 * never heard of, and the next sign-in will try again.
 */
export async function ensureProfile(user: User): Promise<void> {
  if (!supabase || !user.sub) return
  await supabase
    .from('profiles')
    .upsert(
      {
        id: user.sub,
        email: user.email ?? null,
        display_name: user.name ?? user.nickname ?? null,
        avatar_url: user.picture ?? null,
      },
      { onConflict: 'id' },
    )
    .then(undefined, () => undefined)
}
