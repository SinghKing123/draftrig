import { create } from 'zustand'

/**
 * Whether the bill of materials panel is open.
 *
 * The bill used to live on a tab inside the console drawer, alongside the
 * solver's warnings and the oscilloscope. That is the wrong neighbourhood for
 * it: a console reads as a place for developers, and the one thing in there
 * that everybody wants — what the build costs and what to order — was the
 * least likely to be found. So it is its own panel now, with its own tab on
 * the edge of the window, and the console keeps the two things that really
 * are diagnostics.
 *
 * Remembered between sessions, because whether you want it open is a habit
 * rather than a per-build decision.
 */

const KEY = 'draftrig.bom.open.v1'

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const remember = (open: boolean) => {
  try {
    localStorage.setItem(KEY, open ? '1' : '0')
  } catch {
    /* private window: it simply will not be remembered */
  }
}

interface BomPanelState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useBomPanel = create<BomPanelState>()((set, get) => ({
  open: read(),
  setOpen: (open) => {
    remember(open)
    set({ open })
  },
  toggle: () => {
    const open = !get().open
    remember(open)
    set({ open })
  },
}))
