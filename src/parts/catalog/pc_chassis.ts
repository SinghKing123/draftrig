import type { PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'
import { ALU_DARK, FR4, GOLD, PLASTIC, STEEL } from './pc'

/**
 * The case, the supply, and everything that bolts into them.
 *
 * The supply is a real source: three rails behind their own internal
 * resistance, so a build that asks for more than it can give sags rather than
 * quietly working. That is the whole reason to model a PC here at all.
 */

const MESH = { color: '#0E1013', rough: 0.8, density: 1.2 }
const GLASS = { color: '#20262E', rough: 0.06, opacity: 0.24, transmission: 0.86, density: 2.5 }

/* ================================================================== */
/* Power supply                                                        */
/* ================================================================== */

const PSU_FORM: Record<string, { w: number; h: number; d: number; label: string }> = {
  atx: { w: 150, h: 86, d: 140, label: 'ATX' },
  sfx: { w: 125, h: 63.5, d: 100, label: 'SFX' },
}

const psu: PartDef = {
  id: 'power-supply',
  name: 'Power supply',
  category: 'pc-chassis',
  blurb: 'Three rails with real headroom',
  tags: ['psu', 'power', 'supply', 'atx', 'sfx', 'watts', 'pc', '80 plus', 'rail'],
  doc: {
    price: 120,
    description:
      'An ATX or SFX supply. The 12 V rail sits behind an internal resistance sized from the wattage, so pulling more than it can give makes it sag instead of pretending. Efficiency sets how much it draws from the wall.',
  },
  params: [
    { key: 'form', label: 'Form factor', type: 'enum', default: 'atx', group: 'Supply', options: [
      { value: 'atx', label: 'ATX, 150 x 86' }, { value: 'sfx', label: 'SFX, 125 x 63.5' },
    ] },
    { key: 'watts', label: 'Rated output', type: 'number', unit: 'W', default: 750, min: 200, max: 1600, step: 50, group: 'Supply' },
    { key: 'efficiency', label: 'Efficiency', type: 'enum', default: 'gold', group: 'Supply', options: [
      { value: 'bronze', label: '80 Plus Bronze, 85 %' }, { value: 'gold', label: '80 Plus Gold, 90 %' }, { value: 'titanium', label: '80 Plus Titanium, 94 %' },
    ] },
    { key: 'modular', label: 'Modular cables', type: 'bool', default: true, group: 'Supply' },
  ],
  solids: (p) => {
    const f = PSU_FORM[str(p, 'form', 'atx')] ?? PSU_FORM.atx
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#15181C', rough: 0.55, density: 7.8 }, size: [f.w, f.h, f.d], at: [0, f.h / 2, 0], bevel: 0.8 },
      // Intake fan and its grille.
      { kind: 'cyl', mat: MESH, r: Math.min(f.w, f.d) * 0.4, h: 2, at: [0, f.h + 0.2, 0] },
      ...Array.from({ length: 5 }, (_, i): Solid => ({
        kind: 'torus', mat: { color: '#2A2E35', metal: 0.8, rough: 0.5, density: 7.8 },
        r: Math.min(f.w, f.d) * 0.08 * (i + 1), tube: 0.5, rot: [90, 0, 0],
        at: [0, f.h + 1.4, 0], seg: 28, noCollide: true,
      })),
      // Mains inlet and switch on the back face.
      { kind: 'box', mat: PLASTIC, size: [26, 22, 4], at: [-f.w / 2 + 26, 22, -f.d / 2 - 1], bevel: 0.4 },
      { kind: 'box', mat: { color: '#B4231D', rough: 0.5, density: 1.2 }, size: [14, 10, 3], at: [-f.w / 2 + 56, 22, -f.d / 2 - 1], bevel: 0.3 },
      // Exhaust honeycomb.
      { kind: 'box', mat: MESH, size: [f.w - 90, f.h - 14, 1.6], at: [26, f.h / 2, -f.d / 2 - 0.5], noCollide: true },
    ]
    if (p.modular !== false) {
      // Cable sockets on the front face.
      for (let i = 0; i < 6; i++) {
        out.push({
          kind: 'box', mat: { color: '#0E1013', rough: 0.7, density: 1.2 },
          size: [18, 9, 3], at: [-f.w / 2 + 26 + (i % 3) * 42, 22 + Math.floor(i / 3) * 22, f.d / 2 + 0.6],
          bevel: 0.2, noCollide: true,
        })
      }
    }
    return out
  },
  ports: (p) => {
    const f = PSU_FORM[str(p, 'form', 'atx')] ?? PSU_FORM.atx
    const out: Port[] = [
      { id: 'atx24', label: 'ATX 24-pin', kind: 'electrical', pos: [-f.w / 2 + 26, 22, f.d / 2 + 3], dir: [0, 0, 1], role: 'power', imax: 30 },
      { id: 'eps', label: 'EPS 8-pin', kind: 'electrical', pos: [-f.w / 2 + 68, 22, f.d / 2 + 3], dir: [0, 0, 1], role: 'power', imax: 30 },
      { id: 'pcie1', label: 'PCIe 8-pin', kind: 'electrical', pos: [-f.w / 2 + 110, 22, f.d / 2 + 3], dir: [0, 0, 1], role: 'power', imax: 30, groupId: 'psu-12v' },
      { id: 'pcie2', label: 'PCIe 8-pin', kind: 'electrical', pos: [-f.w / 2 + 26, 44, f.d / 2 + 3], dir: [0, 0, 1], role: 'power', imax: 30, groupId: 'psu-12v' },
      { id: 'sata', label: 'SATA power', kind: 'electrical', pos: [-f.w / 2 + 68, 44, f.d / 2 + 3], dir: [0, 0, 1], role: 'power', imax: 10 },
      { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [-f.w / 2 + 110, 44, f.d / 2 + 3], dir: [0, 0, 1], role: 'gnd', imax: 60 },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
    return out
  },
  electrical: {
    devices: (p) => {
      const watts = num(p, 'watts', 750)
      // Everything of consequence rides the 12 V rail. Internal resistance is
      // sized so the rail is at spec when loaded to its rating and sags past it.
      const rint = (12 * 0.05) / (watts / 12)
      return [
        // The rail itself is internal to the supply; the connectors hang off it.
        { type: 'vsource', v: 12, a: '#12v', b: 'gnd', rint },
        { type: 'short', a: '#12v', b: 'atx24' },
        { type: 'short', a: '#12v', b: 'eps' },
        { type: 'short', a: '#12v', b: 'pcie1' },
        { type: 'short', a: '#12v', b: 'pcie2' },
        { type: 'short', a: '#12v', b: 'sata' },
      ]
    },
    supplies: ['atx24', 'eps', 'pcie1', 'pcie2', 'sata'],
    limits: { imax: 60 },
  },
  // A supply is a shell, a transformer and some board, not a solid steel brick.
  mass: (p) => 1100 + num(p, 'watts', 750) * 0.9,
  price: (p) => {
    const watts = num(p, 'watts', 750)
    const tier = { bronze: 0.11, gold: 0.15, titanium: 0.22 }[str(p, 'efficiency', 'gold')] ?? 0.15
    return Math.round(watts * tier)
  },
  readouts: (p) => {
    const watts = num(p, 'watts', 750)
    const eff = { bronze: 0.85, gold: 0.9, titanium: 0.94 }[str(p, 'efficiency', 'gold')] ?? 0.9
    return [
      { label: 'Rated output', value: `${Math.round(watts)} W` },
      { label: '12 V capacity', value: `${(watts / 12).toFixed(0)} A` },
      { label: 'Draw at full load', value: `${Math.round(watts / eff)} W from the wall` },
      { label: 'Efficiency', value: `${Math.round(eff * 100)} %` },
    ]
  },
}

/* ================================================================== */
/* Storage                                                             */
/* ================================================================== */

const ssdM2: PartDef = {
  id: 'ssd-m2',
  name: 'M.2 SSD',
  category: 'pc-component',
  blurb: 'NVMe drive, 2280 and friends',
  tags: ['ssd', 'm2', 'nvme', 'storage', 'drive', '2280', 'disk', 'pc'],
  doc: { price: 80, description: 'An M.2 NVMe drive. The number is its size: 2280 is 22 mm wide and 80 long.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: '2280', group: 'Drive', options: [
      { value: '2230', label: '2230' }, { value: '2242', label: '2242' }, { value: '2280', label: '2280' }, { value: '22110', label: '22110' },
    ] },
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '2', group: 'Drive', options: [
      { value: '0.5', label: '500 GB' }, { value: '1', label: '1 TB' }, { value: '2', label: '2 TB' }, { value: '4', label: '4 TB' },
    ] },
    { key: 'heatsink', label: 'Heatsink', type: 'bool', default: false, group: 'Drive' },
  ],
  solids: (p) => {
    const code = str(p, 'size', '2280')
    const len = parseInt(code.slice(2), 10) || 80
    const out: Solid[] = [
      { kind: 'box', mat: FR4, size: [len, 1.5, 22], at: [len / 2 - 8, 0.75, 0] },
      { kind: 'box', mat: GOLD, size: [11.5, 1.6, 20], at: [-2, 0.75, 0], noCollide: true },
      // The key notch that makes it an M key.
      { kind: 'box', mat: { color: '#0A0B0D', rough: 0.9, density: 0.01 }, size: [1.4, 1.7, 4.6], at: [1.6, 0.75, -8], noCollide: true },
      { kind: 'box', mat: { color: '#16181C', rough: 0.5, density: 1.9 }, size: [len * 0.3, 1.2, 12], at: [len * 0.35, 2.1, 4], noCollide: true },
      { kind: 'box', mat: { color: '#16181C', rough: 0.5, density: 1.9 }, size: [len * 0.2, 1.2, 10], at: [len * 0.72, 2.1, -4], noCollide: true },
    ]
    if (p.heatsink === true) {
      out.push({ kind: 'box', mat: ALU_DARK, size: [len - 6, 6, 23], at: [len / 2 - 8, 5, 0], bevel: 0.6 })
    }
    return out
  },
  ports: () => [
    { id: 'edge', label: 'M.2 M key', kind: 'mechanical', pos: [-2, 0, 0], dir: [0, -1, 0], mate: { type: 'm2', key: 'M' } },
  ],
  readouts: (p) => [
    { label: 'Size', value: str(p, 'size', '2280') },
    { label: 'Capacity', value: `${str(p, 'capacity', '2')} TB` },
    { label: 'Power draw', value: '7 W under load' },
  ],
}

const driveSata: PartDef = {
  id: 'drive-sata',
  name: 'SATA drive',
  category: 'pc-component',
  blurb: '2.5 inch SSD or 3.5 inch hard disk',
  tags: ['sata', 'ssd', 'hdd', 'hard disk', 'drive', 'storage', '2.5', '3.5', 'pc'],
  doc: { price: 55, description: 'A 2.5 or 3.5 inch drive with the standard SATA data and power connectors.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: '2.5', group: 'Drive', options: [
      { value: '2.5', label: '2.5 inch' }, { value: '3.5', label: '3.5 inch' },
    ] },
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '2', group: 'Drive', options: [
      { value: '1', label: '1 TB' }, { value: '2', label: '2 TB' }, { value: '4', label: '4 TB' }, { value: '8', label: '8 TB' },
    ] },
  ],
  solids: (p) => {
    const big = str(p, 'size', '2.5') === '3.5'
    const w = big ? 101.6 : 69.85
    const d = big ? 146 : 100
    const h = big ? 26.1 : 7
    return [
      { kind: 'box', mat: big ? STEEL : { color: '#2A2E35', metal: 0.7, rough: 0.45, density: 5 }, size: [w, h, d], at: [0, h / 2, 0], bevel: 0.5 },
      // SATA data and power, side by side on the back edge.
      { kind: 'box', mat: { color: '#15181C', rough: 0.7, density: 1.2 }, size: [8, 3.5, 6], at: [-w / 2 + 14, h / 2, -d / 2 - 1], noCollide: true },
      { kind: 'box', mat: { color: '#15181C', rough: 0.7, density: 1.2 }, size: [20, 3.5, 6], at: [-w / 2 + 32, h / 2, -d / 2 - 1], noCollide: true },
      { kind: 'box', mat: { color: '#C8CDD4', rough: 0.4, density: 1.4 }, size: [w * 0.7, 0.2, d * 0.55], at: [0, h + 0.1, 6], noCollide: true },
    ]
  },
  ports: (p) => {
    const big = str(p, 'size', '2.5') === '3.5'
    const w = big ? 101.6 : 69.85
    const d = big ? 146 : 100
    const h = big ? 26.1 : 7
    return [
      { id: 'power', label: 'SATA power', kind: 'electrical', pos: [-w / 2 + 32, h / 2, -d / 2 - 4], dir: [0, 0, -1], role: 'power', imax: 3 },
      { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [-w / 2 + 44, h / 2, -d / 2 - 4], dir: [0, 0, -1], role: 'gnd', imax: 3 },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      // Roughly 8 W for a spinning disk, 3 W for an SSD.
      const w = str(p, 'size', '2.5') === '3.5' ? 8 : 3
      return [{ type: 'resistor', r: (12 * 12) / w, a: 'power', b: 'gnd' }]
    },
  },
  readouts: (p) => [
    { label: 'Size', value: `${str(p, 'size', '2.5')} inch` },
    { label: 'Capacity', value: `${str(p, 'capacity', '2')} TB` },
    { label: 'Power draw', value: str(p, 'size', '2.5') === '3.5' ? '8 W' : '3 W' },
  ],
}

/* ================================================================== */
/* Cooling                                                             */
/* ================================================================== */

const cooler: PartDef = {
  id: 'cpu-cooler',
  name: 'CPU cooler',
  category: 'pc-component',
  blurb: 'Tower cooler, height decides the case',
  tags: ['cooler', 'heatsink', 'cpu', 'tower', 'fan', 'thermal', 'pc', 'air'],
  doc: { price: 40, description: 'A tower cooler. Height is what decides whether the side panel goes back on, so it is the parameter that matters.' },
  params: [
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 158, min: 40, max: 175, step: 1, group: 'Cooler' },
    { key: 'fans', label: 'Fans', type: 'number', default: 1, min: 0, max: 2, step: 1, group: 'Cooler' },
    { key: 'watts', label: 'Rated for', type: 'number', unit: 'W', default: 220, min: 50, max: 350, step: 10, group: 'Cooler' },
  ],
  solids: (p) => {
    const h = num(p, 'height', 158)
    const finH = h - 42
    const out: Solid[] = [
      // Base block and heatpipes.
      { kind: 'box', mat: { color: '#C9CED4', metal: 1, rough: 0.28, density: 8.9 }, size: [42, 8, 42], at: [0, 4, 0], bevel: 0.5 },
      ...Array.from({ length: 6 }, (_, i): Solid => ({
        kind: 'cyl', mat: { color: '#B87333', metal: 1, rough: 0.3, density: 8.9 },
        r: 3, h: h - 14, at: [-15 + i * 6, 8 + (h - 14) / 2, i % 2 ? -8 : 8],
      })),
      // Fin stack, drawn as a stack of thin plates.
      // Fins. Bare aluminium at this spacing reads as one solid white block,
      // so they are darker and further apart than a photograph would show.
      ...Array.from({ length: Math.max(6, Math.round(finH / 3.2)) }, (_, i): Solid => ({
        kind: 'box', mat: { color: '#8B9199', metal: 1, rough: 0.5, density: 2.7 },
        size: [120, 0.6, 50], at: [0, 40 + i * 3.2, 0], noCollide: true,
      })),
    ]
    const fans = Math.round(num(p, 'fans', 1))
    for (let i = 0; i < fans; i++) {
      out.push({
        kind: 'box', mat: PLASTIC, size: [25, 120, 120],
        at: [i === 0 ? -74 : 74, 40 + finH / 2, 0], bevel: 2,
      })
      out.push({
        kind: 'cyl', mat: { color: '#1B1E24', rough: 0.7, density: 1.2 }, r: 55, h: 26, rot: [0, 0, 90],
        at: [i === 0 ? -74 : 74, 40 + finH / 2, 0], noCollide: true,
      })
    }
    return out
  },
  ports: (p) => [
    { id: 'base', label: 'Contact plate', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    { id: 'fan', label: 'Fan header', kind: 'electrical', pos: [30, num(p, 'height', 158) - 10, 0], dir: [0, 1, 0], role: 'power', imax: 1 },
    { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [38, num(p, 'height', 158) - 10, 0], dir: [0, 1, 0], role: 'gnd', imax: 1 },
  ],
  electrical: {
    devices: (p) => {
      const w = Math.round(num(p, 'fans', 1)) * 2.4
      return w > 0 ? [{ type: 'resistor', r: (12 * 12) / w, a: 'fan', b: 'gnd' }] : []
    },
  },
  readouts: (p) => [
    { label: 'Height', value: `${Math.round(num(p, 'height', 158))} mm` },
    { label: 'Rated for', value: `${Math.round(num(p, 'watts', 220))} W` },
    { label: 'Fans', value: String(Math.round(num(p, 'fans', 1))) },
  ],
}

const caseFan: PartDef = {
  id: 'case-fan',
  name: 'Case fan',
  category: 'pc-component',
  blurb: '120 or 140 mm, four-pin PWM',
  tags: ['fan', 'case', '120mm', '140mm', 'pwm', 'airflow', 'cooling', 'pc'],
  doc: { price: 12, description: 'A standard case fan. Mounting holes are on the usual 105 or 124.5 mm square.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: '120', group: 'Fan', options: [
      { value: '92', label: '92 mm' }, { value: '120', label: '120 mm' }, { value: '140', label: '140 mm' },
    ] },
    { key: 'rgb', label: 'Lit ring', type: 'bool', default: false, group: 'Fan' },
  ],
  solids: (p) => {
    const s = parseInt(str(p, 'size', '120'), 10) || 120
    const t = s >= 140 ? 25 : 25
    const bore = s * 0.46
    const holePitch = s === 92 ? 82.5 : s === 140 ? 124.5 : 105
    const holes = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => circle(2.3, (sx * holePitch) / 2, (sz * holePitch) / 2, 10)))
    return [
      {
        kind: 'extrude', mat: PLASTIC,
        profile: { outline: roundRect(s, s, 5, 0, 0, 4), holes: [circle(bore, 0, 0, 40), ...holes] },
        depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0],
      },
      { kind: 'cyl', mat: { color: '#1B1E24', rough: 0.6, density: 1.2 }, r: s * 0.17, h: t - 6, at: [0, t / 2, 0] },
      // Blades.
      ...Array.from({ length: 9 }, (_, i): Solid => ({
        kind: 'box', mat: { color: '#2A2E35', rough: 0.55, opacity: 0.95, density: 1.2 },
        size: [bore * 0.86, 1.4, s * 0.18], at: [0, t / 2, 0],
        rot: [0, (i / 9) * 360, 16], noCollide: true,
      })),
      ...(p.rgb === true
        ? [{
            kind: 'torus' as const, mat: { color: '#C6D4EA', rough: 0.3, emissive: '#3C7BDC', emissiveIntensity: 0.55, density: 1.2 },
            r: s * 0.44, tube: 2, rot: [90, 0, 0] as Vec3, at: [0, t - 1, 0] as Vec3, seg: 40, noCollide: true,
          }]
        : []),
    ]
  },
  ports: (p) => {
    const s = parseInt(str(p, 'size', '120'), 10) || 120
    const holePitch = s === 92 ? 82.5 : s === 140 ? 124.5 : 105
    const out: Port[] = [
      { id: 'pwr', label: 'Fan 12 V', kind: 'electrical', pos: [s / 2 - 6, 12, s / 2 - 6], dir: [1, 0, 0], role: 'power', imax: 0.5 },
      { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [s / 2 - 6, 12, s / 2 - 14], dir: [1, 0, 0], role: 'gnd', imax: 0.5 },
    ]
    let i = 0
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push({
          id: `mount${i++}`, label: 'Fan screw', kind: 'mechanical',
          pos: [(sx * holePitch) / 2, 0, (sz * holePitch) / 2], dir: [0, -1, 0],
          mate: { type: 'hole', size: 4.4 }, groupId: 'mounts',
        })
      }
    }
    return out
  },
  electrical: {
    devices: () => [{ type: 'resistor', r: (12 * 12) / 2.4, a: 'pwr', b: 'gnd' }],
  },
  readouts: (p) => [
    { label: 'Size', value: `${str(p, 'size', '120')} mm` },
    { label: 'Screw pitch', value: `${str(p, 'size', '120') === '140' ? 124.5 : str(p, 'size', '120') === '92' ? 82.5 : 105} mm` },
    { label: 'Power draw', value: '2.4 W' },
  ],
}

/* ================================================================== */
/* Case                                                                */
/* ================================================================== */

const CASE_SPEC: Record<string, {
  w: number; h: number; d: number; label: string
  takes: string[]; gpuMax: number; coolerMax: number
  /** Longest radiator any wall of this case will take, mm. */
  radMax: number
}> = {
  full: { w: 240, h: 560, d: 500, label: 'Full tower', takes: ['atx', 'matx', 'itx'], gpuMax: 420, coolerMax: 190, radMax: 457 },
  mid: { w: 220, h: 470, d: 450, label: 'Mid tower', takes: ['atx', 'matx', 'itx'], gpuMax: 360, coolerMax: 170, radMax: 397 },
  micro: { w: 205, h: 400, d: 400, label: 'Micro tower', takes: ['matx', 'itx'], gpuMax: 320, coolerMax: 158, radMax: 277 },
  itx: { w: 165, h: 250, d: 320, label: 'Mini ITX', takes: ['itx'], gpuMax: 265, coolerMax: 70, radMax: 277 },
}

const pcCase: PartDef = {
  id: 'pc-case',
  name: 'PC case',
  category: 'pc-chassis',
  blurb: 'Standoffs, clearances and a side panel',
  tags: ['case', 'tower', 'chassis', 'atx', 'itx', 'pc', 'enclosure', 'build'],
  doc: {
    price: 90,
    description:
      'A tower case. Its standoffs are on the ATX grid, and it carries the two clearances that actually stop builds: how long a graphics card can be and how tall a cooler can be.',
  },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: 'mid', group: 'Case', options: [
      { value: 'full', label: 'Full tower' }, { value: 'mid', label: 'Mid tower' },
      { value: 'micro', label: 'Micro tower' }, { value: 'itx', label: 'Mini ITX' },
    ] },
    { key: 'sidePanel', label: 'Glass panel on', type: 'bool', default: false, group: 'Case', help: 'Take it off to see inside, as you would while building.' },
    { key: 'colour', label: 'Finish', type: 'enum', default: 'black', group: 'Case', options: [
      { value: 'black', label: 'Black' }, { value: 'white', label: 'White' },
    ] },
  ],
  solids: (p) => {
    const c = CASE_SPEC[str(p, 'size', 'mid')] ?? CASE_SPEC.mid
    const shell = str(p, 'colour', 'black') === 'white'
      ? { color: '#DDE1E6', rough: 0.5, density: 7.85 }
      : { color: '#16191D', rough: 0.55, density: 7.85 }
    const t = 1.2
    const out: Solid[] = [
      // Floor, roof, back and far side. The near side is the window.
      { kind: 'box', mat: shell, size: [c.w, t, c.d], at: [0, t / 2, 0] },
      { kind: 'box', mat: shell, size: [c.w, t, c.d], at: [0, c.h - t / 2, 0] },
      { kind: 'box', mat: shell, size: [c.w, c.h, t], at: [0, c.h / 2, -c.d / 2 + t / 2] },
      { kind: 'box', mat: shell, size: [t, c.h, c.d], at: [-c.w / 2 + t / 2, c.h / 2, 0] },
      // Motherboard tray, standing off the far side.
      { kind: 'box', mat: shell, size: [t, c.h - 90, c.d - 60], at: [-c.w / 2 + 26, c.h / 2 - 20, 10] },
      // Front panel with a mesh intake.
      { kind: 'box', mat: shell, size: [c.w, c.h, 2], at: [0, c.h / 2, c.d / 2 - 1], bevel: 1 },
      { kind: 'box', mat: MESH, size: [c.w - 30, c.h - 60, 2], at: [0, c.h / 2, c.d / 2 - 3.5], noCollide: true },
      /*
       * PSU shroud, as the two panels it actually is. Modelled as a solid block
       * it was six litres of steel, which put fifty kilograms on the bill of
       * materials and made a mid tower weigh more than the bench.
       */
      { kind: 'box', mat: shell, size: [c.w - 4, t, c.d - 120], at: [0, 90, -20], bevel: 0.4 },
      { kind: 'box', mat: shell, size: [c.w - 4, 90, t], at: [0, 45, -20 + (c.d - 120) / 2], bevel: 0.4 },
      // Feet.
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): Solid => ({
        kind: 'cyl', mat: { color: '#0E1013', rough: 0.9, density: 1.2 }, r: 9, h: 12,
        at: [(sx * (c.w - 40)) / 2, -6, (sz * (c.d - 50)) / 2],
      }))),
      // Rear I/O cutout and expansion slots.
      { kind: 'box', mat: { color: '#0A0B0D', rough: 0.9, density: 0.01 }, size: [160, 45, 3], at: [-c.w / 2 + 106, c.h - 74, -c.d / 2 + t], noCollide: true },
      ...Array.from({ length: 7 }, (_, i): Solid => ({
        kind: 'box', mat: shell, size: [18, 100, 2],
        at: [-c.w / 2 + 66, c.h - 168 - i * 20.32, -c.d / 2 + 3], rot: [0, 0, 90], noCollide: true,
      })),
    ]
    if (p.sidePanel === true) {
      out.push({ kind: 'box', mat: GLASS, size: [4, c.h - 20, c.d - 20], at: [c.w / 2 - 3, c.h / 2, 0], bevel: 1 })
    }
    return out
  },
  ports: (p) => {
    const c = CASE_SPEC[str(p, 'size', 'mid')] ?? CASE_SPEC.mid
    const out: Port[] = []
    // Standoffs on the ATX grid, referenced from the top rear corner of the tray.
    const grid: [number, number][] = [
      [10.16, 10.16], [10.16, 106.68], [10.16, 233.68],
      [107.95, 10.16], [107.95, 106.68], [107.95, 233.68],
      [200.66, 10.16], [200.66, 106.68], [200.66, 233.68],
    ]
    const x0 = -c.w / 2 + 28
    const y0 = c.h - 40
    const z0 = -c.d / 2 + 40
    grid.forEach(([gx, gz], i) => {
      if (gx > c.h - 90 || gz > c.d - 90) return
      out.push({
        id: `standoff${i}`, label: 'Standoff', kind: 'mechanical',
        pos: [x0, y0 - gx, z0 + gz], dir: [1, 0, 0],
        mate: { type: 'standoff', key: 'ATX' }, groupId: 'standoffs',
      })
    })
    out.push(
      { id: 'psu-bay', label: 'PSU bay', kind: 'mechanical', pos: [0, 6, -c.d / 2 + 90], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    )
    return out
  },
  mass: (p) => {
    const c = CASE_SPEC[str(p, 'size', 'mid')] ?? CASE_SPEC.mid
    // Panels, frame and glass. The solid tree overstates a sheet-metal shell.
    return (c.w * c.h * c.d) / 4200 + (p.sidePanel === true ? 2200 : 0)
  },
  price: (p) => ({ full: 160, mid: 95, micro: 75, itx: 110 })[str(p, 'size', 'mid')] ?? 95,
  readouts: (p) => {
    const c = CASE_SPEC[str(p, 'size', 'mid')] ?? CASE_SPEC.mid
    return [
      { label: 'Size', value: `${c.label}, ${c.w} x ${c.h} x ${c.d} mm` },
      { label: 'Boards it takes', value: c.takes.map((t) => (t === 'matx' ? 'micro ATX' : t.toUpperCase())).join(', ') },
      { label: 'Longest card', value: `${c.gpuMax} mm` },
      { label: 'Tallest cooler', value: `${c.coolerMax} mm` },
      { label: 'Longest radiator', value: `${c.radMax} mm` },
    ]
  },
}

registerParts([psu, ssdM2, driveSata, cooler, caseFan, pcCase])

export const PC_CHASSIS_PARTS = [psu, ssdM2, driveSata, cooler, caseFan, pcCase]
export { CASE_SPEC }
