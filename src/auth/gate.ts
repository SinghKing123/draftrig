import { useCallback } from 'react'
import { useAuth } from './AuthProvider'
import { useWall as wallStore } from '@/state/wall'

/**
 * What an account is for, in one place.
 *
 * The bench is open to anybody. Lay out a board, wire it, switch it on, load
 * an example, read the bill of materials — none of that asks who you are,
 * because a tool nobody can try is a tool nobody adopts.
 *
 * An account is what lets work leave the tab. Saving it, copying it,
 * downloading it, opening one you already have, the list those live in, and
 * the sketch editor. Signed out, none of them write anything anywhere: close
 * the tab and the bench is gone, which is why the editor asks before letting
 * that happen.
 *
 * This used to be a `mayKeep` boolean in the editor, a wall rendered beside
 * it, and a separate check on the dashboard. Three copies of one rule, and
 * the keyboard shortcut for Save as skipped all of them — Ctrl+Shift+S did
 * what the menu item it duplicates refused to do. One module now, and a test
 * that every gated action goes through it.
 */

/** Whether the person may keep work: signed in, or no accounts in this build. */
export function useMayKeep(): boolean {
  const { user, enabled } = useAuth()
  return Boolean(user) || !enabled
}

/* The prompt itself is a plain store; see state/wall for why it lives there
   rather than here. Re-exported so callers still have one import to make. */
export { useWall } from '@/state/wall'

/**
 * Run something, or ask them to sign in first.
 *
 * The reason is what they were trying to do, in their words: "Sign in to
 * save this build", not "Authentication required".
 */
export function useGuard(): (reason: string, run: () => void) => void {
  const may = useMayKeep()
  const ask = wallStore((s) => s.ask)
  return useCallback(
    (reason: string, run: () => void) => {
      if (may) run()
      else ask(reason)
    },
    [may, ask],
  )
}
