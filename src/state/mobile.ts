import { create } from 'zustand'

/**
 * Which sheet is up on a phone, if any.
 *
 * Only one at a time. The bench is the thing being worked on and two panels
 * over a 390-pixel window leaves nothing to work on, so opening one closes
 * the other — including the bill of materials, which is a sheet here and a
 * fourth column on a desktop.
 *
 * Not remembered between sessions: a sheet is a thing you opened a moment ago
 * for one purpose, not a preference, and a phone that reopens onto a covered
 * bench looks broken.
 */
type Sheet = 'parts' | 'inspect' | null

interface MobileState {
  sheet: Sheet
  setSheet: (sheet: Sheet) => void
}

export const useMobile = create<MobileState>()((set) => ({
  sheet: null,
  setSheet: (sheet) => set({ sheet }),
}))

/**
 * The width below which the editor stops being three columns.
 *
 * Kept here as well as in the stylesheet because the bar has to know whether
 * it exists — a keyboard shortcut that opens a sheet on a desktop, where
 * there are no sheets, would be a shortcut that does nothing.
 */
export const PHONE_MAX = 860
