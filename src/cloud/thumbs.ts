/**
 * Project thumbnails, kept in this browser.
 *
 * Deliberately not part of the project row. A picture is worth a few kilobytes
 * and a project is worth keeping, so they are stored apart: losing every
 * thumbnail to a full quota costs nothing, and losing a build would not be
 * acceptable. It also means no schema change to sync one.
 */

const KEY = (id: string): string => `draftrig.thumb.${id}`
const INDEX = 'draftrig.thumbs'

/** How many to keep. Older ones are dropped when the list grows past this. */
const KEEP = 40

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeIndex(ids: string[]): void {
  try {
    localStorage.setItem(INDEX, JSON.stringify(ids))
  } catch {
    /* full or unavailable: the list simply stops being pruned */
  }
}

export function getThumb(id: string): string | null {
  try {
    return localStorage.getItem(KEY(id))
  } catch {
    return null
  }
}

export function setThumb(id: string, dataUrl: string): void {
  try {
    localStorage.setItem(KEY(id), dataUrl)
  } catch {
    // Out of room. Drop the oldest half and try once more, because the
    // alternative is that thumbnails silently stop updating forever.
    const ids = readIndex().filter((x) => x !== id)
    for (const old of ids.slice(0, Math.ceil(ids.length / 2))) removeThumb(old)
    try {
      localStorage.setItem(KEY(id), dataUrl)
    } catch {
      return
    }
  }
  const ids = readIndex().filter((x) => x !== id)
  ids.push(id)
  while (ids.length > KEEP) {
    const old = ids.shift()
    if (old) removeThumb(old)
  }
  writeIndex(ids)
}

export function removeThumb(id: string): void {
  try {
    localStorage.removeItem(KEY(id))
  } catch {
    /* ignore */
  }
  const ids = readIndex().filter((x) => x !== id)
  writeIndex(ids)
}
