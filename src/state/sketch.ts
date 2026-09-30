import { create } from 'zustand'

/**
 * Which board's sketch is open in the editor, if any.
 *
 * Not a boolean like the bill of materials panel, because a build can have
 * more than one controller on it and "the sketch panel is open" is not a
 * useful thing to say about a bench with two. It holds an instance id, and
 * closing is setting it to null.
 *
 * Deliberately not remembered between sessions: an instance id from a project
 * you are no longer in means nothing, and a panel that opens onto a board that
 * is not there is worse than one that stays shut.
 */
interface SketchPanelState {
  /** The instance whose sketch is being edited, or null. */
  editing: string | null
  open: (instanceId: string) => void
  close: () => void
  toggle: (instanceId: string) => void
}

export const useSketchPanel = create<SketchPanelState>()((set, get) => ({
  editing: null,
  open: (instanceId) => set({ editing: instanceId }),
  close: () => set({ editing: null }),
  toggle: (instanceId) => set({ editing: get().editing === instanceId ? null : instanceId }),
}))
