import { create } from 'zustand'

/**
 * What the viewport is actually doing, for when it misbehaves.
 *
 * This exists because a fault was reported that could not be reproduced: the
 * move gizmo leaving copies of itself, the picture freezing, everything
 * lagging. Half a dozen theories were measured and discarded — a geometry
 * leak, which was real and fixed; a failing depth blit, which is real and is
 * not this; a stuck autoClear, which reproduces the look and turns out to be
 * overwritten by the composer anyway.
 *
 * Guessing from a description is slow and mostly wrong. This turns the next
 * occurrence into a screenshot: press the key, photograph the numbers, and the
 * cause is usually obvious from which of them is climbing.
 *
 * The counters are sampled, not computed on demand, so reading them costs
 * nothing while the panel is closed.
 */

export interface Diagnostics {
  fps: number
  /** Longest frame in the last sample window, ms. A freeze shows up here. */
  worstFrame: number
  geometries: number
  textures: number
  programs: number
  calls: number
  triangles: number
  /** Objects in the scene graph. Duplication shows up here. */
  objects: number
  /** How many move gizmos exist. Should be one, or none. */
  gizmos: number
  /** Failing WebGL calls since the page loaded. Should not climb. */
  glErrors: number
  contextLost: boolean
  quality: string
  /** Megabytes of JS heap, where the browser will say. */
  heapMb: number
}

const EMPTY: Diagnostics = {
  fps: 0, worstFrame: 0, geometries: 0, textures: 0, programs: 0, calls: 0,
  triangles: 0, objects: 0, gizmos: 0, glErrors: 0, contextLost: false,
  quality: '', heapMb: 0,
}

interface DiagState {
  open: boolean
  data: Diagnostics
  toggle: () => void
  set: (d: Diagnostics) => void
}

export const useDiagnostics = create<DiagState>()((set, get) => ({
  open: false,
  data: EMPTY,
  toggle: () => set({ open: !get().open }),
  set: (data) => set({ data }),
}))

/* ------------------------------------------------------------------ */
/* WebGL error counting                                                */
/* ------------------------------------------------------------------ */

/**
 * Counts WebGL calls that fail.
 *
 * The browser console is not usable for this: it stops reporting after about
 * 256 errors per context and says so, which is exactly how a fault that
 * happens every single frame came to look like a brief hiccup during load.
 * Counting them here is the only way to see that it never stops.
 *
 * Only blitFramebuffer is wrapped. getError() forces the pipeline to flush, so
 * putting it after every draw call costs more than anything it could find:
 * doing exactly that dropped a healthy sixty-frame viewport to eight, which
 * would have had somebody chasing a performance fault that was the measurement
 * itself. Framebuffer blits happen a handful of times a frame, which is cheap
 * enough to watch and is where the failures actually are.
 *
 * Development only, for the same reason.
 */
let glErrors = 0

export function countGlErrors(gl: WebGL2RenderingContext | WebGLRenderingContext): void {
  if (!import.meta.env.DEV) return
  const ctx = gl as WebGL2RenderingContext & { __counted?: boolean }
  if (ctx.__counted) return
  ctx.__counted = true

  for (const name of ['blitFramebuffer'] as const) {
    const orig = (ctx as unknown as Record<string, unknown>)[name]
    if (typeof orig !== 'function') continue
    ;(ctx as unknown as Record<string, unknown>)[name] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      const result = (orig as (...a: unknown[]) => unknown).apply(this, args)
      if (this.getError() !== this.NO_ERROR) glErrors++
      return result
    }
  }
}

export const glErrorCount = (): number => glErrors
