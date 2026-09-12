import type { PartDef, Port, Solid, Vec2, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Stock and hardware: the parts that hold everything else up.
 *
 * Sizes here are the ones sold rather than the ones convenient to draw, so a
 * length entered in a project is a length that can be ordered, and the mass
 * that comes out of it is the mass that turns up.
 */

/* ================================================================== */
/* Tube                                                                */
/* ================================================================== */

const TUBE_MATERIALS: Record<string, { label: string; mat: string }> = {
  'alu-6063': { label: 'Aluminium', mat: 'alu-6063' },
  steel: { label: 'Mild steel', mat: 'steel' },
  'stainless-304': { label: 'Stainless', mat: 'stainless-304' },
  'alu-anod-black': { label: 'Aluminium, black anodised', mat: 'alu-anod-black' },
}

const squareTube: PartDef = {
  id: 'tube-square',
  name: 'Square tube',
  category: 'structural',
  blurb: 'Hollow section, most of the stiffness at a third of the weight',
  tags: ['tube', 'square', 'box section', 'hollow', 'stock', 'frame', 'steel', 'aluminium', 'rhs'],
  doc: {
    price: 6,
    description:
      'Hollow square section. Bending stiffness lives in the material furthest from the centre, so taking the middle out of a bar costs little stiffness and saves most of the mass.',
  },
  params: [
    { key: 'size', label: 'Across flats', type: 'number', unit: 'mm', default: 25, min: 10, max: 100, step: 1, group: 'Section' },
    { key: 'wall', label: 'Wall thickness', type: 'number', unit: 'mm', default: 2, min: 0.8, max: 6, step: 0.2, group: 'Section' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 20, max: 3000, step: 10, group: 'Section' },
    { key: 'material', label: 'Material', type: 'enum', default: 'alu-6063', group: 'Section', options: Object.entries(TUBE_MATERIALS).map(([value, v]) => ({ value, label: v.label })) },
  ],
  solids: (p) => {
    const s = num(p, 'size', 25)
    const wall = Math.min(num(p, 'wall', 2), s / 2 - 0.2)
    const len = num(p, 'length', 300)
    const inner = s - wall * 2
    return [
      {
        kind: 'extrude', mat: TUBE_MATERIALS[str(p, 'material', 'alu-6063')]?.mat ?? 'alu-6063',
        profile: {
          outline: roundRect(s, s, Math.min(wall, s / 6), 0, 0, 3),
          holes: [roundRect(inner, inner, Math.min(wall * 0.6, inner / 6), 0, 0, 3)],
        },
        depth: len, rot: [0, 90, 0], at: [0, s / 2, 0],
      },
    ]
  },
  ports: (p) => {
    const s = num(p, 'size', 25)
    const len = num(p, 'length', 300)
    return [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-len / 2, s / 2, 0], dir: [-1, 0, 0], mate: { type: 'face' } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [len / 2, s / 2, 0], dir: [1, 0, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top face', kind: 'mechanical', pos: [0, s, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'bottom', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'side', label: 'Side face', kind: 'mechanical', pos: [0, s / 2, s / 2], dir: [0, 0, 1], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const s = num(p, 'size', 25)
    const wall = Math.min(num(p, 'wall', 2), s / 2 - 0.2)
    const inner = s - wall * 2
    const area = s * s - inner * inner
    // Second moment of area of a hollow square about its own centroid.
    const i = (Math.pow(s, 4) - Math.pow(inner, 4)) / 12
    const solidI = Math.pow(s, 4) / 12
    return [
      { label: 'Section area', value: `${area.toFixed(0)} mm²` },
      { label: 'Second moment', value: `${(i / 1000).toFixed(1)} x 10³ mm⁴` },
      { label: 'Against a solid bar', value: `${((i / solidI) * 100).toFixed(0)} % as stiff, ${((area / (s * s)) * 100).toFixed(0)} % of the weight` },
      { label: 'Mass per metre', value: `${((area * 1000 * ({ 'alu-6063': 2.7, steel: 7.85, 'stainless-304': 8.0, 'alu-anod-black': 2.7 }[str(p, 'material', 'alu-6063')] ?? 2.7)) / 1e6).toFixed(2)} kg` },
    ]
  },
}

const roundTube: PartDef = {
  id: 'tube-round',
  name: 'Round tube',
  category: 'structural',
  blurb: 'The same stiffness in every direction',
  tags: ['tube', 'round', 'pipe', 'hollow', 'stock', 'rod', 'chs', 'aluminium', 'steel'],
  doc: {
    price: 5,
    description:
      'Hollow round section. Unlike a square it has no weak axis, which matters when the load direction is not known in advance, and it is what a torque tube is made of.',
  },
  params: [
    { key: 'od', label: 'Outside diameter', type: 'number', unit: 'mm', default: 25, min: 4, max: 120, step: 1, group: 'Section' },
    { key: 'wall', label: 'Wall thickness', type: 'number', unit: 'mm', default: 2, min: 0.5, max: 8, step: 0.2, group: 'Section' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 20, max: 3000, step: 10, group: 'Section' },
    { key: 'material', label: 'Material', type: 'enum', default: 'alu-6063', group: 'Section', options: Object.entries(TUBE_MATERIALS).map(([value, v]) => ({ value, label: v.label })) },
  ],
  solids: (p) => {
    const od = num(p, 'od', 25)
    const wall = Math.min(num(p, 'wall', 2), od / 2 - 0.2)
    const len = num(p, 'length', 300)
    return [
      {
        kind: 'extrude', mat: TUBE_MATERIALS[str(p, 'material', 'alu-6063')]?.mat ?? 'alu-6063',
        profile: { outline: circle(od / 2, 0, 0, 32), holes: [circle(od / 2 - wall, 0, 0, 32)] },
        depth: len, rot: [0, 90, 0], at: [0, od / 2, 0],
      },
    ]
  },
  ports: (p) => {
    const od = num(p, 'od', 25)
    const len = num(p, 'length', 300)
    return [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-len / 2, od / 2, 0], dir: [-1, 0, 0], mate: { type: 'face' } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [len / 2, od / 2, 0], dir: [1, 0, 0], mate: { type: 'face' } },
      { id: 'bore', label: 'Bore', kind: 'mechanical', pos: [len / 2, od / 2, 0], dir: [1, 0, 0], mate: { type: 'hole', size: od - num(p, 'wall', 2) * 2 } },
    ]
  },
  readouts: (p) => {
    const od = num(p, 'od', 25)
    const wall = Math.min(num(p, 'wall', 2), od / 2 - 0.2)
    const id = od - wall * 2
    const area = (Math.PI / 4) * (od * od - id * id)
    const i = (Math.PI / 64) * (Math.pow(od, 4) - Math.pow(id, 4))
    return [
      { label: 'Bore', value: `${id.toFixed(1)} mm` },
      { label: 'Section area', value: `${area.toFixed(0)} mm²` },
      { label: 'Second moment', value: `${(i / 1000).toFixed(1)} x 10³ mm⁴, in every direction` },
      { label: 'Mass per metre', value: `${((area * 1000 * ({ 'alu-6063': 2.7, steel: 7.85, 'stainless-304': 8.0, 'alu-anod-black': 2.7 }[str(p, 'material', 'alu-6063')] ?? 2.7)) / 1e6).toFixed(2)} kg` },
    ]
  },
}

/* ================================================================== */
/* Threaded rod                                                        */
/* ================================================================== */

/** Coarse thread pitch for a metric size, mm. */
const METRIC_PITCH: Record<number, number> = { 3: 0.5, 4: 0.7, 5: 0.8, 6: 1, 8: 1.25, 10: 1.5, 12: 1.75 }

const threadedRod: PartDef = {
  id: 'rod-threaded',
  name: 'Threaded rod',
  category: 'fastener',
  blurb: 'A metre of thread, cut to whatever is needed',
  tags: ['threaded rod', 'studding', 'allthread', 'rod', 'm8', 'thread', 'stock', 'tension'],
  doc: {
    price: 3,
    description:
      'Studding, sold by the metre and cut to length. Used in tension it is strong; used as a leadscrew it is a poor one, because a coarse thread has backlash and terrible efficiency compared with a trapezoidal screw.',
  },
  params: [
    {
      key: 'thread', label: 'Thread', type: 'enum', default: 'M8', group: 'Rod',
      options: ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12'].map((m) => ({ value: m, label: m })),
    },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 200, min: 20, max: 1000, step: 5, group: 'Rod' },
    {
      key: 'material', label: 'Material', type: 'enum', default: 'steel-zinc', group: 'Rod',
      options: [
        { value: 'steel-zinc', label: 'Zinc-plated steel' },
        { value: 'stainless-304', label: 'Stainless A2' },
        { value: 'brass', label: 'Brass' },
      ],
    },
  ],
  solids: (p) => {
    const d = parseInt(str(p, 'thread', 'M8').slice(1), 10) || 8
    const len = num(p, 'length', 200)
    const pitch = METRIC_PITCH[d] ?? 1.25
    const mat = str(p, 'material', 'steel-zinc')
    const out: Solid[] = [
      // The core, at the minor diameter.
      { kind: 'cyl', mat, r: (d - pitch * 1.08) / 2, h: len, rot: [0, 0, 90], at: [0, d / 2, 0], seg: 20 },
    ]
    // Thread crests as a stack of thin discs. A true helix would be prettier
    // and would cost several thousand triangles on a part that is usually
    // seen from half a metre away.
    const turns = Math.min(Math.floor(len / pitch), 400)
    for (let i = 0; i < turns; i++) {
      out.push({
        kind: 'cyl', mat, r: d / 2, h: pitch * 0.55, rot: [0, 0, 90],
        at: [-len / 2 + (i + 0.5) * pitch, d / 2, 0], seg: 16, noCollide: true, chamfer: pitch * 0.2,
      })
    }
    return out
  },
  ports: (p) => {
    const d = parseInt(str(p, 'thread', 'M8').slice(1), 10) || 8
    const len = num(p, 'length', 200)
    return [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-len / 2, d / 2, 0], dir: [-1, 0, 0], mate: { type: 'stud', size: d } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [len / 2, d / 2, 0], dir: [1, 0, 0], mate: { type: 'stud', size: d } },
    ]
  },
  readouts: (p) => {
    const d = parseInt(str(p, 'thread', 'M8').slice(1), 10) || 8
    const pitch = METRIC_PITCH[d] ?? 1.25
    // Tensile stress area, the standard ISO formula.
    const area = (Math.PI / 4) * Math.pow(d - 0.9382 * pitch, 2)
    const grade = str(p, 'material', 'steel-zinc') === 'stainless-304' ? 500 : str(p, 'material', 'steel-zinc') === 'brass' ? 350 : 400
    return [
      { label: 'Thread', value: `${str(p, 'thread', 'M8')} x ${pitch} coarse` },
      { label: 'Stress area', value: `${area.toFixed(1)} mm²` },
      { label: 'Breaking load', value: `${((area * grade) / 1000).toFixed(1)} kN` },
      { label: 'Travel per turn', value: `${pitch} mm` },
    ]
  },
}

/* ================================================================== */
/* Standoff                                                            */
/* ================================================================== */

const standoff: PartDef = {
  id: 'standoff-hex',
  name: 'Standoff',
  category: 'fastener',
  blurb: 'Holds a board off a surface, threaded at one end or both',
  tags: ['standoff', 'spacer', 'pillar', 'pcb', 'hex', 'brass', 'nylon', 'm3', 'mount'],
  doc: {
    price: 0.15,
    description:
      'A hex pillar between a board and whatever it is mounted to. Nylon where the board has traces near the hole and metal where it does not, since a brass pillar under a ground plane is a connection whether you meant it or not.',
  },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M3', group: 'Standoff', options: ['M2', 'M2.5', 'M3', 'M4'].map((m) => ({ value: m, label: m })) },
    { key: 'length', label: 'Body length', type: 'number', unit: 'mm', default: 10, min: 3, max: 60, step: 1, group: 'Standoff' },
    {
      key: 'ends', label: 'Ends', type: 'enum', default: 'mf', group: 'Standoff',
      options: [
        { value: 'ff', label: 'Female both ends' },
        { value: 'mf', label: 'Male one end, female the other' },
        { value: 'mm', label: 'Male both ends' },
      ],
    },
    {
      key: 'material', label: 'Material', type: 'enum', default: 'brass', group: 'Standoff',
      options: [
        { value: 'brass', label: 'Brass' },
        { value: 'stainless-304', label: 'Stainless' },
        { value: 'nylon-black', label: 'Nylon' },
      ],
    },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'thread', 'M3').slice(1)) || 3
    const len = num(p, 'length', 10)
    const ends = str(p, 'ends', 'mf')
    const mat = str(p, 'material', 'brass')
    const af = d * 2 // across flats, near enough for these
    const studLen = d + 3
    const out: Solid[] = [
      { kind: 'cyl', mat, r: af / 2 / Math.cos(Math.PI / 6), h: len, seg: 6, at: [0, len / 2, 0], chamfer: 0.3 },
    ]
    if (ends === 'mf' || ends === 'mm') {
      out.push({ kind: 'cyl', mat, r: d / 2, h: studLen, at: [0, -studLen / 2, 0], chamfer: 0.3 })
    }
    if (ends === 'mm') {
      out.push({ kind: 'cyl', mat, r: d / 2, h: studLen, at: [0, len + studLen / 2, 0], chamfer: 0.3 })
    }
    // The bore, so a female end reads as one.
    if (ends !== 'mm') {
      out.push({
        kind: 'cyl', mat: { color: '#0A0C0E', rough: 0.9, density: 0.01 }, r: d / 2 - 0.4, h: Math.min(len * 0.7, 8),
        at: [0, len - Math.min(len * 0.7, 8) / 2 + 0.1, 0], seg: 14, noCollide: true,
      })
    }
    return out
  },
  ports: (p) => {
    const d = parseFloat(str(p, 'thread', 'M3').slice(1)) || 3
    const len = num(p, 'length', 10)
    const ends = str(p, 'ends', 'mf')
    const studLen = d + 3
    const out: Port[] = []
    out.push(
      ends === 'mm' || ends === 'mf'
        ? { id: 'bottom', label: 'Male stud', kind: 'mechanical', pos: [0, -studLen, 0], dir: [0, -1, 0], mate: { type: 'stud', size: d } }
        : { id: 'bottom', label: 'Female thread', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'thread', size: d, depth: len / 2 } },
    )
    out.push(
      ends === 'mm'
        ? { id: 'top', label: 'Male stud', kind: 'mechanical', pos: [0, len + studLen, 0], dir: [0, 1, 0], mate: { type: 'stud', size: d } }
        : { id: 'top', label: 'Female thread', kind: 'mechanical', pos: [0, len, 0], dir: [0, 1, 0], mate: { type: 'thread', size: d, depth: len / 2 } },
    )
    return out
  },
  readouts: (p) => {
    const d = parseFloat(str(p, 'thread', 'M3').slice(1)) || 3
    const mat = str(p, 'material', 'brass')
    return [
      { label: 'Thread', value: str(p, 'thread', 'M3') },
      { label: 'Across flats', value: `${(d * 2).toFixed(1)} mm hex` },
      { label: 'Standoff height', value: `${num(p, 'length', 10)} mm` },
      { label: 'Conductive', value: mat === 'nylon-black' ? 'No, nylon' : 'Yes, and it will join the board to whatever it is bolted to' },
    ]
  },
}

/* ================================================================== */
/* Shaft coupler                                                       */
/* ================================================================== */

const coupler: PartDef = {
  id: 'shaft-coupler',
  name: 'Shaft coupler',
  category: 'motion',
  blurb: 'Joins two shafts, rigid or forgiving',
  tags: ['coupler', 'coupling', 'shaft', 'motor', 'leadscrew', 'flexible', 'jaw', '5mm', '8mm'],
  doc: {
    price: 3.5,
    description:
      'Joins a motor shaft to whatever it drives. A rigid one transmits everything including misalignment, which becomes a side load on both bearings; a flexible one absorbs a fraction of a millimetre of it and costs some torsional stiffness.',
  },
  params: [
    { key: 'boreA', label: 'Bore A', type: 'number', unit: 'mm', default: 5, min: 3, max: 16, step: 0.5, group: 'Coupler' },
    { key: 'boreB', label: 'Bore B', type: 'number', unit: 'mm', default: 8, min: 3, max: 16, step: 0.5, group: 'Coupler' },
    {
      key: 'style', label: 'Style', type: 'enum', default: 'flexible', group: 'Coupler',
      options: [
        { value: 'rigid', label: 'Rigid, clamping' },
        { value: 'flexible', label: 'Flexible, helical cut' },
        { value: 'jaw', label: 'Jaw, with a spider' },
      ],
    },
  ],
  solids: (p) => {
    const a = num(p, 'boreA', 5)
    const b = num(p, 'boreB', 8)
    const style = str(p, 'style', 'flexible')
    const od = Math.max(a, b) * 2.4 + 4
    const len = od * 1.1
    const mat = 'alu-6063'
    const out: Solid[] = []

    if (style === 'jaw') {
      // Two hubs with a rubber spider between them.
      for (const [s, bore] of [[-1, a], [1, b]] as const) {
        out.push({ kind: 'cyl', mat, r: od / 2, h: len * 0.42, rot: [0, 0, 90], at: [(s * len) / 2 - s * len * 0.21, od / 2, 0], seg: 26, chamfer: 0.6 })
        out.push({ kind: 'cyl', mat: { color: '#0A0C0E', rough: 0.9, density: 0.01 }, r: bore / 2, h: len * 0.4, rot: [0, 0, 90], at: [(s * len) / 2 - s * len * 0.2, od / 2, 0], seg: 18, noCollide: true })
      }
      out.push({ kind: 'cyl', mat: { color: '#D8A814', rough: 0.75, density: 1.2 }, r: od / 2 - 1.5, h: len * 0.2, rot: [0, 0, 90], at: [0, od / 2, 0], seg: 20 })
    } else {
      out.push({ kind: 'cyl', mat, r: od / 2, h: len, rot: [0, 0, 90], at: [0, od / 2, 0], seg: 26, chamfer: 0.6 })
      // Both bores, meeting in the middle.
      for (const [s, bore] of [[-1, a], [1, b]] as const) {
        out.push({
          kind: 'cyl', mat: { color: '#0A0C0E', rough: 0.9, density: 0.01 }, r: bore / 2, h: len * 0.48,
          rot: [0, 0, 90], at: [(s * len) / 2 - s * len * 0.24, od / 2, 0], seg: 18, noCollide: true,
        })
      }
      if (style === 'flexible') {
        // The helical relief cut, as a run of slots round the middle.
        for (let i = 0; i < 10; i++) {
          out.push({
            kind: 'box', mat: { color: '#2A2E34', rough: 0.8, density: 0.01 },
            size: [1.1, od + 0.4, od * 0.8], at: [-len * 0.18 + i * (len * 0.04), od / 2, 0],
            rot: [0, 0, 0], noCollide: true,
          })
        }
      }
      // Clamping screws, one at each end.
      for (const s of [-1, 1] as const) {
        out.push({
          kind: 'cyl', mat: 'steel-zinc', r: 1.6, h: od * 0.8, rot: [0, 0, 0],
          at: [(s * len) / 2 - s * len * 0.16, od * 0.9, od * 0.22] as Vec3, seg: 12,
        })
      }
    }
    return out
  },
  ports: (p) => {
    const a = num(p, 'boreA', 5)
    const b = num(p, 'boreB', 8)
    const od = Math.max(a, b) * 2.4 + 4
    const len = od * 1.1
    return [
      { id: 'a', label: `${a} mm bore`, kind: 'mechanical', pos: [-len / 2, od / 2, 0], dir: [-1, 0, 0], mate: { type: 'hole', size: a } },
      { id: 'b', label: `${b} mm bore`, kind: 'mechanical', pos: [len / 2, od / 2, 0], dir: [1, 0, 0], mate: { type: 'hole', size: b } },
    ]
  },
  readouts: (p) => {
    const style = str(p, 'style', 'flexible')
    return [
      { label: 'Bores', value: `${num(p, 'boreA', 5)} mm to ${num(p, 'boreB', 8)} mm` },
      { label: 'Style', value: style === 'rigid' ? 'Rigid, clamping' : style === 'jaw' ? 'Jaw with a spider' : 'Helical cut' },
      { label: 'Misalignment', value: style === 'rigid' ? 'None, it all becomes a bearing load' : style === 'jaw' ? '1 degree and 0.3 mm' : '0.2 mm parallel' },
      { label: 'Backlash', value: style === 'jaw' ? 'A little, in the spider' : 'None' },
    ]
  },
}

/* ================================================================== */
/* Timing belt                                                         */
/* ================================================================== */

const belt: PartDef = {
  id: 'belt-gt2',
  name: 'Timing belt',
  category: 'motion',
  blurb: 'GT2, does not slip and does not stretch',
  tags: ['belt', 'gt2', 'timing', 'toothed', 'drive', '3d printer', 'cnc', 'pulley', 'motion'],
  doc: {
    price: 4,
    description:
      'Toothed belt with glass or steel cords through it. The teeth stop it slipping and the cords stop it stretching, which is the whole reason a printer can go back to the same place twice.',
  },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 400, min: 60, max: 5000, step: 10, group: 'Belt' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 6, min: 3, max: 15, step: 1, group: 'Belt' },
    {
      key: 'form', label: 'Form', type: 'enum', default: 'open', group: 'Belt',
      options: [{ value: 'open', label: 'Open ended' }, { value: 'closed', label: 'Closed loop' }],
    },
    {
      key: 'cord', label: 'Cord', type: 'enum', default: 'glass', group: 'Belt',
      options: [{ value: 'glass', label: 'Fibreglass' }, { value: 'steel', label: 'Steel, stiffer' }],
    },
  ],
  solids: (p) => {
    const len = num(p, 'length', 400)
    const w = num(p, 'width', 6)
    const T = 1.38
    const pitch = 2
    const mat = { color: '#17191C', rough: 0.82, density: 1.4, name: 'Neoprene' }
    const out: Solid[] = []
    if (str(p, 'form', 'open') === 'closed') {
      // A closed belt round two imagined pulleys: a flat loop.
      const span = len / 2 - Math.PI * 12
      out.push({ kind: 'box', mat, size: [span, T, w], at: [0, 12 + T / 2, 0] })
      out.push({ kind: 'box', mat, size: [span, T, w], at: [0, 12 - T / 2 - 24, 0] })
      for (const s of [-1, 1] as const) {
        out.push({
          kind: 'lathe', mat, seg: 20, phi: [s > 0 ? -90 : 90, 180],
          points: [[12, 0], [12 + T, 0], [12 + T, w], [12, w]],
          at: [(s * span) / 2, 0, -w / 2], rot: [0, 0, 0],
        })
      }
      return out
    }
    // Open belt: a straight length with teeth on the underside.
    out.push({ kind: 'box', mat, size: [len, T, w], at: [0, T / 2 + 0.75, 0] })
    const teeth = Math.min(Math.floor(len / pitch), 900)
    for (let i = 0; i < teeth; i++) {
      out.push({
        kind: 'cyl', mat, r: 0.75, h: w, rot: [90, 0, 0],
        at: [-len / 2 + (i + 0.5) * pitch, 0.75, 0], seg: 8, noCollide: true,
      })
    }
    return out
  },
  ports: (p) => {
    const len = num(p, 'length', 400)
    const w = num(p, 'width', 6)
    if (str(p, 'form', 'open') === 'closed') {
      return [{ id: 'loop', label: 'Loop', kind: 'mechanical', pos: [0, 12, 0], dir: [0, 1, 0], mate: { type: 'face' } }]
    }
    void w
    return [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-len / 2, 1.5, 0], dir: [-1, 0, 0], mate: { type: 'face' } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [len / 2, 1.5, 0], dir: [1, 0, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const len = num(p, 'length', 400)
    const w = num(p, 'width', 6)
    const steel = str(p, 'cord', 'glass') === 'steel'
    return [
      { label: 'Pitch', value: '2 mm GT2' },
      { label: 'Teeth', value: `${Math.floor(len / 2)}` },
      { label: 'Width', value: `${w} mm` },
      { label: 'Working tension', value: `${(w * (steel ? 12 : 8)).toFixed(0)} N` },
    ]
  },
}

/* ================================================================== */
/* Wheel                                                               */
/* ================================================================== */

const wheel: PartDef = {
  id: 'wheel',
  name: 'Wheel',
  category: 'motion',
  blurb: 'Rubber tyre on a moulded hub',
  tags: ['wheel', 'tyre', 'tire', 'robot', 'drive', 'rover', 'hub', 'traction'],
  doc: {
    price: 2.4,
    description:
      'A driven wheel for a small robot. The diameter sets how fast it goes for a given motor speed and how much torque it needs, and those pull in opposite directions.',
  },
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', unit: 'mm', default: 65, min: 20, max: 200, step: 1, group: 'Wheel' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 26, min: 6, max: 80, step: 1, group: 'Wheel' },
    { key: 'bore', label: 'Bore', type: 'number', unit: 'mm', default: 6, min: 2, max: 16, step: 0.5, group: 'Wheel' },
    {
      key: 'hub', label: 'Hub', type: 'enum', default: 'd-shaft', group: 'Wheel',
      options: [{ value: 'd-shaft', label: 'D shaft' }, { value: 'round', label: 'Round with a grub screw' }, { value: 'hex', label: 'Hex' }],
    },
  ],
  solids: (p) => {
    const d = num(p, 'diameter', 65)
    const w = num(p, 'width', 26)
    const bore = num(p, 'bore', 6)
    const r = d / 2
    const hubR = Math.max(r * 0.55, bore * 1.8)
    const out: Solid[] = [
      // Tyre, with a shoulder either side so it is not a plain cylinder.
      { kind: 'cyl', mat: 'rubber', r, h: w, rot: [0, 0, 90], at: [0, r, 0], seg: 36, chamfer: Math.min(w * 0.12, 3) },
      // Hub.
      { kind: 'cyl', mat: { color: '#E8EAEC', rough: 0.55, density: 1.1 }, r: hubR, h: w * 0.9, rot: [0, 0, 90], at: [0, r, 0], seg: 28 },
      // Spokes cut through the hub face.
      ...Array.from({ length: 6 }, (_, i): Solid => ({
        kind: 'cyl', mat: { color: '#1A1C20', rough: 0.8, density: 0.01 }, r: hubR * 0.22, h: w,
        rot: [0, 0, 90], at: [0, r + Math.sin((i / 6) * Math.PI * 2) * hubR * 0.6, Math.cos((i / 6) * Math.PI * 2) * hubR * 0.6] as Vec3,
        seg: 12, noCollide: true,
      })),
      // Bore, D-flatted where the hub calls for it.
      {
        kind: 'cyl', mat: { color: '#0A0C0E', rough: 0.9, density: 0.01 }, r: bore / 2, h: w + 1,
        rot: [0, 0, 90], at: [0, r, 0], seg: str(p, 'hub', 'd-shaft') === 'hex' ? 6 : 16, noCollide: true,
      },
    ]
    return out
  },
  ports: (p) => {
    const d = num(p, 'diameter', 65)
    const w = num(p, 'width', 26)
    const bore = num(p, 'bore', 6)
    return [
      { id: 'bore', label: `${bore} mm bore`, kind: 'mechanical', pos: [-w / 2, d / 2, 0], dir: [-1, 0, 0], mate: { type: 'hole', size: bore } },
      { id: 'contact', label: 'Contact patch', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const d = num(p, 'diameter', 65)
    const circ = Math.PI * d
    return [
      { label: 'Circumference', value: `${circ.toFixed(0)} mm per turn` },
      { label: 'At 100 rpm', value: `${((circ * 100) / 60 / 1000).toFixed(2)} m/s` },
      { label: 'At 300 rpm', value: `${((circ * 300) / 60 / 1000).toFixed(2)} m/s` },
      { label: 'Torque for 5 N', value: `${((5 * d) / 2000).toFixed(3)} Nm at the shaft` },
    ]
  },
}

/* ================================================================== */
/* Compression spring                                                  */
/* ================================================================== */

const spring: PartDef = {
  id: 'spring-compression',
  name: 'Compression spring',
  category: 'motion',
  blurb: 'A known force for a known deflection',
  tags: ['spring', 'compression', 'coil', 'preload', 'bed levelling', 'return', 'force'],
  doc: {
    price: 0.3,
    description:
      'A helical compression spring. The rate follows from the wire, the coil diameter and the number of active turns, so the force at any deflection is arithmetic rather than a guess.',
  },
  params: [
    { key: 'od', label: 'Outside diameter', type: 'number', unit: 'mm', default: 8, min: 3, max: 40, step: 0.5, group: 'Spring' },
    { key: 'wire', label: 'Wire diameter', type: 'number', unit: 'mm', default: 0.8, min: 0.2, max: 5, step: 0.1, group: 'Spring' },
    { key: 'free', label: 'Free length', type: 'number', unit: 'mm', default: 25, min: 5, max: 200, step: 1, group: 'Spring' },
    { key: 'turns', label: 'Active turns', type: 'number', default: 10, min: 3, max: 60, step: 1, group: 'Spring' },
    { key: 'compressed', label: 'Compressed by', type: 'number', unit: 'mm', default: 0, min: 0, max: 150, step: 0.5, group: 'Control' },
  ],
  solids: (p) => {
    const od = num(p, 'od', 8)
    const wire = Math.min(num(p, 'wire', 0.8), od / 3)
    const free = num(p, 'free', 25)
    const turns = Math.round(num(p, 'turns', 10))
    const squash = Math.min(num(p, 'compressed', 0), free - turns * wire * 1.05)
    const len = free - squash
    const r = (od - wire) / 2
    // The helix, as a swept tube. Sixteen points a turn is enough to read as
    // a coil without being expensive on a part that is usually small.
    const perTurn = 16
    const path: Vec3[] = []
    const total = turns * perTurn
    for (let i = 0; i <= total; i++) {
      const t = i / total
      const a = t * turns * Math.PI * 2
      path.push([Math.cos(a) * r, wire / 2 + t * (len - wire), Math.sin(a) * r])
    }
    return [{ kind: 'tube', mat: { color: '#A9AEB6', metal: 1, rough: 0.35, density: 7.85 }, r: wire / 2, path, seg: 8 }]
  },
  ports: (p) => {
    const free = num(p, 'free', 25)
    const turns = Math.round(num(p, 'turns', 10))
    const wire = num(p, 'wire', 0.8)
    const len = free - Math.min(num(p, 'compressed', 0), free - turns * wire * 1.05)
    return [
      { id: 'bottom', label: 'Bottom face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top face', kind: 'mechanical', pos: [0, len, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const od = num(p, 'od', 8)
    const wire = Math.min(num(p, 'wire', 0.8), od / 3)
    const turns = Math.round(num(p, 'turns', 10))
    const squash = num(p, 'compressed', 0)
    // k = G d^4 / (8 D^3 n), with G for music wire in MPa.
    const G = 79300
    const D = od - wire
    const k = (G * Math.pow(wire, 4)) / (8 * Math.pow(D, 3) * turns)
    return [
      { label: 'Rate', value: `${k.toFixed(2)} N/mm` },
      { label: 'Force now', value: `${(k * squash).toFixed(1)} N at ${squash} mm` },
      { label: 'Solid length', value: `${(turns * wire * 1.05).toFixed(1)} mm` },
      { label: 'Force at solid', value: `${(k * (num(p, 'free', 25) - turns * wire * 1.05)).toFixed(0)} N` },
    ]
  },
}

/* ================================================================== */
/* Hinge                                                               */
/* ================================================================== */

const hinge: PartDef = {
  id: 'hinge-butt',
  name: 'Hinge',
  category: 'fastener',
  blurb: 'Two leaves and a pin, opened to whatever angle you like',
  tags: ['hinge', 'butt', 'door', 'lid', 'pivot', 'enclosure', 'panel'],
  doc: {
    price: 1.2,
    description:
      'A plain butt hinge. The leaves let into a face so the two parts close flush, and the knuckle sets where the pivot is, which is what decides whether a lid clears its own frame on the way up.',
  },
  params: [
    { key: 'length', label: 'Leaf length', type: 'number', unit: 'mm', default: 50, min: 20, max: 200, step: 5, group: 'Hinge' },
    { key: 'leaf', label: 'Leaf width', type: 'number', unit: 'mm', default: 20, min: 10, max: 60, step: 1, group: 'Hinge' },
    { key: 'angle', label: 'Open angle', type: 'number', unit: '°', default: 90, min: 0, max: 180, step: 5, group: 'Control' },
    {
      key: 'material', label: 'Material', type: 'enum', default: 'stainless-304', group: 'Hinge',
      options: [{ value: 'stainless-304', label: 'Stainless' }, { value: 'brass', label: 'Brass' }, { value: 'steel-zinc', label: 'Zinc-plated steel' }],
    },
  ],
  solids: (p) => {
    const len = num(p, 'length', 50)
    const leaf = num(p, 'leaf', 20)
    const angle = num(p, 'angle', 90)
    const finish = str(p, 'material', 'stainless-304')
    // Rolled and polished rather than mirrored. A flat leaf at roughness 0.24
    // catches the key light square on and blows out to a white card.
    const mat = {
      color: finish === 'brass' ? '#C9A227' : finish === 'steel-zinc' ? '#A9B0B8' : '#B5BAC1',
      metal: 1, rough: 0.42, density: finish === 'brass' ? 8.5 : 7.9,
    }
    const T = 1.6
    const knuckle = 3

    /**
     * One leaf, lying flat: length along x, width running away from the pin
     * in z, thickness in y. Drawn from the pin outward so the group can be
     * rotated about the pin and take the leaf with it.
     */
    // An extrude laid flat with rot [-90, 0, 0] maps its profile y to world
    // -z, so the leaf is drawn at negative v to come out on the +z side of
    // the pin. Drawn the other way it swings under the floor instead of up.
    const plate = (): Solid => ({
      kind: 'extrude', mat,
      profile: {
        outline: [
          [-len / 2, -leaf],
          [len / 2, -leaf],
          [len / 2, -knuckle],
          [-len / 2, -knuckle],
        ] as Vec2[],
        holes: [circle(2.1, -len / 4, -leaf * 0.62, 12), circle(2.1, len / 4, -leaf * 0.62, 12)],
      },
      depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
    })

    return [
      { kind: 'group', mat, at: [0, knuckle, 0], rot: [0, 0, 0], children: [plate()] },
      // The moving leaf swings about the pin, which is the x axis of the group.
      { kind: 'group', mat, at: [0, knuckle, 0], rot: [-angle, 0, 0], children: [plate()] },
      // Knuckle and pin.
      { kind: 'cyl', mat, r: knuckle, h: len * 0.94, rot: [0, 0, 90], at: [0, knuckle, 0], seg: 18 },
      { kind: 'cyl', mat: 'steel', r: 1.1, h: len, rot: [0, 0, 90], at: [0, knuckle, 0], seg: 12, noCollide: true },
    ]
  },
  ports: (p) => {
    const len = num(p, 'length', 50)
    const leaf = num(p, 'leaf', 20)
    const angle = (num(p, 'angle', 90) * Math.PI) / 180
    const knuckle = 3
    const mid = (knuckle + leaf) / 2
    const out: Port[] = [
      { id: 'leaf-a', label: 'Fixed leaf', kind: 'mechanical', pos: [0, knuckle, mid], dir: [0, -1, 0], mate: { type: 'face' } },
      {
        id: 'leaf-b', label: 'Moving leaf', kind: 'mechanical',
        pos: [0, knuckle + Math.sin(angle) * mid, Math.cos(angle) * mid],
        dir: [0, 1, 0], mate: { type: 'face' },
      },
    ]
    for (const s of [-1, 1] as const) {
      out.push({
        id: `hole-a${s > 0 ? 1 : 0}`, label: 'M4 screw', kind: 'mechanical',
        pos: [(s * len) / 4, knuckle + 1.6, leaf * 0.62], dir: [0, 1, 0], mate: { type: 'hole', size: 4.2 }, groupId: 'holes-a',
      })
    }
    return out
  },
  readouts: (p) => [
    { label: 'Leaf', value: `${num(p, 'length', 50)} x ${num(p, 'leaf', 20)} mm` },
    { label: 'Open to', value: `${Math.round(num(p, 'angle', 90))}°` },
    { label: 'Pivot', value: '3 mm above the mounting face' },
    { label: 'Fixings', value: '4 x M4 countersunk' },
  ],
}

/* ================================================================== */
/* Caster                                                              */
/* ================================================================== */

const caster: PartDef = {
  id: 'caster',
  name: 'Caster',
  category: 'motion',
  blurb: 'Swivel wheel on a plate, with the offset that makes it follow',
  tags: ['caster', 'castor', 'wheel', 'swivel', 'trolley', 'cart', 'furniture', 'mobile'],
  doc: {
    price: 3,
    description:
      'A swivelling wheel on a top plate. The wheel axis is offset behind the swivel axis, which is what makes it trail and point the right way rather than fighting the direction of travel.',
  },
  params: [
    { key: 'diameter', label: 'Wheel diameter', type: 'number', unit: 'mm', default: 50, min: 25, max: 150, step: 5, group: 'Caster' },
    { key: 'load', label: 'Rated load', type: 'number', unit: 'kg', default: 40, min: 10, max: 300, step: 5, group: 'Caster' },
    { key: 'braked', label: 'Brake fitted', type: 'bool', default: false, group: 'Caster' },
    {
      key: 'tyre', label: 'Tyre', type: 'enum', default: 'rubber', group: 'Caster',
      options: [{ value: 'rubber', label: 'Rubber, quiet' }, { value: 'nylon', label: 'Nylon, hard' }, { value: 'pu', label: 'Polyurethane' }],
    },
  ],
  solids: (p) => {
    const d = num(p, 'diameter', 50)
    const r = d / 2
    const offset = r * 0.38
    const plate = d * 0.9
    const forkH = r + 10
    const tyreMat =
      str(p, 'tyre', 'rubber') === 'nylon' ? 'nylon-black'
      : str(p, 'tyre', 'rubber') === 'pu' ? { color: '#C8A45A', rough: 0.55, density: 1.2 }
      : 'rubber'
    const out: Solid[] = [
      // Top plate with four bolt holes.
      {
        kind: 'extrude', mat: 'steel-zinc',
        profile: {
          outline: roundRect(plate, plate, 3, 0, 0, 3),
          holes: ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) =>
            circle(2.6, sx * (plate / 2 - 6), sz * (plate / 2 - 6), 10),
          ),
        },
        depth: 3, rot: [-90, 0, 0], at: [0, forkH + 3 + 1.5, 0],
      },
      // Swivel race and the fork hanging off it.
      { kind: 'cyl', mat: 'steel-zinc', r: plate * 0.3, h: 6, at: [0, forkH + 1, 0], seg: 22 },
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'box', mat: 'steel-zinc', size: [3, forkH, d * 0.34],
        at: [-offset, forkH / 2, s * (d * 0.22 + 3)] as Vec3,
      })),
      { kind: 'box', mat: 'steel-zinc', size: [d * 0.5, 3, d * 0.5], at: [-offset * 0.4, forkH - 1.5, 0] },
      // Wheel, offset behind the swivel axis, which is the whole trick.
      { kind: 'cyl', mat: tyreMat, r, h: d * 0.36, rot: [0, 0, 90], at: [-offset, r, 0], seg: 30, chamfer: 1.5 },
      { kind: 'cyl', mat: { color: '#E8EAEC', rough: 0.5, density: 1.1 }, r: r * 0.45, h: d * 0.38, rot: [0, 0, 90], at: [-offset, r, 0], seg: 22 },
      { kind: 'cyl', mat: 'steel', r: 4, h: d * 0.5, rot: [0, 0, 90], at: [-offset, r, 0], seg: 14 },
    ]
    if (p.braked === true) {
      out.push({ kind: 'box', mat: { color: '#C4262C', rough: 0.55, density: 1.4 }, size: [14, 4, d * 0.3], at: [r * 0.5, 6, 0], rot: [0, 0, -12] })
    }
    return out
  },
  ports: (p) => {
    const d = num(p, 'diameter', 50)
    const r = d / 2
    const plate = d * 0.9
    const forkH = r + 10
    const y = forkH + 3 + 3
    const out: Port[] = [
      { id: 'plate', label: 'Top plate', kind: 'mechanical', pos: [0, y, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
    let i = 0
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push({
          id: `bolt${i++}`, label: 'M5 bolt', kind: 'mechanical',
          pos: [sx * (plate / 2 - 6), y, sz * (plate / 2 - 6)], dir: [0, 1, 0],
          mate: { type: 'hole', size: 5.5 }, groupId: 'bolts',
        })
      }
    }
    return out
  },
  readouts: (p) => {
    const d = num(p, 'diameter', 50)
    const load = num(p, 'load', 40)
    return [
      { label: 'Wheel', value: `${d} mm, ${str(p, 'tyre', 'rubber')}` },
      { label: 'Rated load', value: `${load} kg each` },
      { label: 'Four of these', value: `${load * 3} kg, derated for uneven floors` },
      { label: 'Trail', value: `${(d * 0.19).toFixed(0)} mm behind the swivel axis` },
    ]
  },
}

registerParts([squareTube, roundTube, threadedRod, standoff, coupler, belt, wheel, spring, hinge, caster])
