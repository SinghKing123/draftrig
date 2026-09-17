import { create } from 'zustand'

/**
 * The terminal under the pointer, named.
 *
 * Wiring meant aiming at one grey dot among thirty identical grey dots and
 * hoping. The picking itself was never the problem — the targets are held at a
 * constant size on screen and the nearest one to the cursor wins — but nothing
 * ever told you which pin you were about to connect, so the only way to find
 * D13 was to wire it and read the result in the inspector.
 *
 * Lives outside the Canvas because the label is HTML drawn over the viewport,
 * and the scene is what knows which terminal is hovered.
 */

export interface PortHover {
  /** The terminal's own name, e.g. "D13". */
  label: string
  /** The part it belongs to, e.g. "Arduino Uno 1". */
  owner: string
  role?: string
  /** Position in CSS pixels within the canvas. */
  x: number
  y: number
}

interface PortHoverState {
  hover: PortHover | null
  set: (h: PortHover | null) => void
}

export const usePortHover = create<PortHoverState>()((set, get) => ({
  hover: null,
  set: (h) => {
    const current = get().hover
    if (h === null) {
      if (current !== null) set({ hover: null })
      return
    }
    // The position is recomputed every frame while the camera moves. Only
    // publish a real change, or the label re-renders sixty times a second
    // while sitting still.
    if (
      current &&
      current.label === h.label &&
      current.owner === h.owner &&
      Math.abs(current.x - h.x) < 0.5 &&
      Math.abs(current.y - h.y) < 0.5
    ) {
      return
    }
    set({ hover: h })
  },
}))
