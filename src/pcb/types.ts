import type { Vec2 } from '@/parts/kernel/types'

/**
 * A printed circuit board, as a document carries one.
 *
 * Board coordinates are millimetres with the origin at the centre of the
 * outline, +x right and +y up. That is the convention Gerber uses and the
 * convention every fab reads, so the numbers in this file are the numbers
 * in the exported file and there is no axis flip hidden anywhere between
 * them. The screen is the only place y is turned over, because a screen
 * counts downwards, and it is turned over once, in the canvas.
 *
 * Everything here is plain data on the document, so the board undoes,
 * redoes and saves with the build it came out of rather than living in a
 * store of its own that quietly disagrees with the file.
 */

export type Side = 'top' | 'bottom'

/** Where one part sits on the board. */
export interface Placement {
  x: number
  y: number
  /** Degrees, anticlockwise, about the footprint origin. */
  rot: number
  /**
   * Which face it is mounted on.
   *
   * A part on the bottom is mirrored in x, which is what actually happens
   * when you turn a board over, and its through-holes stay where they are
   * because a hole goes through both sides.
   */
  side: Side
}

/** A run of copper on one layer. */
export interface Track {
  id: string
  /** The net it belongs to. Copper that joins two nets is a short. */
  net: string
  layer: Side
  /** mm */
  width: number
  /** Vertices, mm. At least two. */
  pts: Vec2[]
}

/** A plated hole joining the two copper layers. */
export interface Via {
  id: string
  net: string
  at: Vec2
  /** Finished hole diameter, mm. */
  drill: number
  /** Copper ring diameter, mm. */
  pad: number
}

/**
 * What the board may not violate.
 *
 * The defaults are a cheap two-layer prototype run — the class every
 * hobby fab quotes at its lowest price — so a board drawn without
 * touching these is a board that can actually be ordered. Tighten them
 * and the checker tightens with them.
 */
export interface Rules {
  /** Default width of a new track, mm. */
  track: number
  /** Minimum copper-to-copper gap between different nets, mm. */
  clearance: number
  /** Via copper ring diameter, mm. */
  via: number
  /** Via finished hole, mm. */
  drill: number
  /** Minimum gap from copper to the board outline, mm. */
  edge: number
}

export const DEFAULT_RULES: Rules = {
  track: 0.4,
  clearance: 0.25,
  via: 0.8,
  drill: 0.4,
  edge: 0.5,
}

export interface Pcb {
  /** Outline, mm. The outline is a rectangle; shaped boards are not in yet. */
  w: number
  h: number
  /** Keyed by instance id. An instance with no entry is not on the board. */
  placements: Record<string, Placement>
  tracks: Record<string, Track>
  trackOrder: string[]
  vias: Record<string, Via>
  viaOrder: string[]
  rules: Rules
}

export function emptyPcb(w = 80, h = 60): Pcb {
  return {
    w,
    h,
    placements: {},
    tracks: {},
    trackOrder: [],
    vias: {},
    viaOrder: [],
    rules: { ...DEFAULT_RULES },
  }
}

/* ------------------------------------------------------------------ */
/* Footprints                                                          */
/* ------------------------------------------------------------------ */

/**
 * One pad of a footprint, in the footprint's own frame.
 *
 * `drill` of 0 is a surface pad. Everything the catalogue has today is
 * through-hole, because everything in it is a part you can hold.
 */
export interface Pad {
  /** The port this pad is, so a pad and a terminal are the same thing. */
  portId: string
  label: string
  at: Vec2
  /** Copper extent, mm. */
  size: Vec2
  shape: 'round' | 'rect'
  /** Finished hole, mm. 0 for a surface pad. */
  drill: number
}

export interface Footprint {
  pads: Pad[]
  /** The part's body, width and depth in mm, for the silkscreen and the courtyard. */
  body: Vec2
  /** Where the body centre sits relative to the pad origin. */
  bodyAt: Vec2
}

/** A pad, addressed the way the rest of the document addresses a terminal. */
export interface PadRef {
  instanceId: string
  portId: string
}

export const padKey = (instanceId: string, portId: string): string => `${instanceId}:${portId}`
