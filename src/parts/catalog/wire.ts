import type { DeviceModel, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { num, str } from './_helpers'

/**
 * Wire and cable, as stock you place rather than as the connections you draw.
 *
 * The two are not the same thing and both are needed. Dragging a connection
 * between two ports is how a circuit gets described; a length of 22 AWG on the
 * bench is a physical object with a price, a mass, a bend radius and a voltage
 * drop. A robot arm whose motor leads have to reach the controller is a real
 * constraint that the abstract connection cannot express.
 *
 * Every wire here is modelled as its own resistance. At 24 AWG and 100 mm that
 * is 8 milliohms and nobody will ever see it. At 30 AWG and two metres feeding
 * a motor it is most of a volt, which is exactly the sort of thing that is
 * baffling on a bench and obvious here.
 */

/** Copper resistivity at 20 C, ohm-metres. */
const RHO_CU = 1.68e-8

/** Ohms for a conductor of `mm` millimetres and `mm2` square millimetres. */
const wireOhms = (mm: number, mm2: number): number => (RHO_CU * mm * 1e3) / Math.max(mm2, 1e-4)

interface Gauge {
  label: string
  /** Conductor cross-section, mm^2. */
  mm2: number
  /** Outside diameter over the insulation, mm. */
  od: number
  /** Continuous current in free air, amps. */
  imax: number
}

/**
 * AWG sizes that anyone actually stocks. Areas are the standard table; the
 * outside diameters are for ordinary PVC-insulated hook-up wire, which is
 * roughly the conductor plus 0.8 mm of wall.
 */
const GAUGES: Record<string, Gauge> = {
  '30': { label: '30 AWG (wire wrap)', mm2: 0.0509, od: 0.8, imax: 0.86 },
  '28': { label: '28 AWG', mm2: 0.081, od: 0.95, imax: 1.4 },
  '26': { label: '26 AWG', mm2: 0.1288, od: 1.1, imax: 2.2 },
  '24': { label: '24 AWG', mm2: 0.2047, od: 1.35, imax: 3.5 },
  '22': { label: '22 AWG', mm2: 0.3247, od: 1.6, imax: 7 },
  '20': { label: '20 AWG', mm2: 0.5189, od: 1.85, imax: 11 },
  '18': { label: '18 AWG', mm2: 0.8231, od: 2.15, imax: 16 },
  '16': { label: '16 AWG', mm2: 1.309, od: 2.6, imax: 22 },
  '14': { label: '14 AWG', mm2: 2.081, od: 3.1, imax: 32 },
  '12': { label: '12 AWG', mm2: 3.309, od: 3.8, imax: 41 },
}

const gaugeOptions = Object.entries(GAUGES).map(([value, g]) => ({ value, label: g.label }))

const INSULATION: Record<string, string> = {
  red: '#C4262C',
  black: '#1A1C1E',
  yellow: '#D8A814',
  green: '#1F9E4B',
  blue: '#1F5FCC',
  white: '#E6E9ED',
  orange: '#D96A1E',
  grey: '#7C828B',
}

const colorOptions = Object.keys(INSULATION).map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}))

const insulationMat = (key: string) => ({
  color: INSULATION[key] ?? INSULATION.red,
  rough: 0.55,
  density: 1.4,
  name: 'PVC insulation',
})

/**
 * A catenary from end to end.
 *
 * Wire laid on a bench does not go anywhere in a straight line, and a straight
 * cylinder between two points reads as a rod. `sag` is the drop at midspan as a
 * fraction of the run.
 */
function drape(len: number, y: number, sag: number, z = 0, steps = 14): Vec3[] {
  const path: Vec3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = -len / 2 + t * len
    // 4t(1-t) is a parabola that is 0 at both ends and 1 in the middle.
    path.push([x, y + sag * len * 4 * t * (1 - t), z])
  }
  return path
}

/* ================================================================== */
/* Hook-up wire                                                        */
/* ================================================================== */

const hookupWire: PartDef = {
  id: 'wire-hookup',
  name: 'Hook-up wire',
  category: 'wire',
  blurb: 'A cut length with the resistance it really has',
  tags: ['wire', 'cable', 'hookup', 'awg', 'stranded', 'solid', 'conductor', 'lead'],
  doc: {
    manufacturer: 'Generic',
    description:
      'PVC-insulated copper, cut to length and stripped at both ends. Carries its own resistance, so a long thin run costs volts at the far end.',
    price: 0.15,
  },
  params: [
    { key: 'gauge', label: 'Gauge', type: 'enum', default: '22', group: 'Cable', options: gaugeOptions },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 120, min: 20, max: 3000, step: 10, group: 'Cable' },
    { key: 'color', label: 'Insulation', type: 'enum', default: 'red', group: 'Cable', options: colorOptions },
    {
      key: 'core', label: 'Conductor', type: 'enum', default: 'stranded', group: 'Cable',
      help: 'Solid wire holds a shape and goes into a breadboard. Stranded survives being moved.',
      options: [{ value: 'stranded', label: 'Stranded' }, { value: 'solid', label: 'Solid core' }],
    },
    { key: 'strip', label: 'Stripped ends', type: 'number', unit: 'mm', default: 6, min: 0, max: 25, step: 1, group: 'Cable' },
  ],
  solids: (p) => {
    const g = GAUGES[str(p, 'gauge', '22')] ?? GAUGES['22']
    const len = num(p, 'length', 120)
    const strip = Math.min(num(p, 'strip', 6), len / 3)
    const ins = len - strip * 2
    const r = g.od / 2
    const cr = Math.sqrt(g.mm2 / Math.PI)
    const sag = 0.06

    const out: Solid[] = [
      {
        kind: 'tube', mat: insulationMat(str(p, 'color', 'red')), r, seg: 10,
        path: drape(ins, r, sag),
      },
    ]

    // Bare copper at each end, held at the height the insulation ends at.
    for (const s of [-1, 1] as const) {
      out.push({
        kind: 'cyl', mat: str(p, 'core', 'stranded') === 'solid' ? 'copper-bare' : 'tin',
        r: cr, h: strip + 0.5, rot: [0, 0, 90],
        at: [s * (ins / 2 + strip / 2), r, 0],
      })
    }
    return out
  },
  ports: (p) => {
    const g = GAUGES[str(p, 'gauge', '22')] ?? GAUGES['22']
    const len = num(p, 'length', 120)
    const r = g.od / 2
    return [
      { id: 'a', label: 'End A', kind: 'electrical', pos: [-len / 2, r, 0], dir: [-1, 0, 0], role: 'passive', imax: g.imax },
      { id: 'b', label: 'End B', kind: 'electrical', pos: [len / 2, r, 0], dir: [1, 0, 0], role: 'passive', imax: g.imax },
    ]
  },
  electrical: {
    devices: (p) => {
      const g = GAUGES[str(p, 'gauge', '22')] ?? GAUGES['22']
      return [{ type: 'resistor', r: wireOhms(num(p, 'length', 120), g.mm2), a: 'a', b: 'b' }]
    },
  },
  price: (p) => 0.0009 * num(p, 'length', 120) + 0.05,
  readouts: (p) => {
    const g = GAUGES[str(p, 'gauge', '22')] ?? GAUGES['22']
    const len = num(p, 'length', 120)
    const r = wireOhms(len, g.mm2)
    return [
      { label: 'Cross-section', value: `${g.mm2.toFixed(3)} mm²` },
      { label: 'Resistance', value: eng(r, 'Ω') },
      { label: 'Drop at 1 A', value: `${(r * 1000).toFixed(0)} mV` },
      { label: 'Continuous current', value: `${g.imax} A` },
    ]
  },
}

/* ================================================================== */
/* Jumper wire                                                         */
/* ================================================================== */

const JUMPER_ENDS: Record<string, { label: string; a: 'm' | 'f'; b: 'm' | 'f' }> = {
  mm: { label: 'Male to male', a: 'm', b: 'm' },
  mf: { label: 'Male to female', a: 'm', b: 'f' },
  ff: { label: 'Female to female', a: 'f', b: 'f' },
}

/** The crimp and its housing at one end of a jumper. */
function dupontEnd(x: number, sign: 1 | -1, y: number, kind: 'm' | 'f', color: string): Solid[] {
  const out: Solid[] = [
    { kind: 'box', mat: { color, rough: 0.6, density: 1.14 }, size: [6.2, 2.5, 2.5], at: [x + sign * 3.1, y, 0], bevel: 0.2 },
  ]
  if (kind === 'm') {
    // A male jumper is a header pin sticking out of the shell.
    out.push({ kind: 'box', mat: 'tin', size: [7, 0.64, 0.64], at: [x + sign * 9.7, y, 0] })
  } else {
    // A female one is a socket, so the shell is simply longer and hollow.
    out.push({
      kind: 'cyl', mat: { color: '#0B0D10', rough: 0.9, density: 0.01 }, r: 0.75, h: 2.4,
      rot: [0, 0, 90], at: [x + sign * 6.4, y, 0], seg: 10, noCollide: true,
    })
  }
  return out
}

const jumperWire: PartDef = {
  id: 'jumper-dupont',
  name: 'Jumper wire',
  category: 'wire',
  blurb: 'Pre-made Dupont lead, male or female ends',
  tags: ['jumper', 'dupont', 'wire', 'breadboard', 'lead', 'patch', 'prototyping'],
  doc: {
    description:
      'The ready-made jumpers that come in ribbons of forty. 24 AWG stranded with crimped Dupont terminals in a 2.54 mm shell.',
    price: 0.1,
  },
  params: [
    { key: 'ends', label: 'Ends', type: 'enum', default: 'mm', group: 'Cable', options: Object.entries(JUMPER_ENDS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 150, min: 50, max: 400, step: 10, group: 'Cable' },
    { key: 'color', label: 'Colour', type: 'enum', default: 'blue', group: 'Cable', options: colorOptions },
  ],
  solids: (p) => {
    const e = JUMPER_ENDS[str(p, 'ends', 'mm')] ?? JUMPER_ENDS.mm
    const len = num(p, 'length', 150)
    const color = INSULATION[str(p, 'color', 'blue')] ?? INSULATION.blue
    const wire = len - 20
    const y = 1.3
    return [
      { kind: 'tube', mat: insulationMat(str(p, 'color', 'blue')), r: 0.675, seg: 8, path: drape(wire, y, 0.07) },
      ...dupontEnd(-wire / 2, -1, y, e.a, color),
      ...dupontEnd(wire / 2, 1, y, e.b, color),
    ]
  },
  ports: (p) => {
    const e = JUMPER_ENDS[str(p, 'ends', 'mm')] ?? JUMPER_ENDS.mm
    const len = num(p, 'length', 150)
    const wire = len - 20
    const y = 1.3
    const tip = (sign: 1 | -1, kind: 'm' | 'f'): number => sign * (wire / 2 + (kind === 'm' ? 12.5 : 7))
    return [
      { id: 'a', label: e.a === 'm' ? 'Pin end' : 'Socket end', kind: 'electrical', pos: [tip(-1, e.a), y, 0], dir: [-1, 0, 0], role: 'passive', imax: 3 },
      { id: 'b', label: e.b === 'm' ? 'Pin end' : 'Socket end', kind: 'electrical', pos: [tip(1, e.b), y, 0], dir: [1, 0, 0], role: 'passive', imax: 3 },
    ]
  },
  electrical: {
    devices: (p) => [{ type: 'resistor', r: wireOhms(num(p, 'length', 150), GAUGES['24'].mm2), a: 'a', b: 'b' }],
  },
  readouts: (p) => [
    { label: 'Conductor', value: '24 AWG stranded' },
    { label: 'Resistance', value: eng(wireOhms(num(p, 'length', 150), GAUGES['24'].mm2), 'Ω') },
    { label: 'Pitch', value: '2.54 mm Dupont' },
  ],
}

/* ================================================================== */
/* Ribbon cable                                                        */
/* ================================================================== */

/** The repeating colour run printed on rainbow ribbon, conductor 1 first. */
const RAINBOW = ['#8B5A2B', '#C4262C', '#D96A1E', '#D8A814', '#1F9E4B', '#1F5FCC', '#7B3FA0', '#7C828B', '#E6E9ED', '#1A1C1E']

const ribbonCable: PartDef = {
  id: 'ribbon-cable',
  name: 'Ribbon cable',
  category: 'wire',
  blurb: 'Bonded conductors on 1.27 mm pitch, every one addressable',
  tags: ['ribbon', 'cable', 'idc', 'flat', 'bus', 'wire', 'harness'],
  doc: {
    description:
      'Flat cable on the standard 1.27 mm pitch, as used with IDC connectors. Each conductor is its own net here, so a cable wired one pin out behaves like one.',
    price: 1.4,
  },
  params: [
    { key: 'ways', label: 'Conductors', type: 'number', default: 10, min: 4, max: 40, step: 2, group: 'Cable' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 200, min: 50, max: 2000, step: 10, group: 'Cable' },
    {
      key: 'style', label: 'Colour', type: 'enum', default: 'rainbow', group: 'Cable',
      options: [{ value: 'rainbow', label: 'Rainbow' }, { value: 'grey', label: 'Grey with a red stripe' }],
    },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'ways', 10))
    const len = num(p, 'length', 200)
    const rainbow = str(p, 'style', 'rainbow') === 'rainbow'
    const pitch = 1.27
    const out: Solid[] = []
    for (let i = 0; i < n; i++) {
      const z = -((n - 1) / 2) * pitch + i * pitch
      const color = rainbow ? RAINBOW[i % RAINBOW.length] : i === 0 ? '#C4262C' : '#8E939B'
      out.push({
        kind: 'tube', mat: { color, rough: 0.62, density: 1.4 }, r: 0.62, seg: 6,
        path: drape(len, 0.62, 0.04, z, 12),
      })
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'ways', 10))
    const len = num(p, 'length', 200)
    const pitch = 1.27
    const out: Port[] = []
    for (let i = 0; i < n; i++) {
      const z = -((n - 1) / 2) * pitch + i * pitch
      out.push({ id: `a${i + 1}`, label: `A${i + 1}`, kind: 'electrical', pos: [-len / 2, 0.62, z], dir: [-1, 0, 0], role: 'passive', imax: 1 })
      out.push({ id: `b${i + 1}`, label: `B${i + 1}`, kind: 'electrical', pos: [len / 2, 0.62, z], dir: [1, 0, 0], role: 'passive', imax: 1 })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'ways', 10))
      const r = wireOhms(num(p, 'length', 200), 0.0819) // 28 AWG, the usual ribbon conductor
      const out: DeviceModel[] = []
      for (let i = 1; i <= n; i++) out.push({ type: 'resistor', r, a: `a${i}`, b: `b${i}` })
      return out
    },
  },
  price: (p) => 0.0007 * num(p, 'length', 200) * (num(p, 'ways', 10) / 10) + 0.6,
  readouts: (p) => [
    { label: 'Conductors', value: `${Math.round(num(p, 'ways', 10))} way` },
    { label: 'Pitch', value: '1.27 mm' },
    { label: 'Per conductor', value: eng(wireOhms(num(p, 'length', 200), 0.0819), 'Ω') },
  ],
}

/* ================================================================== */
/* Silicone wire                                                       */
/* ================================================================== */

const siliconeWire: PartDef = {
  id: 'wire-silicone',
  name: 'Silicone wire',
  category: 'wire',
  blurb: 'High-strand count, stays flexible, takes real current',
  tags: ['silicone', 'wire', 'flexible', 'high current', 'battery', 'motor', 'rc', 'power'],
  doc: {
    description:
      'Fine-strand copper in a silicone jacket. Limp where PVC is stiff and rated to 200 C, which is why battery and motor leads are made of it.',
    price: 0.5,
  },
  params: [
    { key: 'gauge', label: 'Gauge', type: 'enum', default: '16', group: 'Cable', options: gaugeOptions.filter((g) => Number(g.value) <= 20) },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 200, min: 30, max: 3000, step: 10, group: 'Cable' },
    { key: 'color', label: 'Jacket', type: 'enum', default: 'red', group: 'Cable', options: colorOptions },
  ],
  solids: (p) => {
    const g = GAUGES[str(p, 'gauge', '16')] ?? GAUGES['16']
    const len = num(p, 'length', 200)
    // Silicone jackets are thicker walled than PVC for the same conductor.
    const r = (g.od + 0.7) / 2
    const strip = 8
    const ins = len - strip * 2
    const cr = Math.sqrt(g.mm2 / Math.PI)
    return [
      {
        kind: 'tube', seg: 12, r,
        mat: { color: INSULATION[str(p, 'color', 'red')] ?? INSULATION.red, rough: 0.8, density: 1.2, name: 'Silicone' },
        // Silicone drapes further than PVC because it is softer.
        path: drape(ins, r, 0.1),
      },
      ...([-1, 1] as const).map((s) => ({
        kind: 'cyl' as const, mat: 'tin', r: cr, h: strip, rot: [0, 0, 90] as Vec3,
        at: [s * (ins / 2 + strip / 2), r, 0] as Vec3,
      })),
    ]
  },
  ports: (p) => {
    const g = GAUGES[str(p, 'gauge', '16')] ?? GAUGES['16']
    const len = num(p, 'length', 200)
    const r = (g.od + 0.7) / 2
    // Silicone runs cooler for the same copper, so it is rated above PVC.
    const i = g.imax * 1.35
    return [
      { id: 'a', label: 'End A', kind: 'electrical', pos: [-len / 2, r, 0], dir: [-1, 0, 0], role: 'passive', imax: i },
      { id: 'b', label: 'End B', kind: 'electrical', pos: [len / 2, r, 0], dir: [1, 0, 0], role: 'passive', imax: i },
    ]
  },
  electrical: {
    devices: (p) => {
      const g = GAUGES[str(p, 'gauge', '16')] ?? GAUGES['16']
      return [{ type: 'resistor', r: wireOhms(num(p, 'length', 200), g.mm2), a: 'a', b: 'b' }]
    },
  },
  price: (p) => 0.0022 * num(p, 'length', 200) + 0.2,
  readouts: (p) => {
    const g = GAUGES[str(p, 'gauge', '16')] ?? GAUGES['16']
    const len = num(p, 'length', 200)
    const r = wireOhms(len, g.mm2)
    return [
      { label: 'Cross-section', value: `${g.mm2.toFixed(2)} mm²` },
      { label: 'Resistance', value: eng(r, 'Ω') },
      { label: 'Continuous current', value: `${Math.round(g.imax * 1.35)} A` },
      { label: 'Loss at rating', value: `${(r * Math.pow(g.imax * 1.35, 2)).toFixed(2)} W` },
    ]
  },
}

/* ================================================================== */
/* Test lead                                                           */
/* ================================================================== */

/** One sprung alligator clip, jaws open along +x. */
function alligator(x: number, sign: 1 | -1, y: number, color: string): Solid[] {
  const out: Solid[] = []
  // Insulating boot over the barrel.
  out.push({
    kind: 'cyl', mat: { color, rough: 0.55, density: 1.3 }, r: 3.6, h: 14, chamfer: 0.8,
    rot: [0, 0, 90], at: [x + sign * 7, y, 0],
  })
  // Jaws: two toothed strips that meet at the tip.
  for (const s of [-1, 1] as const) {
    out.push({
      kind: 'box', mat: 'steel', size: [15, 1, 3.4],
      at: [x + sign * 20, y + s * 1.6, 0], rot: [0, 0, sign * s * -4],
    })
    for (let i = 0; i < 3; i++) {
      out.push({
        kind: 'box', mat: 'steel', size: [1.2, 1.4, 3.2],
        at: [x + sign * (16 + i * 3.4), y + s * 2.4, 0], noCollide: true,
      })
    }
  }
  return out
}

const testLead: PartDef = {
  id: 'test-lead',
  name: 'Test lead',
  category: 'wire',
  blurb: 'Alligator clips on a flexible lead',
  tags: ['test lead', 'alligator', 'crocodile', 'clip', 'probe', 'jumper', 'bench'],
  doc: { description: 'Insulated alligator clips on a stranded lead. What you reach for to hang a meter on something for ten seconds.', price: 0.6 },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 250, min: 100, max: 1200, step: 10, group: 'Cable' },
    { key: 'color', label: 'Colour', type: 'enum', default: 'red', group: 'Cable', options: colorOptions },
  ],
  solids: (p) => {
    const len = num(p, 'length', 250)
    const wire = Math.max(len - 60, 30)
    const y = 4
    const color = INSULATION[str(p, 'color', 'red')] ?? INSULATION.red
    return [
      { kind: 'tube', mat: insulationMat(str(p, 'color', 'red')), r: 0.9, seg: 8, path: drape(wire, y, 0.12) },
      ...alligator(-wire / 2, -1, y, color),
      ...alligator(wire / 2, 1, y, color),
    ]
  },
  ports: (p) => {
    const len = num(p, 'length', 250)
    const wire = Math.max(len - 60, 30)
    const y = 4
    return [
      { id: 'a', label: 'Clip A', kind: 'electrical', pos: [-(wire / 2 + 27), y, 0], dir: [-1, 0, 0], role: 'passive', imax: 5 },
      { id: 'b', label: 'Clip B', kind: 'electrical', pos: [wire / 2 + 27, y, 0], dir: [1, 0, 0], role: 'passive', imax: 5 },
    ]
  },
  electrical: {
    // The clip contacts matter more than the copper: a dozen milliohms each.
    devices: (p) => [{ type: 'resistor', r: wireOhms(num(p, 'length', 250), GAUGES['22'].mm2) + 0.025, a: 'a', b: 'b' }],
  },
  readouts: (p) => [
    { label: 'Lead', value: `22 AWG, ${Math.round(num(p, 'length', 250))} mm` },
    { label: 'End to end', value: eng(wireOhms(num(p, 'length', 250), GAUGES['22'].mm2) + 0.025, 'Ω') },
    { label: 'Jaw opening', value: '6 mm' },
  ],
}

registerParts([hookupWire, jumperWire, ribbonCable, siliconeWire, testLead])
