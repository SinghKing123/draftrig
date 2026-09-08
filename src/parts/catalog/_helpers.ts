import type { MatRef, Params, Port, Solid, Vec2, Vec3 } from '../kernel/types'

/* Typed param readers — catalog code stays readable without casts. */
export const num = (p: Params, k: string, d = 0): number => (typeof p[k] === 'number' ? (p[k] as number) : d)
export const str = (p: Params, k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : d)
export const bool = (p: Params, k: string, d = false): boolean => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d)

export const DOWN: Vec3 = [0, -1, 0]
export const UP: Vec3 = [0, 1, 0]

/** 2.54 mm — the pitch that most of hobby electronics is built on. */
export const PITCH = 2.54

/**
 * Two axial leads leaving a body along X, bent down to a seating plane at y=0
 * and continuing `insert` mm below it.
 */
export function axialLeads(opts: {
  pitch: number
  bodyLen: number
  bodyY: number
  leadR?: number
  insert?: number
  mat?: MatRef
}): Solid[] {
  const { pitch, bodyLen, bodyY } = opts
  const r = opts.leadR ?? 0.28
  const insert = opts.insert ?? 3.4
  const mat = opts.mat ?? 'tin'
  const make = (sign: 1 | -1): Solid => ({
    kind: 'tube',
    mat,
    r,
    seg: 8,
    path: [
      [(sign * bodyLen) / 2, bodyY, 0],
      [(sign * pitch) / 2, bodyY, 0],
      [(sign * pitch) / 2, -insert, 0],
    ],
  })
  return [make(1), make(-1)]
}

/** Straight radial leads dropping from a body to below the seating plane. */
export function radialLeads(opts: {
  pitch: number
  fromY: number
  leadR?: number
  insert?: number
  mat?: MatRef
  z?: number
}): Solid[] {
  const r = opts.leadR ?? 0.25
  const insert = opts.insert ?? 3.4
  const mat = opts.mat ?? 'tin'
  const z = opts.z ?? 0
  return ([1, -1] as const).map((sign) => ({
    kind: 'cyl' as const,
    mat,
    r,
    h: opts.fromY + insert,
    at: [(sign * opts.pitch) / 2, (opts.fromY - insert) / 2, z] as Vec3,
  }))
}

/** Lead-tip electrical port, pointing down into the board. */
export function pinPort(id: string, label: string, x: number, z = 0, opts: Partial<Port> = {}): Port {
  return {
    id,
    label,
    kind: 'electrical',
    pos: [x, -1.6, z],
    dir: DOWN,
    role: 'passive',
    ...opts,
  }
}

/** A rectangle centred on the origin, as a profile outline. */
export function rect(w: number, h: number, cx = 0, cy = 0): Vec2[] {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ]
}

/** A circle as a polygon, for use as an extrude hole. */
export function circle(r: number, cx = 0, cy = 0, seg = 24): Vec2[] {
  const pts: Vec2[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

/** Rounded rectangle outline. */
export function roundRect(w: number, h: number, r: number, cx = 0, cy = 0, segPerCorner = 5): Vec2[] {
  const rr = Math.min(r, w / 2, h / 2)
  const pts: Vec2[] = []
  const corners: [number, number, number][] = [
    [cx + w / 2 - rr, cy + h / 2 - rr, 0],
    [cx - w / 2 + rr, cy + h / 2 - rr, Math.PI / 2],
    [cx - w / 2 + rr, cy - h / 2 + rr, Math.PI],
    [cx + w / 2 - rr, cy - h / 2 + rr, (3 * Math.PI) / 2],
  ]
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= segPerCorner; i++) {
      const a = a0 + (i / segPerCorner) * (Math.PI / 2)
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr])
    }
  }
  return pts
}

/** Standard resistor / capacitor value ladders for enum params. */
export const E24 = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2,
  9.1,
]
