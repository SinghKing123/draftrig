import { create } from 'zustand'

/**
 * Which drawer the console is showing, and whether it is showing at all.
 *
 * Lifted out of the Console component so anything can point at it — the tour
 * opens it, an error opens it, and a shortcut can put it on a given tab.
 *
 * The bill of materials was a third tab here once. It has its own panel now:
 * see state/bom.ts.
 */

export type ConsoleTab = 'issues' | 'scope'

const OPEN_KEY = 'draftrig.console.open.v1'
const readOpen = (): boolean => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

interface ConsoleState {
  tab: ConsoleTab
  open: boolean
  /** Open the drawer on a given tab. What every shortcut into it calls. */
  show: (tab: ConsoleTab) => void
  setTab: (tab: ConsoleTab) => void
  setOpen: (open: boolean) => void
}

const remember = (open: boolean) => {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {
    /* private window: it simply will not be remembered */
  }
}

export const useConsole = create<ConsoleState>()((set) => ({
  tab: 'issues',
  open: readOpen(),
  show: (tab) => {
    remember(true)
    set({ tab, open: true })
  },
  setTab: (tab) => {
    remember(true)
    set({ tab, open: true })
  },
  setOpen: (open) => {
    remember(open)
    set({ open })
  },
}))
