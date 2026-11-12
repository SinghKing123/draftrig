/**
 * Phone or computer, decided once per visit.
 *
 * The editor is a 3D scene: three.js, a post-processing stack and up to
 * 26 MB of meshes. On a phone that is a long download for a screen too
 * small to place a resistor on. So a phone never loads it. /app on a
 * phone renders the build sheet (routes/BuildSheet), which reads the same
 * document and shows its parts, wiring and code as lists.
 *
 * The test is a touch screen narrower than 900px. Width alone would also
 * catch a desktop browser window that has been made narrow, and that
 * person still has a mouse and wants the editor. Touch alone would catch
 * a tablet in landscape, which has room for it.
 *
 * "Request desktop site" widens the viewport past 900px, so a phone that
 * asks for the desktop site gets the editor. The sheet also has its own
 * link for the same thing, remembered for the rest of the tab's session.
 */

export const PHONE_QUERY = '(max-width: 899px) and (pointer: coarse)'

const KEY = 'draftrig.desktop.v1'

/** True when the visitor asked for the full editor on this device. */
export function wantsDesktop(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setWantsDesktop(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    /* private window: the choice lasts until the page reloads */
  }
}

/**
 * Read at mount and not again. A phone turned to landscape is still a
 * phone, and swapping the editor out from under somebody mid-build
 * because the window changed shape would lose what they were doing.
 */
export function isPhone(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(PHONE_QUERY).matches && !wantsDesktop()
}
