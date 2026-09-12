import type { PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { num, roundRect, str } from './_helpers'
import { UNO_HOLES, unoFurniture, unoHoleProfiles, unoOutline, unoSilk } from './board_uno'

const P = 2.54

/* ------------------------------------------------------------------ */
/* Shared board furniture                                              */
/* ------------------------------------------------------------------ */

/** A female header strip: black body with a row of dark sockets. */
function femaleHeader(x0: number, z: number, n: number, mask = 'abs-black'): Solid[] {
  const len = n * P
  const out: Solid[] = [
    { kind: 'box', mat: mask, size: [len, 8.5, P + 0.1], at: [x0 + len / 2 - P / 2, 4.25, z], bevel: 0.3 },
  ]
  for (let i = 0; i < n; i++) {
    out.push({
      kind: 'box', mat: { color: '#0A0B0D', rough: 0.9, density: 0.01 }, size: [1.7, 1.4, 1.7],
      at: [x0 + i * P, 8.4, z], noCollide: true,
    })
  }
  return out
}

/** Electrical ports for a female header, one per socket. */
function headerPorts(ids: string[], labels: string[], x0: number, z: number, y = 8.5, role: Port['role'] = 'io'): Port[] {
  return ids.map((id, i) => ({
    id,
    label: labels[i] ?? id.toUpperCase(),
    kind: 'electrical' as const,
    pos: [x0 + i * P, y, z] as Vec3,
    dir: [0, 1, 0] as Vec3,
    role,
    imax: 0.04,
  }))
}

/** Four M3 mounting holes inset from the corners of a board. */
function mountHoles(w: number, d: number, inset: number, y: number): Port[] {
  const out: Port[] = []
  let i = 0
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      out.push({
        id: `mount${i++}`, label: 'M3 mount', kind: 'mechanical',
        pos: [sx * (w / 2 - inset), y, sz * (d / 2 - inset)], dir: [0, 1, 0],
        mate: { type: 'hole', size: 3.2 }, groupId: 'mounts',
      })
    }
  }
  return out
}

/* ================================================================== */
/* Microcontroller board                                               */
/* ================================================================== */

const MCU_PROGRAMS = [
  { value: 'blink', label: 'Blink, toggle D13' },
  { value: 'fade', label: 'Fade, PWM ramp on D9' },
  { value: 'pwm', label: 'PWM, fixed duty on D5' },
  { value: 'button', label: 'Button, D2 toggles D13' },
  { value: 'chase', label: 'Chase, sequence D2 to D7' },
  { value: 'lcd-text', label: 'LCD, show two lines of text' },
  { value: 'lcd-count', label: 'LCD, counter' },
  { value: 'lcd-clock', label: 'LCD, running clock' },
  { value: 'oled-text', label: 'OLED, show two lines over I2C' },
  { value: 'oled-clock', label: 'OLED, running clock over I2C' },
  { value: 'off', label: 'No program, all pins input' },
]

/** The sketches that bit-bang a character LCD on D12, D11 and D5 to D2. */
const LCD_SKETCH = (p: { program?: unknown }): boolean =>
  typeof p.program === 'string' && p.program.startsWith('lcd-')

/** The sketches that drive a panel over I2C on A4 and A5. */
const OLED_SKETCH = (p: { program?: unknown }): boolean =>
  typeof p.program === 'string' && p.program.startsWith('oled-')

/** Either kind of panel sketch: both take a first line of text. */
const PANEL_SKETCH = (p: { program?: unknown }): boolean => LCD_SKETCH(p) || OLED_SKETCH(p)

const W = 68.6
const D = 53.4
const T = 1.6

const mcuBoard: PartDef = {
  id: 'mcu-board',
  name: 'Microcontroller board',
  category: 'module',
  blurb: 'Uno-style board running a stock sketch',
  tags: ['arduino', 'uno', 'mcu', 'microcontroller', 'atmega', 'board', 'controller', 'sketch'],
  doc: {
    manufacturer: 'Arduino',
    mpn: 'A000066',
    price: 24,
    description:
      'An Uno-compatible board. Pick one of the stock sketches and the pins behave the way that program makes them behave, outputs drive through a real 28 Ω source impedance, so an LED without a resistor is still a mistake.',
  },
  params: [
    { key: 'program', label: 'Sketch', type: 'enum', default: 'blink', group: 'Control', options: MCU_PROGRAMS },
    { key: 'interval', label: 'Interval', type: 'number', unit: 's', default: 0.5, min: 0.001, max: 10, step: 0.05, group: 'Control' },
    { key: 'duty', label: 'PWM duty', type: 'number', unit: '%', default: 50, min: 0, max: 100, step: 1, group: 'Control', showIf: (p) => p.program === 'pwm' },
    { key: 'text1', label: 'Display line 1', type: 'text', default: 'Draftrig', group: 'Control', showIf: PANEL_SKETCH },
    { key: 'text2', label: 'Display line 2', type: 'text', default: 'LCD ready', group: 'Control', showIf: (p) => p.program === 'lcd-text' || p.program === 'oled-text' },
    { key: 'power', label: 'Powered from', type: 'enum', default: 'usb', group: 'Control', options: [
      { value: 'usb', label: 'USB' }, { value: 'vin', label: 'Barrel jack / VIN' },
    ] },
    { key: 'mask', label: 'Board colour', type: 'enum', default: 'fr4-blue', group: 'Board', options: [
      { value: 'fr4-blue', label: 'Blue' }, { value: 'fr4-green', label: 'Green' }, { value: 'fr4-black', label: 'Black' },
    ] },
  ],
  solids: (p) => {
    const mask = str(p, 'mask', 'fr4-blue')
    return [
      {
        kind: 'extrude', mat: mask,
        profile: { outline: unoOutline(), holes: unoHoleProfiles() },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      // The printed layer: pin numbers, header names, designators, the lot.
      {
        kind: 'silk', size: [W, D], items: unoSilk(),
        mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 20, noCollide: true,
      },
      ...unoFurniture(T),
      ...femaleHeader(-19, -D / 2 + 3.2, 10),
      ...femaleHeader(11, -D / 2 + 3.2, 8),
      ...femaleHeader(-24, D / 2 - 3.2, 8),
      ...femaleHeader(6, D / 2 - 3.2, 6),
    ]
  },
  ports: () => {
    const zFar = -D / 2 + 3.2
    const zNear = D / 2 - 3.2
    return [
      // Digital 8-13, GND, AREF, SDA, SCL.
      ...headerPorts(
        ['d8', 'd9', 'd10', 'd11', 'd12', 'd13', 'gnd2', 'aref', 'sda', 'scl'],
        ['D8', 'D9 ~', 'D10 ~', 'D11 ~', 'D12', 'D13 (LED)', 'GND', 'AREF', 'SDA', 'SCL'],
        -19, zFar,
      ),
      // Digital 0-7.
      ...headerPorts(
        ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'],
        ['D0 RX', 'D1 TX', 'D2', 'D3 ~', 'D4', 'D5 ~', 'D6 ~', 'D7'],
        11, zFar,
      ),
      // Power header.
      ...headerPorts(
        ['nc', 'ioref', 'reset', 'v33', 'v5', 'gnd', 'gnd3', 'vin'],
        ['NC', 'IOREF', 'RESET', '3.3 V', '5 V', 'GND', 'GND', 'VIN'],
        -24, zNear, 8.5, 'power',
      ),
      // Analogue in.
      ...headerPorts(['a0', 'a1', 'a2', 'a3', 'a4', 'a5'], ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], 6, zNear, 8.5, 'analog'),
      ...UNO_HOLES.map(([x, y], i) => ({
        id: `mount${i}`, label: 'M3 mount', kind: 'mechanical' as const,
        pos: [x, T, -y] as Vec3, dir: [0, 1, 0] as Vec3,
        mate: { type: 'hole' as const, size: 3.2 }, groupId: 'mounts',
      })),
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: () => [
      {
        type: 'behavioral', evalId: 'mcu', ref: 'gnd',
        pins: [
          'vin', 'v5', 'v33',
          'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7',
          'd8', 'd9', 'd10', 'd11', 'd12', 'd13',
          'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
        ],
      },
      // The three GND pins are one net, as they are on the board.
      { type: 'short', a: 'gnd', b: 'gnd2' },
      { type: 'short', a: 'gnd2', b: 'gnd3' },
      // On an R3 the SDA and SCL pins beside AREF are the same two pads as A4
      // and A5, not extra ones. Wiring a display to either pair works, and
      // using both at once is a short, exactly as on the board.
      { type: 'short', a: 'sda', b: 'a4' },
      { type: 'short', a: 'scl', b: 'a5' },
    ],
    supplies: ['v5', 'v33'],
    limits: { imax: 0.2, vmax: 12 },
  },
  readouts: (p) => [
    { label: 'Sketch', value: MCU_PROGRAMS.find((x) => x.value === str(p, 'program', 'blink'))?.label ?? 'None' },
    { label: 'Logic level', value: '5 V' },
    { label: 'Per-pin current', value: '20 mA (40 mA absolute max)' },
    { label: 'Total I/O current', value: '200 mA' },
    { label: 'Powered from', value: str(p, 'power', 'usb') === 'usb' ? 'USB (5 V)' : 'VIN (7 to 12 V)' },
  ],
}

/* ================================================================== */
/* ESP32 development board                                             */
/* ================================================================== */

const esp32: PartDef = {
  id: 'esp32-devkit',
  name: 'ESP32 dev board',
  category: 'module',
  blurb: 'Wi-Fi microcontroller on a 30-pin devkit',
  tags: ['esp32', 'wifi', 'bluetooth', 'devkit', 'microcontroller', 'iot', 'module', 'board'],
  doc: { manufacturer: 'Espressif', mpn: 'ESP32-DevKitC', price: 8, description: 'Dual-core Wi-Fi and Bluetooth microcontroller on a breadboard-friendly carrier. Note: 3.3 V logic, not 5 V tolerant.' },
  params: [
    { key: 'pins', label: 'Pins per side', type: 'number', default: 15, min: 12, max: 19, step: 1, group: 'Board' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'pins', 15))
    const w = 25.4
    const d = n * P + 6
    const t = 1.2
    return [
      { kind: 'extrude', mat: 'fr4-black', profile: { outline: roundRect(w, d, 1.5) }, depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0] },
      // The shielded radio module, with its antenna cut-out at the end.
      { kind: 'box', mat: { color: '#C2C7CE', metal: 1, rough: 0.34, density: 7.8 }, size: [18, 3.1, 25.5], at: [0, t + 1.55, -d / 2 + 15], bevel: 0.35 },
      { kind: 'box', mat: 'fr4-black', size: [16, 1.2, 6], at: [0, t + 0.6, -d / 2 + 3.5] },
      { kind: 'box', mat: { color: '#C2C7CE', metal: 1, rough: 0.4, density: 7.8 }, size: [11, 0.3, 4.5], at: [0, t + 1.3, -d / 2 + 3.5], noCollide: true },
      // Micro-USB socket.
      { kind: 'box', mat: { color: '#B8BDC4', metal: 1, rough: 0.36, density: 7.8 }, size: [8, 3, 5.6], at: [0, t + 1.5, d / 2 - 2] },
      // Buttons and regulator.
      { kind: 'box', mat: 'abs-black', size: [4.5, 2.6, 4.5], at: [-9, t + 1.3, d / 2 - 10] },
      { kind: 'box', mat: 'abs-black', size: [4.5, 2.6, 4.5], at: [9, t + 1.3, d / 2 - 10] },
      { kind: 'box', mat: 'epoxy-black', size: [3.2, 1.2, 2.6], at: [6, t + 0.6, d / 2 - 17] },
      // Pin headers down both long edges.
      ...Array.from({ length: n }, (_, i): Solid => ({
        kind: 'box', mat: 'abs-black', size: [P - 0.1, 2.5, P - 0.1],
        at: [-w / 2 + 1.5, t + 1.25, -d / 2 + 3 + i * P],
      })),
      ...Array.from({ length: n }, (_, i): Solid => ({
        kind: 'box', mat: 'gold', size: [0.64, 11, 0.64], at: [-w / 2 + 1.5, t + 2.9, -d / 2 + 3 + i * P],
      })),
      ...Array.from({ length: n }, (_, i): Solid => ({
        kind: 'box', mat: 'abs-black', size: [P - 0.1, 2.5, P - 0.1],
        at: [w / 2 - 1.5, t + 1.25, -d / 2 + 3 + i * P],
      })),
      ...Array.from({ length: n }, (_, i): Solid => ({
        kind: 'box', mat: 'gold', size: [0.64, 11, 0.64], at: [w / 2 - 1.5, t + 2.9, -d / 2 + 3 + i * P],
      })),
    ]
  },
  ports: (p) => {
    const n = Math.round(num(p, 'pins', 15))
    const w = 25.4
    const d = n * P + 6
    const ports: Port[] = []
    // Left side: 3V3, GND then GPIOs. Right side: VIN, GND then GPIOs.
    const left = ['v33', 'gndl', ...Array.from({ length: n - 2 }, (_, i) => `io${i}`)]
    const right = ['vin', 'gndr', ...Array.from({ length: n - 2 }, (_, i) => `io${i + n - 2}`)]
    left.forEach((id, i) => {
      ports.push({
        id, label: id === 'v33' ? '3.3 V' : id === 'gndl' ? 'GND' : `GPIO ${i - 2}`,
        kind: 'electrical', pos: [-w / 2 + 1.5, 8.2, -d / 2 + 3 + i * P], dir: [0, 1, 0],
        role: id === 'v33' ? 'power' : id === 'gndl' ? 'gnd' : 'io', imax: 0.04,
      })
    })
    right.forEach((id, i) => {
      ports.push({
        id, label: id === 'vin' ? 'VIN (5 V)' : id === 'gndr' ? 'GND' : `GPIO ${i + n - 4}`,
        kind: 'electrical', pos: [w / 2 - 1.5, 8.2, -d / 2 + 3 + i * P], dir: [0, 1, 0],
        role: id === 'vin' ? 'power' : id === 'gndr' ? 'gnd' : 'io', imax: 0.04,
        groupId: id === 'gndr' ? 'gnd' : undefined,
      })
    })
    ports.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return ports
  },
  electrical: {
    devices: () => [{ type: 'short', a: 'gndl', b: 'gndr' }],
    limits: { vmax: 3.6, imax: 0.04 },
  },
  readouts: () => [
    { label: 'Logic level', value: '3.3 V, not 5 V tolerant' },
    { label: 'Clock', value: '240 MHz, dual core' },
    { label: 'Per-pin current', value: '12 mA' },
    { label: 'Wi-Fi peak draw', value: '~250 mA' },
  ],
}

/* ================================================================== */
/* H-bridge motor driver                                               */
/* ================================================================== */

const motorDriver: PartDef = {
  id: 'motor-driver',
  name: 'Motor driver',
  category: 'module',
  blurb: 'Dual H-bridge for direction and speed',
  tags: ['motor driver', 'h-bridge', 'l298n', 'drv8833', 'tb6612', 'pwm', 'module', 'driver'],
  doc: { mpn: 'L298N', price: 3.5, description: 'Dual H-bridge module. Drives a motor forwards, backwards or braked, with PWM on the enable pin for speed.' },
  params: [
    { key: 'kind', label: 'Output stage', type: 'enum', default: 'bipolar', group: 'Electrical', options: [
      { value: 'bipolar', label: 'L298N, bipolar, 1.4 V drop' },
      { value: 'mosfet', label: 'DRV8833, MOSFET, low drop' },
    ] },
    { key: 'vlogic', label: 'Logic level', type: 'number', unit: 'V', default: 5, min: 3.3, max: 5.5, step: 0.1, group: 'Electrical' },
    { key: 'alwaysEnabled', label: 'Enable jumper fitted', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const bipolar = str(p, 'kind', 'bipolar') === 'bipolar'
    const w = bipolar ? 43 : 24
    const d = bipolar ? 43 : 21
    const t = 1.6
    const out: Solid[] = [
      { kind: 'extrude', mat: 'fr4-blue', profile: { outline: roundRect(w, d, 2) }, depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0] },
    ]
    if (bipolar) {
      // The unmistakable finned heatsink and the big through-hole IC.
      out.push({ kind: 'box', mat: 'epoxy-black', size: [22, 5, 16], at: [0, t + 2.5, -2], bevel: 0.4 })
      out.push({ kind: 'box', mat: { color: '#8F959D', metal: 1, rough: 0.5, density: 2.7 }, size: [26, 3, 12], at: [0, t + 11, -2] })
      for (let i = 0; i < 7; i++) {
        out.push({ kind: 'box', mat: { color: '#8F959D', metal: 1, rough: 0.5, density: 2.7 }, size: [1.6, 14, 12], at: [-12 + i * 4, t + 6, -2] })
      }
      // Screw terminals.
      for (const [x, z] of [[-13, d / 2 - 4], [13, d / 2 - 4], [0, -d / 2 + 4]] as const) {
        out.push({ kind: 'box', mat: { color: '#1D4FD8', rough: 0.55, density: 1.4 }, size: [15, 10, 8], at: [x, t + 5, z], bevel: 0.4 })
        out.push({ kind: 'cyl', mat: 'steel-zinc', r: 1.6, h: 1.2, at: [x - 3.8, t + 10.2, z] })
        out.push({ kind: 'cyl', mat: 'steel-zinc', r: 1.6, h: 1.2, at: [x + 3.8, t + 10.2, z] })
      }
    } else {
      out.push({ kind: 'box', mat: 'epoxy-black', size: [5, 1.2, 6.4], at: [0, t + 0.6, 0] })
    }
    // Logic header along one edge.
    out.push(...femaleHeader(-7.5, d / 2 - 9, 6))
    return out
  },
  ports: (p) => {
    const bipolar = str(p, 'kind', 'bipolar') === 'bipolar'
    const w = bipolar ? 43 : 24
    const d = bipolar ? 43 : 21
    return [
      ...headerPorts(['in1', 'in2', 'en', 'gnd', 'vcc', 'vm'],
        ['IN1', 'IN2', 'ENA (PWM)', 'GND', 'Logic 5 V', 'Motor V+'], -7.5, d / 2 - 9, 8.5, 'io'),
      { id: 'out1', label: 'Motor A', kind: 'electrical', pos: [-13, 11, -d / 2 + 4], dir: [0, 0, -1], role: 'power', imax: 2 },
      { id: 'out2', label: 'Motor B', kind: 'electrical', pos: [13, 11, -d / 2 + 4], dir: [0, 0, -1], role: 'power', imax: 2 },
      ...mountHoles(w, d, 3.5, 1.6),
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: () => [
      { type: 'behavioral', evalId: 'h-bridge', ref: 'gnd', pins: ['vm', 'in1', 'in2', 'en', 'out1', 'out2'] },
      // Logic supply draw.
      { type: 'resistor', r: 250, a: 'vcc', b: 'gnd' },
    ],
    limits: { imax: 2, vmax: 35 },
  },
  readouts: (p) => {
    const bipolar = str(p, 'kind', 'bipolar') === 'bipolar'
    return [
      { label: 'Output drop', value: bipolar ? '~1.4 V per side' : '~0.25 V per side' },
      { label: 'Continuous current', value: bipolar ? '2 A per channel' : '1.5 A per channel' },
      { label: 'Motor supply', value: bipolar ? '5 to 35 V' : '2.7 to 10.8 V' },
      { label: 'Truth table', value: 'IN1≠IN2 drives, IN1=IN2 brakes' },
    ]
  },
}

/* ================================================================== */
/* Relay module                                                        */
/* ================================================================== */

const relayModule: PartDef = {
  id: 'relay-module',
  name: 'Relay module',
  category: 'module',
  blurb: 'Opto-isolated, for mains-level loads',
  tags: ['relay', 'module', 'switch', 'isolated', 'contact', 'srd', 'mains'],
  doc: { price: 2.2, description: 'Single-channel relay board with an opto-isolated input. The coil side and the contact side share no electrical connection.' },
  params: [
    { key: 'coilV', label: 'Coil voltage', type: 'enum', default: '5', group: 'Electrical', options: [
      { value: '5', label: '5 V coil' }, { value: '12', label: '12 V coil' },
    ] },
    { key: 'activeLow', label: 'Active-low trigger', type: 'bool', default: true, group: 'Control' },
    { key: 'energised', label: 'Energised', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const w = 43, d = 26, t = 1.6
    const on = p.energised === true
    return [
      { kind: 'extrude', mat: 'fr4-blue', profile: { outline: roundRect(w, d, 2) }, depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0] },
      // The relay can.
      { kind: 'box', mat: { color: '#1D4FD8', rough: 0.5, density: 1.5 }, size: [19, 15.5, 15.5], at: [5, t + 7.75, 0], bevel: 0.5 },
      // Screw terminal for the contacts.
      { kind: 'box', mat: { color: '#1C6B3A', rough: 0.55, density: 1.4 }, size: [15, 10, 8], at: [-13, t + 5, 0], bevel: 0.4 },
      ...[-3.8, 0, 3.8].map((z): Solid => ({ kind: 'cyl', mat: 'steel-zinc', r: 1.5, h: 1.2, at: [-13, t + 10.2, z] })),
      // Optocoupler, driver transistor and the status LED.
      { kind: 'box', mat: 'epoxy-black', size: [9, 3, 6.4], at: [5, t + 1.5, -d / 2 + 4] },
      {
        kind: 'cyl',
        mat: { color: '#B31217', rough: 0.3, emissive: '#FF3A20', emissiveIntensity: on ? 1.4 : 0.05, density: 1.2 },
        r: 1.4, h: 1, at: [16, t + 0.5, -d / 2 + 5], tag: 'lens',
      },
      ...femaleHeader(15, d / 2 - 4, 3),
    ]
  },
  ports: (p) => {
    const w = 43, d = 26
    void p
    return [
      ...headerPorts(['vcc', 'gnd', 'in'], ['VCC', 'GND', 'IN'], 15, d / 2 - 4, 8.5, 'io'),
      { id: 'com', label: 'COM', kind: 'electrical', pos: [-13, 11, 0], dir: [0, 0, -1], role: 'passive', imax: 10 },
      { id: 'no', label: 'NO', kind: 'electrical', pos: [-13, 11, -3.8], dir: [0, 0, -1], role: 'passive', imax: 10 },
      { id: 'nc', label: 'NC', kind: 'electrical', pos: [-13, 11, 3.8], dir: [0, 0, -1], role: 'passive', imax: 10 },
      ...mountHoles(w, d, 3.5, 1.6),
    ]
  },
  electrical: {
    devices: (p) => {
      const on = p.energised === true
      const coil = parseFloat(str(p, 'coilV', '5'))
      return [
        // Coil side: a real load on whatever drives it.
        { type: 'resistor', r: (coil * coil) / 0.36, a: 'vcc', b: 'gnd' },
        // Contact side: isolated, and genuinely a changeover.
        { type: 'switch', a: 'com', b: 'no', closed: on, ron: 0.05, roff: 1e9 },
        { type: 'switch', a: 'com', b: 'nc', closed: !on, ron: 0.05, roff: 1e9 },
      ]
    },
  },
  readouts: (p) => [
    { label: 'Coil', value: `${str(p, 'coilV', '5')} V, ~70 mA` },
    { label: 'Contact rating', value: '10 A at 250 VAC / 30 VDC' },
    { label: 'Trigger', value: p.activeLow === true ? 'Active low' : 'Active high' },
    { label: 'Isolation', value: 'Optocoupled, no shared ground' },
  ],
}

/* ================================================================== */
/* Buck converter                                                      */
/* ================================================================== */

const buck: PartDef = {
  id: 'buck-converter',
  name: 'Buck converter',
  category: 'power',
  blurb: 'Switching step-down. Stays cool under load',
  tags: ['buck', 'converter', 'dc-dc', 'step down', 'lm2596', 'mp1584', 'switching', 'regulator'],
  doc: { mpn: 'LM2596', price: 1.6, description: 'Switching step-down module. Unlike a linear regulator it converts rather than burns the difference, so a 12 V to 5 V drop at 2 A costs about a watt instead of fourteen.' },
  params: [
    { key: 'vout', label: 'Output voltage', type: 'number', unit: 'V', default: 5, min: 1.25, max: 35, step: 0.1, group: 'Control' },
    { key: 'imax', label: 'Current limit', type: 'number', unit: 'A', default: 2, min: 0.1, max: 5, step: 0.1, group: 'Electrical' },
    { key: 'eff', label: 'Efficiency', type: 'number', unit: '%', default: 88, min: 60, max: 97, step: 1, group: 'Electrical' },
    { key: 'dropout', label: 'Headroom needed', type: 'number', unit: 'V', default: 1.4, min: 0.3, max: 4, step: 0.1, group: 'Electrical' },
  ],
  solids: () => {
    const w = 43, d = 21, t = 1.6
    return [
      { kind: 'extrude', mat: 'fr4-blue', profile: { outline: roundRect(w, d, 1.5) }, depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0] },
      // Switcher IC, catch diode, inductor and the two electrolytics.
      { kind: 'box', mat: 'epoxy-black', size: [10, 4.5, 6], at: [-8, t + 2.25, -3] },
      { kind: 'cyl', mat: { color: '#2A2D33', rough: 0.6, density: 4.5 }, r: 5.5, h: 5, at: [6, t + 2.5, -2] },
      { kind: 'cyl', mat: 'elcap-sleeve', r: 4, h: 8, at: [-16, t + 4, 4] },
      { kind: 'cyl', mat: 'elcap-sleeve', r: 4, h: 8, at: [16, t + 4, 4] },
      // The trim pot everyone spends five minutes turning.
      { kind: 'box', mat: { color: '#1D4FD8', rough: 0.5, density: 1.4 }, size: [7, 4.5, 7], at: [6, t + 2.25, 6] },
      { kind: 'cyl', mat: { color: '#D8DCE2', rough: 0.4, density: 1.1 }, r: 2.4, h: 1, at: [6, t + 4.7, 6] },
    ]
  },
  ports: () => [
    { id: 'in', label: 'IN +', kind: 'electrical', pos: [-19, 2, -8], dir: [0, 1, 0], role: 'power', imax: 3 },
    { id: 'ing', label: 'IN −', kind: 'electrical', pos: [-19, 2, -3], dir: [0, 1, 0], role: 'gnd', imax: 3, groupId: 'gnd' },
    { id: 'out', label: 'OUT +', kind: 'electrical', pos: [19, 2, -8], dir: [0, 1, 0], role: 'power', imax: 3 },
    { id: 'outg', label: 'OUT −', kind: 'electrical', pos: [19, 2, -3], dir: [0, 1, 0], role: 'gnd', imax: 3, groupId: 'gnd' },
    ...mountHoles(43, 21, 3, 1.6),
  ],
  electrical: {
    devices: () => [
      { type: 'behavioral', evalId: 'regulator-linear', ref: 'ing', pins: ['in', 'out'] },
    ],
  },
  readouts: (p) => {
    const vout = num(p, 'vout', 5)
    const imax = num(p, 'imax', 2)
    const eff = num(p, 'eff', 88) / 100
    return [
      { label: 'Output', value: `${vout.toFixed(2)} V` },
      { label: 'Max current', value: eng(imax, 'A') },
      { label: 'Efficiency', value: `${Math.round(eff * 100)} %` },
      { label: 'Heat at full load', value: `${(vout * imax * (1 / eff - 1)).toFixed(2)} W` },
      { label: 'Input draw at 12 V', value: eng((vout * imax) / eff / 12, 'A') },
    ]
  },
}

registerParts([mcuBoard, esp32, motorDriver, relayModule, buck])
