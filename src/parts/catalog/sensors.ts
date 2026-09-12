import type { DeviceModel, PartDef, Port, SilkItem, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, circle, num, PITCH as P, radialLeads, roundRect, str } from './_helpers'

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

/* ================================================================== */
/* Passive infrared motion sensor                                      */
/* ================================================================== */

const pir: PartDef = {
  id: 'sensor-pir',
  name: 'PIR motion sensor',
  category: 'sensor',
  blurb: 'Fresnel dome over a pyroelectric element, one digital pin',
  tags: ['pir', 'motion', 'sensor', 'hc-sr501', 'infrared', 'presence', 'alarm', 'occupancy'],
  doc: {
    mpn: 'HC-SR501',
    price: 1.4,
    description:
      'The white dome module. It watches for a change in infrared across its field of view, so it sees someone walking past and not someone sitting still. The output is a plain digital level, held for as long as the on-board timer pot is set to.',
  },
  params: [
    { key: 'motion', label: 'Motion detected', type: 'bool', default: false, group: 'Reading' },
    { key: 'holdTime', label: 'Hold time', type: 'number', unit: 's', default: 5, min: 0.5, max: 300, step: 0.5, group: 'Module' },
    {
      key: 'trigger', label: 'Trigger mode', type: 'enum', default: 'repeat', group: 'Module',
      help: 'Repeatable restarts the timer on every movement. Single fires once and then waits out the whole hold.',
      options: [{ value: 'repeat', label: 'Repeatable (H)' }, { value: 'single', label: 'Single (L)' }],
    },
  ],
  solids: () => {
    const W = 32
    const D = 24
    const T = 1.6
    return [
      {
        kind: 'extrude', mat: 'fr4-green',
        profile: { outline: roundRect(W, D, 1.6, 0, 0, 4) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      // The Fresnel lens: a faceted white dome, which is the whole look of it.
      {
        kind: 'lathe', mat: { color: '#F4F5F7', rough: 0.42, opacity: 0.95, density: 1.05 }, seg: 24,
        points: [[11.5, 0], [11.5, 2], [11.2, 6], [10, 10], [7.6, 13], [4, 15.2], [0, 15.8]],
        at: [0, T, 0],
      },
      // The segment lines moulded into it.
      ...Array.from({ length: 8 }, (_, i): Solid => ({
        kind: 'box', mat: { color: '#D7D9DD', rough: 0.5, density: 0.01 },
        size: [0.4, 0.4, 22], at: [0, T + 4, 0], rot: [0, (i * 180) / 8, 0], noCollide: true,
      })),
      // Two adjustment pots. They are on the back in life, and on top here so
      // that they can be seen at all.
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'cyl', mat: { color: '#E8A33D', rough: 0.5, density: 1.6 }, r: 3.2, h: 2.4,
        at: [s * 11, T + 1.2, -D / 2 + 4] as Vec3, seg: 14,
      })),
      ...modulePins(3, D / 2 - 3, 0, -P),
    ]
  },
  ports: () =>
    modulePorts([['gnd', 'GND', 'gnd'], ['out', 'OUT', 'io'], ['vcc', 'VCC (5 V)', 'power']], 24 / 2 - 3, -4, -P),
  electrical: {
    devices: () => [
      { type: 'behavioral', evalId: 'digital-sensor', ref: 'gnd', pins: ['vcc', 'out'] },
      // The on-board regulator idles at a couple of hundred microamps.
      { type: 'resistor', r: 22000, a: 'vcc', b: 'gnd' },
    ],
    limits: { vmax: 20 },
  },
  readouts: (p) => [
    { label: 'Output', value: bool(p, 'motion', false) ? 'High, 3.3 V' : 'Low' },
    { label: 'Hold time', value: `${num(p, 'holdTime', 5)} s after the last movement` },
    { label: 'Supply', value: '5 to 12 V, regulator on board' },
    { label: 'Coverage', value: 'About 7 m, 110 degrees' },
  ],
}

/* ================================================================== */
/* Temperature and humidity                                            */
/* ================================================================== */

const DHT_MODELS: Record<string, { label: string; tMin: number; tMax: number; tAcc: number; hAcc: number; period: number; body: string }> = {
  dht11: { label: 'DHT11, blue', tMin: 0, tMax: 50, tAcc: 2, hAcc: 5, period: 1, body: '#2E63C8' },
  dht22: { label: 'DHT22, white', tMin: -40, tMax: 80, tAcc: 0.5, hAcc: 2, period: 2, body: '#E6E8EB' },
}

const dht: PartDef = {
  id: 'sensor-dht',
  name: 'Temperature and humidity sensor',
  category: 'sensor',
  blurb: 'DHT11 or DHT22 on a single open-drain data line',
  tags: ['dht11', 'dht22', 'am2302', 'temperature', 'humidity', 'sensor', 'weather', 'climate'],
  doc: {
    mpn: 'DHT22',
    price: 3,
    description:
      'The plastic-grilled humidity sensor. One wire carries both readings in a timed bit stream, with a pull-up holding it high between frames. The pin, the pull-up and the supply behave correctly here; the bit stream itself is not decoded, so the readings below are parameters rather than something a sketch reads off the line.',
  },
  params: [
    { key: 'model', label: 'Model', type: 'enum', default: 'dht22', group: 'Sensor', options: Object.entries(DHT_MODELS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'tempC', label: 'Temperature', type: 'number', unit: '°C', default: 21, min: -40, max: 80, step: 0.5, group: 'Reading' },
    { key: 'humidity', label: 'Relative humidity', type: 'number', unit: '%', default: 45, min: 0, max: 100, step: 1, group: 'Reading' },
    { key: 'pullup', label: 'Pull-up fitted', type: 'bool', default: true, group: 'Electrical', help: '10 k on the data line. Without one the line never returns high and no reading ever completes.' },
  ],
  solids: (p) => {
    const m = DHT_MODELS[str(p, 'model', 'dht22')] ?? DHT_MODELS.dht22
    const W = 15.1
    const H = 25
    const T = 7.7
    const out: Solid[] = [
      { kind: 'box', mat: { color: m.body, rough: 0.62, density: 1.3 }, size: [W, H, T], at: [0, H / 2, 0], bevel: 0.5 },
    ]
    // The grille: a run of slots across the front face.
    for (let i = 0; i < 7; i++) {
      out.push({
        kind: 'box', mat: { color: '#0C0E11', rough: 0.9, density: 0.01 },
        size: [W - 3, 1.2, 0.8], at: [0, H - 4 - i * 2.4, T / 2 - 0.2], noCollide: true,
      })
    }
    const pins = str(p, 'model', 'dht22') === 'dht11' ? 3 : 4
    for (let i = 0; i < pins; i++) {
      out.push({ kind: 'box', mat: 'tin', size: [0.5, 8, 0.4], at: [(i - (pins - 1) / 2) * P, -4, 0] })
    }
    return out
  },
  ports: (p) => {
    const pins = str(p, 'model', 'dht22') === 'dht11' ? 3 : 4
    const names: [string, string, Port['role']][] =
      pins === 3
        ? [['vcc', 'VCC', 'power'], ['data', 'DATA', 'io'], ['gnd', 'GND', 'gnd']]
        : [['vcc', 'VCC', 'power'], ['data', 'DATA', 'io'], ['nc', 'NC', 'passive'], ['gnd', 'GND', 'gnd']]
    return names.map(([id, label, role], i) => ({
      id, label, kind: 'electrical' as const,
      pos: [(i - (pins - 1) / 2) * P, -8, 0] as Vec3, dir: [0, -1, 0] as Vec3,
      role, imax: 0.01, solderable: true,
    }))
  },
  electrical: {
    devices: (p) => {
      const out: DeviceModel[] = [{ type: 'resistor', r: 47000, a: 'vcc', b: 'gnd' }]
      // The data line idles high through its pull-up. That resistor is the
      // single most common omission with these, and without it the line sits
      // wherever it was last left.
      if (p.pullup !== false) out.push({ type: 'resistor', r: 10000, a: 'vcc', b: 'data' })
      return out
    },
    limits: { vmax: 5.5 },
  },
  readouts: (p) => {
    const m = DHT_MODELS[str(p, 'model', 'dht22')] ?? DHT_MODELS.dht22
    return [
      { label: 'Temperature', value: `${num(p, 'tempC', 21).toFixed(1)} °C, ±${m.tAcc}` },
      { label: 'Humidity', value: `${Math.round(num(p, 'humidity', 45))} %, ±${m.hAcc}` },
      { label: 'Range', value: `${m.tMin} to ${m.tMax} °C` },
      { label: 'Reading rate', value: `One every ${m.period} s` },
    ]
  },
}

/* ================================================================== */
/* Hall effect switch                                                  */
/* ================================================================== */

const hall: PartDef = {
  id: 'sensor-hall',
  name: 'Hall effect switch',
  category: 'sensor',
  blurb: 'Open-drain output that a magnet pulls low',
  tags: ['hall', 'magnet', 'sensor', 'a3144', 'proximity', 'rpm', 'position'],
  doc: {
    mpn: 'A3144',
    price: 0.35,
    description:
      'A hall switch in TO-92. The output is open drain, so it can only pull down and reads as nothing without a pull-up. A south pole against the marked face turns it on, and it stays on until the field falls well below the level that tripped it.',
  },
  params: [
    { key: 'magnet', label: 'Magnet present', type: 'bool', default: false, group: 'Reading' },
    { key: 'pullup', label: 'Pull-up fitted', type: 'bool', default: true, group: 'Electrical', help: '10 k to VCC. Open-drain outputs read as nothing at all without one.' },
  ],
  solids: () => {
    const H = 4.2
    const out: Solid[] = [
      // TO-92 flat pack: a slab with a domed back.
      { kind: 'box', mat: 'epoxy-black', size: [4.1, H, 1.6], at: [0, 3 + H / 2, 0], bevel: 0.2 },
      { kind: 'cyl', mat: 'epoxy-black', r: 2.05, h: 1.6, rot: [90, 0, 0], at: [0, 3 + H, 0], phi: [0, 180] },
    ]
    for (const x of [-1.27, 0, 1.27]) {
      out.push({ kind: 'box', mat: 'tin', size: [0.45, 6.4, 0.35], at: [x, -0.2, 0] })
    }
    return out
  },
  ports: () => [
    { id: 'vcc', label: 'VCC', kind: 'electrical', pos: [-1.27, -3.4, 0], dir: [0, -1, 0], role: 'power', imax: 0.02, solderable: true },
    { id: 'gnd', label: 'GND', kind: 'electrical', pos: [0, -3.4, 0], dir: [0, -1, 0], role: 'gnd', imax: 0.02, solderable: true },
    { id: 'out', label: 'OUT (open drain)', kind: 'electrical', pos: [1.27, -3.4, 0], dir: [0, -1, 0], role: 'io', imax: 0.025, solderable: true },
  ],
  electrical: {
    devices: (p) => {
      const out: DeviceModel[] = [
        { type: 'behavioral', evalId: 'digital-sensor', ref: 'gnd', pins: ['vcc', 'out'] },
        { type: 'resistor', r: 470000, a: 'vcc', b: 'gnd' },
      ]
      if (p.pullup !== false) out.push({ type: 'resistor', r: 10000, a: 'vcc', b: 'out' })
      return out
    },
    limits: { vmax: 24 },
  },
  readouts: (p) => [
    { label: 'Output', value: bool(p, 'magnet', false) ? 'Pulled low' : 'Released' },
    { label: 'Drive', value: 'Open drain, sinks 25 mA' },
    { label: 'Pull-up', value: p.pullup !== false ? '10 k fitted' : 'None, the pin floats' },
    { label: 'Supply', value: '4.5 to 24 V' },
  ],
}

/* ================================================================== */
/* Infrared obstacle sensor                                            */
/* ================================================================== */

const irObstacle: PartDef = {
  id: 'sensor-ir-obstacle',
  name: 'IR obstacle sensor',
  category: 'sensor',
  blurb: 'Emitter and detector pair with a comparator between them',
  tags: ['ir', 'infrared', 'obstacle', 'sensor', 'proximity', 'line', 'follower', 'reflective', 'robot'],
  doc: {
    mpn: 'FC-51',
    price: 0.8,
    description:
      'An infrared LED beside a detector. It reads reflected light rather than distance, so a black surface at two centimetres and a white one at ten can look the same to it, which is what the trimmer is for.',
  },
  params: [
    { key: 'detected', label: 'Obstacle detected', type: 'bool', default: false, group: 'Reading' },
    { key: 'range', label: 'Trip distance', type: 'number', unit: 'cm', default: 8, min: 2, max: 30, step: 1, group: 'Module' },
  ],
  solids: () => {
    const W = 31
    const D = 14
    const T = 1.6
    return [
      {
        kind: 'extrude', mat: 'fr4-blue',
        profile: { outline: roundRect(W, D, 1.4, 0, 0, 3) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [W, D], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 24, noCollide: true,
        items: [
          { t: 'text', at: [4, 3.4], text: 'IR', size: 2, bold: true },
          { t: 'pads', at: [W / 2 - 6.5, -D / 2 + 3], n: 3, pitch: P, r: 1 },
        ],
      },
      // The emitter is clear and the detector is dark. That is how you tell
      // them apart on a real board too.
      { kind: 'cyl', mat: { color: '#DCEAF0', rough: 0.1, opacity: 0.6, transmission: 0.7, density: 1.2 }, r: 2.5, h: 5, rot: [90, 0, 0], at: [-W / 2 + 6, T + 2.6, D / 2 + 2] },
      { kind: 'cyl', mat: { color: '#1A1D22', rough: 0.35, density: 1.2 }, r: 2.5, h: 5, rot: [90, 0, 0], at: [-W / 2 + 12, T + 2.6, D / 2 + 2] },
      { kind: 'box', mat: { color: '#1D4FD8', rough: 0.5, density: 1.6 }, size: [6.4, 4.8, 6.4], at: [1, T + 2.4, -1], bevel: 0.3 },
      { kind: 'box', mat: 'epoxy-black', size: [5, 1.2, 4], at: [9, T + 0.6, 2], noCollide: true },
      ...modulePins(3, -D / 2 + 3, 0, W / 2 - 6.5 - P),
    ]
  },
  ports: () =>
    modulePorts([['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd'], ['out', 'OUT', 'io']], -14 / 2 + 3, -4, 31 / 2 - 6.5 - P),
  electrical: {
    devices: () => [
      { type: 'behavioral', evalId: 'digital-sensor', ref: 'gnd', pins: ['vcc', 'out'] },
      // The emitter LED is most of the 20 mA these draw.
      { type: 'resistor', r: 250, a: 'vcc', b: 'gnd' },
    ],
    limits: { vmax: 5.5 },
  },
  readouts: (p) => [
    { label: 'Output', value: bool(p, 'detected', false) ? 'Low, obstacle seen' : 'High, clear' },
    { label: 'Logic', value: 'Active low, as the comparator sits' },
    { label: 'Trip distance', value: `${Math.round(num(p, 'range', 8))} cm, set by the trimmer` },
    { label: 'Current', value: 'About 20 mA, mostly the emitter' },
  ],
}

/* ================================================================== */
/* Tilt switch                                                         */
/* ================================================================== */

const tilt: PartDef = {
  id: 'sensor-tilt',
  name: 'Tilt switch',
  category: 'sensor',
  blurb: 'A ball in a can, closed one way up and open the other',
  tags: ['tilt', 'vibration', 'sensor', 'sw-520d', 'orientation', 'shake', 'ball'],
  doc: {
    mpn: 'SW-520D',
    price: 0.15,
    description:
      'Two contacts and a rolling ball. Upright it shorts them; past about thirty degrees it does not. It rattles on the way, so anything reading one wants debouncing.',
  },
  params: [
    { key: 'tilted', label: 'Tilted past the angle', type: 'bool', default: false, group: 'Reading' },
    { key: 'angle', label: 'Switching angle', type: 'number', unit: '°', default: 30, min: 10, max: 80, step: 5, group: 'Sensor' },
  ],
  solids: (p) => {
    const H = 10.5
    const lean = bool(p, 'tilted', false) ? num(p, 'angle', 30) : 0
    return [
      {
        kind: 'group', mat: 'nickel', at: [0, 0, 0], rot: [0, 0, lean], children: [
          { kind: 'cyl', mat: 'nickel', r: 2.15, h: H, at: [0, 3 + H / 2, 0], chamfer: 0.4 },
          { kind: 'cyl', mat: { color: '#1A1C1E', rough: 0.6, density: 1.4 }, r: 2.3, h: 1.4, at: [0, 3.7, 0] },
          ...[-1.27, 1.27].map((x): Solid => ({ kind: 'box', mat: 'tin', size: [0.45, 6, 0.35], at: [x, 0, 0] })),
        ],
      },
    ]
  },
  ports: () => [
    { id: 'a', label: 'Contact A', kind: 'electrical', pos: [-1.27, -3, 0], dir: [0, -1, 0], role: 'passive', imax: 0.02, solderable: true },
    { id: 'b', label: 'Contact B', kind: 'electrical', pos: [1.27, -3, 0], dir: [0, -1, 0], role: 'passive', imax: 0.02, solderable: true },
  ],
  electrical: {
    devices: (p) => [{ type: 'switch', a: 'a', b: 'b', closed: !bool(p, 'tilted', false), ron: 5, roff: 1e9 }],
    limits: { imax: 0.02, vmax: 12 },
  },
  readouts: (p) => [
    { label: 'Contacts', value: bool(p, 'tilted', false) ? 'Open' : 'Closed' },
    { label: 'Switching angle', value: `About ${Math.round(num(p, 'angle', 30))}°` },
    { label: 'Rating', value: '20 mA, 12 V' },
  ],
}

/* ================================================================== */
/* Current sensor                                                      */
/* ================================================================== */

const ACS_RANGES: Record<string, { label: string; amps: number; sens: number }> = {
  '5': { label: 'ACS712, ±5 A', amps: 5, sens: 0.185 },
  '20': { label: 'ACS712, ±20 A', amps: 20, sens: 0.1 },
  '30': { label: 'ACS712, ±30 A', amps: 30, sens: 0.066 },
}

/** Conduction path through the package, ohms. 1.2 milliohms per the datasheet. */
const ACS_SHUNT = 1.2e-3

const currentSensor: PartDef = {
  id: 'sensor-current',
  name: 'Current sensor',
  category: 'sensor',
  blurb: 'Current goes through the chip, output sits at half the supply',
  tags: ['current', 'sensor', 'acs712', 'hall', 'ammeter', 'measure', 'shunt'],
  doc: {
    mpn: 'ACS712',
    price: 2.6,
    description:
      'The load current passes through the chip and a hall element reads the field around it. The output rests at half the supply with nothing flowing and moves either side of it with direction, which is why this reads alternating current where a plain shunt cannot.',
  },
  params: [
    { key: 'range', label: 'Range', type: 'enum', default: '5', group: 'Sensor', options: Object.entries(ACS_RANGES).map(([value, v]) => ({ value, label: v.label })) },
  ],
  solids: () => {
    const W = 31
    const D = 13
    const T = 1.6
    return [
      {
        kind: 'extrude', mat: 'fr4-black',
        profile: { outline: roundRect(W, D, 1.4, 0, 0, 3) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [W, D], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 24, noCollide: true,
        items: [
          { t: 'text', at: [-6, -D / 2 + 2], text: 'ACS712', size: 1.8, bold: true },
          { t: 'pads', at: [W / 2 - 6.5, D / 2 - 3], n: 3, pitch: P, r: 1 },
        ],
      },
      { kind: 'box', mat: 'epoxy-black', size: [7, 1.2, 7], at: [-4, T + 0.6, 1], noCollide: true },
      { kind: 'box', mat: { color: '#1E7A3C', rough: 0.55, density: 1.4 }, size: [10.2, 9.6, 9.4], at: [-W / 2 + 7, T + 4.8, 0], bevel: 0.4 },
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'cyl', mat: { color: '#B8BCC2', rough: 0.35, metal: 1, density: 7.8 }, r: 1.4, h: 1.2,
        at: [-W / 2 + 7 + s * 2.54, T + 9.4, 0] as Vec3, chamfer: 0.15,
      })),
      ...modulePins(3, D / 2 - 3, 0, W / 2 - 6.5 - P),
    ]
  },
  ports: () => {
    const W = 31
    const D = 13
    const out: Port[] = modulePorts(
      [['vcc', 'VCC (5 V)', 'power'], ['out', 'OUT', 'analog'], ['gnd', 'GND', 'gnd']],
      D / 2 - 3, -4, W / 2 - 6.5 - P,
    )
    out.push(
      { id: 'ip1', label: 'IP+', kind: 'electrical', pos: [-W / 2 + 7 - 2.54, 12, -5], dir: [0, 0, -1], role: 'passive', imax: 30 },
      { id: 'ip2', label: 'IP−', kind: 'electrical', pos: [-W / 2 + 7 + 2.54, 12, -5], dir: [0, 0, -1], role: 'passive', imax: 30 },
    )
    return out
  },
  electrical: {
    devices: () => [
      // The conduction path really is a couple of milliohms of copper through
      // the package, and the behaviour reads the drop across it to work out
      // the current. Nothing is told to it.
      { type: 'resistor', r: ACS_SHUNT, a: 'ip1', b: 'ip2' },
      { type: 'behavioral', evalId: 'current-sensor', ref: 'gnd', pins: ['vcc', 'out', 'ip1', 'ip2'] },
      { type: 'resistor', r: 500, a: 'vcc', b: 'gnd' },
    ],
    limits: { vmax: 5.5, imax: 30 },
  },
  readouts: (p) => {
    const r = ACS_RANGES[str(p, 'range', '5')] ?? ACS_RANGES['5']
    return [
      { label: 'Range', value: `±${r.amps} A` },
      { label: 'Sensitivity', value: `${(r.sens * 1000).toFixed(0)} mV per amp` },
      { label: 'Zero current', value: 'Half the supply, 2.5 V at 5 V' },
      { label: 'Insertion loss', value: `${(ACS_SHUNT * r.amps * r.amps).toFixed(2)} W at full scale` },
    ]
  },
}

/* ================================================================== */
/* Inertial measurement unit                                           */
/* ================================================================== */

const imu: PartDef = {
  id: 'sensor-imu',
  name: 'Accelerometer and gyro',
  category: 'sensor',
  blurb: 'Six axes on an I2C breakout',
  tags: ['imu', 'mpu6050', 'accelerometer', 'gyro', 'gyroscope', 'i2c', 'tilt', 'balance'],
  doc: {
    mpn: 'MPU-6050',
    price: 2.1,
    description:
      'Three axes of acceleration and three of rotation on one chip, read over I2C. The address pin picks between 0x68 and 0x69, which is how two of them share one bus.',
  },
  params: [
    {
      key: 'address', label: 'I2C address', type: 'enum', default: '0x68', group: 'Electrical',
      options: [{ value: '0x68', label: '0x68 (AD0 low)' }, { value: '0x69', label: '0x69 (AD0 high)' }],
    },
    { key: 'pitch', label: 'Pitch', type: 'number', unit: '°', default: 0, min: -90, max: 90, step: 1, group: 'Reading' },
    { key: 'roll', label: 'Roll', type: 'number', unit: '°', default: 0, min: -90, max: 90, step: 1, group: 'Reading' },
    {
      key: 'accelRange', label: 'Accelerometer range', type: 'enum', default: '2', group: 'Sensor',
      options: ['2', '4', '8', '16'].map((g) => ({ value: g, label: `±${g} g` })),
    },
  ],
  solids: () => {
    const W = 21.2
    const D = 15.6
    const T = 1.2
    return [
      {
        kind: 'extrude', mat: 'fr4-blue',
        profile: {
          outline: roundRect(W, D, 1.2, 0, 0, 3),
          holes: [circle(1.6, -W / 2 + 2.6, 0, 10), circle(1.6, W / 2 - 2.6, 0, 10)],
        },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [W, D], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 28, noCollide: true,
        items: [
          { t: 'text', at: [0, -D / 2 + 2], text: 'GY-521', size: 1.6, bold: true },
          { t: 'pads', at: [-3 * P, D / 2 - 2.2], n: 8, pitch: P, r: 0.85 },
        ],
      },
      { kind: 'box', mat: 'epoxy-black', size: [4, 0.9, 4], at: [0, T + 0.45, 1.4], noCollide: true },
      { kind: 'box', mat: { color: '#23262B', rough: 0.6, density: 3 }, size: [1.6, 0.5, 0.8], at: [5, T + 0.25, -3], noCollide: true },
      ...modulePins(8, D / 2 - 2.2, 0, -3 * P),
    ]
  },
  ports: () => {
    const W = 21.2
    const D = 15.6
    const names: [string, string, Port['role']][] = [
      ['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd'], ['scl', 'SCL', 'io'], ['sda', 'SDA', 'io'],
      ['xda', 'XDA', 'io'], ['xcl', 'XCL', 'io'], ['ad0', 'AD0', 'io'], ['int', 'INT', 'io'],
    ]
    const out: Port[] = modulePorts(names, D / 2 - 2.2, -4, -3 * P)
    out.push(
      { id: 'mount0', label: 'M3 mount', kind: 'mechanical', pos: [-W / 2 + 2.6, 1.2, 0], dir: [0, 1, 0], mate: { type: 'hole', size: 3.2 }, groupId: 'mounts' },
      { id: 'mount1', label: 'M3 mount', kind: 'mechanical', pos: [W / 2 - 2.6, 1.2, 0], dir: [0, 1, 0], mate: { type: 'hole', size: 3.2 }, groupId: 'mounts' },
    )
    return out
  },
  electrical: {
    devices: () => [
      // The module carries its own regulator and the two bus pull-ups, which
      // is why one of these works straight off a 5 V pin.
      { type: 'resistor', r: 1500, a: 'vcc', b: 'gnd' },
      { type: 'resistor', r: 4700, a: 'vcc', b: 'sda' },
      { type: 'resistor', r: 4700, a: 'vcc', b: 'scl' },
      { type: 'resistor', r: 100000, a: 'ad0', b: 'gnd' },
    ],
    limits: { vmax: 5.5 },
  },
  readouts: (p) => [
    { label: 'Axes', value: '3 acceleration, 3 rotation' },
    { label: 'Address', value: `${str(p, 'address', '0x68')}, set by AD0` },
    { label: 'Accelerometer', value: `±${str(p, 'accelRange', '2')} g` },
    { label: 'Attitude', value: `${num(p, 'pitch', 0).toFixed(0)}° pitch, ${num(p, 'roll', 0).toFixed(0)}° roll` },
  ],
}

registerParts([
  ldr, thermistor, soilSensor, gasSensor, ultrasonic,
  pir, dht, hall, irObstacle, tilt, currentSensor, imu,
])

export const SENSOR_PARTS = [
  ldr, thermistor, soilSensor, gasSensor, ultrasonic,
  pir, dht, hall, irObstacle, tilt, currentSensor, imu,
]
