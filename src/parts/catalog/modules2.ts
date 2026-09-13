import type { DeviceModel, PartDef, Port, SilkItem, Solid, Vec2, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Breakout modules, batteries, and the parts a drone is made of.
 *
 * The rule for these is to model what the solver can honestly carry. A load
 * cell is a real Wheatstone bridge whose arms move with the load; a MOSFET
 * module is a real MOSFET, so a 3.3 V board driving an IRF520 gets the half
 * turned-on channel it gets in life. Where a module talks a protocol the
 * solver does not decode, its pins present their pull-ups and its supply its
 * load, and the part says so rather than pretending otherwise.
 */

const P = 2.54
const DARK = { color: '#0A0C0F', rough: 0.9, density: 0.01 }
const METAL = { color: '#B8BDC4', metal: 1, rough: 0.36, density: 7.8 }

/* ------------------------------------------------------------------ */
/* Board furniture                                                     */
/* ------------------------------------------------------------------ */

/** A board lying flat, top face at y = T. */
function board(w: number, d: number, mask: string, T = 1.6, holes: [number, number][] = [], r = 1.2): Solid {
  return {
    kind: 'extrude', mat: mask,
    profile: { outline: roundRect(w, d, r, 0, 0, 3), holes: holes.map(([x, z]) => circle(1.6, x, -z, 12)) },
    depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
  }
}

/** A row of male pins pointing down out of the board, along x. */
function pinsDown(n: number, x0: number, z: number, T = 1.6): Solid[] {
  const out: Solid[] = [
    { kind: 'box', mat: 'nylon-black', size: [n * P, 2.5, 2.5], at: [x0 + ((n - 1) * P) / 2, -1.25, z], bevel: 0.15 },
  ]
  for (let i = 0; i < n; i++) out.push({ kind: 'box', mat: 'tin', size: [0.64, 9, 0.64], at: [x0 + i * P, T - 5.5, z] })
  return out
}

/** Ports for a row of pins made by `pinsDown`. */
function pinPorts(names: [string, string, Port['role']][], x0: number, z: number): Port[] {
  return names.map(([id, label, role], i) => ({
    id, label, kind: 'electrical' as const, pos: [x0 + i * P, -8, z] as Vec3, dir: [0, -1, 0] as Vec3,
    role, imax: role === 'power' || role === 'gnd' ? 0.5 : 0.04, solderable: true,
  }))
}

const chip = (w: number, d: number, at: Vec3): Solid => ({ kind: 'box', mat: 'epoxy-black', size: [w, 1, d], at, noCollide: true })
const led = (at: Vec3, color: string, lit: boolean): Solid => ({
  kind: 'box', mat: { color: '#1A1D22', rough: 0.3, density: 1.2, emissive: color, emissiveIntensity: lit ? 1.5 : 0 }, size: [1.6, 0.6, 0.8], at, noCollide: true,
})
const silk = (w: number, d: number, items: SilkItem[], T = 1.6): Solid => ({
  kind: 'silk', size: [w, d], items, mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 24, noCollide: true,
})

/** A three-pin analogue breakout reusing the ratiometric sensor behaviour. */
function analogModule(opts: {
  id: string; name: string; blurb: string; tags: string[]; price: number; description: string
  readingLabel: string; w: number; d: number; mask: string; body: (p: Record<string, unknown>) => Solid[]; legend: string
  extraPins?: [string, string, Port['role']][]
}): PartDef {
  const pins: [string, string, Port['role']][] = [['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd'], ['out', 'AO', 'analog'], ...(opts.extraPins ?? [])]
  const x0 = -((pins.length - 1) * P) / 2
  const zPins = opts.d / 2 - 2.6
  return {
    id: opts.id, name: opts.name, category: 'sensor', blurb: opts.blurb, tags: opts.tags,
    doc: { price: opts.price, description: opts.description },
    params: [{ key: 'reading', label: opts.readingLabel, type: 'number', unit: '%', default: 40, min: 0, max: 100, step: 1, group: 'Reading' }],
    solids: (p) => [
      board(opts.w, opts.d, opts.mask),
      silk(opts.w, opts.d, [
        { t: 'text', at: [0, -opts.d / 2 + 2.4], text: opts.legend, size: 1.8, bold: true },
        ...pins.map(([, label], i): SilkItem => ({ t: 'text', at: [x0 + i * P, -zPins + 2.6], text: label, size: 1.1 })),
      ]),
      ...opts.body(p),
      ...pinsDown(pins.length, x0, zPins),
    ],
    ports: () => pinPorts(pins, x0, zPins),
    electrical: {
      devices: () => [
        { type: 'behavioral', evalId: 'analog-sensor', ref: 'gnd', pins: ['vcc', 'gnd', 'out'] },
        { type: 'resistor', r: 20000, a: 'vcc', b: 'gnd' },
      ],
      limits: { vmax: 5.5 },
    },
    readouts: (p) => [
      { label: opts.readingLabel, value: `${num(p, 'reading', 40)} %` },
      { label: 'Output at 5 V', value: `${((num(p, 'reading', 40) / 100) * 5).toFixed(2)} V, ratiometric` },
    ],
  }
}

/* ================================================================== */
/* Power switching                                                     */
/* ================================================================== */

const mosfetModule: PartDef = {
  id: 'mosfet-module',
  name: 'MOSFET switch module',
  category: 'module',
  blurb: 'IRF520 on a board, and the 3.3 V trap that comes with it',
  tags: ['mosfet module', 'irf520', 'switch module', 'low side switch', 'pwm driver', 'led strip driver'],
  doc: {
    price: 1.2,
    description:
      'An IRF520 low-side switch with screw terminals. The IRF520 is not a logic-level part: its gate needs about 10 V to turn fully on, so from a 5 V pin it runs warm and from a 3.3 V pin it barely conducts. That is modelled, because it is the whole reason these modules disappoint.',
  },
  params: [],
  solids: () => {
    const W = 33
    const D = 24
    const T = 1.6
    return [
      board(W, D, 'fr4-red', T, [[-13.5, -9], [13.5, -9]]),
      silk(W, D, [{ t: 'text', at: [0, 9], text: 'MOS Module', size: 1.8, bold: true }, { t: 'text', at: [-6, -3], text: 'SIG VCC GND', size: 1 }]),
      // TO-220 lying back with its tab up, and the two screw blocks.
      { kind: 'box', mat: 'epoxy-black', size: [10.2, 4.5, 9.2], at: [4, T + 2.25, 2], bevel: 0.3 },
      { kind: 'box', mat: 'steel', size: [10.2, 1.3, 6.4], at: [4, T + 5.1, -5.2] },
      ...[-1, 1].map((s): Solid => ({ kind: 'box', mat: { color: '#1F5FCC', rough: 0.55, density: 1.4 }, size: [10.2, 10, 7.6], at: [s * 10, T + 5, -D / 2 + 4.2], bevel: 0.4 })),
      led([-10, T + 0.3, 4], '#FF2A18', true),
      ...pinsDown(3, -P - 6, D / 2 - 2),
    ]
  },
  ports: () => {
    const D = 24
    return [
      ...pinPorts([['sig', 'SIG', 'io'], ['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd']], -P - 6, D / 2 - 2),
      { id: 'vin', label: 'VIN +', kind: 'electrical', pos: [-12.5, 12, -D / 2 - 1], dir: [0, 0, -1], role: 'power', imax: 5 },
      { id: 'gndin', label: 'VIN −', kind: 'electrical', pos: [-7.5, 12, -D / 2 - 1], dir: [0, 0, -1], role: 'gnd', imax: 5 },
      { id: 'outp', label: 'V+ out', kind: 'electrical', pos: [7.5, 12, -D / 2 - 1], dir: [0, 0, -1], role: 'power', imax: 5 },
      { id: 'outn', label: 'V− out (switched)', kind: 'electrical', pos: [12.5, 12, -D / 2 - 1], dir: [0, 0, -1], role: 'passive', imax: 5 },
    ]
  },
  electrical: {
    devices: () => [
      { type: 'short', a: 'vin', b: 'outp' },
      { type: 'short', a: 'gndin', b: 'gnd' },
      // IRF520: threshold around 4 V, fully on only well above logic level.
      { type: 'mosfet', d: 'outn', g: 'sig', s: 'gnd', vth: 3.7, k: 1.2, rds: 0.27 },
      { type: 'resistor', r: 10000, a: 'sig', b: 'gnd' },
    ],
    limits: { vmax: 24, imax: 5 },
  },
  readouts: () => [
    { label: 'Transistor', value: 'IRF520, 100 V' },
    { label: 'From 10 V gate', value: '0.27 Ω, 5 A is fine' },
    { label: 'From a 5 V pin', value: 'Several ohms, gets hot above 1 A' },
    { label: 'From 3.3 V', value: 'Barely on. Use an IRLZ44N instead' },
  ],
}

const bts7960: PartDef = {
  id: 'motor-driver-bts7960',
  name: 'High-current motor driver',
  category: 'module',
  blurb: 'BTS7960 half-bridges under a heatsink, 43 A peak',
  tags: ['bts7960', 'ibt-2', 'motor driver', 'h bridge', 'high current', 'dc motor', 'pwm'],
  doc: {
    price: 7,
    description:
      'Two BTS7960 half-bridges make a full H-bridge for a big brushed motor. RPWM drives one way and LPWM the other, both enables have to be high, and the logic runs off its own 5 V pin.',
  },
  params: [],
  solids: () => {
    const W = 50
    const D = 50
    const T = 1.6
    const out: Solid[] = [
      board(W, D, 'fr4-red', T, [[-21, -21], [21, -21], [-21, 21], [21, 21]]),
      { kind: 'box', mat: 'alu-anod-black', size: [40, 4, 40], at: [0, -2, 0] },
    ]
    for (let i = 0; i < 9; i++) out.push({ kind: 'box', mat: 'alu-anod-black', size: [1.6, 12, 40], at: [-17 + i * 4.25, -10, 0] })
    out.push({ kind: 'box', mat: { color: '#1F9E4B', rough: 0.55, density: 1.4 }, size: [20.4, 10, 8], at: [-8, T + 5, -D / 2 + 5], bevel: 0.4 })
    out.push({ kind: 'box', mat: { color: '#1F9E4B', rough: 0.55, density: 1.4 }, size: [10.2, 10, 8], at: [14, T + 5, -D / 2 + 5], bevel: 0.4 })
    out.push({ kind: 'cyl', mat: 'elcap-sleeve', r: 5, h: 11, at: [12, T + 5.5, 6], seg: 18 })
    out.push(chip(6, 5, [-8, T + 0.5, 8]))
    out.push({ kind: 'box', mat: 'nylon-black', size: [4 * P, 8.5, 2 * P], at: [-4, T + 4.25, D / 2 - 4], bevel: 0.3 })
    return out
  },
  ports: () => {
    const D = 50
    const logic: [string, string, Port['role']][] = [['in1', 'RPWM', 'io'], ['in2', 'LPWM', 'io'], ['en', 'R_EN and L_EN', 'io'], ['vcc', 'VCC 5 V', 'power']]
    return [
      ...logic.map(([id, label, role], i): Port => ({ id, label, kind: 'electrical', pos: [-4 - 1.5 * P + i * P, 10.5, D / 2 - 4], dir: [0, 1, 0], role, imax: 0.02 })),
      { id: 'lgnd', label: 'Logic GND', kind: 'electrical', pos: [8, 10.5, D / 2 - 4], dir: [0, 1, 0], role: 'gnd', imax: 0.1 },
      { id: 'vm', label: 'B+', kind: 'electrical', pos: [-13, 12, -D / 2 + 1], dir: [0, 0, -1], role: 'power', imax: 43 },
      { id: 'gnd', label: 'B−', kind: 'electrical', pos: [-3, 12, -D / 2 + 1], dir: [0, 0, -1], role: 'gnd', imax: 43 },
      { id: 'out1', label: 'M+', kind: 'electrical', pos: [11.5, 12, -D / 2 + 1], dir: [0, 0, -1], role: 'power', imax: 43 },
      { id: 'out2', label: 'M−', kind: 'electrical', pos: [16.5, 12, -D / 2 + 1], dir: [0, 0, -1], role: 'power', imax: 43 },
    ]
  },
  electrical: {
    devices: () => [
      { type: 'behavioral', evalId: 'h-bridge', ref: 'gnd', pins: ['vm', 'in1', 'in2', 'en', 'out1', 'out2'] },
      { type: 'short', a: 'lgnd', b: 'gnd' },
      { type: 'resistor', r: 500, a: 'vcc', b: 'lgnd' },
    ],
    limits: { vmax: 27, imax: 43 },
  },
  readouts: () => [
    { label: 'Supply', value: '6 to 27 V' },
    { label: 'Current', value: '43 A peak, far less without airflow' },
    { label: 'Both enables', value: 'Must be high or the outputs float' },
  ],
}

const servoDriver: PartDef = {
  id: 'servo-driver-pca9685',
  name: 'Servo driver',
  category: 'module',
  blurb: 'Sixteen servo channels on two I2C wires',
  tags: ['pca9685', 'servo driver', 'pwm driver', '16 channel', 'i2c', 'servo', 'robot arm'],
  doc: {
    price: 4,
    description:
      'A PCA9685 PWM chip driving sixteen three-pin servo headers. The servos are powered from the V+ terminal, not from the logic supply, which is what stops a robot arm resetting the board every time it moves.',
  },
  params: [{ key: 'address', label: 'I2C address', type: 'enum', default: '0x40', group: 'Electrical', options: ['0x40', '0x41', '0x42', '0x43'].map((a) => ({ value: a, label: a })) }],
  solids: () => {
    const W = 62
    const D = 25
    const T = 1.6
    const out: Solid[] = [
      board(W, D, 'fr4-blue', T, [[-28, -9], [28, -9], [-28, 9], [28, 9]]),
      silk(W, D, [{ t: 'text', at: [0, -9], text: '16-CHANNEL 12-BIT PWM', size: 1.6, bold: true }]),
      chip(7.8, 6, [0, T + 0.5, -5]),
      { kind: 'box', mat: { color: '#1F5FCC', rough: 0.55, density: 1.4 }, size: [10.2, 10, 7.6], at: [0, T + 5, 9], bevel: 0.4 },
      { kind: 'cyl', mat: 'elcap-sleeve', r: 4, h: 8, at: [16, T + 4, -6], seg: 16 },
    ]
    // Four groups of four three-pin headers along the front edge.
    const cols = ['#1A1C1E', '#C4262C', '#D8A814']
    for (let g = 0; g < 4; g++) {
      for (let ch = 0; ch < 4; ch++) {
        const x = -24.5 + g * 13.5 + ch * P
        cols.forEach((c, r) => {
          out.push({ kind: 'box', mat: { color: c, rough: 0.55, density: 1.2 }, size: [P - 0.1, 2.5, P - 0.1], at: [x, T + 1.25, D / 2 - 7.5 + r * P] })
          out.push({ kind: 'box', mat: 'gold', size: [0.64, 7, 0.64], at: [x, T + 4, D / 2 - 7.5 + r * P] })
        })
      }
    }
    for (const s of [-1, 1] as const) out.push({ kind: 'box', mat: 'nylon-black', size: [2.5, 2.5, 6 * P], at: [s * (W / 2 - 2.5), T + 1.25, -2], bevel: 0.15 })
    return out
  },
  ports: () => {
    const W = 62
    const D = 25
    const out: Port[] = ([['gnd', 'GND', 'gnd'], ['oe', 'OE', 'io'], ['scl', 'SCL', 'io'], ['sda', 'SDA', 'io'], ['vcc', 'VCC', 'power'], ['vp', 'V+', 'power']] as const).map(([id, label, role], i) => ({
      id, label, kind: 'electrical' as const, pos: [-W / 2 + 2.5, 8, -2 - 2.5 * P + i * P] as Vec3, dir: [0, 1, 0] as Vec3, role, imax: 0.1,
    }))
    for (let ch = 0; ch < 16; ch++) {
      const g = Math.floor(ch / 4)
      out.push({ id: `pwm${ch}`, label: `Channel ${ch}`, kind: 'electrical', pos: [-24.5 + g * 13.5 + (ch % 4) * P, 9, D / 2 - 7.5 + 2 * P], dir: [0, 1, 0], role: 'io', imax: 0.02 })
    }
    out.push({ id: 'vterm', label: 'V+ terminal', kind: 'electrical', pos: [-2.5, 12, 13], dir: [0, 0, 1], role: 'power', imax: 10 })
    out.push({ id: 'gterm', label: 'GND terminal', kind: 'electrical', pos: [2.5, 12, 13], dir: [0, 0, 1], role: 'gnd', imax: 10 })
    return out
  },
  electrical: {
    devices: () => [
      { type: 'resistor', r: 10000, a: 'vcc', b: 'sda' },
      { type: 'resistor', r: 10000, a: 'vcc', b: 'scl' },
      { type: 'resistor', r: 10000, a: 'oe', b: 'gnd' },
      { type: 'resistor', r: 1000, a: 'vcc', b: 'gnd' },
      { type: 'short', a: 'vp', b: 'vterm' },
      { type: 'short', a: 'gnd', b: 'gterm' },
    ],
    limits: { vmax: 6 },
  },
  readouts: (p) => [
    { label: 'Channels', value: '16, 12-bit, 24 to 1526 Hz' },
    { label: 'Address', value: str(p, 'address', '0x40') },
    { label: 'Servo power', value: 'From the V+ terminal, sized for the servos' },
  ],
}

/* ================================================================== */
/* Measurement                                                         */
/* ================================================================== */

const loadCell: PartDef = {
  id: 'load-cell',
  name: 'Load cell',
  category: 'sensor',
  blurb: 'A full Wheatstone bridge whose arms move with the load',
  tags: ['load cell', 'strain gauge', 'scale', 'weight', 'force sensor', 'wheatstone', 'hx711'],
  doc: {
    price: 4,
    description:
      'An aluminium bar with four strain gauges on it, wired as a bridge. Loading it bends the bar, which stretches two gauges and compresses the other two, and the difference between the two signal wires comes out at 1 mV per volt of excitation at full scale. That is a very small signal, which is what the HX711 is for.',
  },
  params: [
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '5', group: 'Cell', options: ['1', '5', '10', '20', '50'].map((c) => ({ value: c, label: `${c} kg` })) },
    { key: 'load', label: 'Load', type: 'number', unit: 'kg', default: 0, min: 0, max: 50, step: 0.1, group: 'Reading' },
  ],
  solids: () => {
    const L = 80
    const S = 12.7
    const alu = { color: '#A9AEB5', metal: 1, rough: 0.58, density: 2.7 }
    const out: Solid[] = [
      { kind: 'box', mat: alu, size: [L, S, S], at: [0, S / 2, 0] },
      // The double hole that makes the flexure.
      ...[-1, 1].map((s): Solid => ({ kind: 'cyl', mat: DARK, r: 3.8, h: S + 0.2, rot: [90, 0, 0], at: [s * 6, S / 2, 0], seg: 20, noCollide: true })),
      { kind: 'box', mat: DARK, size: [12, 2.4, S + 0.2], at: [0, S / 2, 0], noCollide: true },
      { kind: 'box', mat: { color: '#F2F0EA', rough: 0.6, density: 1.2, name: 'Epoxy potting' }, size: [16, 1.2, 10], at: [0, S + 0.6, 0], noCollide: true },
    ]
    for (const s of [-1, 1]) for (const dx of [-3, 3]) out.push({ kind: 'cyl', mat: DARK, r: 2, h: S + 0.2, at: [s * (L / 2 - 8) + dx, S / 2, 0], seg: 12, noCollide: true })
    const cols = ['#C4262C', '#1A1C1E', '#E6E9ED', '#1F9E4B']
    cols.forEach((c, i) => {
      const z = -3 + i * 2
      out.push({ kind: 'tube', mat: { color: c, rough: 0.6, density: 1.4 }, r: 0.6, seg: 6, path: [[L / 2 - 4, S, z], [L / 2 + 12, S - 2, z], [L / 2 + 40, 1, z * 1.6]] })
    })
    return out
  },
  ports: () => {
    const L = 80
    const names: [string, string, Port['role']][] = [['ep', 'E+, red', 'power'], ['en', 'E−, black', 'gnd'], ['am', 'A−, white', 'analog'], ['ap', 'A+, green', 'analog']]
    const out: Port[] = names.map(([id, label, role], i) => ({ id, label, kind: 'electrical' as const, pos: [L / 2 + 40, 1, (-3 + i * 2) * 1.6] as Vec3, dir: [1, 0, 0] as Vec3, role, imax: 0.02 }))
    let m = 0
    for (const s of [-1, 1]) for (const dx of [-3, 3]) out.push({ id: `bolt${m++}`, label: s < 0 ? 'Fixed end, M4' : 'Load end, M4', kind: 'mechanical', pos: [s * (L / 2 - 8) + dx, 12.7, 0], dir: [0, 1, 0], mate: { type: 'thread', size: 4 }, groupId: s < 0 ? 'fixed' : 'load' })
    return out
  },
  electrical: {
    devices: (p) => {
      const cap = parseFloat(str(p, 'capacity', '5'))
      const k = Math.min(num(p, 'load', 0) / cap, 1.5)
      const R = 1000
      const d = 0.001 * k
      // Opposite arms move opposite ways, so A+ rises and A− falls by the same amount.
      return [
        { type: 'resistor', r: R * (1 - d), a: 'ep', b: 'ap' },
        { type: 'resistor', r: R * (1 + d), a: 'ap', b: 'en' },
        { type: 'resistor', r: R * (1 + d), a: 'ep', b: 'am' },
        { type: 'resistor', r: R * (1 - d), a: 'am', b: 'en' },
      ] as DeviceModel[]
    },
    limits: { vmax: 10 },
  },
  readouts: (p) => {
    const cap = parseFloat(str(p, 'capacity', '5'))
    const load = num(p, 'load', 0)
    return [
      { label: 'Sensitivity', value: '1.0 mV/V at full scale' },
      { label: 'Signal at 5 V', value: `${((Math.min(load / cap, 1.5)) * 5).toFixed(2)} mV` },
      { label: 'Loading', value: load > cap ? `Overloaded, ${Math.round((load / cap) * 100)} %` : `${Math.round((load / cap) * 100)} % of rated` },
    ]
  },
}

const hx711: PartDef = {
  id: 'amp-hx711',
  name: 'Load cell amplifier',
  category: 'module',
  blurb: 'HX711, 24-bit, turns millivolts into counts',
  tags: ['hx711', 'load cell amplifier', 'adc', '24 bit', 'scale', 'weight', 'strain gauge'],
  doc: {
    price: 1.5,
    description:
      'A 24-bit converter built for bridge sensors. It supplies the bridge from E+ and E−, reads A+ against A−, and clocks the result out on DT when SCK is pulsed. The excitation and loading are modelled here; the serial read is not decoded.',
  },
  params: [],
  solids: () => {
    const W = 34
    const D = 20
    const T = 1.6
    return [
      board(W, D, 'fr4-green', T),
      silk(W, D, [
        { t: 'text', at: [0, 1], text: 'HX711', size: 2.4, bold: true },
        { t: 'text', at: [-W / 2 + 2.6, 6], text: 'E+ E- A- A+ B- B+', size: 1, align: 'left', rot: -90 },
      ]),
      chip(6, 10, [0, T + 0.5, -2]),
      ...pinsDown(6, -W / 2 + 2.6 - 0 + 0, 0, T).map((s) => ({ ...s, rot: [0, 90, 0] as Vec3, at: [(s.at?.[2] ?? 0) - W / 2 + 2.6, s.at?.[1] ?? 0, -(s.at?.[0] ?? 0) + 6.35] as Vec3 })),
      ...pinsDown(4, -3.81, 0, T).map((s) => ({ ...s, rot: [0, 90, 0] as Vec3, at: [(s.at?.[2] ?? 0) + W / 2 - 2.6, s.at?.[1] ?? 0, -(s.at?.[0] ?? 0)] as Vec3 })),
    ]
  },
  ports: () => {
    const W = 34
    const left: [string, string, Port['role']][] = [['ep', 'E+', 'power'], ['en', 'E−', 'gnd'], ['am', 'A−', 'analog'], ['ap', 'A+', 'analog'], ['bm', 'B−', 'analog'], ['bp', 'B+', 'analog']]
    const right: [string, string, Port['role']][] = [['gnd', 'GND', 'gnd'], ['dt', 'DT', 'io'], ['sck', 'SCK', 'io'], ['vcc', 'VCC', 'power']]
    return [
      ...left.map(([id, label, role], i): Port => ({ id, label, kind: 'electrical', pos: [-W / 2 + 2.6, -8, 6.35 - i * P], dir: [0, -1, 0], role, imax: 0.05, solderable: true })),
      ...right.map(([id, label, role], i): Port => ({ id, label, kind: 'electrical', pos: [W / 2 - 2.6, -8, 3.81 - i * P], dir: [0, -1, 0], role, imax: 0.05, solderable: true })),
    ]
  },
  electrical: {
    devices: () => [
      // E+ is the chip's regulated excitation, a little under the supply.
      { type: 'resistor', r: 8, a: 'vcc', b: 'ep' },
      { type: 'short', a: 'en', b: 'gnd' },
      { type: 'resistor', r: 3300, a: 'vcc', b: 'gnd' },
      { type: 'resistor', r: 1e7, a: 'ap', b: 'gnd' },
      { type: 'resistor', r: 1e7, a: 'am', b: 'gnd' },
      { type: 'resistor', r: 100000, a: 'vcc', b: 'dt' },
    ],
    limits: { vmax: 5.5 },
  },
  readouts: () => [
    { label: 'Resolution', value: '24 bits, gain 128 on channel A' },
    { label: 'Rate', value: '10 or 80 samples a second' },
    { label: 'Full scale', value: '±20 mV at 128 gain from 5 V' },
  ],
}

const ina219: PartDef = {
  id: 'sensor-ina219',
  name: 'Current and power monitor',
  category: 'sensor',
  blurb: 'A 0.1 Ω shunt on the high side, read over I2C',
  tags: ['ina219', 'current sensor', 'power monitor', 'shunt', 'i2c', 'voltage sensor', 'wattmeter'],
  doc: {
    price: 2.5,
    description:
      'Current flows through a 0.1 Ω shunt between VIN+ and VIN−, and the chip measures the drop and the bus voltage both. The shunt is really in the circuit here, so it costs the load what it costs it in life: 100 mV at 1 A.',
  },
  params: [],
  solids: () => {
    const W = 26
    const D = 22.5
    const T = 1.6
    return [
      board(W, D, 'fr4-blue', T, [[-10, -8], [10, -8]]),
      silk(W, D, [{ t: 'text', at: [0, -3], text: 'INA219', size: 2, bold: true }]),
      chip(3, 3, [-4, T + 0.5, 2]),
      { kind: 'box', mat: { color: '#1B1E22', rough: 0.6, density: 3 }, size: [6.3, 0.8, 3.2], at: [5, T + 0.4, 2] },
      { kind: 'box', mat: { color: '#1F5FCC', rough: 0.55, density: 1.4 }, size: [7.6, 10, 7], at: [0, T + 5, -D / 2 + 3.8], bevel: 0.4 },
      ...pinsDown(6, -2.5 * P, D / 2 - 2),
    ]
  },
  ports: () => {
    const D = 22.5
    return [
      ...pinPorts([['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd'], ['scl', 'SCL', 'io'], ['sda', 'SDA', 'io'], ['vinm', 'VIN−', 'passive'], ['vinp', 'VIN+', 'passive']], -2.5 * P, D / 2 - 2),
      { id: 'tp', label: 'VIN+ terminal', kind: 'electrical', pos: [-1.9, 12, -D / 2 + 3.8], dir: [0, 1, 0], role: 'passive', imax: 3.2, groupId: 'vinp' },
      { id: 'tm', label: 'VIN− terminal', kind: 'electrical', pos: [1.9, 12, -D / 2 + 3.8], dir: [0, 1, 0], role: 'passive', imax: 3.2, groupId: 'vinm' },
    ]
  },
  electrical: {
    devices: () => [
      { type: 'resistor', r: 0.1, a: 'vinp', b: 'vinm' },
      { type: 'short', a: 'tp', b: 'vinp' },
      { type: 'short', a: 'tm', b: 'vinm' },
      { type: 'resistor', r: 10000, a: 'vcc', b: 'sda' },
      { type: 'resistor', r: 10000, a: 'vcc', b: 'scl' },
      { type: 'resistor', r: 5000, a: 'vcc', b: 'gnd' },
    ],
    limits: { vmax: 26, imax: 3.2 },
  },
  readouts: () => [
    { label: 'Shunt', value: '0.1 Ω, 100 mV at 1 A' },
    { label: 'Range', value: '±3.2 A, 0 to 26 V bus' },
    { label: 'Interface', value: 'I2C at 0x40' },
  ],
}

/* ================================================================== */
/* Radio and position                                                  */
/* ================================================================== */

const gps: PartDef = {
  id: 'gps-neo6m',
  name: 'GPS module',
  category: 'module',
  blurb: 'u-blox receiver with a ceramic patch antenna',
  tags: ['gps', 'neo-6m', 'gnss', 'u-blox', 'location', 'navigation', 'serial'],
  doc: { price: 8, description: 'A NEO-6M receiver on a carrier with its patch antenna and a backup cell, so it remembers where the satellites were and finds them again in seconds rather than minutes.' },
  params: [{ key: 'fix', label: 'Satellite fix', type: 'bool', default: true, group: 'Reading' }],
  solids: (p) => {
    const W = 36
    const D = 25
    const T = 1.6
    return [
      board(W, D, 'fr4-blue', T, [[-15, -9.5], [15, -9.5], [-15, 9.5], [15, 9.5]]),
      chip(10, 10, [-5, T + 0.5, -2]),
      { kind: 'cyl', mat: 'nickel', r: 3, h: 1.4, at: [11, T + 0.7, -6], seg: 18 },
      led([11, T + 0.3, 5], '#3C8CFF', p.fix !== false),
      ...pinsDown(4, -1.5 * P, D / 2 - 2),
      // Patch antenna, mounted on the underside as they ship.
      { kind: 'box', mat: { color: '#C9B27A', rough: 0.6, density: 3.5, name: 'Ceramic patch' }, size: [25, 4, 25], at: [0, -2, 0] },
      { kind: 'box', mat: METAL, size: [18, 0.4, 18], at: [0, -4.2, 0], noCollide: true },
    ]
  },
  ports: () => pinPorts([['vcc', 'VCC', 'power'], ['rx', 'RX', 'io'], ['tx', 'TX', 'io'], ['gnd', 'GND', 'gnd']], -1.5 * P, 25 / 2 - 2),
  electrical: { devices: () => [{ type: 'resistor', r: 110, a: 'vcc', b: 'gnd' }], limits: { vmax: 5.5 } },
  readouts: (p) => [
    { label: 'Fix', value: p.fix !== false ? 'Locked, LED blinks once a second' : 'Searching' },
    { label: 'Accuracy', value: '2.5 m in open sky' },
    { label: 'Output', value: 'NMEA at 9600 baud' },
    { label: 'Current', value: '45 mA' },
  ],
}

const nrf24: PartDef = {
  id: 'radio-nrf24l01',
  name: '2.4 GHz radio',
  category: 'module',
  blurb: 'nRF24L01 with its antenna printed on the board',
  tags: ['nrf24l01', 'nrf24', 'radio', '2.4ghz', 'wireless', 'spi', 'transceiver', 'rc'],
  doc: {
    price: 1.5,
    description:
      'A 2.4 GHz transceiver over SPI. It is a 3.3 V part and a 5 V supply destroys it, and it draws current in bursts sharp enough that nearly every build needs a 10 µF capacitor straight across its supply pins.',
  },
  params: [],
  solids: () => {
    const W = 29
    const D = 15
    const T = 1.2
    const meander: SilkItem[] = []
    for (let i = 0; i < 6; i++) meander.push({ t: 'line', from: [W / 2 - 9 + i * 1.4, -5], to: [W / 2 - 9 + i * 1.4, 5], w: 0.5 })
    return [
      board(W, D, 'fr4-green', T),
      { kind: 'silk', size: [W, D], items: meander, ink: '#C8A25A', mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 24, noCollide: true },
      chip(4, 4, [-2, T + 0.5, 0]),
      { kind: 'box', mat: METAL, size: [3.2, 0.9, 2.5], at: [4, T + 0.45, 3], noCollide: true },
      ...pinsDown(4, -W / 2 + 2.5, -1.27, T),
      ...pinsDown(4, -W / 2 + 2.5, 1.27, T),
    ]
  },
  ports: () => {
    const W = 29
    return [
      ...pinPorts([['gnd', 'GND', 'gnd'], ['ce', 'CE', 'io'], ['sck', 'SCK', 'io'], ['miso', 'MISO', 'io']], -W / 2 + 2.5, -1.27),
      ...pinPorts([['vcc', 'VCC 3.3 V', 'power'], ['csn', 'CSN', 'io'], ['mosi', 'MOSI', 'io'], ['irq', 'IRQ', 'io']], -W / 2 + 2.5, 1.27),
    ]
  },
  electrical: { devices: () => [{ type: 'resistor', r: 270, a: 'vcc', b: 'gnd' }], limits: { vmax: 3.6 } },
  readouts: () => [
    { label: 'Supply', value: '1.9 to 3.6 V. Not 5 V' },
    { label: 'Current', value: '12 mA transmitting, in bursts' },
    { label: 'Range', value: 'About 100 m in the open' },
  ],
}

const bluetooth: PartDef = {
  id: 'bluetooth-hc05',
  name: 'Bluetooth module',
  category: 'module',
  blurb: 'HC-05 serial port over the air',
  tags: ['hc-05', 'hc-06', 'bluetooth', 'serial', 'wireless', 'uart', 'spp'],
  doc: { price: 4, description: 'A classic Bluetooth serial module. The carrier regulates the supply, but RX is still a 3.3 V input and wants a divider when a 5 V board talks to it.' },
  params: [{ key: 'paired', label: 'Paired', type: 'bool', default: false, group: 'Reading' }],
  solids: () => {
    const W = 37
    const D = 16
    const T = 1.6
    return [
      board(W, D, 'fr4-blue', T),
      { kind: 'box', mat: { color: '#1F9E4B', rough: 0.55, density: 1.85 }, size: [27, 1, 13], at: [3, T + 0.5, 0] },
      { kind: 'box', mat: METAL, size: [14, 1.5, 10], at: [0, T + 1.75, 0], noCollide: true },
      led([-W / 2 + 4, T + 0.3, -4], '#FF2A18', true),
      ...pinsDown(6, -W / 2 + 2, D / 2 - 2).map((s) => s),
    ]
  },
  ports: () => pinPorts([['state', 'STATE', 'io'], ['rxd', 'RXD', 'io'], ['txd', 'TXD', 'io'], ['gnd', 'GND', 'gnd'], ['vcc', 'VCC', 'power'], ['en', 'EN', 'io']], -37 / 2 + 2, 16 / 2 - 2),
  electrical: { devices: () => [{ type: 'resistor', r: 125, a: 'vcc', b: 'gnd' }, { type: 'resistor', r: 1e6, a: 'rxd', b: 'gnd' }], limits: { vmax: 6 } },
  readouts: (p) => [
    { label: 'State', value: p.paired === true ? 'Paired, LED slow blink' : 'Waiting, LED fast blink' },
    { label: 'Default', value: '9600 baud, PIN 1234' },
  ],
}

const rfid: PartDef = {
  id: 'rfid-rc522',
  name: 'RFID reader',
  category: 'module',
  blurb: 'RC522, reads 13.56 MHz cards held over the coil',
  tags: ['rfid', 'rc522', 'mfrc522', 'nfc', 'card reader', 'mifare', 'spi', 'access control'],
  doc: { price: 2.5, description: 'An MFRC522 reader with its antenna coil etched round the board. A card has to be within a few centimetres, and it is a 3.3 V part.' },
  params: [{ key: 'card', label: 'Card present', type: 'bool', default: true, group: 'Reading' }],
  solids: (p) => {
    const W = 60
    const D = 40
    const T = 1.6
    const coil: SilkItem[] = [0, 1, 2, 3].map((i): SilkItem => ({ t: 'rect', at: [4, 1], size: [44 - i * 3, 32 - i * 3], w: 0.7, r: 3 }))
    const out: Solid[] = [
      board(W, D, 'fr4-blue', T, [[-24, -15], [24, -15], [-24, 15], [24, 15]]),
      { kind: 'silk', size: [W, D], items: coil, ink: '#C8A25A', mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 16, noCollide: true },
      chip(6, 6, [-20, T + 0.5, 0]),
      { kind: 'box', mat: METAL, size: [5, 1.2, 3], at: [-20, T + 0.6, 9], noCollide: true },
      ...pinsDown(8, -W / 2 + 3 + 0, 0).map((s) => ({ ...s, rot: [0, 90, 0] as Vec3, at: [(s.at?.[2] ?? 0) - W / 2 + 3, s.at?.[1] ?? 0, -(s.at?.[0] ?? 0) - W / 2 + 3 + 3.5 * P] as Vec3 })),
    ]
    if (p.card !== false) {
      out.push({ kind: 'box', mat: { color: '#F2F3F5', rough: 0.4, density: 1.3 }, size: [85.6, 0.8, 54], at: [6, T + 20, 0], rot: [0, 12, 0], bevel: 0.3 })
    }
    return out
  },
  ports: () => {
    const W = 60
    const names: [string, string, Port['role']][] = [['sda', 'SDA (SS)', 'io'], ['sck', 'SCK', 'io'], ['mosi', 'MOSI', 'io'], ['miso', 'MISO', 'io'], ['irq', 'IRQ', 'io'], ['gnd', 'GND', 'gnd'], ['rst', 'RST', 'io'], ['vcc', '3.3 V', 'power']]
    return names.map(([id, label, role], i): Port => ({ id, label, kind: 'electrical', pos: [-W / 2 + 3, -8, 3.5 * P - i * P], dir: [0, -1, 0], role, imax: 0.05, solderable: true }))
  },
  electrical: { devices: () => [{ type: 'resistor', r: 250, a: 'vcc', b: 'gnd' }], limits: { vmax: 3.6 } },
  readouts: (p) => [
    { label: 'Card', value: p.card !== false ? 'In the field' : 'None' },
    { label: 'Range', value: 'About 3 cm' },
    { label: 'Supply', value: '3.3 V, 13 to 26 mA' },
  ],
}

/* ================================================================== */
/* Human input                                                         */
/* ================================================================== */

const thumbstick: PartDef = {
  id: 'joystick-module',
  name: 'Thumbstick module',
  category: 'sensor',
  blurb: 'Two pots on a gimbal and a click switch',
  tags: ['joystick module', 'thumbstick', 'ky-023', 'analog stick', 'xy', 'input'],
  doc: { price: 1, description: 'The two-axis thumbstick from a game controller on a breakout. Each axis is a 10 k pot centred at half the supply, and pushing the stick down closes SW to ground.' },
  params: [
    { key: 'x', label: 'X', type: 'number', unit: '%', default: 0, min: -100, max: 100, step: 1, group: 'Control' },
    { key: 'y', label: 'Y', type: 'number', unit: '%', default: 0, min: -100, max: 100, step: 1, group: 'Control' },
    { key: 'pressed', label: 'Pressed', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const W = 26
    const D = 34
    const T = 1.6
    const x = num(p, 'x', 0) / 100
    const y = num(p, 'y', 0) / 100
    return [
      board(W, D, 'fr4-black', T, [[-9.5, -13], [9.5, -13], [-9.5, 13], [9.5, 13]]),
      { kind: 'box', mat: 'nickel', size: [16, 11, 16], at: [0, T + 5.5, -2] },
      ...[-1, 1].map((s): Solid => ({ kind: 'box', mat: { color: '#1F5FCC', rough: 0.55, density: 1.4 }, size: [10, 9, 4], at: [s * 10.5, T + 4.5, -2], rot: [0, 90, 0] })),
      {
        kind: 'group', mat: 'abs-black', at: [0, T + 11, -2], rot: [-y * 24, 0, -x * 24], children: [
          { kind: 'cyl', mat: 'abs-black', r: 2.5, h: 8, at: [0, 4 - (p.pressed === true ? 1.5 : 0), 0], seg: 12 },
          { kind: 'cyl', mat: 'rubber', r: 9, h: 6, at: [0, 9 - (p.pressed === true ? 1.5 : 0), 0], seg: 24, chamfer: 2 },
        ],
      },
      ...pinsDown(5, -2 * P, D / 2 - 2),
    ]
  },
  ports: () => pinPorts([['gnd', 'GND', 'gnd'], ['vcc', '+5V', 'power'], ['vrx', 'VRx', 'analog'], ['vry', 'VRy', 'analog'], ['sw', 'SW', 'io']], -2 * P, 34 / 2 - 2),
  electrical: {
    devices: (p) => {
      const fx = 0.5 + num(p, 'x', 0) / 200
      const fy = 0.5 + num(p, 'y', 0) / 200
      return [
        { type: 'resistor', r: 1 + 10000 * (1 - fx), a: 'vcc', b: 'vrx' },
        { type: 'resistor', r: 1 + 10000 * fx, a: 'vrx', b: 'gnd' },
        { type: 'resistor', r: 1 + 10000 * (1 - fy), a: 'vcc', b: 'vry' },
        { type: 'resistor', r: 1 + 10000 * fy, a: 'vry', b: 'gnd' },
        { type: 'switch', a: 'sw', b: 'gnd', closed: p.pressed === true, ron: 0.2, roff: 1e9 },
      ] as DeviceModel[]
    },
    limits: { vmax: 5.5 },
  },
  readouts: (p) => [
    { label: 'VRx at 5 V', value: `${(2.5 + num(p, 'x', 0) / 40).toFixed(2)} V` },
    { label: 'VRy at 5 V', value: `${(2.5 + num(p, 'y', 0) / 40).toFixed(2)} V` },
    { label: 'SW', value: p.pressed === true ? 'Closed to ground' : 'Open, needs a pull-up' },
  ],
}

const tftDisplay: PartDef = {
  id: 'display-tft',
  name: 'TFT display',
  category: 'display',
  blurb: '2.8 in colour panel with an SD slot on the back',
  tags: ['tft', 'ili9341', 'lcd', 'colour display', 'spi display', 'touchscreen', '2.8 inch', '320x240'],
  doc: {
    price: 9,
    description:
      'An ILI9341 colour panel, 320 by 240, over SPI. The backlight is a real LED load on the LED pin. The SPI traffic itself is not decoded here, so the panel shows whether it is lit rather than what a sketch would draw on it.',
  },
  params: [{ key: 'lit', label: 'Backlight on', type: 'bool', default: true, group: 'Display' }],
  solids: (p) => {
    const W = 86
    const D = 50
    const T = 1.6
    return [
      board(W, D, 'fr4-red', T, [[-40, -21], [40, -21], [-40, 21], [40, 21]]),
      { kind: 'box', mat: { color: '#0A0C10', rough: 0.15, clearcoat: 0.8, density: 2.5 }, size: [70, 3.5, 50], at: [-3, T + 1.75, 0] },
      {
        kind: 'box', mat: { color: '#070A0E', rough: 0.1, density: 2.5, emissive: '#3B6FD0', emissiveIntensity: p.lit === false ? 0 : 0.6 },
        size: [57.6, 0.4, 43.2], at: [-3, T + 3.6, 0], noCollide: true,
      },
      { kind: 'box', mat: METAL, size: [26, 2.5, 26], at: [0, -1.25, 0] },
      ...pinsDown(14, 0, 0).map((s) => ({ ...s, rot: [0, 90, 0] as Vec3, at: [(s.at?.[2] ?? 0) + W / 2 - 3, s.at?.[1] ?? 0, -(s.at?.[0] ?? 0) + 6.5 * P] as Vec3 })),
    ]
  },
  ports: () => {
    const W = 86
    const names: [string, string, Port['role']][] = [
      ['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd'], ['cs', 'CS', 'io'], ['reset', 'RESET', 'io'], ['dc', 'DC', 'io'], ['mosi', 'SDI', 'io'], ['sck', 'SCK', 'io'],
      ['led', 'LED', 'power'], ['miso', 'SDO', 'io'], ['tclk', 'T_CLK', 'io'], ['tcs', 'T_CS', 'io'], ['tdin', 'T_DIN', 'io'], ['tdo', 'T_DO', 'io'], ['tirq', 'T_IRQ', 'io'],
    ]
    return names.map(([id, label, role], i): Port => ({ id, label, kind: 'electrical', pos: [W / 2 - 3, -8, 6.5 * P - i * P], dir: [0, -1, 0], role, imax: 0.1, solderable: true }))
  },
  electrical: {
    devices: () => [
      { type: 'resistor', r: 450, a: 'vcc', b: 'gnd' },
      // Backlight: four white LEDs in parallel behind a small resistor.
      { type: 'resistor', r: 3.9, a: 'led', b: '#bl' },
      { type: 'diode', a: '#bl', c: 'gnd', vf: 2.9, n: 2, rs: 2 },
    ],
    limits: { vmax: 5.5 },
  },
  readouts: () => [
    { label: 'Resolution', value: '320 x 240, 262 000 colours' },
    { label: 'Controller', value: 'ILI9341, SPI' },
    { label: 'Backlight', value: 'About 60 mA from the LED pin' },
  ],
}

const microphone = analogModule({
  id: 'sensor-microphone', name: 'Microphone module', blurb: 'Electret capsule with a gain pot and an amplifier',
  tags: ['microphone', 'max4466', 'sound sensor', 'audio', 'electret', 'mic', 'clap'],
  price: 2, readingLabel: 'Sound level', w: 20, d: 14, mask: 'fr4-blue', legend: 'MAX4466',
  description: 'An electret microphone behind an adjustable amplifier. The output idles at half the supply and swings either side of it with sound.',
  body: () => [
    { kind: 'cyl', mat: 'nickel', r: 4.9, h: 6.7, at: [-4, 1.6 + 3.35, -1], seg: 22 },
    { kind: 'cyl', mat: { color: '#1A1C1E', rough: 0.95, density: 0.3 }, r: 4.3, h: 0.3, at: [-4, 1.6 + 6.8, -1], seg: 22, noCollide: true },
    { kind: 'box', mat: { color: '#1F5FCC', rough: 0.55, density: 1.4 }, size: [4.8, 4.5, 4.8], at: [5, 1.6 + 2.25, -1], bevel: 0.3 },
  ],
})

const gasSensorMq2 = analogModule({
  id: 'sensor-gas-mq2', name: 'Gas sensor', blurb: 'MQ-2 heated element behind a steel mesh cap',
  tags: ['gas sensor', 'mq-2', 'mq2', 'smoke', 'lpg', 'methane', 'air quality'],
  price: 2, readingLabel: 'Gas concentration', w: 32, d: 22, mask: 'fr4-blue', legend: 'MQ-2',
  description: 'A tin oxide element on a heater. It needs a minute or two to warm up before it reads anything, and the heater alone draws about 150 mA, which is more than a board pin will give it.',
  extraPins: [['do', 'DO', 'io']],
  body: () => [
    { kind: 'cyl', mat: 'abs-black', r: 9.5, h: 3, at: [0, 1.6 + 1.5, -2], seg: 28 },
    { kind: 'cyl', mat: { color: '#9EA3AA', metal: 0.8, rough: 0.8, density: 1.5, name: 'Stainless mesh' }, r: 8.5, h: 11, at: [0, 1.6 + 8.5, -2], seg: 28 },
    { kind: 'cyl', mat: { color: '#D8A814', rough: 0.4, density: 1.2 }, r: 1.2, h: 0.4, at: [0, 1.6 + 14.2, -2], seg: 12, noCollide: true },
  ],
})

const waterLevel = analogModule({
  id: 'sensor-water-level', name: 'Water level sensor', blurb: 'Exposed traces that conduct more the deeper they go',
  tags: ['water level', 'water sensor', 'rain', 'liquid level', 'flood', 'moisture'],
  price: 0.8, readingLabel: 'Depth', w: 20, d: 62, mask: 'fr4-red', legend: 'WATER',
  description: 'Interleaved bare traces with a transistor reading the leakage between them. Left powered in water, the traces corrode within days, so it is best switched on only to take a reading.',
  body: () => {
    const out: Solid[] = []
    for (let i = 0; i < 10; i++) out.push({ kind: 'box', mat: 'copper-bare', size: [14, 0.1, 1], at: [0, 1.66, -26 + i * 4], noCollide: true })
    return out
  },
})

/* ================================================================== */
/* Batteries                                                           */
/* ================================================================== */

/** Open-circuit voltage of a lithium cell against state of charge, 0 to 1. */
const liCell = (soc: number): number => {
  const s = Math.min(Math.max(soc, 0), 1)
  return s < 0.1 ? 3.0 + s * 5 : 3.5 + 0.7 * Math.pow((s - 0.1) / 0.9, 0.9)
}

const lipo: PartDef = {
  id: 'battery-lipo',
  name: 'LiPo pack',
  category: 'power',
  blurb: 'Series cells in shrink wrap, XT60 and a balance lead',
  tags: ['lipo', 'lithium polymer', 'battery pack', '3s', '4s', 'rc battery', 'drone battery', 'xt60'],
  doc: {
    price: 30,
    description:
      'Lithium polymer cells in series. Each cell is 4.2 V full and should not go below about 3.3 V under load; the balance lead is what lets a charger see every cell. The C rating times the capacity is the current it will give before it sags badly.',
  },
  params: [
    { key: 'cells', label: 'Cells', type: 'enum', default: '3', group: 'Pack', options: ['1', '2', '3', '4', '6'].map((c) => ({ value: c, label: `${c}S` })) },
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '2200', group: 'Pack', options: ['850', '1300', '2200', '5000', '10000'].map((c) => ({ value: c, label: `${c} mAh` })) },
    { key: 'crate', label: 'C rating', type: 'enum', default: '50', group: 'Pack', options: ['25', '50', '100'].map((c) => ({ value: c, label: `${c}C` })) },
    { key: 'charge', label: 'Charge', type: 'number', unit: '%', default: 90, min: 0, max: 100, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'cells', '3'), 10) || 3
    const cap = parseInt(str(p, 'capacity', '2200'), 10) || 2200
    const k = Math.cbrt(cap / 2200)
    const L = 105 * k
    const W = 34 * k
    const H = n * 8.5 * k
    const wrap = { color: '#1F4FA8', rough: 0.35, clearcoat: 0.5, density: 2.1, name: 'Shrink wrap' }
    const out: Solid[] = [
      { kind: 'box', mat: wrap, size: [L, H, W], at: [0, H / 2, 0], bevel: Math.min(3, H / 4) },
      {
        kind: 'silk', size: [L - 10, W - 6], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, H + 0.02, 0], px: 10, noCollide: true,
        items: [
          { t: 'text', at: [0, 5], text: `${cap} mAh  ${n}S`, size: 5, bold: true },
          { t: 'text', at: [0, -5], text: `${(n * 3.7).toFixed(1)} V  ${str(p, 'crate', '50')}C`, size: 4 },
        ],
      },
    ]
    // Main leads to an XT60, balance lead to a JST-XH.
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'tube', mat: { color: s > 0 ? '#C4262C' : '#1A1C1E', rough: 0.8, density: 1.2 }, r: 1.6, seg: 8, path: [[L / 2, H / 2, s * 4], [L / 2 + 25, H / 2, s * 6], [L / 2 + 50, 5, s * 5]] })
    }
    out.push({ kind: 'box', mat: { color: '#E0B200', rough: 0.5, density: 1.4 }, size: [16, 8, 16], at: [L / 2 + 58, 5, 0], bevel: 1 })
    for (let i = 0; i <= n; i++) {
      out.push({ kind: 'tube', mat: { color: i === 0 ? '#1A1C1E' : '#C4262C', rough: 0.6, density: 1.2 }, r: 0.5, seg: 6, path: [[-L / 2, H / 2, -W / 4 + i * 1.2], [-L / 2 - 30, H / 2 - 2, -W / 4 + i * 1.2], [-L / 2 - 50, 3, -W / 4 + i * 1.2]] })
    }
    out.push({ kind: 'box', mat: { color: '#E8EAEC', rough: 0.55, density: 1.2 }, size: [6, 5, (n + 1) * 2.5 + 1], at: [-L / 2 - 53, 3, -W / 4 + (n * 1.2) / 2], bevel: 0.3 })
    return out
  },
  ports: (p) => {
    const n = parseInt(str(p, 'cells', '3'), 10) || 3
    const k = Math.cbrt((parseInt(str(p, 'capacity', '2200'), 10) || 2200) / 2200)
    const L = 105 * k
    const W = 34 * k
    const out: Port[] = [
      { id: 'p', label: 'XT60 +', kind: 'electrical', pos: [L / 2 + 66, 5, 3.6], dir: [1, 0, 0], role: 'power', imax: 100 },
      { id: 'n', label: 'XT60 −', kind: 'electrical', pos: [L / 2 + 66, 5, -3.6], dir: [1, 0, 0], role: 'gnd', imax: 100 },
    ]
    for (let i = 0; i <= n; i++) {
      out.push({ id: `bal${i}`, label: i === 0 ? 'Balance, 0 V' : `Balance, cell ${i}`, kind: 'electrical', pos: [-L / 2 - 56, 3, -W / 4 + i * 2.5], dir: [-1, 0, 0], role: 'passive', imax: 1 })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const n = parseInt(str(p, 'cells', '3'), 10) || 3
      const cap = parseInt(str(p, 'capacity', '2200'), 10) || 2200
      const c = parseInt(str(p, 'crate', '50'), 10) || 50
      const v = liCell(num(p, 'charge', 90) / 100)
      // Internal resistance per cell that gives about a 10 % sag at the C rating.
      const rCell = (v * 0.1) / ((cap / 1000) * c)
      const out: DeviceModel[] = []
      for (let i = 0; i < n; i++) {
        out.push({ type: 'vsource', v, a: `bal${i + 1}`, b: `bal${i}`, rint: rCell })
      }
      out.push({ type: 'short', a: 'n', b: 'bal0' })
      out.push({ type: 'short', a: 'p', b: `bal${n}` })
      return out
    },
    supplies: ['p'],
  },
  mass: (p) => ((parseInt(str(p, 'capacity', '2200'), 10) || 2200) * (parseInt(str(p, 'cells', '3'), 10) || 3)) / 44,
  price: (p) => ((parseInt(str(p, 'capacity', '2200'), 10) || 2200) * (parseInt(str(p, 'cells', '3'), 10) || 3)) / 220,
  readouts: (p) => {
    const n = parseInt(str(p, 'cells', '3'), 10) || 3
    const cap = parseInt(str(p, 'capacity', '2200'), 10) || 2200
    const c = parseInt(str(p, 'crate', '50'), 10) || 50
    const v = liCell(num(p, 'charge', 90) / 100)
    return [
      { label: 'Pack voltage', value: `${(v * n).toFixed(2)} V, ${v.toFixed(2)} V a cell` },
      { label: 'Energy', value: `${((n * 3.7 * cap) / 1000).toFixed(1)} Wh` },
      { label: 'Continuous', value: `${Math.round((cap / 1000) * c)} A` },
      { label: 'Stop discharging at', value: `${(n * 3.3).toFixed(1)} V under load` },
    ]
  },
}

const cell18650: PartDef = {
  id: 'battery-18650',
  name: '18650 cell',
  category: 'power',
  blurb: 'One lithium-ion cylinder, 3.0 to 4.2 V',
  tags: ['18650', 'lithium ion', 'li-ion', 'cell', 'battery', 'rechargeable', '21700'],
  doc: { price: 5, description: 'A single 18 by 65 mm lithium-ion cell. The flat end is negative. A protected cell has a small circuit under the wrap that cuts out before it is damaged; a bare one does not.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: '18650', group: 'Cell', options: [{ value: '18650', label: '18650, 3000 mAh' }, { value: '21700', label: '21700, 5000 mAh' }] },
    { key: 'charge', label: 'Charge', type: 'number', unit: '%', default: 80, min: 0, max: 100, step: 1, group: 'Control' },
    { key: 'wrap', label: 'Wrap', type: 'enum', default: 'blue', group: 'Cell', options: [{ value: 'blue', label: 'Blue' }, { value: 'green', label: 'Green' }, { value: 'purple', label: 'Purple' }] },
  ],
  solids: (p) => {
    const big = str(p, 'size', '18650') === '21700'
    const r = big ? 10.5 : 9.1
    const L = big ? 70 : 65
    const wraps: Record<string, string> = { blue: '#1F4FA8', green: '#1F7A3C', purple: '#5B2F8C' }
    return [
      { kind: 'cyl', mat: { color: wraps[str(p, 'wrap', 'blue')] ?? wraps.blue, rough: 0.35, clearcoat: 0.6, density: 2.7 }, r, h: L - 1, rot: [0, 0, 90], at: [0, r, 0], seg: 32, chamfer: 0.8 },
      { kind: 'cyl', mat: 'nickel', r: r * 0.85, h: 0.8, rot: [0, 0, 90], at: [L / 2 - 0.2, r, 0], seg: 28 },
      { kind: 'cyl', mat: 'nickel', r: r * 0.4, h: 1.5, rot: [0, 0, 90], at: [L / 2 + 0.6, r, 0], seg: 20 },
      { kind: 'cyl', mat: 'nickel', r: r * 0.9, h: 0.6, rot: [0, 0, 90], at: [-L / 2 + 0.2, r, 0], seg: 28 },
    ]
  },
  ports: (p) => {
    const big = str(p, 'size', '18650') === '21700'
    const r = big ? 10.5 : 9.1
    const L = big ? 70 : 65
    return [
      { id: 'p', label: 'Positive (+)', kind: 'electrical', pos: [L / 2 + 1.4, r, 0], dir: [1, 0, 0], role: 'power', imax: big ? 30 : 20 },
      { id: 'n', label: 'Negative (−)', kind: 'electrical', pos: [-L / 2 - 0.2, r, 0], dir: [-1, 0, 0], role: 'gnd', imax: big ? 30 : 20 },
    ]
  },
  electrical: {
    devices: (p) => [{ type: 'vsource', v: liCell(num(p, 'charge', 80) / 100), a: 'p', b: 'n', rint: str(p, 'size', '18650') === '21700' ? 0.018 : 0.03 }],
    supplies: ['p'],
  },
  mass: (p) => (str(p, 'size', '18650') === '21700' ? 69 : 47),
  readouts: (p) => [
    { label: 'Voltage', value: `${liCell(num(p, 'charge', 80) / 100).toFixed(2)} V` },
    { label: 'Capacity', value: str(p, 'size', '18650') === '21700' ? '5000 mAh' : '3000 mAh' },
    { label: 'Internal resistance', value: str(p, 'size', '18650') === '21700' ? '18 mΩ' : '30 mΩ' },
  ],
}

const coinCell: PartDef = {
  id: 'battery-coin',
  name: 'Coin cell holder',
  category: 'power',
  blurb: 'CR2032 in a through-hole clip',
  tags: ['coin cell', 'cr2032', 'button cell', 'battery holder', 'rtc battery', '3v'],
  doc: { price: 0.6, description: 'A 3 V lithium coin cell in its holder. The internal resistance is high enough that it cannot light an LED at any real brightness; it is for clocks and memory, drawing microamps for years.' },
  params: [{ key: 'fitted', label: 'Cell fitted', type: 'bool', default: true, group: 'Holder' }],
  solids: (p) => {
    const out: Solid[] = [
      { kind: 'cyl', mat: 'abs-black', r: 11, h: 3, at: [0, 1.5, 0], seg: 32 },
      { kind: 'box', mat: 'abs-black', size: [8, 3, 6], at: [11, 1.5, 0] },
      { kind: 'box', mat: 'nickel', size: [20, 0.4, 5], at: [2, 6.6, 0], rot: [0, 0, 4] },
      ...[-1, 1].map((s): Solid => ({ kind: 'box', mat: 'tin', size: [0.6, 4, 0.9], at: [s * 10, -1.5, s * 6] })),
    ]
    if (p.fitted !== false) out.push({ kind: 'cyl', mat: METAL, r: 10, h: 3.2, at: [0, 4.6, 0], seg: 32, chamfer: 0.3 })
    return out
  },
  ports: () => [
    { id: 'p', label: 'Positive (+)', kind: 'electrical', pos: [10, -3.4, 6], dir: [0, -1, 0], role: 'power', imax: 0.003, solderable: true },
    { id: 'n', label: 'Negative (−)', kind: 'electrical', pos: [-10, -3.4, -6], dir: [0, -1, 0], role: 'gnd', imax: 0.003, solderable: true },
  ],
  electrical: {
    devices: (p) => (p.fitted !== false ? [{ type: 'vsource' as const, v: 3.0, a: 'p', b: 'n', rint: 15 }] : [{ type: 'resistor' as const, r: 1e9, a: 'p', b: 'n' }]),
    supplies: ['p'],
  },
  readouts: () => [
    { label: 'Cell', value: 'CR2032, 3 V, 220 mAh' },
    { label: 'Internal resistance', value: '15 Ω and rising as it drains' },
  ],
}

const solarPanel: PartDef = {
  id: 'solar-panel',
  name: 'Solar panel',
  category: 'power',
  blurb: 'Monocrystalline cells in an aluminium frame',
  tags: ['solar panel', 'photovoltaic', 'pv', 'solar', 'renewable', 'off grid', 'charging'],
  doc: {
    price: 60,
    description:
      'Thirty-six cells in series, which is why a "12 V" panel reads about 21 V open circuit. The current it can give follows the sunlight; the voltage barely does, until it is almost dark.',
  },
  params: [
    { key: 'watts', label: 'Rating', type: 'enum', default: '50', group: 'Panel', options: ['5', '10', '20', '50', '100'].map((w) => ({ value: w, label: `${w} W` })) },
    { key: 'sun', label: 'Sunlight', type: 'number', unit: '%', default: 100, min: 0, max: 100, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const w = parseFloat(str(p, 'watts', '50'))
    const s = Math.sqrt(w / 100)
    const L = 1000 * s
    const D = 670 * s
    const out: Solid[] = [
      { kind: 'extrude', mat: 'alu-6063', profile: { outline: roundRect(L, D, 2, 0, 0, 2), holes: [roundRect(L - 30 * s, D - 30 * s, 1, 0, 0, 2)] }, depth: 30 * s, rot: [-90, 0, 0], at: [0, 15 * s, 0] },
      { kind: 'box', mat: { color: '#101A33', rough: 0.2, clearcoat: 1, density: 2.5, name: 'Glass over cells' }, size: [L - 30 * s, 4, D - 30 * s], at: [0, 26 * s, 0] },
    ]
    const cols = 9
    const rows = 4
    const cw = (L - 50 * s) / cols
    const cd = (D - 50 * s) / rows
    const lines: SilkItem[] = []
    for (let c = 0; c <= cols; c++) lines.push({ t: 'line', from: [-(L - 50 * s) / 2 + c * cw, -(D - 50 * s) / 2], to: [-(L - 50 * s) / 2 + c * cw, (D - 50 * s) / 2], w: 3 * s })
    for (let r = 0; r <= rows; r++) lines.push({ t: 'line', from: [-(L - 50 * s) / 2, -(D - 50 * s) / 2 + r * cd], to: [(L - 50 * s) / 2, -(D - 50 * s) / 2 + r * cd], w: 3 * s })
    for (let c = 0; c < cols; c++) {
      for (const f of [0.33, 0.66]) {
        const x = -(L - 50 * s) / 2 + (c + f) * cw
        lines.push({ t: 'line', from: [x, -(D - 50 * s) / 2], to: [x, (D - 50 * s) / 2], w: 1.2 * s })
      }
    }
    out.push({ kind: 'silk', size: [L - 50 * s, D - 50 * s], items: lines, ink: '#B8BEC6', mat: 'silkscreen', rot: [-90, 0, 0], at: [0, 28.2 * s, 0], px: Math.max(0.6, 3 / s), noCollide: true })
    out.push({ kind: 'box', mat: 'abs-black', size: [80 * s, 18 * s, 60 * s], at: [0, 6 * s, -D * 0.3] })
    for (const sx of [-1, 1] as const) {
      out.push({ kind: 'tube', mat: 'abs-black', r: 3, seg: 8, path: [[sx * 30 * s, 6 * s, -D * 0.3 - 30 * s], [sx * 60 * s, 4, -D / 2 - 40], [sx * 80 * s, 4, -D / 2 - 120]] })
    }
    return out
  },
  ports: (p) => {
    const s = Math.sqrt(parseFloat(str(p, 'watts', '50')) / 100)
    const D = 670 * s
    return [
      { id: 'p', label: 'MC4 +', kind: 'electrical', pos: [80 * s, 4, -D / 2 - 120], dir: [0, 0, -1], role: 'power', imax: 10 },
      { id: 'n', label: 'MC4 −', kind: 'electrical', pos: [-80 * s, 4, -D / 2 - 120], dir: [0, 0, -1], role: 'gnd', imax: 10 },
      { id: 'frame', label: 'Frame', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      const w = parseFloat(str(p, 'watts', '50'))
      const sun = num(p, 'sun', 100) / 100
      const voc = 21.6
      const vmp = 18
      const imp = w / vmp
      // Voltage holds up with light until it is nearly dark; the current it
      // can give falls in proportion, which is what the rising resistance does.
      const v = sun < 0.01 ? 0.1 : voc * (0.86 + 0.14 * Math.pow(sun, 0.3))
      const r = (voc - vmp) / imp / Math.max(sun, 0.02)
      return [{ type: 'vsource', v, a: 'p', b: 'n', rint: r }]
    },
    supplies: ['p'],
  },
  mass: (p) => parseFloat(str(p, 'watts', '50')) * 75 + 400,
  readouts: (p) => {
    const w = parseFloat(str(p, 'watts', '50'))
    const sun = num(p, 'sun', 100) / 100
    return [
      { label: 'Open circuit', value: '21.6 V' },
      { label: 'At maximum power', value: `18 V, ${(w / 18).toFixed(2)} A` },
      { label: 'Now', value: `About ${Math.round(w * sun)} W` },
      { label: 'Size', value: `${Math.round(1000 * Math.sqrt(w / 100))} x ${Math.round(670 * Math.sqrt(w / 100))} mm` },
    ]
  },
}

/* ================================================================== */
/* Drone parts                                                         */
/* ================================================================== */

const MOTORS: Record<string, { r: number; h: number; label: string; mount: number; shaft: number; mass: number }> = {
  '2212': { r: 14, h: 26, label: '2212', mount: 16, shaft: 3.17, mass: 55 },
  '2306': { r: 14.2, h: 18, label: '2306', mount: 16, shaft: 5, mass: 33 },
  '5010': { r: 29, h: 26, label: '5010', mount: 25, shaft: 4, mass: 110 },
}

const brushlessMotor: PartDef = {
  id: 'motor-brushless',
  name: 'Brushless motor',
  category: 'motion',
  blurb: 'Outrunner: the bell spins, the windings stay put',
  tags: ['brushless motor', 'bldc', 'outrunner', 'drone motor', '2212', '2306', 'kv', 'quadcopter'],
  doc: {
    price: 14,
    description:
      'An outrunner with the magnets in the spinning bell and the windings on a fixed stator. The kV rating is the no-load speed per volt, so a 920 kV motor on a 3S pack spins at about 10 000 rpm unloaded. It needs an ESC; wired straight to a battery it just gets hot.',
  },
  params: [
    { key: 'size', label: 'Frame', type: 'enum', default: '2212', group: 'Motor', options: Object.keys(MOTORS).map((m) => ({ value: m, label: m })) },
    { key: 'kv', label: 'kV', type: 'number', unit: 'rpm/V', default: 920, min: 300, max: 2800, step: 10, group: 'Motor' },
  ],
  solids: (p) => {
    const m = MOTORS[str(p, 'size', '2212')] ?? MOTORS['2212']
    const out: Solid[] = [
      // Mounting cross on the base.
      { kind: 'box', mat: 'alu-anod-black', size: [m.mount + 8, 3, 6], at: [0, 1.5, 0], bevel: 1 },
      { kind: 'box', mat: 'alu-anod-black', size: [6, 3, m.mount + 8], at: [0, 1.5, 0], bevel: 1 },
      { kind: 'cyl', mat: 'alu-anod-black', r: m.r * 0.55, h: 5, at: [0, 5.5, 0], seg: 24 },
      // Stator windings, glimpsed below the bell.
      { kind: 'cyl', mat: { color: '#B5652E', metal: 0.8, rough: 0.4, density: 8.9, name: 'Copper windings' }, r: m.r * 0.82, h: 4, at: [0, 9, 0], seg: 24 },
      // Bell with its cooling cut-outs.
      { kind: 'cyl', mat: { color: '#C4262C', metal: 0.7, rough: 0.35, density: 2.7 }, r: m.r, h: m.h - 10, at: [0, 11 + (m.h - 10) / 2, 0], seg: 36, chamfer: 1 },
    ]
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      out.push({ kind: 'box', mat: DARK, size: [m.r * 0.5, 0.4, 3], at: [Math.cos(a) * m.r * 0.5, 11 + (m.h - 10) + 0.1, Math.sin(a) * m.r * 0.5], rot: [0, (-a * 180) / Math.PI, 0], noCollide: true })
    }
    out.push({ kind: 'cyl', mat: 'steel', r: m.shaft / 2 + 1.5, h: 8, at: [0, m.h + 5, 0], seg: 16 })
    out.push({ kind: 'cyl', mat: 'alu-6063', r: m.shaft / 2 + 2.5, h: 4, at: [0, m.h + 10, 0], seg: 6 })
    ;['#1A1C1E', '#1A1C1E', '#1A1C1E'].forEach((c, i) => {
      out.push({ kind: 'tube', mat: { color: c, rough: 0.6, density: 1.2 }, r: 0.9, seg: 6, path: [[m.r * 0.6, 4, -2 + i * 2], [m.r + 20, 3, -3 + i * 3], [m.r + 50, 2, -4 + i * 4]] })
    })
    return out
  },
  ports: (p) => {
    const m = MOTORS[str(p, 'size', '2212')] ?? MOTORS['2212']
    const out: Port[] = (['a', 'b', 'c'] as const).map((id, i) => ({ id, label: `Phase ${id.toUpperCase()}`, kind: 'electrical' as const, pos: [m.r + 50, 2, -4 + i * 4] as Vec3, dir: [1, 0, 0] as Vec3, role: 'power' as const, imax: 30 }))
    out.push({ id: 'shaft', label: 'Prop shaft', kind: 'mechanical', pos: [0, m.h + 12, 0], dir: [0, 1, 0], mate: { type: 'stud', size: 5 } })
    let i = 0
    for (const [x, z] of [[m.mount / 2, 0], [-m.mount / 2, 0], [0, m.mount / 2], [0, -m.mount / 2]]) {
      out.push({ id: `mount${i++}`, label: 'M3 mount', kind: 'mechanical', pos: [x, 0, z], dir: [0, -1, 0], mate: { type: 'thread', size: 3 }, groupId: 'mounts' })
    }
    return out
  },
  electrical: {
    // Three windings in a star, each a tenth of an ohm or so.
    devices: () => [
      { type: 'resistor', r: 0.09, a: 'a', b: '#star' },
      { type: 'resistor', r: 0.09, a: 'b', b: '#star' },
      { type: 'resistor', r: 0.09, a: 'c', b: '#star' },
    ],
  },
  mass: (p) => (MOTORS[str(p, 'size', '2212')] ?? MOTORS['2212']).mass,
  readouts: (p) => {
    const kv = num(p, 'kv', 920)
    return [
      { label: 'On 3S, unloaded', value: `${Math.round(kv * 11.1).toLocaleString('en-GB')} rpm` },
      { label: 'On 4S, unloaded', value: `${Math.round(kv * 14.8).toLocaleString('en-GB')} rpm` },
      { label: 'Torque constant', value: `${(9.55 / kv * 1000).toFixed(1)} mNm per amp` },
    ]
  },
}

const propeller: PartDef = {
  id: 'propeller',
  name: 'Propeller',
  category: 'motion',
  blurb: 'Two or three blades, sized in inches by diameter and pitch',
  tags: ['propeller', 'prop', 'drone', 'quadcopter', 'rc', 'blade', '1045', '5 inch'],
  doc: { price: 1, description: 'A moulded propeller. A 10 x 4.5 is ten inches across and would move four and a half inches forward per turn through a solid medium, which air is not, so it is only a rough guide to speed.' },
  params: [
    { key: 'dia', label: 'Diameter', type: 'number', unit: 'in', default: 10, min: 3, max: 15, step: 0.5, group: 'Prop' },
    { key: 'pitch', label: 'Pitch', type: 'number', unit: 'in', default: 4.5, min: 2, max: 8, step: 0.1, group: 'Prop' },
    { key: 'blades', label: 'Blades', type: 'enum', default: '2', group: 'Prop', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }] },
    { key: 'color', label: 'Colour', type: 'enum', default: 'black', group: 'Prop', options: [{ value: 'black', label: 'Black' }, { value: 'orange', label: 'Orange' }, { value: 'clear', label: 'Clear' }] },
  ],
  solids: (p) => {
    const R = (num(p, 'dia', 10) * 25.4) / 2
    const n = parseInt(str(p, 'blades', '2'), 10) || 2
    const pitchIn = num(p, 'pitch', 4.5)
    const cols: Record<string, object> = {
      black: { color: '#17191C', rough: 0.45, density: 1.2 },
      orange: { color: '#E07A1E', rough: 0.4, density: 1.2 },
      clear: { color: '#DDE8EE', rough: 0.2, opacity: 0.6, transmission: 0.5, density: 1.2 },
    }
    const mat = (cols[str(p, 'color', 'black')] ?? cols.black) as never
    // Blade angle at 70 % radius from the pitch: atan(pitch / (2 pi r)).
    const angle = (Math.atan((pitchIn * 25.4) / (2 * Math.PI * R * 0.7)) * 180) / Math.PI
    const chord = R * 0.16
    const outline: Vec2[] = []
    const steps = 12
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = 8 + t * (R - 8)
      const c = chord * (0.55 + Math.sin(t * Math.PI) * 0.6) * (1 - t * 0.35)
      outline.push([x, c / 2])
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps
      const x = 8 + t * (R - 8)
      const c = chord * (0.55 + Math.sin(t * Math.PI) * 0.6) * (1 - t * 0.35)
      outline.push([x, -c / 2])
    }
    const out: Solid[] = [
      { kind: 'cyl', mat, r: 8, h: 9, at: [0, 4.5, 0], seg: 24, chamfer: 1 },
      { kind: 'cyl', mat: DARK, r: 2.6, h: 9.4, at: [0, 4.5, 0], seg: 14, noCollide: true },
    ]
    for (let b = 0; b < n; b++) {
      out.push({
        kind: 'group', mat, at: [0, 5, 0], rot: [0, (b * 360) / n, 0], children: [
          { kind: 'group', mat, at: [0, 0, 0], rot: [angle, 0, 0], children: [
            { kind: 'extrude', mat, profile: { outline }, depth: 1.6, rot: [-90, 0, 0], at: [0, 0, 0] },
          ] },
        ],
      })
    }
    return out
  },
  ports: () => [{ id: 'bore', label: 'Hub bore', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: 5 } }],
  readouts: (p) => {
    const d = num(p, 'dia', 10)
    const pitch = num(p, 'pitch', 4.5)
    return [
      { label: 'Size', value: `${d} x ${pitch}` },
      { label: 'Tip speed at 8000 rpm', value: `${Math.round(((d * 0.0254 * Math.PI) * 8000) / 60)} m/s` },
      { label: 'Pitch speed at 8000 rpm', value: `${Math.round(((pitch * 0.0254 * 8000) / 60) * 3.6)} km/h` },
    ]
  },
}

const esc: PartDef = {
  id: 'esc-brushless',
  name: 'Brushless ESC',
  category: 'module',
  blurb: 'Battery in, three phases out, throttle on a servo lead',
  tags: ['esc', 'electronic speed controller', 'brushless', 'drone', 'rc', '30a', 'bec'],
  doc: { price: 12, description: 'A speed controller for one brushless motor. It reads a servo-style pulse, 1 to 2 ms, and commutates the three phases in turn. Its current rating wants to comfortably exceed what the motor and prop actually draw.' },
  params: [{ key: 'amps', label: 'Rating', type: 'enum', default: '30', group: 'ESC', options: ['20', '30', '40', '60'].map((a) => ({ value: a, label: `${a} A` })) }],
  solids: (p) => {
    const a = parseFloat(str(p, 'amps', '30'))
    const L = 40 + a * 0.4
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1F4FA8', rough: 0.35, clearcoat: 0.5, density: 2 }, size: [L, 9, 24], at: [0, 4.5, 0], bevel: 2.5 },
      { kind: 'silk', size: [L - 6, 18], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, 9.02, 0], px: 14, noCollide: true, items: [{ t: 'text', at: [0, 2], text: `${a}A ESC`, size: 4, bold: true }, { t: 'text', at: [0, -4], text: '2-4S  BEC 5V', size: 2.2 }] },
    ]
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'tube', mat: { color: s > 0 ? '#C4262C' : '#1A1C1E', rough: 0.8, density: 1.2 }, r: 1.5, seg: 8, path: [[-L / 2, 4.5, s * 4], [-L / 2 - 30, 4, s * 5], [-L / 2 - 60, 3, s * 5]] })
    }
    for (let i = 0; i < 3; i++) {
      out.push({ kind: 'tube', mat: { color: '#1A1C1E', rough: 0.8, density: 1.2 }, r: 1.3, seg: 8, path: [[L / 2, 4.5, -6 + i * 6], [L / 2 + 30, 4, -8 + i * 8]] })
      out.push({ kind: 'cyl', mat: 'gold', r: 2, h: 10, rot: [0, 0, 90], at: [L / 2 + 36, 4, -8 + i * 8], seg: 12 })
    }
    ;['#6B3F20', '#C4262C', '#E6E9ED'].forEach((c, i) => {
      out.push({ kind: 'tube', mat: { color: c, rough: 0.6, density: 1.3 }, r: 0.6, seg: 6, path: [[-L / 2, 7, -9 + i * 1.3], [-L / 2 - 40, 5, 14 + i * 1.3], [-L / 2 - 80, 2, 20 + i * 1.3]] })
    })
    return out
  },
  ports: (p) => {
    const L = 40 + parseFloat(str(p, 'amps', '30')) * 0.4
    return [
      { id: 'bp', label: 'Battery +', kind: 'electrical', pos: [-L / 2 - 60, 3, 5], dir: [-1, 0, 0], role: 'power', imax: 40 },
      { id: 'bn', label: 'Battery −', kind: 'electrical', pos: [-L / 2 - 60, 3, -5], dir: [-1, 0, 0], role: 'gnd', imax: 40 },
      ...(['a', 'b', 'c'] as const).map((id, i): Port => ({ id: `m${id}`, label: `Motor phase ${id.toUpperCase()}`, kind: 'electrical', pos: [L / 2 + 41, 4, -8 + i * 8], dir: [1, 0, 0], role: 'power', imax: 40 })),
      { id: 'sig', label: 'Throttle signal', kind: 'electrical', pos: [-L / 2 - 80, 2, 22.6], dir: [-1, 0, 0], role: 'io', imax: 0.01 },
      { id: 'becp', label: 'BEC 5 V', kind: 'electrical', pos: [-L / 2 - 80, 2, 21.3], dir: [-1, 0, 0], role: 'power', imax: 2 },
      { id: 'becn', label: 'BEC ground', kind: 'electrical', pos: [-L / 2 - 80, 2, 20], dir: [-1, 0, 0], role: 'gnd', imax: 2 },
    ]
  },
  electrical: {
    devices: () => [
      { type: 'resistor', r: 400, a: 'bp', b: 'bn' },
      { type: 'short', a: 'bn', b: 'becn' },
      { type: 'resistor', r: 1e6, a: 'sig', b: 'becn' },
    ],
    limits: { vmax: 17 },
  },
  readouts: (p) => [
    { label: 'Continuous', value: `${str(p, 'amps', '30')} A` },
    { label: 'Battery', value: '2S to 4S' },
    { label: 'Signal', value: '1000 to 2000 µs at 50 to 400 Hz' },
  ],
}

/* ================================================================== */
/* Thermal                                                             */
/* ================================================================== */

const peltier: PartDef = {
  id: 'peltier',
  name: 'Peltier module',
  category: 'power',
  blurb: 'Pumps heat from one face to the other, and a lot more out of the hot side',
  tags: ['peltier', 'tec', 'tec1-12706', 'thermoelectric', 'cooler', 'heat pump', 'cooling'],
  doc: {
    price: 3,
    description:
      'A grid of semiconductor pellets between two ceramic plates. Current through it moves heat from one plate to the other, but all the electrical power ends up as heat on the hot side too, so without a large heatsink the "cold" side is soon warm.',
  },
  params: [],
  solids: () => {
    const S = 40
    // Off-white, not white: a flat pale plate square to the light blooms.
    const cer = { color: '#CFCBC2', rough: 0.85, density: 3.9, name: 'Alumina ceramic' }
    const out: Solid[] = [
      { kind: 'box', mat: cer, size: [S, 0.8, S], at: [0, 0.4, 0] },
      { kind: 'box', mat: cer, size: [S, 0.8, S], at: [0, 3.4, 0] },
    ]
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        out.push({ kind: 'box', mat: { color: '#5E6369', metal: 0.5, rough: 0.5, density: 7.7 }, size: [2.4, 2.2, 2.4], at: [-17.5 + i * 5, 1.9, -17.5 + j * 5], noCollide: true })
      }
    }
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'tube', mat: { color: s > 0 ? '#C4262C' : '#1A1C1E', rough: 0.6, density: 1.4 }, r: 0.9, seg: 8, path: [[S / 2, 1.5, s * 12], [S / 2 + 30, 1.5, s * 14], [S / 2 + 80, 1, s * 16]] })
    }
    return out
  },
  ports: () => [
    { id: 'p', label: 'Red (+)', kind: 'electrical', pos: [100, 1, 16], dir: [1, 0, 0], role: 'power', imax: 6.4 },
    { id: 'n', label: 'Black (−)', kind: 'electrical', pos: [100, 1, -16], dir: [1, 0, 0], role: 'gnd', imax: 6.4 },
    { id: 'hot', label: 'Hot face', kind: 'mechanical', pos: [0, 3.8, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    { id: 'cold', label: 'Cold face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: { devices: () => [{ type: 'resistor', r: 1.98, a: 'p', b: 'n' }], limits: { vmax: 15.4, imax: 6.4 } },
  readouts: () => [
    { label: 'Module', value: 'TEC1-12706, 40 mm' },
    { label: 'At 12 V', value: '6 A, 72 W, all of it heat on the hot side' },
    { label: 'Largest difference', value: '68 °C with no load' },
  ],
}

const heatsink: PartDef = {
  id: 'heatsink',
  name: 'Heatsink',
  category: 'power',
  blurb: 'Extruded aluminium fins, sized by how hot the part may run',
  tags: ['heatsink', 'heat sink', 'cooling', 'thermal', 'fins', 'to-220', 'aluminium'],
  doc: { price: 3, description: 'An extruded aluminium fin block. Its thermal resistance times the power going into it is how far above the air the base will sit, so 2 °C/W with 20 W on it is 40 °C over ambient.' },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 40, min: 15, max: 150, step: 5, group: 'Sink' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 40, min: 15, max: 200, step: 5, group: 'Sink' },
    { key: 'height', label: 'Fin height', type: 'number', unit: 'mm', default: 20, min: 5, max: 60, step: 1, group: 'Sink' },
    { key: 'fins', label: 'Fins', type: 'number', default: 9, min: 3, max: 30, step: 1, group: 'Sink' },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'alu-anod-black', group: 'Sink', options: [{ value: 'alu-anod-black', label: 'Black anodised' }, { value: 'alu-6063', label: 'Bare' }] },
  ],
  solids: (p) => {
    const W = num(p, 'width', 40)
    const L = num(p, 'length', 40)
    const H = num(p, 'height', 20)
    const n = Math.round(num(p, 'fins', 9))
    const mat = str(p, 'finish', 'alu-anod-black')
    const t = Math.max(0.8, Math.min(2, (W / n) * 0.35))
    const out: Solid[] = [{ kind: 'box', mat, size: [W, 3, L], at: [0, 1.5, 0] }]
    for (let i = 0; i < n; i++) out.push({ kind: 'box', mat, size: [t, H, L], at: [-W / 2 + t / 2 + (i * (W - t)) / Math.max(n - 1, 1), 3 + H / 2, 0] })
    return out
  },
  ports: (p) => [
    { id: 'base', label: 'Contact face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    { id: 'hole', label: 'M3 hole', kind: 'mechanical', pos: [0, 0, num(p, 'length', 40) / 4], dir: [0, -1, 0], mate: { type: 'hole', size: 3.2 } },
  ],
  readouts: (p) => {
    const W = num(p, 'width', 40)
    const L = num(p, 'length', 40)
    const H = num(p, 'height', 20)
    const n = Math.round(num(p, 'fins', 9))
    const area = (2 * n * H * L + W * L) / 1e6
    // Natural convection, roughly 8 W/m²K, with fin efficiency folded in.
    const rth = 1 / (Math.max(area, 1e-5) * 8 * 0.75)
    return [
      { label: 'Surface', value: `${Math.round(area * 1e4)} cm²` },
      { label: 'Still air', value: `About ${rth.toFixed(1)} °C/W` },
      { label: 'With a fan', value: `About ${(rth / 4).toFixed(1)} °C/W` },
      { label: 'Holds 10 W at', value: `${Math.round(25 + rth * 10)} °C` },
    ]
  },
}

registerParts([
  mosfetModule, bts7960, servoDriver, loadCell, hx711, ina219,
  gps, nrf24, bluetooth, rfid, thumbstick, tftDisplay, microphone, gasSensorMq2, waterLevel,
  lipo, cell18650, coinCell, solarPanel,
  brushlessMotor, propeller, esc, peltier, heatsink,
])

