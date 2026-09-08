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

/* ------------------------------------------------------------------ */
/* Dual in-line package                                                 */
/* ------------------------------------------------------------------ */

export interface DipOpts {
  /** 7.62 mm for a narrow DIP, 15.24 for a wide one. */
  rowSpacing?: number
  bodyColor?: MatRef
  /** Text-free silkscreen dot marking pin 1. */
  marked?: boolean
}

const DIP_STANDOFF = 3.3
const DIP_HEIGHT = 3.6

/** X positions of the pins along one row, left to right. */
function dipRowX(half: number): number[] {
  return Array.from({ length: half }, (_, i) => -((half - 1) / 2) * PITCH + i * PITCH)
}

/** Body, leads and pin-1 marker for a DIP-`n` package. */
export function dipSolids(n: number, opts: DipOpts = {}): Solid[] {
  const half = Math.max(1, Math.round(n / 2))
  const row = opts.rowSpacing ?? 7.62
  const mat = opts.bodyColor ?? 'epoxy-black'
  const len = half * PITCH + 0.5
  const width = row - 2.3
  const bodyY = DIP_STANDOFF + DIP_HEIGHT / 2

  const out: Solid[] = [
    { kind: 'box', mat, size: [len, DIP_HEIGHT, width], at: [0, bodyY, 0], bevel: 0.35 },
  ]

  if (opts.marked !== false) {
    // The notch at pin 1 and the moulded dot beside it.
    out.push({
      kind: 'cyl', mat: { color: '#0A0B0D', rough: 0.9, density: 0.01 }, r: 1.3, h: DIP_HEIGHT,
      at: [-len / 2, bodyY, 0], seg: 14, noCollide: true,
    })
    out.push({
      kind: 'cyl', mat: { color: '#0A0B0D', rough: 0.9, density: 0.01 }, r: 0.7, h: 0.4,
      at: [-len / 2 + 2.1, DIP_STANDOFF + DIP_HEIGHT, -width / 2 + 1.6], seg: 10, noCollide: true,
    })
  }

  // Leads are stamped from flat strip: 0.5 mm wide, 0.25 mm thick, with a
  // shoulder out to the row pitch and then straight down.
  const LEAD_W = 0.5
  const LEAD_T = 0.26
  for (const x of dipRowX(half)) {
    for (const s of [-1, 1] as const) {
      const zIn = (s * width) / 2
      const zOut = (s * row) / 2
      const shoulder = Math.abs(zOut - zIn)
      out.push({
        kind: 'box', mat: 'tin', size: [LEAD_W, LEAD_T, shoulder + 0.5],
        at: [x, DIP_STANDOFF + 0.5, (zIn + zOut) / 2], rot: [s * 22, 0, 0],
      })
      out.push({
        kind: 'box', mat: 'tin', size: [LEAD_W, DIP_STANDOFF + 3.4, LEAD_T],
        at: [x, (DIP_STANDOFF - 3.4) / 2, zOut],
      })
      // Chisel tip so it looks like it could go into a socket.
      out.push({
        kind: 'box', mat: 'tin', size: [LEAD_W * 0.7, 0.8, LEAD_T * 0.6],
        at: [x, -3.6, zOut], noCollide: true,
      })
    }
  }
  return out
}

/**
 * Ports for a DIP-`n`, numbered the way the datasheet does: pin 1 at the
 * notched end, counting along the near row then back along the far one.
 * `names` supplies signal labels in pin order.
 */
export function dipPorts(n: number, names: string[] = [], opts: DipOpts = {}): Port[] {
  const half = Math.max(1, Math.round(n / 2))
  const row = opts.rowSpacing ?? 7.62
  const xs = dipRowX(half)
  const ports: Port[] = []
  for (let i = 0; i < half; i++) {
    ports.push({
      id: names[i] ?? String(i + 1),
      label: `${i + 1} ${names[i] ? names[i].toUpperCase() : ''}`.trim(),
      kind: 'electrical',
      pos: [xs[i], -1.8, row / 2],
      dir: DOWN,
      role: 'io',
      imax: 0.05,
    })
  }
  for (let i = 0; i < half; i++) {
    const pin = half + i
    ports.push({
      id: names[pin] ?? String(pin + 1),
      label: `${pin + 1} ${names[pin] ? names[pin].toUpperCase() : ''}`.trim(),
      kind: 'electrical',
      pos: [xs[half - 1 - i], -1.8, -row / 2],
      dir: DOWN,
      role: 'io',
      imax: 0.05,
    })
  }
  return ports
}
