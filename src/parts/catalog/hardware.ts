import type { MatRef, PartDef, Port, Profile, Solid, Vec2 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, str } from './_helpers'

/**
 * Hardware: the things that hold a build together and the things that move it.
 *
 * Sizes are the real catalogue ones, because the point of drawing a 608 bearing
 * rather than a cylinder is that 8 mm actually goes through it and 22 mm
 * actually has to fit in the pocket you cut.
 */

const STEEL = { color: '#9CA3AC', metal: 1, rough: 0.32, density: 7.85 }
const STEEL_DARK = { color: '#6E757E', metal: 1, rough: 0.42, density: 7.85 }
const BRASS = 'brass'
const NYLON = 'nylon-black'

/** A regular polygon as a profile outline. */
function polygon(sides: number, radius: number, rot = 0): Vec2[] {
  return Array.from({ length: sides }, (_, i): Vec2 => {
    const a = rot + (i / sides) * Math.PI * 2
    return [Math.cos(a) * radius, Math.sin(a) * radius]
  })
}

/* ================================================================== */
/* Fasteners                                                           */
/* ================================================================== */

const METRIC = ['M3', 'M4', 'M5', 'M6', 'M8'] as const
const METRIC_OPTS = METRIC.map((v) => ({ value: v, label: v }))
const mSize = (p: Record<string, unknown>, key = 'thread'): number =>
  parseInt(str(p as never, key, 'M5').slice(1), 10) || 5

/** Across-flats for a standard metric hex nut. */
const NUT_AF: Record<number, number> = { 3: 5.5, 4: 7, 5: 8, 6: 10, 8: 13 }
const NUT_H: Record<number, number> = { 3: 2.4, 4: 3.2, 5: 4, 6: 5, 8: 6.5 }
const WASHER_OD: Record<number, number> = { 3: 7, 4: 9, 5: 10, 6: 12, 8: 16 }

const hexNut: PartDef = {
  id: 'nut-hex',
  name: 'Hex nut',
  category: 'fastener',
  blurb: 'Standard metric nut, DIN 934',
  tags: ['nut', 'hex', 'fastener', 'metric', 'm3', 'm5', 'thread', 'din934'],
  doc: { mpn: 'DIN 934', price: 0.03, description: 'A plain hex nut in the standard across-flats and height for its thread.' },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M5', group: 'Size', options: METRIC_OPTS },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'steel-zinc', group: 'Finish', options: [
      { value: 'steel-zinc', label: 'Zinc plated' }, { value: 'steel', label: 'Plain steel' }, { value: 'brass', label: 'Brass' },
    ] },
  ],
  solids: (p) => {
    const d = mSize(p)
    const af = NUT_AF[d] ?? 8
    const h = NUT_H[d] ?? 4
    // Across-flats to across-corners: the circumradius of a hexagon.
    const r = af / Math.sqrt(3)
    const profile: Profile = { outline: polygon(6, r), holes: [circle(d / 2, 0, 0, 16)] }
    return [{ kind: 'extrude', mat: str(p, 'finish', 'steel-zinc'), profile, depth: h, rot: [-90, 0, 0], at: [0, h / 2, 0] }]
  },
  ports: (p) => {
    const d = mSize(p)
    const h = NUT_H[d] ?? 4
    return [
      { id: 'thread', label: `${str(p, 'thread', 'M5')} thread`, kind: 'mechanical', pos: [0, h / 2, 0], dir: [0, 1, 0], mate: { type: 'thread', size: d } },
      { id: 'face', label: 'Bearing face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const d = mSize(p)
    return [
      { label: 'Across flats', value: `${NUT_AF[d] ?? 8} mm` },
      { label: 'Height', value: `${NUT_H[d] ?? 4} mm` },
      { label: 'Spanner', value: `${NUT_AF[d] ?? 8} mm` },
    ]
  },
}

const washer: PartDef = {
  id: 'washer-flat',
  name: 'Flat washer',
  category: 'fastener',
  blurb: 'Spreads the load under a head',
  tags: ['washer', 'flat', 'fastener', 'metric', 'din125'],
  doc: { mpn: 'DIN 125', price: 0.02, description: 'A plain flat washer in the standard outside diameter for its bore.' },
  params: [
    { key: 'thread', label: 'For thread', type: 'enum', default: 'M5', group: 'Size', options: METRIC_OPTS },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'steel-zinc', group: 'Finish', options: [
      { value: 'steel-zinc', label: 'Zinc plated' }, { value: 'steel', label: 'Plain steel' }, { value: 'brass', label: 'Brass' },
    ] },
  ],
  solids: (p) => {
    const d = mSize(p)
    const od = WASHER_OD[d] ?? 10
    const t = Math.max(0.8, d * 0.2)
    return [{
      kind: 'extrude', mat: str(p, 'finish', 'steel-zinc'),
      profile: { outline: circle(od / 2, 0, 0, 28), holes: [circle((d + 0.4) / 2, 0, 0, 20)] },
      depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0],
    }]
  },
  ports: (p) => {
    const d = mSize(p)
    const t = Math.max(0.8, d * 0.2)
    return [
      { id: 'bore', label: 'Bore', kind: 'mechanical', pos: [0, t, 0], dir: [0, 1, 0], mate: { type: 'hole', size: d + 0.4 } },
      { id: 'face', label: 'Bearing face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
}

const insert: PartDef = {
  id: 'insert-heatset',
  name: 'Heat-set insert',
  category: 'fastener',
  blurb: 'Brass thread melted into plastic',
  tags: ['insert', 'heatset', 'heat set', 'brass', 'threaded', '3d print', 'fastener'],
  doc: {
    mpn: 'M3 x 5 x 4.6',
    price: 0.08,
    description: 'A knurled brass bush pushed into a printed part with a soldering iron. The knurl is what stops it turning once the plastic sets around it.',
  },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M3', group: 'Size', options: METRIC_OPTS.slice(0, 3) },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 5, min: 3, max: 10, step: 0.5, group: 'Size' },
  ],
  solids: (p) => {
    const d = mSize(p)
    const len = num(p, 'length', 5)
    const od = d + 1.6
    const out: Solid[] = [{
      kind: 'extrude', mat: BRASS,
      profile: { outline: circle(od / 2, 0, 0, 24), holes: [circle(d / 2, 0, 0, 16)] },
      depth: len, rot: [-90, 0, 0], at: [0, len / 2, 0],
    }]
    // Two knurled bands, which is what these actually look like.
    for (const y of [len * 0.28, len * 0.72]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        out.push({
          kind: 'box', mat: BRASS, size: [0.35, len * 0.3, 0.35],
          at: [Math.cos(a) * (od / 2), y, Math.sin(a) * (od / 2)],
          rot: [0, (-a * 180) / Math.PI, 0], noCollide: true,
        })
      }
    }
    return out
  },
  ports: (p) => {
    const len = num(p, 'length', 5)
    return [
      { id: 'thread', label: `${str(p, 'thread', 'M3')} thread`, kind: 'mechanical', pos: [0, len, 0], dir: [0, 1, 0], mate: { type: 'thread', size: mSize(p) } },
      { id: 'nose', label: 'Nose', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'stud', size: mSize(p) + 1.6 } },
    ]
  },
}

/* ================================================================== */
/* Motion                                                              */
/* ================================================================== */

const BEARINGS: Record<string, { id: number; od: number; w: number }> = {
  '623': { id: 3, od: 10, w: 4 },
  '624': { id: 4, od: 13, w: 5 },
  '625': { id: 5, od: 16, w: 5 },
  '608': { id: 8, od: 22, w: 7 },
  '6800': { id: 10, od: 19, w: 5 },
}

const bearing: PartDef = {
  id: 'bearing-ball',
  name: 'Ball bearing',
  category: 'motion',
  blurb: 'Shielded deep groove bearing',
  tags: ['bearing', 'ball', '608', '625', 'skate', 'motion', 'shaft', 'roller'],
  doc: { mpn: '608ZZ', price: 0.7, description: 'A shielded deep groove bearing in the usual sizes. The 608 is the skateboard one that half of every printer is built from.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: '608', group: 'Size', options: Object.keys(BEARINGS).map((v) => ({ value: v, label: v })) },
  ],
  solids: (p) => {
    const b = BEARINGS[str(p, 'size', '608')] ?? BEARINGS['608']
    const ring = (rOuter: number, rInner: number, mat: MatRef): Solid => ({
      kind: 'extrude', mat,
      profile: { outline: circle(rOuter, 0, 0, 40), holes: [circle(rInner, 0, 0, 32)] },
      depth: b.w, rot: [-90, 0, 0], at: [0, b.w / 2, 0],
    })
    return [
      ring(b.od / 2, b.od / 2 - 1.6, STEEL),
      ring(b.id / 2 + 1.4, b.id / 2, STEEL),
      // The shield, slightly proud of nothing and inset from both rings.
      ring(b.od / 2 - 1.7, b.id / 2 + 1.5, STEEL_DARK),
    ]
  },
  ports: (p) => {
    const b = BEARINGS[str(p, 'size', '608')] ?? BEARINGS['608']
    return [
      { id: 'bore', label: `${b.id} mm bore`, kind: 'mechanical', pos: [0, b.w / 2, 0], dir: [0, 1, 0], mate: { type: 'hole', size: b.id } },
      { id: 'outer', label: 'Outer race', kind: 'mechanical', pos: [0, b.w / 2, b.od / 2], dir: [0, 0, 1], mate: { type: 'face' } },
      { id: 'face', label: 'Face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const b = BEARINGS[str(p, 'size', '608')] ?? BEARINGS['608']
    return [
      { label: 'Bore', value: `${b.id} mm` },
      { label: 'Outside diameter', value: `${b.od} mm` },
      { label: 'Width', value: `${b.w} mm` },
    ]
  },
}

const pulley: PartDef = {
  id: 'pulley-gt2',
  name: 'GT2 timing pulley',
  category: 'motion',
  blurb: '2 mm pitch, for a toothed belt',
  tags: ['pulley', 'gt2', 'timing', 'belt', 'motion', 'toothed', '20t', 'printer'],
  doc: { mpn: 'GT2-20T', price: 1.4, description: 'An aluminium GT2 pulley with flanges. Pitch diameter follows from the tooth count at 2 mm pitch.' },
  params: [
    { key: 'teeth', label: 'Teeth', type: 'number', default: 20, min: 12, max: 60, step: 1, group: 'Size' },
    { key: 'bore', label: 'Bore', type: 'number', unit: 'mm', default: 5, min: 3, max: 12, step: 0.5, group: 'Size' },
    { key: 'width', label: 'Belt width', type: 'number', unit: 'mm', default: 6, min: 6, max: 15, step: 3, group: 'Size' },
  ],
  solids: (p) => {
    const teeth = Math.round(num(p, 'teeth', 20))
    const bore = num(p, 'bore', 5)
    const bw = num(p, 'width', 6)
    // Pitch diameter for a 2 mm pitch belt.
    const pd = (teeth * 2) / Math.PI
    const r = pd / 2
    const bodyH = bw + 2
    const out: Solid[] = [
      {
        kind: 'extrude', mat: 'alu-6063',
        profile: { outline: circle(r, 0, 0, Math.min(64, teeth * 2)), holes: [circle(bore / 2, 0, 0, 20)] },
        depth: bw, rot: [-90, 0, 0], at: [0, 1 + bw / 2, 0],
      },
      // Flanges above and below the belt path.
      ...[0.5, bw + 1.5].map((y): Solid => ({
        kind: 'extrude', mat: 'alu-6063',
        profile: { outline: circle(r + 1.2, 0, 0, 40), holes: [circle(bore / 2, 0, 0, 20)] },
        depth: 1, rot: [-90, 0, 0], at: [0, y, 0],
      })),
      // Grub screw boss.
      { kind: 'cyl', mat: 'alu-6063', r: bore / 2 + 2.4, h: 6, at: [0, bodyH + 3, 0], chamfer: 0.4 },
      { kind: 'cyl', mat: STEEL_DARK, r: 1.5, h: 3, rot: [0, 0, 90], at: [bore / 2 + 1.6, bodyH + 3, 0], noCollide: true },
    ]
    return out
  },
  ports: (p) => {
    const bore = num(p, 'bore', 5)
    const bw = num(p, 'width', 6)
    return [
      { id: 'bore', label: `${bore} mm bore`, kind: 'mechanical', pos: [0, bw + 8, 0], dir: [0, 1, 0], mate: { type: 'hole', size: bore } },
      { id: 'face', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const teeth = Math.round(num(p, 'teeth', 20))
    return [
      { label: 'Pitch diameter', value: `${((teeth * 2) / Math.PI).toFixed(2)} mm` },
      { label: 'Travel per turn', value: `${(teeth * 2).toFixed(0)} mm` },
      { label: 'Belt', value: 'GT2, 2 mm pitch' },
    ]
  },
}

const linearRail: PartDef = {
  id: 'rail-linear',
  name: 'Linear rail',
  category: 'motion',
  blurb: 'Profile rail with a running carriage',
  tags: ['rail', 'linear', 'mgn12', 'mgn9', 'motion', 'guide', 'carriage', 'slide'],
  doc: { mpn: 'MGN12', price: 18, description: 'A profile rail and its carriage. Mounting holes run at the standard pitch for the size.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: 'MGN12', group: 'Size', options: [
      { value: 'MGN9', label: 'MGN9' }, { value: 'MGN12', label: 'MGN12' }, { value: 'MGN15', label: 'MGN15' },
    ] },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 100, max: 1500, step: 50, group: 'Size' },
    { key: 'carriage', label: 'Carriage position', type: 'number', unit: '%', default: 50, min: 0, max: 100, step: 1, group: 'Layout' },
  ],
  solids: (p) => {
    const spec = RAIL[str(p, 'size', 'MGN12')] ?? RAIL.MGN12
    const len = num(p, 'length', 300)
    const t = Math.min(Math.max(num(p, 'carriage', 50) / 100, 0), 1)
    const travel = Math.max(0, len - spec.blockLen)
    const cx = -travel / 2 + travel * t

    const holes: Vec2[][] = []
    const n = Math.max(2, Math.floor((len - 20) / spec.pitch) + 1)
    const first = -((n - 1) * spec.pitch) / 2
    for (let i = 0; i < n; i++) holes.push(circle(spec.holeDia / 2, first + i * spec.pitch, 0, 14))

    return [
      // Rail, as a plan-view extrusion so the counterbores read.
      { kind: 'box', mat: STEEL, size: [len, spec.railH, spec.railW], at: [0, spec.railH / 2, 0], bevel: 0.4 },
      {
        kind: 'extrude', mat: STEEL_DARK, profile: { outline: [[-len / 2, -spec.railW / 2], [len / 2, -spec.railW / 2], [len / 2, spec.railW / 2], [-len / 2, spec.railW / 2]], holes },
        depth: 0.6, rot: [-90, 0, 0], at: [0, spec.railH - 0.3, 0], noCollide: true,
      },
      // Carriage.
      { kind: 'box', mat: STEEL_DARK, size: [spec.blockLen, spec.blockH - spec.railH, spec.blockW], at: [cx, spec.railH + (spec.blockH - spec.railH) / 2, 0], bevel: 0.6 },
      ...[-1, 1].map((s): Solid => ({
        kind: 'box', mat: NYLON, size: [3, spec.blockH - spec.railH - 1, spec.blockW - 1],
        at: [cx + (s * spec.blockLen) / 2, spec.railH + (spec.blockH - spec.railH) / 2, 0], noCollide: true,
      })),
    ]
  },
  ports: (p) => {
    const spec = RAIL[str(p, 'size', 'MGN12')] ?? RAIL.MGN12
    const len = num(p, 'length', 300)
    const t = Math.min(Math.max(num(p, 'carriage', 50) / 100, 0), 1)
    const travel = Math.max(0, len - spec.blockLen)
    const cx = -travel / 2 + travel * t
    const out: Port[] = []
    const n = Math.max(2, Math.floor((len - 20) / spec.pitch) + 1)
    const first = -((n - 1) * spec.pitch) / 2
    for (let i = 0; i < n; i++) {
      out.push({
        id: `hole${i}`, label: 'Rail hole', kind: 'mechanical',
        pos: [first + i * spec.pitch, spec.railH, 0], dir: [0, 1, 0],
        mate: { type: 'hole', size: spec.holeDia }, groupId: 'rail-holes',
      })
    }
    for (let i = 0; i < 4; i++) {
      const sx = i < 2 ? -1 : 1
      const sz = i % 2 === 0 ? -1 : 1
      out.push({
        id: `carriage${i}`, label: 'Carriage thread', kind: 'mechanical',
        pos: [cx + (sx * spec.blockLen) / 3.4, spec.blockH, (sz * spec.blockW) / 3.2], dir: [0, 1, 0],
        mate: { type: 'thread', size: spec.blockThread }, groupId: 'carriage',
      })
    }
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  readouts: (p) => {
    const spec = RAIL[str(p, 'size', 'MGN12')] ?? RAIL.MGN12
    const len = num(p, 'length', 300)
    return [
      { label: 'Travel', value: `${Math.max(0, len - spec.blockLen)} mm` },
      { label: 'Rail width', value: `${spec.railW} mm` },
      { label: 'Carriage threads', value: `M${spec.blockThread}` },
    ]
  },
}

const RAIL: Record<string, {
  railW: number; railH: number; pitch: number; holeDia: number
  blockLen: number; blockW: number; blockH: number; blockThread: number
}> = {
  MGN9: { railW: 9, railH: 6.5, pitch: 20, holeDia: 3.5, blockLen: 39, blockW: 20, blockH: 10, blockThread: 3 },
  MGN12: { railW: 12, railH: 8, pitch: 25, holeDia: 3.5, blockLen: 45, blockW: 27, blockH: 13, blockThread: 3 },
  MGN15: { railW: 15, railH: 10, pitch: 40, holeDia: 4.5, blockLen: 56, blockW: 32, blockH: 16, blockThread: 4 },
}

const leadscrew: PartDef = {
  id: 'leadscrew-t8',
  name: 'Lead screw',
  category: 'motion',
  blurb: 'Trapezoidal screw with a brass nut',
  tags: ['leadscrew', 'lead screw', 't8', 'acme', 'trapezoidal', 'motion', 'z axis', 'nut'],
  doc: { mpn: 'T8', price: 6, description: 'A trapezoidal lead screw and its brass nut. Lead is how far one turn moves it, which on a four-start T8 is 8 mm.' },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 50, max: 1000, step: 10, group: 'Size' },
    { key: 'lead', label: 'Lead', type: 'enum', default: '8', group: 'Size', options: [
      { value: '2', label: '2 mm, single start' }, { value: '4', label: '4 mm, two start' }, { value: '8', label: '8 mm, four start' },
    ] },
    { key: 'nut', label: 'Fit the nut', type: 'bool', default: true, group: 'Layout' },
    { key: 'nutAt', label: 'Nut position', type: 'number', unit: '%', default: 50, min: 0, max: 100, step: 1, group: 'Layout', showIf: (q) => q.nut !== false },
  ],
  solids: (p) => {
    const len = num(p, 'length', 300)
    const lead = parseFloat(str(p, 'lead', '8')) || 8
    const out: Solid[] = [
      { kind: 'cyl', mat: STEEL, r: 4, h: len, rot: [0, 0, 90], at: [0, 4, 0], chamfer: 0.5 },
    ]
    // The thread, as a coarse helix of short segments. Enough turns to read as
    // a screw without pretending to be a swept profile.
    const turns = Math.min(140, Math.floor(len / lead))
    for (let i = 0; i < turns; i++) {
      const x = -len / 2 + 2 + (i + 0.5) * lead
      if (x > len / 2 - 2) break
      out.push({
        kind: 'torus', mat: STEEL_DARK, r: 3.7, tube: 0.55,
        rot: [0, 0, 90], at: [x, 4, 0], seg: 18, noCollide: true,
      })
    }
    if (p.nut !== false) {
      const t = Math.min(Math.max(num(p, 'nutAt', 50) / 100, 0), 1)
      const nx = -len / 2 + 12 + (len - 24) * t
      out.push(
        { kind: 'cyl', mat: BRASS, r: 5.2, h: 15, rot: [0, 0, 90], at: [nx, 4, 0], chamfer: 0.4 },
        {
          kind: 'extrude', mat: BRASS,
          profile: { outline: circle(11, 0, 0, 28), holes: [circle(4.2, 0, 0, 18), ...[0, 1, 2, 3].map((i) => circle(1.6, Math.cos((i / 4) * Math.PI * 2) * 8, Math.sin((i / 4) * Math.PI * 2) * 8, 10))] },
          depth: 3.5, rot: [0, 0, 90], at: [nx - 5.5, 4, 0],
        },
      )
    }
    return out
  },
  ports: (p) => {
    const len = num(p, 'length', 300)
    const out: Port[] = [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-len / 2, 4, 0], dir: [-1, 0, 0], mate: { type: 'stud', size: 8 } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [len / 2, 4, 0], dir: [1, 0, 0], mate: { type: 'stud', size: 8 } },
    ]
    if (p.nut !== false) {
      const t = Math.min(Math.max(num(p, 'nutAt', 50) / 100, 0), 1)
      const nx = -len / 2 + 12 + (len - 24) * t
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        out.push({
          id: `nut${i}`, label: 'Nut flange hole', kind: 'mechanical',
          pos: [nx - 7.2, 4 + Math.sin(a) * 8, Math.cos(a) * 8], dir: [-1, 0, 0],
          mate: { type: 'hole', size: 3.2 }, groupId: 'nut-flange',
        })
      }
    }
    return out
  },
  readouts: (p) => {
    const lead = parseFloat(str(p, 'lead', '8')) || 8
    return [
      { label: 'Lead', value: `${lead} mm per turn` },
      { label: 'With a 200 step motor', value: `${(lead / 200).toFixed(3)} mm per step` },
      { label: 'Diameter', value: '8 mm' },
    ]
  },
}

/* ================================================================== */
/* Structural                                                          */
/* ================================================================== */

const angle: PartDef = {
  id: 'angle-stock',
  name: 'Angle stock',
  category: 'structural',
  blurb: 'L section in aluminium or steel',
  tags: ['angle', 'l section', 'bracket', 'stock', 'aluminium', 'steel', 'framing', 'structural'],
  doc: { price: 4, description: 'Equal angle in the usual stock sizes, cut to length. The inside corner carries the fillet a real extrusion has.' },
  params: [
    { key: 'leg', label: 'Leg', type: 'number', unit: 'mm', default: 25, min: 10, max: 100, step: 5, group: 'Section' },
    { key: 'thickness', label: 'Wall', type: 'number', unit: 'mm', default: 3, min: 1, max: 10, step: 0.5, group: 'Section' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 20, max: 3000, step: 10, group: 'Size' },
    { key: 'material', label: 'Material', type: 'enum', default: 'alu-6063', group: 'Material', options: [
      { value: 'alu-6063', label: 'Aluminium' }, { value: 'steel', label: 'Mild steel' }, { value: 'steel-zinc', label: 'Zinc plated steel' },
    ] },
  ],
  solids: (p) => {
    const leg = num(p, 'leg', 25)
    const t = Math.min(num(p, 'thickness', 3), leg / 2)
    const len = num(p, 'length', 300)
    const outline: Vec2[] = [
      [0, 0], [leg, 0], [leg, t], [t, t], [t, leg], [0, leg],
    ]
    return [{
      kind: 'extrude', mat: str(p, 'material', 'alu-6063'),
      profile: { outline },
      depth: len, bevel: 0.3, rot: [0, 90, 0], at: [0, 0, 0],
    }]
  },
  ports: (p) => {
    const leg = num(p, 'leg', 25)
    const t = Math.min(num(p, 'thickness', 3), leg / 2)
    const len = num(p, 'length', 300)
    return [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-len / 2, t / 2, t / 2], dir: [-1, 0, 0], mate: { type: 'face' } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [len / 2, t / 2, t / 2], dir: [1, 0, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top face', kind: 'mechanical', pos: [0, t, leg / 2], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'side', label: 'Upright face', kind: 'mechanical', pos: [0, leg / 2, t], dir: [0, 0, 1], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const leg = num(p, 'leg', 25)
    const t = num(p, 'thickness', 3)
    return [
      { label: 'Section', value: `${leg} x ${leg} x ${t} mm` },
      { label: 'Cut length', value: `${num(p, 'length', 300)} mm` },
    ]
  },
}

/* ================================================================== */
/* Connectors and switches                                             */
/* ================================================================== */

const terminalBlock: PartDef = {
  id: 'terminal-block',
  name: 'Screw terminal',
  category: 'connector',
  blurb: 'Pluggable block, 5.08 mm pitch',
  tags: ['terminal', 'screw', 'block', 'connector', 'power', 'wire', 'phoenix', '5.08'],
  doc: {
    mpn: 'KF128-5.08',
    price: 0.4,
    description: 'The green screw block every power input ends up on. Terminals are joined to nothing internally, so each way is its own net.',
  },
  params: [
    { key: 'ways', label: 'Ways', type: 'number', default: 2, min: 2, max: 8, step: 1, group: 'Size' },
    { key: 'pitch', label: 'Pitch', type: 'enum', default: '5.08', group: 'Size', options: [
      { value: '3.5', label: '3.5 mm' }, { value: '5.08', label: '5.08 mm' }, { value: '7.62', label: '7.62 mm' },
    ] },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'ways', 2))
    const pitch = parseFloat(str(p, 'pitch', '5.08')) || 5.08
    const w = n * pitch
    const d = pitch * 1.85
    const h = pitch * 1.9
    const x0 = -((n - 1) * pitch) / 2
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1E7A3C', rough: 0.55, density: 1.4 }, size: [w, h, d], at: [0, h / 2, 0], bevel: 0.4 },
    ]
    for (let i = 0; i < n; i++) {
      const x = x0 + i * pitch
      // Wire entry, screw head and pin.
      out.push({ kind: 'box', mat: { color: '#0D2A16', rough: 0.9, density: 0.01 }, size: [pitch * 0.6, pitch * 0.55, 2], at: [x, h * 0.32, -d / 2 + 0.6], noCollide: true })
      out.push({ kind: 'cyl', mat: STEEL, r: pitch * 0.27, h: 1.2, at: [x, h - 0.2, d * 0.08], chamfer: 0.15 })
      out.push({ kind: 'box', mat: STEEL_DARK, size: [pitch * 0.34, 0.5, 1.4], at: [x, h + 0.35, d * 0.08], noCollide: true })
      out.push({ kind: 'box', mat: 'tin', size: [0.8, 6, 0.8], at: [x, -3, 0] })
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'ways', 2))
    const pitch = parseFloat(str(p, 'pitch', '5.08')) || 5.08
    const x0 = -((n - 1) * pitch) / 2
    return Array.from({ length: n }, (_, i): Port => ({
      id: `t${i + 1}`,
      label: `Way ${i + 1}`,
      kind: 'electrical',
      pos: [x0 + i * pitch, -6, 0],
      dir: [0, -1, 0],
      role: 'passive',
      imax: 10,
    }))
  },
  electrical: { devices: () => [], limits: { imax: 10, vmax: 300 } },
  readouts: (p) => [
    { label: 'Ways', value: String(Math.round(num(p, 'ways', 2))) },
    { label: 'Rating', value: '10 A, 300 V' },
    { label: 'Wire', value: 'Up to 2.5 mm²' },
  ],
}

const rocker: PartDef = {
  id: 'switch-rocker',
  name: 'Rocker switch',
  category: 'electromech',
  blurb: 'Panel switch, latching',
  tags: ['rocker', 'switch', 'panel', 'mains', 'power', 'kcd11', 'latching', 'on off'],
  doc: { mpn: 'KCD1-101', price: 0.5, description: 'A panel rocker in the common 21 by 15 mm cutout. Latching, so it stays where you put it.' },
  params: [
    { key: 'on', label: 'Switched on', type: 'bool', default: false, group: 'State' },
    { key: 'colour', label: 'Rocker', type: 'enum', default: 'black', group: 'Body', options: [
      { value: 'black', label: 'Black' }, { value: 'red', label: 'Red' }, { value: 'green', label: 'Green' },
    ] },
  ],
  solids: (p) => {
    const on = p.on === true
    const colours: Record<string, MatRef> = {
      black: { color: '#1A1D22', rough: 0.5, density: 1.4 },
      red: { color: '#B4231D', rough: 0.45, density: 1.4 },
      green: { color: '#1E7A3C', rough: 0.45, density: 1.4 },
    }
    const cap = colours[str(p, 'colour', 'black')] ?? colours.black
    return [
      // Body below the panel, bezel above it.
      { kind: 'box', mat: { color: '#15181C', rough: 0.6, density: 1.4 }, size: [21, 14, 15], at: [0, -7, 0], bevel: 0.4 },
      { kind: 'box', mat: { color: '#15181C', rough: 0.5, density: 1.4 }, size: [25.5, 2.2, 19.5], at: [0, 1.1, 0], bevel: 0.5 },
      // The rocker itself, tilted the way it is switched.
      { kind: 'box', mat: cap, size: [18.5, 4, 13], at: [0, 3.6, 0], rot: [on ? 9 : -9, 0, 0], bevel: 0.6 },
      ...[-1, 1].map((s): Solid => ({
        kind: 'box', mat: 'tin', size: [0.8, 8, 4.8], at: [0, -13, s * 4.6],
      })),
    ]
  },
  ports: () => [
    { id: 'a', label: 'Terminal A', kind: 'electrical', pos: [0, -17, -4.6], dir: [0, -1, 0], role: 'passive', imax: 6 },
    { id: 'b', label: 'Terminal B', kind: 'electrical', pos: [0, -17, 4.6], dir: [0, -1, 0], role: 'passive', imax: 6 },
    { id: 'panel', label: 'Panel cutout', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'hole', size: 21 } },
  ],
  electrical: {
    devices: (p) => [{ type: 'switch', a: 'a', b: 'b', closed: p.on === true, ron: 0.02, roff: 1e9 }],
    limits: { imax: 6, vmax: 250 },
  },
  readouts: (p) => [
    { label: 'State', value: p.on === true ? 'Closed' : 'Open' },
    { label: 'Panel cutout', value: '21 x 15 mm' },
    { label: 'Rating', value: '6 A, 250 V' },
  ],
}

const microswitch: PartDef = {
  id: 'switch-micro',
  name: 'Limit switch',
  category: 'electromech',
  blurb: 'Microswitch, common with NO and NC',
  tags: ['limit', 'micro', 'switch', 'endstop', 'lever', 'ss-5gl', 'omron', 'spdt', 'homing'],
  doc: {
    mpn: 'SS-5GL',
    price: 0.6,
    description: 'A lever microswitch with changeover contacts. The endstop on nearly every machine: common goes to normally closed until the lever moves.',
  },
  params: [
    { key: 'pressed', label: 'Lever pressed', type: 'bool', default: false, group: 'State' },
    { key: 'lever', label: 'Lever', type: 'enum', default: 'straight', group: 'Body', options: [
      { value: 'none', label: 'Plunger only' }, { value: 'straight', label: 'Straight lever' }, { value: 'roller', label: 'Roller lever' },
    ] },
  ],
  solids: (p) => {
    const pressed = p.pressed === true
    const lever = str(p, 'lever', 'straight')
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1B1E23', rough: 0.55, density: 1.4 }, size: [19.8, 10.2, 6.4], at: [0, 5.1, 0], bevel: 0.3 },
      { kind: 'cyl', mat: { color: '#D8DCE2', rough: 0.5, density: 1.2 }, r: 1.5, h: pressed ? 1.2 : 2.6, at: [4.5, 10.2 + (pressed ? 0.6 : 1.3), 0] },
      ...[-6.4, 0, 6.4].map((x): Solid => ({
        kind: 'box', mat: 'tin', size: [3.2, 6, 0.5], at: [x, -3, 0],
      })),
    ]
    if (lever !== 'none') {
      const tilt = pressed ? -3 : -13
      out.push({
        kind: 'box', mat: { color: '#C6CBD2', metal: 1, rough: 0.35, density: 7.8 },
        size: [18, 0.4, 4.6], at: [-1.5, 12.4, 0], rot: [0, 0, tilt],
      })
      if (lever === 'roller') {
        out.push({
          kind: 'cyl', mat: NYLON, r: 2.4, h: 4.4, rot: [90, 0, 0],
          at: [-10.4 + Math.cos((tilt * Math.PI) / 180) * 0, 12.4 + Math.sin((tilt * Math.PI) / 180) * -9, 0],
        })
      }
    }
    return out
  },
  ports: () => [
    { id: 'com', label: 'COM', kind: 'electrical', pos: [0, -6, 0], dir: [0, -1, 0], role: 'passive', imax: 5 },
    { id: 'nc', label: 'NC', kind: 'electrical', pos: [-6.4, -6, 0], dir: [0, -1, 0], role: 'passive', imax: 5 },
    { id: 'no', label: 'NO', kind: 'electrical', pos: [6.4, -6, 0], dir: [0, -1, 0], role: 'passive', imax: 5 },
    { id: 'mount0', label: 'Mount hole', kind: 'mechanical', pos: [-4.7, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: 2.5 }, groupId: 'mounts' },
    { id: 'mount1', label: 'Mount hole', kind: 'mechanical', pos: [4.7, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: 2.5 }, groupId: 'mounts' },
  ],
  electrical: {
    devices: (p) => {
      const pressed = p.pressed === true
      return [
        { type: 'switch', a: 'com', b: 'nc', closed: !pressed, ron: 0.03, roff: 1e9 },
        { type: 'switch', a: 'com', b: 'no', closed: pressed, ron: 0.03, roff: 1e9 },
      ]
    },
    limits: { imax: 5, vmax: 250 },
  },
  readouts: (p) => [
    { label: 'COM to NC', value: p.pressed === true ? 'Open' : 'Closed' },
    { label: 'COM to NO', value: p.pressed === true ? 'Closed' : 'Open' },
  ],
}

/* ================================================================== */
/* Hobby servo                                                         */
/* ================================================================== */

const servo: PartDef = {
  id: 'servo-hobby',
  name: 'Hobby servo',
  category: 'electromech',
  blurb: 'Position from a pulse width',
  tags: ['servo', 'sg90', 'mg996', 'motor', 'rc', 'pwm', 'angle', 'arm', 'actuator'],
  doc: {
    mpn: 'SG90',
    price: 2.2,
    description:
      'A hobby servo. It reads the width of the pulse on its signal wire, once every twenty milliseconds, and holds the angle that width asks for. The horn here is posed by its parameter; the inspector shows the angle the signal is actually commanding.',
  },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: 'sg90', group: 'Body', options: [
      { value: 'sg90', label: 'Micro (SG90)' }, { value: 'mg996', label: 'Standard (MG996R)' },
    ] },
    { key: 'angle', label: 'Horn angle', type: 'number', unit: '°', default: 90, min: 0, max: 180, step: 1, group: 'Pose' },
    { key: 'stall', label: 'Loaded', type: 'bool', default: false, group: 'Pose', help: 'Draws stall current instead of idle current.' },
  ],
  solids: (p) => {
    const big = str(p, 'size', 'sg90') === 'mg996'
    const w = big ? 40.7 : 22.8
    const d = big ? 19.7 : 12.2
    const bodyH = big ? 36.5 : 22.5
    const tabH = big ? 4 : 2.5
    const angle = num(p, 'angle', 90)
    const hornX = big ? 12 : 6.5

    return [
      { kind: 'box', mat: { color: '#1B4FA8', rough: 0.45, clearcoat: 0.2, density: 1.2 }, size: [w, bodyH, d], at: [0, bodyH / 2, 0], bevel: 0.6 },
      // Mounting tabs.
      { kind: 'box', mat: { color: '#1B4FA8', rough: 0.45, density: 1.2 }, size: [w + (big ? 14 : 9.6), tabH, d], at: [0, bodyH - (big ? 10 : 6.5), 0], bevel: 0.4 },
      // Output boss and horn.
      { kind: 'cyl', mat: { color: '#15305F', rough: 0.5, density: 1.2 }, r: big ? 6 : 3.4, h: big ? 5 : 3.2, at: [-w / 2 + (big ? 10 : 5.8), bodyH + (big ? 2.5 : 1.6), 0] },
      {
        kind: 'group', mat: 'abs-white',
        at: [-w / 2 + (big ? 10 : 5.8), bodyH + (big ? 5.4 : 3.6), 0],
        rot: [0, angle - 90, 0],
        children: [
          { kind: 'cyl', mat: 'abs-white', r: big ? 5 : 3, h: 2.4, at: [0, 1.2, 0] },
          { kind: 'box', mat: 'abs-white', size: [hornX * 2, 1.8, big ? 5 : 3.4], at: [hornX * 0.62, 1.2, 0], bevel: 0.3 },
        ],
      },
      // Lead-out, three wires.
      ...(['#3A3F46', '#B4231D', '#C8A227'] as const).map((c, i): Solid => ({
        kind: 'tube', mat: { color: c, rough: 0.6, density: 1.4 }, r: 0.7, seg: 6,
        path: [[w / 2, bodyH * 0.45, (i - 1) * 1.8], [w / 2 + 14, bodyH * 0.45, (i - 1) * 1.8]],
      })),
    ]
  },
  ports: (p) => {
    const big = str(p, 'size', 'sg90') === 'mg996'
    const w = big ? 40.7 : 22.8
    const bodyH = big ? 36.5 : 22.5
    const tabH = big ? 4 : 2.5
    const y = bodyH * 0.45
    const out: Port[] = [
      { id: 'gnd', label: 'GND, brown', kind: 'electrical', pos: [w / 2 + 15, y, -1.8], dir: [1, 0, 0], role: 'gnd', imax: 2 },
      { id: 'vcc', label: 'V+, red', kind: 'electrical', pos: [w / 2 + 15, y, 0], dir: [1, 0, 0], role: 'power', imax: 2 },
      { id: 'sig', label: 'Signal, orange', kind: 'electrical', pos: [w / 2 + 15, y, 1.8], dir: [1, 0, 0], role: 'io', imax: 0.02 },
    ]
    for (const [i, sx] of [-1, 1].entries()) {
      out.push({
        id: `mount${i}`, label: 'Mount hole', kind: 'mechanical',
        pos: [sx * (w / 2 + (big ? 5 : 3.2)), bodyH - (big ? 10 : 6.5) + tabH / 2, 0], dir: [0, 1, 0],
        mate: { type: 'hole', size: big ? 4.2 : 2.2 }, groupId: 'mounts',
      })
    }
    return out
  },
  electrical: {
    devices: () => [{ type: 'behavioral', evalId: 'servo', ref: 'gnd', pins: ['vcc', 'sig'] }],
    limits: { vmax: 7, imax: 2.5 },
  },
  readouts: (p) => {
    const big = str(p, 'size', 'sg90') === 'mg996'
    return [
      { label: 'Pulse for this angle', value: `${Math.round(1000 + (num(p, 'angle', 90) / 180) * 1000)} µs` },
      { label: 'Range', value: '1000 to 2000 µs, 0 to 180°' },
      { label: 'Stall current', value: big ? '2.5 A at 6 V' : '650 mA at 5 V' },
      { label: 'Torque', value: big ? '9.4 kg cm at 4.8 V' : '1.8 kg cm at 4.8 V' },
    ]
  },
}

registerParts([hexNut, washer, insert, bearing, pulley, linearRail, leadscrew, angle, terminalBlock, rocker, microswitch, servo])

export const HARDWARE_PARTS = [
  hexNut, washer, insert, bearing, pulley, linearRail, leadscrew, angle, terminalBlock, rocker, microswitch, servo,
]
