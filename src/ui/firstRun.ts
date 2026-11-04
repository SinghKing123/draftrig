/**
 * Whether this is somebody's first time in the editor.
 *
 * It used to be one flag: had the tour been finished or dismissed. That is a
 * narrower question than the one being asked, and it answered wrong in the
 * ordinary case — close the welcome by pressing Escape, navigate in from a
 * link, open the editor on a second machine, and the flag is unset, so the
 * editor spends the rest of the session explaining itself to somebody who has
 * used it for a month.
 *
 * Three facts answer it properly, and any one of them is enough:
 *
 *   - the tour was seen
 *   - a part has been placed on the bench at some point
 *   - there is a saved project in this browser
 *
 * The second is the one that matters, and it is the one that was missing.
 * Somebody who has placed a part knows what the library is for.
 */

const USED_KEY = 'draftrig.used.v1'
const TOUR_KEY = 'tour.seen.v1'
const PROJECTS_KEY = 'draftrig.projects'

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    /* private window: every question below answers "no", which is the safe
       side — a newcomer is shown the hint, and that is what the hint is for. */
    return null
  }
}

/** Record that the bench has had something on it. Cheap, and idempotent. */
export function markEditorUsed(): void {
  try {
    if (localStorage.getItem(USED_KEY) !== '1') localStorage.setItem(USED_KEY, '1')
  } catch {
    /* nothing to do: the editor works the same, it just stays introductory */
  }
}

/** Has this person used the editor before, by any of the three measures? */
export function hasUsedEditor(): boolean {
  if (read(USED_KEY) === '1') return true
  if (read(TOUR_KEY) === '1') return true
  const saved = read(PROJECTS_KEY)
  if (!saved) return false
  try {
    const list: unknown = JSON.parse(saved)
    return Array.isArray(list) && list.length > 0
  } catch {
    return false
  }
}
