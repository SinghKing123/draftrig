import { create } from 'zustand'

/**
 * The sign-in prompt, raised from anywhere.
 *
 * A store rather than a prop, because the things that need it are scattered:
 * the file menu, a keyboard shortcut, and a tab on the edge of the viewport
 * that the editor does not own. Threading a callback to all of them is how
 * one of them ends up without it.
 *
 * It lives here rather than beside the rule in auth/gate so that it can be
 * reached without reaching Auth0 and Supabase too — importing the rule
 * constructs a Supabase client, which a test running on node cannot do.
 */
interface WallState {
  /** What they were trying to do, phrased for them, or null when shut. */
  reason: string | null
  ask: (reason: string) => void
  close: () => void
}

export const useWall = create<WallState>()((set) => ({
  reason: null,
  ask: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}))
