import { create } from 'zustand'
import type { Vec2 } from '@/parts/kernel/types'
import type { Side } from '@/pcb/types'

/**
 * What the board editor is doing, as opposed to what the board is.
 *
 * None of this belongs on the document: which layer you are looking at
 * and how far you have zoomed in are not properties of a board, they are
 * properties of looking at one, and putting them in the file would make
 * scrolling an unsaved change. The board itself lives on the document,
 * where it undoes and saves.
 */

export type BoardTool = 'select' | 'route' | 'via'

/** A track being drawn, between the first click and the last. */
export interface Pending {
  net: string
  layer: Side
  width: number
  /** Committed corners. The live one under the pointer is not in here. */
  pts: Vec2[]
}

interface BoardState {
  tool: BoardTool
  /** The layer new copper goes on, and the one drawn in front. */
  layer: Side
  grid: number
  /** Width for the next track, mm. Taken from the rules when the board opens. */
  width: number

  /** Pixels per millimetre. */
  zoom: number
  /** Board coordinate at the centre of the view, mm. */
  pan: Vec2

  pending: Pending | null
  /** Where the pointer is, in board coordinates. */
  cursor: Vec2
  /** The pad the pointer is over, if any. */
  hoverPad: string | null
  /** The net being shown on its own, or null for all of them. */
  focusNet: string | null
  /** Selected copper and parts, by id. */
  selection: string[]
  /** The violation being pointed at. */
  showViolation: string | null

  setTool: (t: BoardTool) => void
  setLayer: (l: Side) => void
  flipLayer: () => void
  setGrid: (g: number) => void
  setWidth: (w: number) => void
  setView: (zoom: number, pan: Vec2) => void
  setCursor: (p: Vec2) => void
  setHoverPad: (k: string | null) => void
  setFocusNet: (n: string | null) => void
  select: (ids: string[]) => void
  setShowViolation: (id: string | null) => void

  begin: (p: Pending) => void
  push: (at: Vec2) => void
  dropCorner: () => void
  finish: () => void
}

/**
 * The grids worth having, in millimetres.
 *
 * A tenth of an inch is on the list because the parts are: every
 * through-hole footprint in this catalogue lands on 2.54, so a grid of
 * 1.27 puts a track between two pins of a DIP and a grid of 0.635 puts
 * two there. The round metric steps are for everything that is not on
 * an imperial pitch.
 */
export const GRIDS = [2.54, 1.27, 0.635, 1, 0.5, 0.25, 0]

export const useBoard = create<BoardState>()((set) => ({
  tool: 'route',
  layer: 'top',
  grid: 1.27,
  width: 0.4,
  zoom: 6,
  pan: [0, 0],
  pending: null,
  cursor: [0, 0],
  hoverPad: null,
  focusNet: null,
  selection: [],
  showViolation: null,

  setTool: (tool) => set({ tool, pending: null }),
  setLayer: (layer) => set({ layer }),
  flipLayer: () => set((s) => ({ layer: s.layer === 'top' ? 'bottom' : 'top' })),
  setGrid: (grid) => set({ grid }),
  setWidth: (width) => set({ width }),
  setView: (zoom, pan) => set({ zoom, pan }),
  setCursor: (cursor) => set({ cursor }),
  setHoverPad: (hoverPad) => set({ hoverPad }),
  setFocusNet: (focusNet) => set({ focusNet }),
  select: (selection) => set({ selection }),
  setShowViolation: (showViolation) => set({ showViolation }),

  begin: (pending) => set({ pending }),
  push: (at) => set((s) => (s.pending ? { pending: { ...s.pending, pts: [...s.pending.pts, at] } } : s)),
  /* Backspace while routing: take back the last corner, and end the run
     entirely once there is nothing left to take back. */
  dropCorner: () =>
    set((s) => {
      if (!s.pending) return s
      if (s.pending.pts.length <= 1) return { pending: null }
      return { pending: { ...s.pending, pts: s.pending.pts.slice(0, -1) } }
    }),
  finish: () => set({ pending: null }),
}))
