import type { PartDef, Port, SilkItem, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { num, PITCH as P, radialLeads, roundRect, str } from './_helpers'

/**
 * Sensors.
 *
 * The two-terminal ones are genuinely just a resistance that a parameter moves,
 * which is what they are in a circuit, so they need no behaviour: put one in a
 * divider and the divider does what a divider does. The module ones present a
 * driven output referenced to their own ground.
 */

const PIN_MAT = 'tin'

/** A row of male pins under a module, the way every breakout ships. */
function modulePins(n: number, z: number, y0: number, x0?: number): Solid[] {
  const left = x0 ?? -((n - 1) * P) / 2
  const out: Solid[] = [
    { kind: 'box', mat: 'nylon-black', size: [n * P, 2.5, 2.5], at: [left + ((n - 1) * P) / 2, y0 - 1.25, z], bevel: 0.15 },
  ]
  for (let i = 0; i < n; i++) {
    out.push({ kind: 'box', mat: PIN_MAT, size: [0.64, 8, 0.64], at: [left + i * P, y0 - 4, z] })
  }
  return out
}

function modulePorts(ids: [string, string, Port['role']][], z: number, y: number, x0?: number): Port[] {
  const left = x0 ?? -((ids.length - 1) * P) / 2
  return ids.map(([id, label, role], i) => ({
    id,
    label,
    kind: 'electrical' as const,
    pos: [left + i * P, y, z] as Vec3,
    dir: [0, -1, 0] as Vec3,
    role,
    imax: 0.05,
  }))
}

/* ================================================================== */
/* Light dependent resistor                                            */
/* ================================================================== */

const ldr: PartDef = {
  id: 'ldr',
  name: 'Photoresistor',
  category: 'sensor',
  blurb: 'Resistance falls as light rises',
  tags: ['ldr', 'photoresistor', 'light', 'sensor', 'cds', 'gl5528', 'photocell'],
  doc: {
    mpn: 'GL5528',
    price: 0.35,
    description:
      'A cadmium sulphide cell. It is a resistor whose value depends on how much light falls on it, so it does its job in a divider with no model beyond its resistance.',
  },
  params: [
    { key: 'light', label: 'Light level', type: 'number', unit: '%', default: 55, min: 0, max: 100, step: 1, group: 'Reading', help: 'Dark is a megohm or so, full sun is a few hundred ohms.' },
    { key: 'dark', label: 'Dark resistance', type: 'number', unit: 'Ω', default: 1e6, min: 1e4, max: 2e7, eng: true, group: 'Device' },
    { key: 'bright', label: 'Lit resistance', type: 'number', unit: 'Ω', default: 400, min: 50, max: 1e5, eng: true, group: 'Device' },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 5.08, min: 2.54, max: 10.16, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const pitch = num(p, 'pitch', 5.08)
    const y = 4.6
    // The classic zigzag track on a ceramic disc under clear epoxy.
    const track: Solid[] = []
    for (let i = 0; i < 5; i++) {
      track.push({
        kind: 'box', mat: { color: '#C8B48A', rough: 0.5, density: 3 },
        size: [4.6, 0.12, 0.42], at: [0, y + 0.62, -1.4 + i * 0.7], noCollide: true,
      })
    }
    return [
      { kind: 'cyl', mat: { color: '#E9E4D6', rough: 0.55, density: 3 }, r: 2.6, h: 1.3, at: [0, y, 0], chamfer: 0.2 },
      ...track,
      { kind: 'cyl', mat: { color: '#F0EAD8', rough: 0.12, opacity: 0.55, transmission: 0.6, density: 1.2 }, r: 2.62, h: 0.5, at: [0, y + 0.9, 0], noCollide: true },
      ...radialLeads({ pitch, fromY: y - 0.65, insert: 3.4 }),
    ]
  },
  ports: (p) => {
    const h = num(p, 'pitch', 5.08) / 2
    return [
      { id: '1', label: 'A', kind: 'electrical', pos: [-h, -3.4, 0], dir: [0, -1, 0], role: 'passive' },
      { id: '2', label: 'B', kind: 'electrical', pos: [h, -3.4, 0], dir: [0, -1, 0], role: 'passive' },
    ]
  },
  electrical: {
    devices: (p) => {
      // Log-linear between the dark and lit values, which is how a CdS cell
      // actually behaves across its range.
      const f = Math.min(Math.max(num(p, 'light', 55) / 100, 0), 1)
      const dark = Math.log(num(p, 'dark', 1e6))
      const bright = Math.log(num(p, 'bright', 400))
      return [{ type: 'resistor', r: Math.exp(dark + (bright - dark) * f), a: '1', b: '2' }]
    },
  },
  readouts: (p) => {
    const f = Math.min(Math.max(num(p, 'light', 55) / 100, 0), 1)
    const r = Math.exp(Math.log(num(p, 'dark', 1e6)) * (1 - f) + Math.log(num(p, 'bright', 400)) * f)
    return [{ label: 'Resistance now', value: r >= 1000 ? `${(r / 1000).toFixed(1)} kΩ` : `${Math.round(r)} Ω` }]
  },
}

/* ================================================================== */
/* NTC thermistor                                                      */
/* ================================================================== */

const thermistor: PartDef = {
  id: 'thermistor-ntc',
  name: 'NTC thermistor',
  category: 'sensor',
  blurb: 'Resistance falls as it warms up',
  tags: ['thermistor', 'ntc', 'temperature', 'sensor', 'heat', '10k', '100k', '3950'],
  doc: {
    mpn: 'NTC 10K 3950',
    price: 0.4,
    description:
      'A negative temperature coefficient bead. Resistance follows the beta equation about its value at 25 C, so a divider against it reads as a real temperature curve rather than a straight line.',
  },
  params: [
    { key: 'tempC', label: 'Temperature', type: 'number', unit: '°C', default: 25, min: -40, max: 300, step: 1, group: 'Reading' },
    { key: 'r25', label: 'R at 25 °C', type: 'number', unit: 'Ω', default: 10000, min: 100, max: 1e6, eng: true, group: 'Device' },
    { key: 'beta', label: 'Beta', type: 'number', unit: 'K', default: 3950, min: 2000, max: 5000, step: 10, group: 'Device' },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 2.54, min: 2.54, max: 7.62, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const pitch = num(p, 'pitch', 2.54)
    const y = 3.4
    return [
      { kind: 'sphere', mat: { color: '#1B1D22', rough: 0.42, density: 3.2 }, r: 1.5, at: [0, y, 0] },
      ...radialLeads({ pitch, fromY: y - 0.6, insert: 3.4, leadR: 0.22 }),
    ]
  },
  ports: (p) => {
    const h = num(p, 'pitch', 2.54) / 2
    return [
      { id: '1', label: 'A', kind: 'electrical', pos: [-h, -3.4, 0], dir: [0, -1, 0], role: 'passive' },
      { id: '2', label: 'B', kind: 'electrical', pos: [h, -3.4, 0], dir: [0, -1, 0], role: 'passive' },
    ]
  },
  electrical: {
    devices: (p) => [{ type: 'resistor', r: ntcResistance(p), a: '1', b: '2' }],
  },
  readouts: (p) => {
    const r = ntcResistance(p)
    return [
      { label: 'Resistance now', value: r >= 1000 ? `${(r / 1000).toFixed(2)} kΩ` : `${Math.round(r)} Ω` },
      { label: 'Model', value: 'Beta equation about 25 °C' },
    ]
  },
}

/** R = R25 · exp(B · (1/T − 1/298.15)), the standard single-beta model. */
function ntcResistance(p: Record<string, unknown>): number {
  const t = (typeof p.tempC === 'number' ? p.tempC : 25) + 273.15
  const r25 = typeof p.r25 === 'number' ? p.r25 : 10000
  const beta = typeof p.beta === 'number' ? p.beta : 3950
  return r25 * Math.exp(beta * (1 / Math.max(t, 1) - 1 / 298.15))
}

/* ================================================================== */
/* Analogue three-pin module                                           */
/* ================================================================== */

/** Shared shape for the little breakout boards: board, sensor, three pins. */
function threePinModule(opts: {
  id: string
  name: string
  blurb: string
  tags: string[]
  mpn: string
  price: number
  description: string
  /** Extra solids on top of the board. */
  body: (p: Record<string, unknown>) => Solid[]
  w: number
  d: number
  silk: string
  readingLabel: string
  readingUnit: string
  toVolts: (readingPct: number, vcc: number) => number
}): PartDef {
  const T = 1.6
  return {
    id: opts.id,
    name: opts.name,
    category: 'sensor',
    blurb: opts.blurb,
    tags: opts.tags,
    doc: { mpn: opts.mpn, price: opts.price, description: opts.description },
    params: [
      { key: 'reading', label: opts.readingLabel, type: 'number', unit: opts.readingUnit, default: 50, min: 0, max: 100, step: 1, group: 'Reading' },
      { key: 'mask', label: 'Board colour', type: 'enum', default: 'fr4-blue', group: 'Board', options: [
        { value: 'fr4-blue', label: 'Blue' }, { value: 'fr4-red', label: 'Red' }, { value: 'fr4-black', label: 'Black' },
      ] },
    ],
    solids: (p) => {
      const silk: SilkItem[] = [
        { t: 'text', at: [0, opts.d / 2 - 2.6], text: opts.silk, size: 2, bold: true },
        { t: 'pads', at: [-P, -opts.d / 2 + 3], n: 3, pitch: P, r: 1.1 },
        ...['G', 'V', 'S'].map((s, i): SilkItem => ({
          t: 'text', at: [-P + i * P, -opts.d / 2 + 5.6], text: s, size: 1.5,
        })),
      ]
      return [
        {
          kind: 'extrude', mat: str(p, 'mask', 'fr4-blue'),
          profile: { outline: roundRect(opts.w, opts.d, 1.6, 0, 0, 4) },
          depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
        },
        { kind: 'silk', size: [opts.w, opts.d], items: silk, mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 22, noCollide: true },
        ...opts.body(p),
        ...modulePins(3, -opts.d / 2 + 3, 0, -P),
      ]
    },
    ports: () =>
      modulePorts(
        [['gnd', 'GND', 'gnd'], ['vcc', 'VCC', 'power'], ['out', 'OUT', 'analog']],
        -opts.d / 2 + 3,
        -4,
        -P,
      ),
    electrical: {
      devices: () => [
        { type: 'behavioral', evalId: 'analog-sensor', ref: 'gnd', pins: ['vcc', 'gnd', 'out'] },
        // Quiescent draw, so the supply sees a load rather than nothing.
        { type: 'resistor', r: 15000, a: 'vcc', b: 'gnd' },
      ],
      limits: { vmax: 5.5 },
    },
    readouts: (p) => {
      const pct = num(p, 'reading', 50)
      return [
        { label: opts.readingLabel, value: `${pct} ${opts.readingUnit}` },
        { label: 'Output at 5 V', value: `${opts.toVolts(pct, 5).toFixed(2)} V` },
        { label: 'Output', value: 'Ratiometric to VCC' },
      ]
    },
  }
}

const soilSensor = threePinModule({
  id: 'sensor-soil',
  name: 'Soil moisture sensor',
  blurb: 'Capacitive probe with an analogue output',
  tags: ['soil', 'moisture', 'sensor', 'plant', 'water', 'capacitive', 'garden'],
  mpn: 'Capacitive v1.2',
  price: 2.4,
  description: 'A capacitive probe. The output falls as the soil gets wetter, and it is ratiometric to the supply.',
  w: 22,
  d: 26,
  silk: 'SOIL',
  readingLabel: 'Moisture',
  readingUnit: '%',
  toVolts: (pct, vcc) => vcc * (pct / 100),
  body: () => [
    { kind: 'box', mat: { color: '#1B4E2F', rough: 0.5, density: 1.85 }, size: [8, 1.6, 60], at: [0, 0.8, 30], noCollide: true },
    { kind: 'box', mat: 'epoxy-black', size: [4.4, 1, 3.4], at: [4, 2.1, 4], bevel: 0.15 },
  ],
})

const gasSensor = threePinModule({
  id: 'sensor-ldr-module',
  name: 'Light sensor module',
  blurb: 'Photoresistor on a board with a driven output',
  tags: ['light', 'ldr', 'sensor', 'module', 'brightness', 'photocell'],
  mpn: 'LM393 LDR',
  price: 1.2,
  description: 'A photoresistor and a divider on a small board. The analogue pin rises with light and is ratiometric to the supply.',
  w: 20,
  d: 24,
  silk: 'LIGHT',
  readingLabel: 'Brightness',
  readingUnit: '%',
  toVolts: (pct, vcc) => vcc * (pct / 100),
  body: () => [
    { kind: 'cyl', mat: { color: '#E9E4D6', rough: 0.5, density: 3 }, r: 2.6, h: 1.4, at: [0, 2.3, 3], chamfer: 0.2 },
    { kind: 'box', mat: 'epoxy-black', size: [4.4, 1, 3.4], at: [-5, 2.1, -4], bevel: 0.15 },
  ],
})

/* ================================================================== */
/* Ultrasonic range finder                                             */
/* ================================================================== */

const ultrasonic: PartDef = {
  id: 'sensor-ultrasonic',
  name: 'Ultrasonic range finder',
  category: 'sensor',
  blurb: 'Two transducers, trigger and echo',
  tags: ['ultrasonic', 'hc-sr04', 'distance', 'range', 'sensor', 'sonar', 'proximity'],
  doc: {
    mpn: 'HC-SR04',
    price: 1.8,
    description:
      'The four-pin range finder. Pulse the trigger and the echo pin goes high for as long as the sound takes to come back, which is what this reproduces: about 58 microseconds per centimetre.',
  },
  params: [
    { key: 'distance', label: 'Distance to target', type: 'number', unit: 'cm', default: 30, min: 2, max: 400, step: 1, group: 'Reading' },
  ],
  solids: () => {
    const w = 45
    const d = 20
    const T = 1.6
    const silk: SilkItem[] = [
      { t: 'text', at: [0, -d / 2 + 6.4], text: 'HC-SR04', size: 2, bold: true },
      { t: 'pads', at: [-1.5 * P, -d / 2 + 3], n: 4, pitch: P, r: 1.1 },
    ]
    return [
      {
        kind: 'extrude', mat: 'fr4-blue', profile: { outline: roundRect(w, d, 1.4, 0, 0, 4) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      { kind: 'silk', size: [w, d], items: silk, mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 22, noCollide: true },
      // The two aluminium cans, and the crystal between them.
      ...[-13, 13].map((x): Solid => ({
        kind: 'group', mat: 'alu-6063', at: [x, T, 0], children: [
          { kind: 'cyl', mat: { color: '#B7BCC3', metal: 1, rough: 0.4, density: 2.7 }, r: 8, h: 12, at: [0, 6, 0], chamfer: 0.5 },
          { kind: 'cyl', mat: { color: '#3A3F46', rough: 0.75, density: 1.2 }, r: 6.6, h: 0.6, at: [0, 12.1, 0], noCollide: true },
        ],
      })),
      { kind: 'box', mat: { color: '#9AA1A9', metal: 1, rough: 0.35, density: 6 }, size: [10, 3.6, 4.2], at: [0, T + 1.8, 3], bevel: 0.7 },
      ...modulePins(4, -d / 2 + 3, T, -1.5 * P),
    ]
  },
  ports: () =>
    modulePorts(
      [['vcc', 'VCC', 'power'], ['trig', 'TRIG', 'io'], ['echo', 'ECHO', 'io'], ['gnd', 'GND', 'gnd']],
      -20 / 2 + 3,
      -4,
      -1.5 * P,
    ),
  electrical: {
    devices: () => [
      { type: 'behavioral', evalId: 'ultrasonic', ref: 'gnd', pins: ['vcc', 'trig', 'echo'] },
      { type: 'resistor', r: 1500, a: 'vcc', b: 'gnd' },
    ],
    limits: { vmax: 5.5 },
  },
  readouts: (p) => {
    const cm = num(p, 'distance', 30)
    return [
      { label: 'Echo pulse', value: `${Math.round(cm * 58)} µs` },
      { label: 'Scale', value: '58 µs per cm' },
      { label: 'Range', value: '2 to 400 cm' },
    ]
  },
}

registerParts([ldr, thermistor, soilSensor, gasSensor, ultrasonic])

export const SENSOR_PARTS = [ldr, thermistor, soilSensor, gasSensor, ultrasonic]
