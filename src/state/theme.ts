import { create } from 'zustand'

/**
 * The editor's light or dark theme.
 *
 * Dark is the default and stays the default: every screenshot tool in tools/
 * and every shot preset was tuned against it, and a headless browser asks for
 * a light colour scheme by default, so following the system preference would
 * have quietly turned all of them light. Light is something you choose, and
 * the choice is remembered in this browser.
 *
 * Only the editor reads this. The public pages have their own fixed palettes
 * and never see the attribute it sets — see ThemeByRoute in main.tsx.
 */

export type Theme = 'dark' | 'light'

const KEY = 'draftrig.theme.v1'

const read = (): Theme => {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>()((set, get) => ({
  theme: read(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* private window: it applies now and is simply not remembered */
    }
    set({ theme })
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))

/** True when the editor is drawn on a dark ground, for the logo variants. */
export const useOnDark = () => useTheme((s) => s.theme === 'dark')
