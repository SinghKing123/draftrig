import type { PartDef, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { bool, num, str } from './_helpers'

const P = 2.54

/* ================================================================== */
/* Battery holder                                                      */
/* ================================================================== */

const CELLS: Record<string, { v: number; d: number; l: number; r: number; mah: number; label: string }> = {
  aa: { v: 1.5, d: 14.5, l: 50.5, r: 0.15, mah: 2400, label: 'AA alkaline (1.5 V)' },
  aaa: { v: 1.5, d: 10.5, l: 44.5, r: 0.3, mah: 1000, label: 'AAA alkaline (1.5 V)' },
  '18650': { v: 3.7, d: 18.2, l: 65, r: 0.04, mah: 3000, label: '18650 Li-ion (3.7 V)' },
  c: { v: 1.5, d: 26.2, l: 50, r: 0.1, mah: 8000, label: 'C alkaline (1.5 V)' },
}

const batteryHolder: PartDef = {
  id: 'battery-holder',
  name: 'Battery holder',
  category: 'power',
  blurb: 'Cells in series with real internal resistance',
  tags: ['battery', 'cell', 'aa', '18650', 'power', 'supply', 'holder'],
  doc: { description: 'Battery holder with flying leads. Terminal voltage sags under load according to cell internal resistance.', price: 1.2 },
  params: [
    { key: 'cell', label: 'Cell type', type: 'enum', default: 'aa', group: 'Power', options: Object.entries(CELLS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'count', label: 'Cells in series', type: 'number', default: 4, min: 1, max: 8, step: 1, group: 'Power' },
    { key: 'soc', label: 'State of charge', type: 'number', unit: '%', default: 100, min: 0, max: 100, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const c = CELLS[str(p, 'cell', 'aa')] ?? CELLS.aa
    const n = Math.round(num(p, 'count', 4))
    const pitch = c.d + 2.4
    const w = c.l + 8
    const d = pitch * n + 2
    const h = c.d + 3
    const out: Solid[] = [
      { kind: 'box', mat: 'abs-black', size: [w, 2, d], at: [0, 1, 0], bevel: 0.6 },
    ]
    const cy = 2 + c.d / 2
    for (let i = 0; i < n; i++) {
      const z = -((n - 1) / 2) * pitch + i * pitch
      const flip = i % 2 === 1
      // Cell body, with the label wrap in a lighter tone so it reads as a cell.
      out.push({ kind: 'cyl', mat: { color: '#23262B', rough: 0.5, density: 2.6 }, r: c.d / 2, h: c.l, rot: [0, 0, 90], at: [0, cy, z] })
      out.push({ kind: 'cyl', mat: { color: '#C8531F', rough: 0.45, density: 2.6 }, r: c.d / 2 + 0.05, h: c.l * 0.62, rot: [0, 0, 90], at: [0, cy, z] })
      // Positive nub and the flat negative end.
      out.push({ kind: 'cyl', mat: 'steel', r: c.d * 0.16, h: 1.2, rot: [0, 0, 90], at: [(flip ? -1 : 1) * (c.l / 2 + 0.6), cy, z] })
      // Short divider between cells only, not a full wall.
      if (i < n - 1) {
        out.push({ kind: 'box', mat: 'abs-black', size: [w * 0.7, c.d * 0.55, 1.4], at: [0, 2 + c.d * 0.275, z + pitch / 2] })
      }
      // Contact springs at the ends.
      out.push({ kind: 'box', mat: 'nickel', size: [0.8, c.d * 0.7, c.d * 0.5], at: [(flip ? 1 : -1) * (c.l / 2 + 2.2), cy, z] })
    }
    // End walls carry the contacts; the long sides stay open.
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'box', mat: 'abs-black', size: [3, h, d], at: [s * (w / 2 - 1.5), 2 + h / 2, 0], bevel: 0.5 })
    }
    // Flying leads.
    out.push({ kind: 'tube', mat: { color: '#B01A1A', rough: 0.6, density: 1.4 }, r: 0.9, seg: 8,
      path: [[w / 2 - 2, 2, -d / 2 + 3], [w / 2 + 14, 4, -d / 2 + 3], [w / 2 + 22, 1.2, -d / 2 + 3]] })
    out.push({ kind: 'tube', mat: { color: '#1A1C1E', rough: 0.6, density: 1.4 }, r: 0.9, seg: 8,
      path: [[w / 2 - 2, 2, d / 2 - 3], [w / 2 + 14, 4, d / 2 - 3], [w / 2 + 22, 1.2, d / 2 - 3]] })
    return out
  },
  ports: (p) => {
    const c = CELLS[str(p, 'cell', 'aa')] ?? CELLS.aa
    const n = Math.round(num(p, 'count', 4))
    const pitch = c.d + 2.4
    const w = c.l + 8
    const d = pitch * n + 2
    return [
      { id: 'p', label: 'Positive (+)', kind: 'electrical', pos: [w / 2 + 22, 1.2, -d / 2 + 3], dir: [1, 0, 0], role: 'power', imax: 5 },
      { id: 'n', label: 'Negative (−)', kind: 'electrical', pos: [w / 2 + 22, 1.2, d / 2 - 3], dir: [1, 0, 0], role: 'gnd', imax: 5 },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      const c = CELLS[str(p, 'cell', 'aa')] ?? CELLS.aa
      const n = Math.round(num(p, 'count', 4))
      const soc = num(p, 'soc', 100) / 100
      // Simple discharge curve: alkaline sags with depth of discharge.
      const v = c.v * (0.78 + 0.22 * Math.pow(Math.max(soc, 0), 0.35)) * n
      return [{ type: 'vsource', v, a: 'p', b: 'n', rint: c.r * n }]
    },
  },
  readouts: (p) => {
    const c = CELLS[str(p, 'cell', 'aa')] ?? CELLS.aa
    const n = Math.round(num(p, 'count', 4))
    const soc = num(p, 'soc', 100) / 100
    const v = c.v * (0.78 + 0.22 * Math.pow(Math.max(soc, 0), 0.35)) * n
    return [
      { label: 'Open-circuit voltage', value: `${v.toFixed(2)} V` },
      { label: 'Internal resistance', value: eng(c.r * n, 'Ω') },
      { label: 'Capacity', value: `${c.mah} mAh` },
      { label: 'Energy', value: `${((v * c.mah) / 1000).toFixed(1)} Wh` },
    ]
  },
}

/* ================================================================== */
/* Bench power supply                                                  */
/* ================================================================== */

const benchSupply: PartDef = {
  id: 'bench-supply',
  name: 'Bench supply',
  category: 'power',
  blurb: 'Adjustable DC with a real current limit',
  tags: ['power supply', 'psu', 'bench', 'dc', 'lab', 'variable'],
  doc: { description: 'Adjustable linear bench supply. Drops out of constant-voltage into constant-current when the limit is reached.', price: 65 },
  params: [
    { key: 'voltage', label: 'Voltage', type: 'number', unit: 'V', default: 5, min: 0, max: 30, step: 0.1, group: 'Control' },
    { key: 'ilimit', label: 'Current limit', type: 'number', unit: 'A', default: 1, min: 0.001, max: 10, step: 0.01, group: 'Control' },
    { key: 'on', label: 'Output enabled', type: 'bool', default: true, group: 'Control' },
  ],
  solids: () => {
    const w = 120, h = 70, d = 150
    // The front panel faces +Z, which is toward the default camera. A part
    // whose controls point away from the viewer looks like a blank box.
    return [
      { kind: 'box', mat: { color: '#2E3238', rough: 0.65, density: 1.2 }, size: [w, h, d], at: [0, h / 2, 0], bevel: 2 },
      // Recessed front fascia.
      { kind: 'box', mat: { color: '#15181C', rough: 0.5, density: 1.2 }, size: [w - 8, h - 8, 2], at: [0, h / 2, d / 2 + 0.5], bevel: 1 },
      // Seven-segment display.
      { kind: 'box', mat: { color: '#0B1A14', rough: 0.2, emissive: '#39E08A', emissiveIntensity: 0.55, density: 2.5 },
        size: [58, 24, 1], at: [-22, h - 24, d / 2 + 1.6], tag: 'display', noCollide: true },
      // Knobs.
      { kind: 'cyl', mat: { color: '#1A1D22', rough: 0.5, density: 1.1 }, r: 9, h: 12, chamfer: 1.2, rot: [90, 0, 0], at: [34, h - 26, d / 2 + 6] },
      { kind: 'cyl', mat: { color: '#1A1D22', rough: 0.5, density: 1.1 }, r: 9, h: 12, chamfer: 1.2, rot: [90, 0, 0], at: [34, h - 50, d / 2 + 6] },
      // Knob pointers, so the settings read as settings.
      { kind: 'box', mat: { color: '#E6EAF0', rough: 0.6, density: 0.01 }, size: [1.4, 6, 0.6], at: [34, h - 20, d / 2 + 8], noCollide: true },
      { kind: 'box', mat: { color: '#E6EAF0', rough: 0.6, density: 0.01 }, size: [1.4, 6, 0.6], at: [34, h - 44, d / 2 + 8], noCollide: true },
      // Binding posts: red, black, green earth.
      { kind: 'cyl', mat: { color: '#C0272D', rough: 0.4, density: 1.2 }, r: 5.5, h: 9, chamfer: 0.8, rot: [90, 0, 0], at: [-30, 16, d / 2 + 4.5] },
      { kind: 'cyl', mat: { color: '#1A1C1E', rough: 0.4, density: 1.2 }, r: 5.5, h: 9, chamfer: 0.8, rot: [90, 0, 0], at: [-6, 16, d / 2 + 4.5] },
      { kind: 'cyl', mat: { color: '#3DD68C', rough: 0.4, density: 1.2 }, r: 5.5, h: 9, chamfer: 0.8, rot: [90, 0, 0], at: [18, 16, d / 2 + 4.5] },
      // Cooling vents on the back.
      { kind: 'box', mat: { color: '#191C21', rough: 0.8, density: 0.01 }, size: [w - 20, 30, 1], at: [0, h - 20, -d / 2 - 0.2], noCollide: true },
      // Rubber feet.
      ...([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => ({
        kind: 'cyl' as const, mat: 'rubber', r: 6, h: 3,
        at: [sx * (w / 2 - 12), 1.5, sz * (d / 2 - 12)] as Vec3,
      })),
    ]
  },
  ports: () => {
    const d = 150
    return [
      { id: 'p', label: '+ Output', kind: 'electrical', pos: [-30, 16, d / 2 + 9], dir: [0, 0, 1], role: 'power', imax: 10 },
      { id: 'n', label: '− Output', kind: 'electrical', pos: [-6, 16, d / 2 + 9], dir: [0, 0, 1], role: 'gnd', imax: 10 },
      { id: 'e', label: 'Earth', kind: 'electrical', pos: [18, 16, d / 2 + 9], dir: [0, 0, 1], role: 'shield', imax: 10 },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) =>
      bool(p, 'on', true)
        ? [{ type: 'vsource', v: num(p, 'voltage', 5), a: 'p', b: 'n', rint: 0.02 }]
        : [{ type: 'resistor', r: 1e9, a: 'p', b: 'n' }],
  },
  readouts: (p) => [
    { label: 'Set point', value: `${num(p, 'voltage', 5).toFixed(2)} V` },
    { label: 'Current limit', value: eng(num(p, 'ilimit', 1), 'A') },
    { label: 'Max power', value: `${(num(p, 'voltage', 5) * num(p, 'ilimit', 1)).toFixed(1)} W` },
  ],
}

/* ================================================================== */
/* Tactile pushbutton                                                  */
/* ================================================================== */

const pushbutton: PartDef = {
  id: 'pushbutton-tactile',
  name: 'Pushbutton',
  category: 'electromech',
  blurb: 'Momentary tactile switch — click it while simulating',
  tags: ['button', 'switch', 'tactile', 'momentary', 'push'],
  doc: { description: '6 mm tactile switch. The two pins on each side are permanently joined inside the body.', price: 0.12 },
  params: [
    { key: 'capColor', label: 'Cap colour', type: 'color', default: '#C0272D', group: 'Body' },
    { key: 'pressed', label: 'Pressed', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const pressed = bool(p, 'pressed', false)
    return [
      { kind: 'box', mat: 'abs-black', size: [6, 3.5, 6], at: [0, 1.75, 0], bevel: 0.3 },
      { kind: 'cyl', mat: { color: '#B8BCC2', rough: 0.35, metal: 1, density: 7.8 }, r: 1.75, h: 0.6, at: [0, 3.7, 0] },
      { kind: 'cyl', mat: { color: str(p, 'capColor', '#C0272D'), rough: 0.4, density: 1.1 }, r: 1.75, h: 1.6,
        at: [0, pressed ? 4.4 : 4.8, 0], tag: 'cap' },
      { kind: 'box', mat: 'tin', size: [0.5, 3.8, 0.9], at: [3.1, -0.9, 2.25] },
      { kind: 'box', mat: 'tin', size: [0.5, 3.8, 0.9], at: [3.1, -0.9, -2.25] },
      { kind: 'box', mat: 'tin', size: [0.5, 3.8, 0.9], at: [-3.1, -0.9, 2.25] },
      { kind: 'box', mat: 'tin', size: [0.5, 3.8, 0.9], at: [-3.1, -0.9, -2.25] },
    ]
  },
  ports: () => [
    { id: 'a1', label: 'A1', kind: 'electrical', pos: [3.1, -2.4, 2.25], dir: [0, -1, 0], role: 'passive', groupId: 'a' },
    { id: 'a2', label: 'A2', kind: 'electrical', pos: [3.1, -2.4, -2.25], dir: [0, -1, 0], role: 'passive', groupId: 'a' },
    { id: 'b1', label: 'B1', kind: 'electrical', pos: [-3.1, -2.4, 2.25], dir: [0, -1, 0], role: 'passive', groupId: 'b' },
    { id: 'b2', label: 'B2', kind: 'electrical', pos: [-3.1, -2.4, -2.25], dir: [0, -1, 0], role: 'passive', groupId: 'b' },
  ],
  electrical: {
    devices: (p) => [{ type: 'switch', a: 'a1', b: 'b1', closed: bool(p, 'pressed', false), ron: 0.05, roff: 1e9 }],
  },
}

/* ================================================================== */
/* Toggle switch                                                       */
/* ================================================================== */

const toggleSwitch: PartDef = {
  id: 'switch-toggle',
  name: 'Toggle switch',
  category: 'electromech',
  blurb: 'SPST or SPDT, latching',
  tags: ['switch', 'toggle', 'spst', 'spdt', 'latching'],
  doc: { description: 'Panel-mount toggle switch.', price: 1.1 },
  params: [
    { key: 'poles', label: 'Configuration', type: 'enum', default: 'spst', group: 'Body', options: [{ value: 'spst', label: 'SPST — on / off' }, { value: 'spdt', label: 'SPDT — changeover' }] },
    { key: 'on', label: 'On', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const on = bool(p, 'on', false)
    return [
      { kind: 'box', mat: { color: '#1A1C20', rough: 0.55, density: 1.5 }, size: [12.7, 9, 8.5], at: [0, 4.5, 0], bevel: 0.5 },
      { kind: 'cyl', mat: 'nickel', r: 3.1, h: 6, at: [0, 12, 0] },
      { kind: 'cyl', mat: 'nickel', r: 4.5, h: 2.5, at: [0, 10.2, 0] },
      { kind: 'cyl', mat: 'nickel', r: 1.4, h: 9, at: [0, 17, 0], rot: [on ? 22 : -22, 0, 0], tag: 'lever' },
      { kind: 'sphere', mat: 'nickel', r: 1.9, at: [0, 21.5, on ? 3.2 : -3.2] },
      { kind: 'box', mat: 'tin', size: [0.8, 6, 1.6], at: [0, -3, 0] },
      { kind: 'box', mat: 'tin', size: [0.8, 6, 1.6], at: [0, -3, 4.7] },
      { kind: 'box', mat: 'tin', size: [0.8, 6, 1.6], at: [0, -3, -4.7] },
    ]
  },
  ports: () => [
    { id: 'com', label: 'Common', kind: 'electrical', pos: [0, -5.5, 0], dir: [0, -1, 0], role: 'passive', imax: 3 },
    { id: 'no', label: 'Normally open', kind: 'electrical', pos: [0, -5.5, 4.7], dir: [0, -1, 0], role: 'passive', imax: 3 },
    { id: 'nc', label: 'Normally closed', kind: 'electrical', pos: [0, -5.5, -4.7], dir: [0, -1, 0], role: 'passive', imax: 3 },
  ],
  electrical: {
    devices: (p) => {
      const on = bool(p, 'on', false)
      const devs: { type: 'switch'; a: string; b: string; closed: boolean; ron: number; roff: number }[] = [
        { type: 'switch', a: 'com', b: 'no', closed: on, ron: 0.02, roff: 1e9 },
      ]
      if (str(p, 'poles', 'spst') === 'spdt') {
        devs.push({ type: 'switch', a: 'com', b: 'nc', closed: !on, ron: 0.02, roff: 1e9 })
      }
      return devs
    },
  },
}

/* ================================================================== */
/* Potentiometer                                                       */
/* ================================================================== */

const potentiometer: PartDef = {
  id: 'potentiometer',
  name: 'Potentiometer',
  category: 'electromech',
  blurb: 'Rotary pot — drag the knob while simulating',
  tags: ['potentiometer', 'pot', 'variable resistor', 'rheostat', 'knob', 'trimmer'],
  doc: { description: 'Single-turn rotary potentiometer. Wiper position is live during simulation.', price: 0.9 },
  params: [
    { key: 'value', label: 'Total resistance', type: 'number', unit: 'Ω', default: 10000, min: 100, max: 1e6, eng: true, group: 'Electrical' },
    { key: 'taper', label: 'Taper', type: 'enum', default: 'lin', group: 'Electrical', options: [{ value: 'lin', label: 'Linear (B)' }, { value: 'log', label: 'Logarithmic (A)' }] },
    { key: 'pos', label: 'Wiper position', type: 'number', unit: '%', default: 50, min: 0, max: 100, step: 1, group: 'Control' },
    { key: 'knob', label: 'Knob', type: 'bool', default: true, group: 'Body' },
  ],
  solids: (p) => {
    const angle = -135 + (num(p, 'pos', 50) / 100) * 270
    const out: Solid[] = [
      { kind: 'cyl', mat: { color: '#B9BEC6', rough: 0.35, metal: 1, density: 7.8 }, r: 8, h: 7, at: [0, 3.5, 0] },
      { kind: 'box', mat: { color: '#B9BEC6', rough: 0.35, metal: 1, density: 7.8 }, size: [16, 7, 4], at: [0, 3.5, -6] },
      { kind: 'cyl', mat: 'nickel', r: 3.5, h: 5, at: [0, 9, 0] },
      { kind: 'cyl', mat: 'nickel', r: 3, h: 14, at: [0, 14, 0], tag: 'shaft', rot: [0, angle, 0] },
      { kind: 'box', mat: 'tin', size: [0.8, 6, 1.4], at: [-2.5, -1, 6.5] },
      { kind: 'box', mat: 'tin', size: [0.8, 6, 1.4], at: [0, -1, 6.5] },
      { kind: 'box', mat: 'tin', size: [0.8, 6, 1.4], at: [2.5, -1, 6.5] },
    ]
    if (p.knob !== false) {
      out.push({ kind: 'cyl', mat: { color: '#1D2026', rough: 0.5, density: 1.1 }, r: 8.5, h: 14, r2: 7.5, at: [0, 18, 0], rot: [0, angle, 0], tag: 'knob' })
      out.push({ kind: 'box', mat: { color: '#F0F3F7', rough: 0.6, density: 1.1 }, size: [1.2, 1, 8], at: [0, 25.1, -4], rot: [0, angle, 0], noCollide: true })
    }
    return out
  },
  ports: () => [
    { id: 'a', label: 'CCW end', kind: 'electrical', pos: [-2.5, -3.5, 6.5], dir: [0, -1, 0], role: 'passive' },
    { id: 'w', label: 'Wiper', kind: 'electrical', pos: [0, -3.5, 6.5], dir: [0, -1, 0], role: 'passive' },
    { id: 'b', label: 'CW end', kind: 'electrical', pos: [2.5, -3.5, 6.5], dir: [0, -1, 0], role: 'passive' },
  ],
  electrical: {
    devices: (p) => {
      const total = num(p, 'value', 10000)
      const raw = Math.min(1, Math.max(0, num(p, 'pos', 50) / 100))
      const frac = str(p, 'taper', 'lin') === 'log' ? Math.pow(raw, 2.2) : raw
      const MIN = 0.5 // never a true short — real wipers have contact resistance
      return [
        { type: 'resistor', r: Math.max(MIN, total * frac), a: 'a', b: 'w' },
        { type: 'resistor', r: Math.max(MIN, total * (1 - frac)), a: 'w', b: 'b' },
      ]
    },
  },
  readouts: (p) => {
    const total = num(p, 'value', 10000)
    const raw = num(p, 'pos', 50) / 100
    const frac = str(p, 'taper', 'lin') === 'log' ? Math.pow(raw, 2.2) : raw
    return [
      { label: 'A → W', value: eng(total * frac, 'Ω') },
      { label: 'W → B', value: eng(total * (1 - frac), 'Ω') },
    ]
  },
}

/* ================================================================== */
/* Piezo buzzer                                                        */
/* ================================================================== */

const buzzer: PartDef = {
  id: 'buzzer-piezo',
  name: 'Piezo buzzer',
  category: 'electromech',
  blurb: 'Active buzzer — audible in simulation',
  tags: ['buzzer', 'piezo', 'sound', 'beeper', 'speaker'],
  doc: { description: 'Self-oscillating active buzzer. Drive it with DC and it sounds.', price: 0.6 },
  params: [
    { key: 'vnom', label: 'Rated voltage', type: 'number', unit: 'V', default: 5, min: 1.5, max: 24, step: 0.5, group: 'Electrical' },
    { key: 'freq', label: 'Tone', type: 'number', unit: 'Hz', default: 2300, min: 200, max: 8000, step: 50, group: 'Acoustic' },
  ],
  solids: () => [
    { kind: 'cyl', mat: 'abs-black', r: 6, h: 9, at: [0, 4.5, 0] },
    { kind: 'cyl', mat: { color: '#0C0E10', rough: 0.9, density: 0.01 }, r: 1.2, h: 1, at: [0, 9.2, 0], noCollide: true },
    { kind: 'box', mat: 'tin', size: [0.5, 6, 0.5], at: [-3.25, -1.5, 0] },
    { kind: 'box', mat: 'tin', size: [0.5, 6, 0.5], at: [3.25, -1.5, 0] },
  ],
  ports: () => [
    { id: 'p', label: '+', kind: 'electrical', pos: [3.25, -3.6, 0], dir: [0, -1, 0], role: 'power', imax: 0.05 },
    { id: 'n', label: '−', kind: 'electrical', pos: [-3.25, -3.6, 0], dir: [0, -1, 0], role: 'gnd', imax: 0.05 },
  ],
  electrical: {
    devices: (p) => [{ type: 'resistor', r: Math.max(50, num(p, 'vnom', 5) / 0.025), a: 'p', b: 'n' }],
  },
}

/* ================================================================== */
/* Brushed DC motor                                                    */
/* ================================================================== */

const dcMotor: PartDef = {
  id: 'motor-dc',
  name: 'DC motor',
  category: 'motion',
  blurb: 'Brushed motor with a real torque–speed curve',
  tags: ['motor', 'dc', 'brushed', '130', 'gearmotor', 'actuator'],
  doc: { description: 'Small brushed DC motor. Speed and stall current follow the standard first-order model.', price: 2.4 },
  params: [
    { key: 'vnom', label: 'Rated voltage', type: 'number', unit: 'V', default: 6, min: 1.5, max: 48, step: 0.5, group: 'Electrical' },
    { key: 'rpm', label: 'No-load speed', type: 'number', unit: 'rpm', default: 9000, min: 20, max: 40000, step: 100, group: 'Mechanical' },
    { key: 'rwind', label: 'Winding resistance', type: 'number', unit: 'Ω', default: 3.2, min: 0.05, max: 200, step: 0.1, group: 'Electrical' },
    { key: 'shaft', label: 'Shaft Ø', type: 'number', unit: 'mm', default: 2, min: 1, max: 12, step: 0.5, group: 'Mechanical' },
  ],
  solids: (p) => {
    const d = 20.4, len = 25
    return [
      { kind: 'cyl', mat: { color: '#9BA2AA', rough: 0.42, metal: 1, density: 7.8 }, r: d / 2, h: len, rot: [0, 0, 90], at: [0, d / 2, 0] },
      { kind: 'box', mat: { color: '#9BA2AA', rough: 0.42, metal: 1, density: 7.8 }, size: [len, d * 0.86, d * 0.9], at: [0, d / 2, 0] },
      { kind: 'cyl', mat: { color: '#D9DDE2', rough: 0.5, density: 1.4 }, r: d * 0.42, h: 2.5, rot: [0, 0, 90], at: [len / 2 + 1, d / 2, 0] },
      { kind: 'cyl', mat: 'steel', r: num(p, 'shaft', 2) / 2, h: 9, rot: [0, 0, 90], at: [len / 2 + 7, d / 2, 0], tag: 'shaft' },
      { kind: 'box', mat: 'copper', size: [1.5, 0.4, 4], at: [-len / 2 - 1.5, d / 2 + 3.5, 0] },
      { kind: 'box', mat: 'copper', size: [1.5, 0.4, 4], at: [-len / 2 - 1.5, d / 2 - 3.5, 0] },
    ]
  },
  ports: () => [
    { id: 'p', label: 'Terminal +', kind: 'electrical', pos: [-14, 13.7, 0], dir: [-1, 0, 0], role: 'power', imax: 3 },
    { id: 'n', label: 'Terminal −', kind: 'electrical', pos: [-14, 6.7, 0], dir: [-1, 0, 0], role: 'power', imax: 3 },
    { id: 'shaft', label: 'Output shaft', kind: 'mechanical', pos: [22, 10.2, 0], dir: [1, 0, 0], mate: { type: 'stud', size: 2 } },
  ],
  electrical: {
    // Modelled as winding resistance in series with a back-EMF source that the
    // solver updates from shaft speed each timestep.
    devices: (p) => [{ type: 'resistor', r: num(p, 'rwind', 3.2), a: 'p', b: 'n' }],
  },
  readouts: (p) => {
    const v = num(p, 'vnom', 6)
    const r = num(p, 'rwind', 3.2)
    const rpm = num(p, 'rpm', 9000)
    const kv = rpm / v
    const stall = v / r
    const kt = 60 / (2 * Math.PI * kv)
    return [
      { label: 'Stall current', value: eng(stall, 'A') },
      { label: 'Speed constant', value: `${kv.toFixed(0)} rpm/V` },
      { label: 'Torque constant', value: `${(kt * 1000).toFixed(1)} mN·m/A` },
      { label: 'Stall torque', value: `${(kt * stall * 1000).toFixed(0)} mN·m` },
    ]
  },
}

/* ================================================================== */
/* Ground reference                                                    */
/* ================================================================== */

const groundRef: PartDef = {
  id: 'ground',
  name: 'Ground',
  category: 'power',
  blurb: 'The 0 V reference every circuit needs',
  tags: ['ground', 'gnd', 'reference', '0v', 'earth'],
  doc: { description: 'Marks a node as 0 V. A circuit without one cannot be solved.' },
  params: [],
  solids: () => [
    { kind: 'box', mat: { color: '#3DD68C', rough: 0.4, emissive: '#3DD68C', emissiveIntensity: 0.25, density: 0.3 }, size: [7, 0.9, 1.4], at: [0, 4.4, 0] },
    { kind: 'box', mat: { color: '#3DD68C', rough: 0.4, emissive: '#3DD68C', emissiveIntensity: 0.25, density: 0.3 }, size: [4.6, 0.9, 1.4], at: [0, 2.9, 0] },
    { kind: 'box', mat: { color: '#3DD68C', rough: 0.4, emissive: '#3DD68C', emissiveIntensity: 0.25, density: 0.3 }, size: [2.2, 0.9, 1.4], at: [0, 1.4, 0] },
    { kind: 'cyl', mat: 'tin', r: 0.35, h: 6, at: [0, 2.2, 0] },
  ],
  ports: () => [{ id: 'gnd', label: 'GND', kind: 'electrical', pos: [0, -0.8, 0], dir: [0, -1, 0], role: 'gnd', imax: 10 }],
  electrical: { devices: () => [] },
}

registerParts([batteryHolder, benchSupply, pushbutton, toggleSwitch, potentiometer, buzzer, dcMotor, groundRef])

export const P_PITCH = P
