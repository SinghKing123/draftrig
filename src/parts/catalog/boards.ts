import type { DeviceModel, PartDef, Port, SilkItem, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Development boards and the small modules that go beside them.
 *
 * These are the parts that turn a circuit into a project: a controller, a
 * driver, a charger, a converter. Each one carries the pin names printed on
 * the real board, because reading a legend off the silkscreen is how anyone
 * actually wires one of these up.
 */

const P = 2.54

/** A row of male header pins standing off a board. */
function malePins(x0: number, z: number, n: number, y0: number, len = 11.5): Solid[] {
  const out: Solid[] = []
  for (let i = 0; i < n; i++) {
    out.push({ kind: 'box', mat: 'tin', size: [0.64, len, 0.64], at: [x0 + i * P, y0 + len / 2 - 3, z] })
  }
  out.push({
    kind: 'box', mat: 'nylon-black', size: [n * P, 2.5, 2.5],
    at: [x0 + ((n - 1) * P) / 2, y0 + 1.25, z], bevel: 0.15,
  })
  return out
}

/** Electrical ports for one row of pins, hanging below the board. */
function rowPorts(names: [string, string, Port['role']][], x0: number, z: number, y = -1.6, imax = 0.04): Port[] {
  return names.map(([id, label, role], i) => ({
    id,
    label,
    kind: 'electrical' as const,
    pos: [x0 + i * P, y, z] as Vec3,
    dir: [0, -1, 0] as Vec3,
    role,
    imax,
    solderable: true,
  }))
}

/* ================================================================== */
/* Raspberry Pi Pico                                                   */
/* ================================================================== */

/** GPIO names down each edge, pin 1 at the USB end. Left column first. */
const PICO_LEFT: [string, string][] = [
  ['gp0', 'GP0'], ['gp1', 'GP1'], ['gnd1', 'GND'], ['gp2', 'GP2'], ['gp3', 'GP3'],
  ['gp4', 'GP4'], ['gp5', 'GP5'], ['gnd2', 'GND'], ['gp6', 'GP6'], ['gp7', 'GP7'],
  ['gp8', 'GP8'], ['gp9', 'GP9'], ['gnd3', 'GND'], ['gp10', 'GP10'], ['gp11', 'GP11'],
  ['gp12', 'GP12'], ['gp13', 'GP13'], ['gnd4', 'GND'], ['gp14', 'GP14'], ['gp15', 'GP15'],
]
const PICO_RIGHT: [string, string][] = [
  ['vbus', 'VBUS'], ['vsys', 'VSYS'], ['gnd5', 'GND'], ['en', '3V3_EN'], ['v33', '3V3'],
  ['aref', 'ADC_VREF'], ['gp28', 'GP28'], ['agnd', 'AGND'], ['gp27', 'GP27'], ['gp26', 'GP26'],
  ['run', 'RUN'], ['gp22', 'GP22'], ['gnd6', 'GND'], ['gp21', 'GP21'], ['gp20', 'GP20'],
  ['gp19', 'GP19'], ['gp18', 'GP18'], ['gnd7', 'GND'], ['gp17', 'GP17'], ['gp16', 'GP16'],
]

const PICO_W = 21
const PICO_D = 51
const PICO_T = 1.0

const pico: PartDef = {
  id: 'pi-pico',
  name: 'Raspberry Pi Pico',
  category: 'module',
  blurb: 'RP2040 on a 21 by 51 board, castellated all the way round',
  tags: ['pico', 'rp2040', 'raspberry pi', 'mcu', 'microcontroller', 'board', 'arm', 'micropython'],
  doc: {
    manufacturer: 'Raspberry Pi',
    mpn: 'SC0915',
    price: 4,
    datasheet: 'https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf',
    description:
      'Two ARM cores at 133 MHz with 264 kB of RAM and a flash chip beside them. The edges are castellated as well as drilled, so the same board can go in a header or be soldered flat onto another one.',
  },
  params: [
    { key: 'variant', label: 'Variant', type: 'enum', default: 'pico', group: 'Board', options: [
      { value: 'pico', label: 'Pico' }, { value: 'picow', label: 'Pico W, with wireless' },
    ] },
    { key: 'headers', label: 'Headers fitted', type: 'bool', default: true, group: 'Board' },
    { key: 'mask', label: 'Board colour', type: 'enum', default: 'fr4-green', group: 'Board', options: [
      { value: 'fr4-green', label: 'Green' }, { value: 'fr4-black', label: 'Black' },
    ] },
  ],
  solids: (p) => {
    const w = PICO_W
    const d = PICO_D
    const T = PICO_T
    const silk: SilkItem[] = [
      { t: 'text', at: [0, -6], text: 'Raspberry Pi', size: 2, bold: true },
      { t: 'text', at: [0, -9], text: p.variant === 'picow' ? 'Pico W' : 'Pico', size: 2.6, bold: true },
      { t: 'text', at: [0, -12.6], text: '(c) 2021', size: 1.3 },
      // The pin legends, printed inboard of each row as they are on the board.
      ...PICO_LEFT.map((n, i): SilkItem => ({
        t: 'text', at: [-w / 2 + 4.2, d / 2 - 4.7 - i * P], text: n[1], size: 1.25, align: 'left',
      })),
      ...PICO_RIGHT.map((n, i): SilkItem => ({
        t: 'text', at: [w / 2 - 4.2, d / 2 - 4.7 - i * P], text: n[1], size: 1.25, align: 'right',
      })),
    ]
    // Castellations: half-round notches down both long edges.
    const notches = [
      ...PICO_LEFT.map((_, i) => circle(0.8, -w / 2, d / 2 - 4.7 - i * P, 8)),
      ...PICO_RIGHT.map((_, i) => circle(0.8, w / 2, d / 2 - 4.7 - i * P, 8)),
      circle(1.05, 0, -d / 2 + 2, 10),
    ]
    const out: Solid[] = [
      {
        kind: 'extrude', mat: str(p, 'mask', 'fr4-green'),
        profile: { outline: roundRect(w, d, 1.6, 0, 0, 4), holes: notches },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      { kind: 'silk', size: [w, d], items: silk, mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 26, noCollide: true },
      // Micro USB at the top end.
      { kind: 'box', mat: { color: '#AEB4BC', metal: 1, rough: 0.46, density: 7.8 }, size: [7.5, 2.6, 5.5], at: [0, T + 1.3, d / 2 - 1.4] },
      // RP2040, the flash chip beside it, and the crystal.
      { kind: 'box', mat: 'epoxy-black', size: [7, 0.9, 7], at: [0, T + 0.45, 4], noCollide: true },
      { kind: 'box', mat: 'epoxy-black', size: [5, 0.8, 4], at: [0, T + 0.4, -3], noCollide: true },
      { kind: 'box', mat: { color: '#B8BEC6', metal: 1, rough: 0.34, density: 7.8 }, size: [3.2, 0.9, 2.5], at: [-5.5, T + 0.45, -3], noCollide: true },
      // The BOOTSEL button.
      { kind: 'box', mat: { color: '#E8EAEC', rough: 0.5, density: 1.4 }, size: [3.6, 1.6, 2.6], at: [0, T + 0.8, d / 2 - 8], noCollide: true },
      // The on-board LED, which is what everyone blinks first.
      {
        kind: 'box', tag: 'led',
        mat: { color: '#1E7A3C', rough: 0.3, density: 1.2, emissive: '#2BFF6A', emissiveIntensity: 0 },
        size: [1.6, 0.6, 0.8], at: [-4.5, T + 0.3, -10], noCollide: true,
      },
    ]
    if (p.variant === 'picow') {
      // The radio module and its antenna, which is a shape in the copper.
      out.push({ kind: 'box', mat: { color: '#C8CCD2', metal: 1, rough: 0.4, density: 7.8 }, size: [10, 1.2, 7], at: [0, T + 0.6, -14], noCollide: true })
    }
    if (p.headers !== false) {
      out.push(...malePins(-w / 2 + 1.6, d / 2 - 4.7, 1, T))
      // One strip per edge, laid along z rather than x, so build them by hand.
      for (const [sx, row] of [[-1, PICO_LEFT], [1, PICO_RIGHT]] as const) {
        for (let i = 0; i < row.length; i++) {
          out.push({ kind: 'box', mat: 'tin', size: [0.64, 11.5, 0.64], at: [(sx * w) / 2 - sx * 1.6, T + 2.75, d / 2 - 4.7 - i * P] })
        }
        out.push({
          kind: 'box', mat: 'nylon-black', size: [P, 2.5, row.length * P],
          at: [(sx * w) / 2 - sx * 1.6, T + 1.25, d / 2 - 4.7 - ((row.length - 1) * P) / 2], bevel: 0.15,
        })
      }
    }
    return out
  },
  ports: () => {
    const w = PICO_W
    const d = PICO_D
    const out: Port[] = []
    const role = (id: string): Port['role'] =>
      id.startsWith('gnd') || id === 'agnd' ? 'gnd'
      : id === 'vbus' || id === 'vsys' || id === 'v33' ? 'power'
      : 'io'
    for (const [sx, row] of [[-1, PICO_LEFT], [1, PICO_RIGHT]] as const) {
      row.forEach(([id, label], i) => {
        out.push({
          id, label, kind: 'electrical',
          pos: [(sx * w) / 2 - sx * 1.6, -1.4, d / 2 - 4.7 - i * P], dir: [0, -1, 0],
          role: role(id), imax: id === 'vbus' || id === 'vsys' ? 0.5 : 0.016, solderable: true,
        })
      })
    }
    out.push({
      id: 'mount0', label: 'M2 mount', kind: 'mechanical',
      pos: [0, PICO_T, -d / 2 + 2], dir: [0, 1, 0], mate: { type: 'hole', size: 2.1 },
    })
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: () => {
      const out: DeviceModel[] = [
        // The on-board buck-boost makes 3.3 V from anything between about
        // 1.8 and 5.5 V on VSYS, and VBUS reaches VSYS through a Schottky.
        { type: 'vsource', v: 3.3, a: 'v33', b: 'gnd1', rint: 0.15 },
        { type: 'diode', a: 'vbus', c: 'vsys', vf: 0.35, n: 1.05, rs: 0.1 },
        { type: 'resistor', r: 240, a: 'vsys', b: 'gnd1' },
      ]
      // Every ground pin is the same net, as on the board.
      for (const g of ['gnd2', 'gnd3', 'gnd4', 'gnd5', 'gnd6', 'gnd7', 'agnd']) {
        out.push({ type: 'short', a: 'gnd1', b: g })
      }
      return out
    },
    supplies: ['v33'],
    limits: { vmax: 5.5, imax: 0.3 },
  },
  price: (p) => (p.variant === 'picow' ? 6 : 4),
  readouts: (p) => [
    { label: 'Core', value: 'Dual Cortex-M0+, 133 MHz' },
    { label: 'Memory', value: '264 kB RAM, 2 MB flash' },
    { label: 'Logic level', value: '3.3 V, and not 5 V tolerant' },
    { label: 'Wireless', value: p.variant === 'picow' ? '2.4 GHz Wi-Fi and Bluetooth' : 'None' },
  ],
}

/* ================================================================== */
/* Arduino Nano                                                        */
/* ================================================================== */

const NANO_LEFT: [string, string, Port['role']][] = [
  ['d13', 'D13', 'io'], ['v3', '3V3', 'power'], ['aref', 'AREF', 'analog'],
  ['a0', 'A0', 'analog'], ['a1', 'A1', 'analog'], ['a2', 'A2', 'analog'], ['a3', 'A3', 'analog'],
  ['a4', 'A4 SDA', 'analog'], ['a5', 'A5 SCL', 'analog'], ['a6', 'A6', 'analog'], ['a7', 'A7', 'analog'],
  ['v5', '5V', 'power'], ['reset2', 'RST', 'io'], ['gnd', 'GND', 'gnd'], ['vin', 'VIN', 'power'],
]
const NANO_RIGHT: [string, string, Port['role']][] = [
  ['d12', 'D12', 'io'], ['d11', 'D11', 'io'], ['d10', 'D10', 'io'], ['d9', 'D9', 'io'],
  ['d8', 'D8', 'io'], ['d7', 'D7', 'io'], ['d6', 'D6', 'io'], ['d5', 'D5', 'io'],
  ['d4', 'D4', 'io'], ['d3', 'D3', 'io'], ['d2', 'D2', 'io'], ['gnd2', 'GND', 'gnd'],
  ['reset', 'RST', 'io'], ['d0', 'D0 RX', 'io'], ['d1', 'D1 TX', 'io'],
]

const NANO_W = 17.8
const NANO_D = 43.2

const nano: PartDef = {
  id: 'arduino-nano',
  name: 'Arduino Nano',
  category: 'module',
  blurb: 'The Uno on a board that fits a breadboard',
  tags: ['nano', 'arduino', 'atmega328', 'mcu', 'microcontroller', 'board', 'breadboard', 'sketch'],
  doc: {
    manufacturer: 'Arduino',
    mpn: 'A000005',
    price: 9,
    description:
      'The same processor as an Uno on a board narrow enough to straddle a breadboard. Two more analogue inputs than the Uno has, and no barrel jack, so it is fed from USB or from VIN.',
  },
  params: [
    { key: 'program', label: 'Sketch', type: 'enum', default: 'blink', group: 'Control', options: [
      { value: 'blink', label: 'Blink, toggle D13' },
      { value: 'fade', label: 'Fade, PWM ramp on D9' },
      { value: 'pwm', label: 'PWM, fixed duty on D5' },
      { value: 'button', label: 'Button, D2 toggles D13' },
      { value: 'chase', label: 'Chase, sequence D2 to D7' },
      { value: 'off', label: 'No program, all pins input' },
    ] },
    { key: 'interval', label: 'Interval', type: 'number', unit: 's', default: 0.5, min: 0.001, max: 10, step: 0.05, group: 'Control' },
    { key: 'duty', label: 'PWM duty', type: 'number', unit: '%', default: 50, min: 0, max: 100, step: 1, group: 'Control', showIf: (p) => p.program === 'pwm' },
    { key: 'power', label: 'Powered from', type: 'enum', default: 'usb', group: 'Control', options: [
      { value: 'usb', label: 'USB' }, { value: 'vin', label: 'VIN' },
    ] },
    { key: 'mask', label: 'Board colour', type: 'enum', default: 'fr4-blue', group: 'Board', options: [
      { value: 'fr4-blue', label: 'Blue' }, { value: 'fr4-black', label: 'Black' }, { value: 'fr4-green', label: 'Green' },
    ] },
  ],
  solids: (p) => {
    const w = NANO_W
    const d = NANO_D
    const T = 1.6
    const silk: SilkItem[] = [
      { t: 'text', at: [0, 2], text: 'NANO', size: 3, bold: true },
      { t: 'text', at: [0, -1.6], text: 'ARDUINO', size: 1.6 },
      ...NANO_LEFT.map((n, i): SilkItem => ({
        t: 'text', at: [-w / 2 + 3.6, d / 2 - 3.4 - i * P], text: n[1], size: 1.15, align: 'left',
      })),
      ...NANO_RIGHT.map((n, i): SilkItem => ({
        t: 'text', at: [w / 2 - 3.6, d / 2 - 3.4 - i * P], text: n[1], size: 1.15, align: 'right',
      })),
    ]
    return [
      {
        kind: 'extrude', mat: str(p, 'mask', 'fr4-blue'),
        profile: { outline: roundRect(w, d, 1, 0, 0, 3) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      { kind: 'silk', size: [w, d], items: silk, mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 28, noCollide: true },
      // Mini USB, the processor, the regulator and the four indicator LEDs.
      { kind: 'box', mat: { color: '#AEB4BC', metal: 1, rough: 0.46, density: 7.8 }, size: [7.6, 4, 6 ], at: [0, T + 2, d / 2 - 2] },
      { kind: 'box', mat: 'epoxy-black', size: [9, 1, 9], at: [0, T + 0.5, 0], noCollide: true },
      { kind: 'box', mat: 'epoxy-black', size: [3.5, 1.2, 2.6], at: [-5.5, T + 0.6, 12], noCollide: true },
      { kind: 'box', mat: { color: '#B8BEC6', metal: 1, rough: 0.34, density: 7.8 }, size: [4.5, 1.2, 3.2], at: [4, T + 0.6, -8], noCollide: true },
      ...(['#2BFF6A', '#FFD23A', '#FFD23A', '#FF8A3A'] as const).map((c, i): Solid => ({
        kind: 'box', tag: `led${i}`,
        mat: { color: '#2A2E34', rough: 0.35, density: 1.2, emissive: c, emissiveIntensity: 0 },
        size: [1.6, 0.6, 0.8], at: [-4 + i * 2.2, T + 0.3, 7], noCollide: true,
      })),
      // The two long pin rows, plus the six-way ICSP at the far end.
      ...([-1, 1] as const).flatMap((sx) => {
        const strip: Solid[] = []
        for (let i = 0; i < 15; i++) {
          strip.push({ kind: 'box', mat: 'tin', size: [0.64, 11.5, 0.64], at: [(sx * w) / 2 - sx * 1.27, T + 2.75, d / 2 - 3.4 - i * P] })
        }
        strip.push({
          kind: 'box', mat: 'nylon-black', size: [P, 2.5, 15 * P],
          at: [(sx * w) / 2 - sx * 1.27, T + 1.25, d / 2 - 3.4 - (14 * P) / 2], bevel: 0.15,
        })
        return strip
      }),
    ]
  },
  ports: () => {
    const w = NANO_W
    const d = NANO_D
    const out: Port[] = []
    for (const [sx, row] of [[-1, NANO_LEFT], [1, NANO_RIGHT]] as const) {
      row.forEach(([id, label, role], i) => {
        out.push({
          id, label, kind: 'electrical',
          pos: [(sx * w) / 2 - sx * 1.27, -1.4, d / 2 - 3.4 - i * P], dir: [0, -1, 0],
          role, imax: role === 'power' ? 0.5 : 0.04, solderable: true,
        })
      })
    }
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: () => [
      {
        type: 'behavioral', evalId: 'mcu', ref: 'gnd',
        pins: [
          'vin', 'v5', 'v3',
          'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7',
          'd8', 'd9', 'd10', 'd11', 'd12', 'd13',
          'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
        ],
      },
      { type: 'short', a: 'gnd', b: 'gnd2' },
      // A6 and A7 are analogue only and exist on the Nano but not the Uno.
      { type: 'resistor', r: 1e8, a: 'a6', b: 'gnd' },
      { type: 'resistor', r: 1e8, a: 'a7', b: 'gnd' },
      { type: 'resistor', r: 1e8, a: 'aref', b: 'gnd' },
      { type: 'resistor', r: 10000, a: 'v5', b: 'reset' },
      { type: 'short', a: 'reset', b: 'reset2' },
    ],
    supplies: ['v5', 'v3'],
    limits: { imax: 0.2, vmax: 12 },
  },
  readouts: () => [
    { label: 'Processor', value: 'ATmega328P, 16 MHz' },
    { label: 'Logic level', value: '5 V' },
    { label: 'Analogue inputs', value: '8, two more than an Uno' },
    { label: 'Per-pin current', value: '20 mA, 200 mA in total' },
  ],
}

/* ================================================================== */
/* Stepper driver                                                      */
/* ================================================================== */

const DRIVERS: Record<string, { label: string; vref: number; imax: number; steps: number[]; rsense: number }> = {
  a4988: { label: 'A4988, up to 2 A', vref: 0.8, imax: 2, steps: [1, 2, 4, 8, 16], rsense: 0.1 },
  drv8825: { label: 'DRV8825, up to 2.2 A', vref: 0.65, imax: 2.2, steps: [1, 2, 4, 8, 16, 32], rsense: 0.1 },
  tmc2209: { label: 'TMC2209, quiet, 2 A', vref: 0.9, imax: 2, steps: [1, 2, 4, 8, 16, 32, 64], rsense: 0.11 },
}

const stepperDriver: PartDef = {
  id: 'stepper-driver',
  name: 'Stepper driver',
  category: 'module',
  blurb: 'Chops current into a coil, set by one small pot',
  tags: ['a4988', 'drv8825', 'tmc2209', 'stepper', 'driver', 'pololu', '3d printer', 'cnc', 'microstep'],
  doc: {
    manufacturer: 'Pololu',
    mpn: 'A4988',
    price: 3,
    description:
      'A current-chopping driver on a 15 by 20 mm board. It regulates coil current rather than voltage, which is the only way to drive a stepper at any speed, and the trimmer sets that current. Set it too high and the motor cooks; too low and it skips.',
  },
  params: [
    { key: 'model', label: 'Driver', type: 'enum', default: 'a4988', group: 'Driver', options: Object.entries(DRIVERS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'vref', label: 'Vref', type: 'number', unit: 'V', default: 0.8, min: 0.05, max: 2, step: 0.01, group: 'Driver', help: 'The voltage on the trimmer, which sets the coil current.' },
    { key: 'microstep', label: 'Microstepping', type: 'number', default: 16, min: 1, max: 64, step: 1, group: 'Driver' },
    { key: 'heatsink', label: 'Heatsink fitted', type: 'bool', default: true, group: 'Thermal' },
  ],
  solids: (p) => {
    const w = 15.5
    const d = 20.5
    const T = 1.6
    const out: Solid[] = [
      {
        kind: 'extrude', mat: 'fr4-green',
        profile: { outline: roundRect(w, d, 1, 0, 0, 3) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [w, d], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 30, noCollide: true,
        items: [
          { t: 'text', at: [0, d / 2 - 2], text: str(p, 'model', 'a4988').toUpperCase(), size: 1.6, bold: true },
          ...['EN', 'MS1', 'MS2', 'MS3', 'RST', 'SLP', 'STP', 'DIR'].map((s, i): SilkItem => ({
            t: 'text', at: [-w / 2 + 2.4, d / 2 - 5 - i * P], text: s, size: 1.1, align: 'left',
          })),
          ...['VMOT', 'GND', 'A2', 'A1', 'B1', 'B2', 'VDD', 'GND'].map((s, i): SilkItem => ({
            t: 'text', at: [w / 2 - 2.4, d / 2 - 5 - i * P], text: s, size: 1.1, align: 'right',
          })),
        ],
      },
      // The driver chip, the trimmer and the two current-sense resistors.
      { kind: 'box', mat: 'epoxy-black', size: [5, 1, 5], at: [0, T + 0.5, 1] },
      { kind: 'cyl', mat: { color: '#1F4FA8', rough: 0.5, density: 1.6 }, r: 1.6, h: 1.6, at: [0, T + 0.8, -d / 2 + 3], seg: 14 },
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'box', mat: { color: '#1B1E22', rough: 0.6, density: 3 }, size: [2, 0.6, 1.2],
        at: [s * 4, T + 0.3, -3] as Vec3, noCollide: true,
      })),
      // Pins go down on both edges: this plugs into a socket on a controller.
      ...([-1, 1] as const).flatMap((sx) =>
        Array.from({ length: 8 }, (_, i): Solid => ({
          kind: 'box', mat: 'tin', size: [0.64, 6, 0.64],
          at: [(sx * w) / 2 - sx * 1.6, -1.4, d / 2 - 5 - i * P] as Vec3,
        })),
      ),
    ]
    if (p.heatsink !== false) {
      out.push({ kind: 'box', mat: { color: '#1E5FA8', metal: 0.9, rough: 0.5, density: 2.7 }, size: [9, 1.5, 9], at: [0, T + 1.75, 1] })
      for (let i = 0; i < 4; i++) {
        out.push({ kind: 'box', mat: { color: '#1E5FA8', metal: 0.9, rough: 0.5, density: 2.7 }, size: [1.4, 5, 9], at: [-3.3 + i * 2.2, T + 5, 1] })
      }
    }
    return out
  },
  ports: () => {
    const w = 15.5
    const d = 20.5
    const left: [string, string, Port['role']][] = [
      ['en', 'ENABLE', 'io'], ['ms1', 'MS1', 'io'], ['ms2', 'MS2', 'io'], ['ms3', 'MS3', 'io'],
      ['rst', 'RESET', 'io'], ['slp', 'SLEEP', 'io'], ['step', 'STEP', 'io'], ['dir', 'DIR', 'io'],
    ]
    const right: [string, string, Port['role']][] = [
      ['vmot', 'VMOT', 'power'], ['gndm', 'GND (motor)', 'gnd'], ['a2', '2A', 'passive'], ['a1', '1A', 'passive'],
      ['b1', '1B', 'passive'], ['b2', '2B', 'passive'], ['vdd', 'VDD (logic)', 'power'], ['gnd', 'GND (logic)', 'gnd'],
    ]
    const out: Port[] = []
    for (const [sx, row] of [[-1, left], [1, right]] as const) {
      row.forEach(([id, label, role], i) => {
        out.push({
          id, label, kind: 'electrical',
          pos: [(sx * w) / 2 - sx * 1.6, -4, d / 2 - 5 - i * P], dir: [0, -1, 0],
          role, imax: role === 'passive' || id === 'vmot' ? 2 : 0.02, solderable: true,
        })
      })
    }
    return out
  },
  electrical: {
    devices: () => [
      // The logic side idles at a few milliamps; the motor side is a switching
      // stage, so at rest it presents little more than its own quiescent draw.
      { type: 'resistor', r: 1500, a: 'vdd', b: 'gnd' },
      { type: 'resistor', r: 4700, a: 'vmot', b: 'gndm' },
      { type: 'short', a: 'gnd', b: 'gndm' },
      // Coil outputs sit at half the motor rail when idle.
      { type: 'resistor', r: 100000, a: 'a1', b: 'a2' },
      { type: 'resistor', r: 100000, a: 'b1', b: 'b2' },
    ],
    limits: { vmax: 35, imax: 2 },
  },
  readouts: (p) => {
    const d = DRIVERS[str(p, 'model', 'a4988')] ?? DRIVERS.a4988
    const vref = num(p, 'vref', 0.8)
    // A4988: I = Vref / (8 x Rsense). DRV8825: I = Vref / 5 x Rsense.
    const amps = str(p, 'model', 'a4988') === 'drv8825' ? vref / (5 * d.rsense) : vref / (8 * d.rsense)
    const step = Math.round(num(p, 'microstep', 16))
    return [
      { label: 'Coil current', value: `${Math.min(amps, d.imax).toFixed(2)} A from ${vref.toFixed(2)} V Vref` },
      { label: 'Driver limit', value: `${d.imax} A with cooling` },
      { label: 'Microstepping', value: `1/${step}, ${200 * step} steps a turn` },
      { label: 'Motor supply', value: '8 to 35 V' },
    ]
  },
}

/* ================================================================== */
/* Lithium charger                                                     */
/* ================================================================== */

const charger: PartDef = {
  id: 'charger-tp4056',
  name: 'Lithium charger',
  category: 'power',
  blurb: 'One cell, constant current then constant voltage',
  tags: ['tp4056', 'charger', 'lithium', 'li-ion', 'lipo', '18650', 'usb', 'protection', 'battery'],
  doc: {
    mpn: 'TP4056',
    price: 0.8,
    description:
      'The small red charging board. It charges one lithium cell at a current set by a single resistor, holding that current until the cell reaches 4.2 V and then holding the voltage. The version with protection adds an over-discharge and short-circuit cut-out that the bare one has not got.',
  },
  params: [
    { key: 'current', label: 'Charge current', type: 'number', unit: 'A', default: 1, min: 0.13, max: 1, step: 0.05, group: 'Charger', help: 'Set by the programming resistor. 1.2 k gives a full amp.' },
    { key: 'protection', label: 'Protection circuit fitted', type: 'bool', default: true, group: 'Charger' },
    {
      key: 'connector', label: 'Input', type: 'enum', default: 'usb-c', group: 'Board',
      options: [{ value: 'usb-c', label: 'USB-C' }, { value: 'micro', label: 'Micro USB' }],
    },
  ],
  solids: (p) => {
    const w = 26
    const d = 17
    const T = 1.2
    const usbC = str(p, 'connector', 'usb-c') === 'usb-c'
    return [
      {
        kind: 'extrude', mat: 'fr4-red',
        profile: { outline: roundRect(w, d, 1, 0, 0, 3), holes: [circle(1.1, -w / 2 + 2.4, 0, 10), circle(1.1, w / 2 - 2.4, 0, 10)] },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [w, d], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 28, noCollide: true,
        items: [
          { t: 'text', at: [-w / 2 + 7, -d / 2 + 2], text: 'B+  B-', size: 1.4, bold: true },
          { t: 'text', at: [w / 2 - 7, -d / 2 + 2], text: 'OUT+ OUT-', size: 1.2 },
        ],
      },
      usbC
        ? { kind: 'box', mat: { color: '#AEB4BC', metal: 1, rough: 0.46, density: 7.8 }, size: [9, 3.2, 7.4], at: [0, T + 1.6, d / 2 - 2] }
        : { kind: 'box', mat: { color: '#AEB4BC', metal: 1, rough: 0.46, density: 7.8 }, size: [8, 2.8, 5.5], at: [0, T + 1.4, d / 2 - 1.6] },
      { kind: 'box', mat: 'epoxy-black', size: [5, 1, 4], at: [-4, T + 0.5, 1], noCollide: true },
      ...(p.protection !== false
        ? [{ kind: 'box' as const, mat: 'epoxy-black', size: [4, 0.9, 3] as Vec3, at: [5, T + 0.45, 1] as Vec3, noCollide: true }]
        : []),
      // Charging and done LEDs.
      ...(['#FF3A2A', '#2BFF6A'] as const).map((c, i): Solid => ({
        kind: 'box', tag: `led${i}`,
        mat: { color: '#2A2E34', rough: 0.3, density: 1.2, emissive: c, emissiveIntensity: 0 },
        size: [1.6, 0.6, 0.8], at: [-3 + i * 3, T + 0.3, 5], noCollide: true,
      })),
      // Four solder pads, front edge.
      ...Array.from({ length: 4 }, (_, i): Solid => ({
        kind: 'cyl', mat: 'gold', r: 1.1, h: 0.1,
        at: [-w / 2 + 5 + i * 5.2, T + 0.05, -d / 2 + 4] as Vec3, seg: 12, noCollide: true,
      })),
    ]
  },
  ports: () => {
    const w = 26
    const d = 17
    const names: [string, string, Port['role']][] = [
      ['bp', 'B+ (cell)', 'power'], ['bn', 'B− (cell)', 'gnd'],
      ['outp', 'OUT+', 'power'], ['outn', 'OUT−', 'gnd'],
    ]
    const out: Port[] = names.map(([id, label, role], i) => ({
      id, label, kind: 'electrical' as const,
      pos: [-w / 2 + 5 + i * 5.2, -1.2, -d / 2 + 4] as Vec3, dir: [0, -1, 0] as Vec3,
      role, imax: 3, solderable: true,
    }))
    out.push(
      { id: 'mount0', label: 'M2 mount', kind: 'mechanical', pos: [-w / 2 + 2.4, 1.2, 0], dir: [0, 1, 0], mate: { type: 'hole', size: 2.2 }, groupId: 'mounts' },
      { id: 'mount1', label: 'M2 mount', kind: 'mechanical', pos: [w / 2 - 2.4, 1.2, 0], dir: [0, 1, 0], mate: { type: 'hole', size: 2.2 }, groupId: 'mounts' },
    )
    return out
  },
  electrical: {
    devices: (p) => {
      const out: DeviceModel[] = [
        { type: 'short', a: 'bn', b: 'outn' },
      ]
      // With protection the cell reaches the output through two FETs in
      // series; without it the two are simply the same node.
      if (p.protection !== false) out.push({ type: 'resistor', r: 0.05, a: 'bp', b: 'outp' })
      else out.push({ type: 'short', a: 'bp', b: 'outp' })
      return out
    },
    limits: { vmax: 6, imax: 3 },
  },
  readouts: (p) => {
    const i = num(p, 'current', 1)
    return [
      { label: 'Charge current', value: `${i.toFixed(2)} A` },
      { label: 'Programming resistor', value: eng(1200 / i, 'Ω') },
      { label: 'Termination', value: '4.2 V, stops at a tenth of the set current' },
      { label: 'Protection', value: p.protection !== false ? 'Over-discharge at 2.4 V, 3 A short cut-out' : 'None fitted' },
    ]
  },
}

/* ================================================================== */
/* Boost converter                                                     */
/* ================================================================== */

const boost: PartDef = {
  id: 'boost-converter',
  name: 'Boost converter',
  category: 'power',
  blurb: 'Steps voltage up, and takes more current in than it gives out',
  tags: ['boost', 'step up', 'converter', 'mt3608', 'xl6009', 'dc-dc', 'supply', 'power'],
  doc: {
    mpn: 'MT3608',
    price: 0.9,
    description:
      'A switching step-up on a small board. Power in has to at least equal power out, so doubling the voltage more than doubles the input current, which is what catches people feeding one from a coin cell.',
  },
  params: [
    { key: 'vout', label: 'Output voltage', type: 'number', unit: 'V', default: 12, min: 2.5, max: 28, step: 0.1, group: 'Converter' },
    { key: 'imax', label: 'Output current limit', type: 'number', unit: 'A', default: 1, min: 0.05, max: 2, step: 0.05, group: 'Converter' },
    { key: 'efficiency', label: 'Efficiency', type: 'number', unit: '%', default: 90, min: 60, max: 97, step: 1, group: 'Converter' },
  ],
  solids: () => {
    const w = 36
    const d = 17
    const T = 1.2
    return [
      {
        kind: 'extrude', mat: 'fr4-blue',
        profile: { outline: roundRect(w, d, 1, 0, 0, 3), holes: [circle(1.6, -w / 2 + 3, 0, 10), circle(1.6, w / 2 - 3, 0, 10)] },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [w, d], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 26, noCollide: true,
        items: [
          { t: 'text', at: [-w / 2 + 7, -d / 2 + 2.2], text: 'IN+ IN-', size: 1.3, bold: true },
          { t: 'text', at: [w / 2 - 7, -d / 2 + 2.2], text: 'OUT+ OUT-', size: 1.3, bold: true },
        ],
      },
      // Inductor, the switching chip, and two electrolytics.
      { kind: 'box', mat: { color: '#23262B', rough: 0.65, density: 4 }, size: [6.5, 4.5, 6.5], at: [0, T + 2.25, 1], bevel: 0.4 },
      { kind: 'box', mat: 'epoxy-black', size: [3, 1, 2.2], at: [-7, T + 0.5, 2], noCollide: true },
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'cyl', mat: 'elcap-sleeve', r: 3.2, h: 7, at: [s * 12, T + 3.5, 1] as Vec3, chamfer: 0.4,
      })),
      // The adjustment trimmer, which is what the output voltage really is.
      { kind: 'box', mat: { color: '#1F4FA8', rough: 0.5, density: 1.6 }, size: [6, 4.4, 6], at: [0, T + 2.2, -5], bevel: 0.3 },
      ...Array.from({ length: 4 }, (_, i): Solid => ({
        kind: 'cyl', mat: 'gold', r: 1.2, h: 0.1,
        at: [-w / 2 + 7 + (i % 2) * 5 + Math.floor(i / 2) * 12, T + 0.05, -d / 2 + 4] as Vec3, seg: 12, noCollide: true,
      })),
    ]
  },
  ports: () => {
    const w = 36
    const d = 17
    const names: [string, string, Port['role']][] = [
      ['inp', 'IN+', 'power'], ['inn', 'IN−', 'gnd'], ['outp', 'OUT+', 'power'], ['outn', 'OUT−', 'gnd'],
    ]
    return names.map(([id, label, role], i) => ({
      id, label, kind: 'electrical' as const,
      pos: [-w / 2 + 7 + (i % 2) * 5 + Math.floor(i / 2) * 12, -1.2, -d / 2 + 4] as Vec3,
      dir: [0, -1, 0] as Vec3, role, imax: 2, solderable: true,
    }))
  },
  electrical: {
    devices: (p) => [
      { type: 'short', a: 'inn', b: 'outn' },
      { type: 'vsource', v: num(p, 'vout', 12), a: 'outp', b: 'outn', rint: 0.08 },
      // Quiescent draw of the switcher itself.
      { type: 'resistor', r: 8000, a: 'inp', b: 'inn' },
    ],
    supplies: ['outp'],
    limits: { vmax: 28, imax: 2 },
  },
  readouts: (p) => {
    const vout = num(p, 'vout', 12)
    const i = num(p, 'imax', 1)
    const eff = num(p, 'efficiency', 90) / 100
    return [
      { label: 'Output', value: `${vout.toFixed(1)} V at up to ${i.toFixed(2)} A` },
      { label: 'Output power', value: `${(vout * i).toFixed(1)} W` },
      { label: 'Input at 5 V', value: `${((vout * i) / eff / 5).toFixed(2)} A` },
      { label: 'Heat', value: `${((vout * i) / eff - vout * i).toFixed(2)} W in the board` },
    ]
  },
}

/* ================================================================== */
/* Real time clock                                                     */
/* ================================================================== */

const rtc: PartDef = {
  id: 'rtc-ds3231',
  name: 'Real time clock',
  category: 'module',
  blurb: 'Keeps time with the power off, and does not drift',
  tags: ['rtc', 'ds3231', 'clock', 'time', 'i2c', 'battery', 'calendar', 'timekeeping'],
  doc: {
    mpn: 'DS3231',
    price: 1.8,
    description:
      'A clock chip with its crystal inside the package and a temperature sensor watching it, which is why this holds two minutes a year where a DS1307 loses that in a week. A coin cell keeps it running with the board unpowered.',
  },
  params: [
    { key: 'battery', label: 'Backup cell fitted', type: 'bool', default: true, group: 'Module' },
    {
      key: 'address', label: 'I2C address', type: 'enum', default: '0x68', group: 'Electrical',
      options: [{ value: '0x68', label: '0x68, fixed' }],
    },
    { key: 'tempC', label: 'Temperature', type: 'number', unit: '°C', default: 22, min: -40, max: 85, step: 0.25, group: 'Reading' },
  ],
  solids: (p) => {
    const w = 38
    const d = 22
    const T = 1.2
    const out: Solid[] = [
      {
        kind: 'extrude', mat: 'fr4-red',
        profile: { outline: roundRect(w, d, 1.4, 0, 0, 3), holes: [circle(1.6, -w / 2 + 3, d / 2 - 3, 10), circle(1.6, -w / 2 + 3, -d / 2 + 3, 10)] },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [w, d], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 24, noCollide: true,
        items: [
          { t: 'text', at: [2, -d / 2 + 2], text: 'DS3231', size: 1.8, bold: true },
          { t: 'pads', at: [-w / 2 + 6, d / 2 - 2.4], n: 6, pitch: P, r: 0.9 },
        ],
      },
      { kind: 'box', mat: 'epoxy-black', size: [7.5, 1.2, 5], at: [0, T + 0.6, 1], noCollide: true },
      { kind: 'box', mat: 'epoxy-black', size: [5, 1, 4], at: [10, T + 0.5, 1], noCollide: true },
      ...malePins(-w / 2 + 6, d / 2 - 2.4, 6, T),
    ]
    if (p.battery !== false) {
      // CR2032 in its holder, which is most of the height of the board.
      out.push({ kind: 'cyl', mat: { color: '#C8CCD2', rough: 0.3, metal: 1, density: 7.8 }, r: 10.2, h: 3.2, at: [-6, T + 1.6, -3], seg: 26 })
      out.push({ kind: 'cyl', mat: { color: '#8A8F98', rough: 0.4, metal: 1, density: 7.8 }, r: 11, h: 1.2, at: [-6, T + 0.6, -3], seg: 26 })
    }
    return out
  },
  ports: () => {
    const w = 38
    const d = 22
    const names: [string, string, Port['role']][] = [
      ['v32k', '32K', 'io'], ['sqw', 'SQW', 'io'], ['scl', 'SCL', 'io'],
      ['sda', 'SDA', 'io'], ['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd'],
    ]
    const out: Port[] = rowPorts(names, -w / 2 + 6, d / 2 - 2.4)
    out.push(
      { id: 'mount0', label: 'M3 mount', kind: 'mechanical', pos: [-w / 2 + 3, 1.2, d / 2 - 3], dir: [0, 1, 0], mate: { type: 'hole', size: 3.2 }, groupId: 'mounts' },
      { id: 'mount1', label: 'M3 mount', kind: 'mechanical', pos: [-w / 2 + 3, 1.2, -d / 2 + 3], dir: [0, 1, 0], mate: { type: 'hole', size: 3.2 }, groupId: 'mounts' },
    )
    return out
  },
  electrical: {
    devices: () => [
      { type: 'resistor', r: 47000, a: 'vcc', b: 'gnd' },
      { type: 'resistor', r: 4700, a: 'vcc', b: 'sda' },
      { type: 'resistor', r: 4700, a: 'vcc', b: 'scl' },
      { type: 'resistor', r: 4700, a: 'vcc', b: 'sqw' },
    ],
    limits: { vmax: 5.5 },
  },
  readouts: (p) => [
    { label: 'Accuracy', value: '±2 ppm, about a minute a year' },
    { label: 'Interface', value: `I2C at ${str(p, 'address', '0x68')}` },
    { label: 'Backup', value: p.battery !== false ? 'CR2032, several years' : 'None, time is lost on power down' },
    { label: 'Temperature', value: `${num(p, 'tempC', 22).toFixed(2)} °C, readable over the bus` },
  ],
}

/* ================================================================== */
/* SD card module                                                      */
/* ================================================================== */

const sdModule: PartDef = {
  id: 'sd-card-module',
  name: 'SD card module',
  category: 'module',
  blurb: 'Card socket with the 3.3 V regulator and shifters a card needs',
  tags: ['sd', 'microsd', 'card', 'storage', 'spi', 'logging', 'module', 'datalogger'],
  doc: {
    price: 1.1,
    description:
      'A card socket, a 3.3 V regulator and level shifters on the four SPI lines. Cards are 3.3 V parts, so a module without those shifters works from a 5 V board only by luck and not for long.',
  },
  params: [
    {
      key: 'size', label: 'Card', type: 'enum', default: 'micro', group: 'Module',
      options: [{ value: 'micro', label: 'microSD' }, { value: 'full', label: 'Full size SD' }],
    },
    { key: 'inserted', label: 'Card inserted', type: 'bool', default: true, group: 'Module' },
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '32', group: 'Module', options: ['2', '8', '16', '32', '64'].map((g) => ({ value: g, label: `${g} GB` })) },
  ],
  solids: (p) => {
    const micro = str(p, 'size', 'micro') === 'micro'
    const w = micro ? 24 : 42
    const d = micro ? 32 : 36
    const T = 1.2
    const out: Solid[] = [
      {
        kind: 'extrude', mat: 'fr4-blue',
        profile: { outline: roundRect(w, d, 1.4, 0, 0, 3), holes: [circle(1.6, -w / 2 + 3, -d / 2 + 3, 10), circle(1.6, w / 2 - 3, -d / 2 + 3, 10)] },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [w, d], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 24, noCollide: true,
        items: [
          { t: 'pads', at: [-2.5 * P, -d / 2 + 3.4], n: 6, pitch: P, r: 0.9 },
          ...['GND', 'VCC', 'MISO', 'MOSI', 'SCK', 'CS'].map((s, i): SilkItem => ({
            t: 'text', at: [-2.5 * P + i * P, -d / 2 + 6], text: s, size: 0.9, rot: 90,
          })),
        ],
      },
      // The socket: a stamped steel shell over the contacts.
      { kind: 'box', mat: { color: '#AEB4BC', metal: 1, rough: 0.46, density: 7.8 }, size: [micro ? 15 : 28, 1.8, micro ? 16 : 20], at: [0, T + 0.9, 3] },
      { kind: 'box', mat: { color: '#1A1D21', rough: 0.7, density: 1.4 }, size: [micro ? 13 : 26, 1, micro ? 14 : 18], at: [0, T + 0.5, 3], noCollide: true },
      // Regulator and shifter.
      { kind: 'box', mat: 'epoxy-black', size: [4, 0.9, 3], at: [-7, T + 0.45, -8], noCollide: true },
      { kind: 'box', mat: 'epoxy-black', size: [5, 0.9, 4], at: [2, T + 0.45, -8], noCollide: true },
      ...malePins(-2.5 * P, -d / 2 + 3.4, 6, T),
    ]
    if (p.inserted !== false) {
      out.push({
        kind: 'box', mat: { color: '#1B1E22', rough: 0.6, density: 1.4 },
        size: [micro ? 11 : 24, 1, micro ? 15 : 32], at: [0, T + 0.5, micro ? 8 : 10],
      })
    }
    return out
  },
  ports: (p) => {
    const d = str(p, 'size', 'micro') === 'micro' ? 32 : 36
    const names: [string, string, Port['role']][] = [
      ['gnd', 'GND', 'gnd'], ['vcc', 'VCC', 'power'], ['miso', 'MISO', 'io'],
      ['mosi', 'MOSI', 'io'], ['sck', 'SCK', 'io'], ['cs', 'CS', 'io'],
    ]
    return rowPorts(names, -2.5 * P, -d / 2 + 3.4)
  },
  electrical: {
    devices: () => [
      // A card in a read or a write pulls a surprising amount, up to 100 mA
      // in bursts, which is why a board running off a 3.3 V pin browns out.
      { type: 'resistor', r: 330, a: 'vcc', b: 'gnd' },
      { type: 'resistor', r: 10000, a: 'vcc', b: 'cs' },
    ],
    limits: { vmax: 5.5 },
  },
  readouts: (p) => [
    { label: 'Interface', value: 'SPI, four lines and a chip select' },
    { label: 'Card', value: p.inserted !== false ? `${str(p, 'capacity', '32')} GB inserted` : 'Empty' },
    { label: 'Logic', value: '5 V tolerant, shifted to 3.3 V on the board' },
    { label: 'Peak current', value: 'About 100 mA during a write' },
  ],
}

/* ================================================================== */
/* Level shifter                                                       */
/* ================================================================== */

const levelShifter: PartDef = {
  id: 'level-shifter',
  name: 'Level shifter',
  category: 'module',
  blurb: 'Four channels between a 5 V board and a 3.3 V one, both ways',
  tags: ['level shifter', 'logic level', '3.3v', '5v', 'converter', 'bidirectional', 'bss138', 'translate'],
  doc: {
    mpn: 'BSS138 x4',
    price: 0.7,
    description:
      'Four small MOSFETs with pull-ups either side. Each channel passes signals both ways without being told which direction they are going, which is what makes these work on an I2C bus where the same wire is driven from both ends.',
  },
  params: [
    { key: 'channels', label: 'Channels', type: 'number', default: 4, min: 2, max: 8, step: 2, group: 'Module' },
    { key: 'vHigh', label: 'High side', type: 'number', unit: 'V', default: 5, min: 2.5, max: 12, step: 0.1, group: 'Electrical' },
    { key: 'vLow', label: 'Low side', type: 'number', unit: 'V', default: 3.3, min: 1.8, max: 5, step: 0.1, group: 'Electrical' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'channels', 4))
    const w = (n + 1) * P + 4
    const d = 15.5
    const T = 1.2
    return [
      {
        kind: 'extrude', mat: 'fr4-blue',
        profile: { outline: roundRect(w, d, 1, 0, 0, 3) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [w, d], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 28, noCollide: true,
        items: [
          { t: 'text', at: [0, 0], text: 'HV | LV', size: 1.4, bold: true },
          { t: 'pads', at: [-((n) * P) / 2, d / 2 - 2.2], n: n + 1, pitch: P, r: 0.85 },
          { t: 'pads', at: [-((n) * P) / 2, -d / 2 + 2.2], n: n + 1, pitch: P, r: 0.85 },
        ],
      },
      // One small MOSFET per channel, in a row down the middle.
      ...Array.from({ length: n }, (_, i): Solid => ({
        kind: 'box', mat: 'epoxy-black', size: [1.6, 0.7, 1.4],
        at: [-((n - 1) * P) / 2 + i * P, T + 0.35, 3] as Vec3, noCollide: true,
      })),
      ...malePins(-(n * P) / 2, d / 2 - 2.2, n + 1, T),
      ...malePins(-(n * P) / 2, -d / 2 + 2.2, n + 1, T),
    ]
  },
  ports: (p) => {
    const n = Math.round(num(p, 'channels', 4))
    const w = (n + 1) * P + 4
    const d = 15.5
    const out: Port[] = []
    const x0 = -(n * P) / 2
    out.push({ id: 'hv', label: 'HV (high side supply)', kind: 'electrical', pos: [x0, -1.4, d / 2 - 2.2], dir: [0, -1, 0], role: 'power', imax: 0.2, solderable: true })
    out.push({ id: 'lv', label: 'LV (low side supply)', kind: 'electrical', pos: [x0, -1.4, -d / 2 + 2.2], dir: [0, -1, 0], role: 'power', imax: 0.2, solderable: true })
    for (let i = 0; i < n; i++) {
      out.push({ id: `h${i + 1}`, label: `HV${i + 1}`, kind: 'electrical', pos: [x0 + (i + 1) * P, -1.4, d / 2 - 2.2], dir: [0, -1, 0], role: 'io', imax: 0.02, solderable: true })
      out.push({ id: `l${i + 1}`, label: `LV${i + 1}`, kind: 'electrical', pos: [x0 + (i + 1) * P, -1.4, -d / 2 + 2.2], dir: [0, -1, 0], role: 'io', imax: 0.02, solderable: true })
    }
    // Both ground pads are the same net; the board has one on each side.
    void w
    return out
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'channels', 4))
      const out: DeviceModel[] = []
      for (let i = 1; i <= n; i++) {
        // Pull-ups either side and the FET between them. With both supplies
        // present a channel passes either way; with one missing it does not,
        // which is the usual reason one of these appears dead.
        out.push({ type: 'resistor', r: 10000, a: 'hv', b: `h${i}` })
        out.push({ type: 'resistor', r: 10000, a: 'lv', b: `l${i}` })
        out.push({ type: 'mosfet', d: `h${i}`, g: 'lv', s: `l${i}`, vth: 1.3, k: 0.05, rds: 3.5 })
      }
      return out
    },
    limits: { vmax: 12 },
  },
  readouts: (p) => [
    { label: 'Channels', value: `${Math.round(num(p, 'channels', 4))}, bidirectional` },
    { label: 'High side', value: `${num(p, 'vHigh', 5).toFixed(1)} V` },
    { label: 'Low side', value: `${num(p, 'vLow', 3.3).toFixed(1)} V` },
    { label: 'Speed', value: 'Fine for I2C and serial, not for fast SPI' },
  ],
}

registerParts([pico, nano, stepperDriver, charger, boost, rtc, sdModule, levelShifter])

export const BOARD_PARTS = [pico, nano, stepperDriver, charger, boost, rtc, sdModule, levelShifter]
