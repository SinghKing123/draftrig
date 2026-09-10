/**
 * Snapshots of the viewport, for the project list.
 *
 * A library of builds where every card shows the same logo is a list of file
 * names. A picture of the thing is what makes it a library, and the viewport
 * is already drawing one.
 */

let canvas: HTMLCanvasElement | null = null

/** Called by the viewport once its canvas exists. */
export function registerCanvas(el: HTMLCanvasElement | null): void {
  canvas = el
}

/**
 * The current view as a JPEG data URL, or null if there is nothing to capture.
 *
 * Reading a WebGL canvas needs `preserveDrawingBuffer`, which the viewport sets
 * for this reason. Without it the buffer is free to be cleared the moment the
 * frame is presented, and this comes back blank on some drivers and not others,
 * which is the worst of both.
 */
export function captureThumbnail(maxWidth = 360): string | null {
  const src = canvas
  if (!src || !src.width || !src.height) return null
  try {
    const scale = Math.min(1, maxWidth / src.width)
    const w = Math.max(1, Math.round(src.width * scale))
    const h = Math.max(1, Math.round(src.height * scale))
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(src, 0, 0, w, h)
    // Quality chosen so a card is legible and a browser's storage is not the
    // limiting factor: this lands around fifteen kilobytes.
    return out.toDataURL('image/jpeg', 0.62)
  } catch {
    // A tainted or lost context. A missing picture is not worth an exception.
    return null
  }
}
