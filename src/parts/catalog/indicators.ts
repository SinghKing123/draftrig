import type { DeviceModel, PartDef, Port, SilkItem, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Displays and indicators beyond the character LCD.
 *
 * The OLED here is driven over real I2C, so it obeys the same rules a physical
 * one does: nothing appears until a driver initialises it, the address has to
 * match, and swapping the two wires produces the blank screen everyone has
 * stared at.
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

/* ================================================================== */
/* OLED module                                                         */
/* ================================================================== */

/** Board and panel dimensions in mm; `px` by `py` is the pixel grid. */
const OLED_SIZES: Record<string, { label: string; px: number; py: number; bw: number; bd: number; vw: number; vd: number; inch: string }> = {
  '128x64': { label: '0.96 in, 128 x 64', px: 128, py: 64, bw: 27.3, bd: 27.8, vw: 21.7, vd: 10.9, inch: '0.96' },
  '128x32': { label: '0.91 in, 128 x 32', px: 128, py: 32, bw: 38, bd: 12, vw: 22.4, vd: 5.6, inch: '0.91' },
}

const oled: PartDef = {
  id: 'display-oled',
  name: 'OLED display',
  category: 'display',
  blurb: 'SSD1306 over real I2C, dark until a driver wakes it',
  tags: ['oled', 'display', 'ssd1306', 'i2c', 'screen', '128x64', '0.96', 'graphic', 'module'],
  doc: {
    manufacturer: 'Generic',
    mpn: 'SSD1306',
    price: 3.4,
    datasheet: 'https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf',
    description:
      'The small monochrome OLED that goes on everything. The controller here decodes the I2C bus a bit at a time: it answers only to its strapped address, only lights up once the init sequence has reached it, and shows nothing at all if SDA and SCL are the wrong way round.',
  },
  params: [
    { key: 'size', label: 'Panel', type: 'enum', default: '128x64', group: 'Module', options: Object.entries(OLED_SIZES).map(([value, v]) => ({ value, label: v.label })) },
    {
      key: 'address', label: 'I2C address', type: 'enum', default: '0x3C', group: 'Electrical',
      help: 'Set by a resistor on the back. A module at the other address ignores everything sent to it.',
      options: [{ value: '0x3C', label: '0x3C (default)' }, { value: '0x3D', label: '0x3D' }],
    },
    {
      key: 'color', label: 'Emission', type: 'enum', default: '#8FE3FF', group: 'Module',
      options: [
        { value: '#8FE3FF', label: 'Blue' }, { value: '#FFFFFF', label: 'White' },
        { value: '#FFC24A', label: 'Yellow' }, { value: '#6BFF9C', label: 'Green' },
      ],
    },
    { key: 'mask', label: 'Board colour', type: 'enum', default: 'fr4-black', group: 'Module', options: [
      { value: 'fr4-black', label: 'Black' }, { value: 'fr4-blue', label: 'Blue' }, { value: 'fr4-green', label: 'Green' },
    ] },
  ],
  solids: (p) => {
    const g = OLED_SIZES[str(p, 'size', '128x64')] ?? OLED_SIZES['128x64']
    const T = 1.2
    const holeInset = 2.3
    const holes = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) =>
      circle(1.1, sx * (g.bw / 2 - holeInset), sz * (g.bd / 2 - holeInset), 10),
    )

    const silk: SilkItem[] = [
      { t: 'pads', at: [-1.5 * P, g.bd / 2 - 2.2], n: 4, pitch: P, r: 0.85 },
      { t: 'text', at: [-1.5 * P, g.bd / 2 - 4.4], text: 'GND', size: 1.3 },
      { t: 'text', at: [-0.5 * P, g.bd / 2 - 4.4], text: 'VCC', size: 1.3 },
      { t: 'text', at: [0.5 * P, g.bd / 2 - 4.4], text: 'SCL', size: 1.3 },
      { t: 'text', at: [1.5 * P, g.bd / 2 - 4.4], text: 'SDA', size: 1.3 },
      { t: 'text', at: [0, -g.bd / 2 + 1.8], text: `${g.inch}" OLED`, size: 1.5, bold: true },
    ]

    return [
      {
        kind: 'extrude', mat: str(p, 'mask', 'fr4-black'),
        profile: { outline: roundRect(g.bw, g.bd, 1.2, 0, 0, 3), holes },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      {
        kind: 'silk', size: [g.bw, g.bd], items: silk, mat: 'silkscreen',
        rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 26, noCollide: true,
      },
      // The glass, which is what you actually see: a dark sheet over the board
      // with the active area a window in the middle of it.
      {
        kind: 'box', mat: { color: '#0A0C10', rough: 0.12, clearcoat: 0.8, density: 2.5 },
        size: [g.bw - 1, 1.3, g.bd * 0.62], at: [0, T + 0.65, -1.2],
      },
      {
        kind: 'screen', size: [g.vw, g.vd], screen: 'main',
        mat: { color: '#05070A', rough: 0.1, density: 2.5 }, rot: [-90, 0, 0],
        at: [0, T + 1.32, -1.2], noCollide: true,
      },
      // Driver bonded under the glass edge, and the flex tail into the board.
      { kind: 'box', mat: 'epoxy-black', size: [g.bw * 0.5, 0.5, 1.6], at: [0, T + 0.3, g.bd * 0.22], noCollide: true },
      ...malePins(-1.5 * P, g.bd / 2 - 2.2, 4, T),
    ]
  },
  ports: (p) => {
    const g = OLED_SIZES[str(p, 'size', '128x64')] ?? OLED_SIZES['128x64']
    const z = g.bd / 2 - 2.2
    const out: Port[] = ([
      ['gnd', 'GND', 'gnd'],
      ['vcc', 'VCC', 'power'],
      ['scl', 'SCL', 'io'],
      ['sda', 'SDA', 'io'],
    ] as const).map(([id, label, role], i) => ({
      id, label, kind: 'electrical' as const,
      pos: [(-1.5 + i) * P, -1.4, z] as Vec3, dir: [0, -1, 0] as Vec3,
      role, imax: 0.05, solderable: true,
    }))
    let m = 0
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push({
          id: `mount${m++}`, label: 'M2 mount', kind: 'mechanical',
          pos: [sx * (g.bw / 2 - 2.3), 1.2, sz * (g.bd / 2 - 2.3)], dir: [0, 1, 0],
          mate: { type: 'hole', size: 2.2 }, groupId: 'mounts',
        })
      }
    }
    return out
  },
  electrical: {
    devices: () => {
      return [
        {
          type: 'behavioral', evalId: 'ssd1306', ref: 'gnd',
          pins: ['vcc', 'sda', 'scl'],
        },
        // Quiescent draw of the controller and its charge pump, a few mA.
        { type: 'resistor', r: 1500, a: 'vcc', b: 'gnd' },
      ]
    },
    limits: { vmax: 5.5 },
  },
  readouts: (p) => {
    const g = OLED_SIZES[str(p, 'size', '128x64')] ?? OLED_SIZES['128x64']
    return [
      { label: 'Resolution', value: `${g.px} x ${g.py} pixels` },
      { label: 'Controller', value: `SSD1306, I2C at ${str(p, 'address', '0x3C')}` },
      { label: 'Active area', value: `${g.vw} x ${g.vd} mm` },
      { label: 'Supply', value: '3.3 to 5 V, about 20 mA lit' },
    ]
  },
}

/* ================================================================== */
/* Addressable LED strip                                               */
/* ================================================================== */

const ledStrip: PartDef = {
  id: 'led-strip-ws2812',
  name: 'Addressable LED strip',
  category: 'display',
  blurb: 'WS2812B on a flexible tape, one data line for the lot',
  tags: ['ws2812', 'neopixel', 'led strip', 'rgb', 'addressable', 'strip', 'light', 'sk6812'],
  doc: {
    manufacturer: 'Worldsemi',
    mpn: 'WS2812B',
    price: 4,
    description:
      'Each pixel has its own controller and passes the rest of the data down the line. One pin drives any number of them, and the current adds up fast: sixty pixels at full white is over three amps.',
  },
  params: [
    { key: 'pixels', label: 'Pixels', type: 'number', default: 8, min: 1, max: 144, step: 1, group: 'Strip' },
    {
      key: 'density', label: 'Density', type: 'enum', default: '60', group: 'Strip',
      options: [{ value: '30', label: '30 per metre' }, { value: '60', label: '60 per metre' }, { value: '144', label: '144 per metre' }],
    },
    {
      key: 'pattern', label: 'Showing', type: 'enum', default: 'rainbow', group: 'Display',
      help: 'What the pixels are set to. The current drawn follows from it.',
      options: [
        { value: 'off', label: 'Off' }, { value: 'white', label: 'All white' },
        { value: 'rainbow', label: 'Rainbow' }, { value: 'red', label: 'All red' },
      ],
    },
    { key: 'brightness', label: 'Brightness', type: 'number', unit: '%', default: 60, min: 0, max: 100, step: 1, group: 'Display' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'pixels', 8))
    const pitch = 1000 / (parseFloat(str(p, 'density', '60')) || 60)
    const len = n * pitch
    const W = 10
    const pattern = str(p, 'pattern', 'rainbow')
    const bright = num(p, 'brightness', 60) / 100

    const out: Solid[] = [
      // The tape: a white flexible board with the copper runs printed on it.
      { kind: 'box', mat: { color: '#F0F1F3', rough: 0.6, density: 1.6 }, size: [len, 0.6, W], at: [0, 0.3, 0], bevel: 0.1 },
      {
        kind: 'silk', size: [len, W], mat: { color: '#C8CBD0', rough: 0.7, density: 1.4 },
        rot: [-90, 0, 0], at: [0, 0.62, 0], px: 8, noCollide: true,
        items: [
          { t: 'line', from: [-len / 2, W / 2 - 1.6], to: [len / 2, W / 2 - 1.6], w: 1.2 },
          { t: 'line', from: [-len / 2, -W / 2 + 1.6], to: [len / 2, -W / 2 + 1.6], w: 1.2 },
        ],
      },
    ]
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (i + 0.5) * pitch
      // Colour the pixel is showing, which is also what decides its current.
      let color = '#101214'
      let lit = 0
      if (pattern === 'white') { color = '#FFFFFF'; lit = bright }
      else if (pattern === 'red') { color = '#FF2A18'; lit = bright }
      else if (pattern === 'rainbow') {
        const hue = (i / Math.max(n, 1)) * 360
        color = `hsl(${hue.toFixed(0)}, 95%, 55%)`
        lit = bright
      }
      out.push({
        kind: 'box', tag: `px${i}`,
        mat: {
          color: lit > 0 ? color : '#E8EAEC', rough: 0.25, opacity: 0.9, density: 1.3,
          emissive: color, emissiveIntensity: lit * 2.4,
        },
        size: [5, 1.5, 5], at: [x, 1.35, 0], bevel: 0.3,
      })
      // The three dice inside, visible through the diffuser.
      if (lit === 0) {
        out.push({ kind: 'box', mat: { color: '#2A2E34', rough: 0.5, density: 0.01 }, size: [3, 0.2, 1.4], at: [x, 1.9, 0], noCollide: true })
      }
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'pixels', 8))
    const pitch = 1000 / (parseFloat(str(p, 'density', '60')) || 60)
    const len = n * pitch
    return [
      { id: 'v5', label: '+5 V in', kind: 'electrical', pos: [-len / 2, 0.6, 3], dir: [-1, 0, 0], role: 'power', imax: 5, solderable: true },
      { id: 'din', label: 'Data in', kind: 'electrical', pos: [-len / 2, 0.6, 0], dir: [-1, 0, 0], role: 'io', imax: 0.02, solderable: true },
      { id: 'gnd', label: 'GND in', kind: 'electrical', pos: [-len / 2, 0.6, -3], dir: [-1, 0, 0], role: 'gnd', imax: 5, solderable: true },
      { id: 'v5o', label: '+5 V out', kind: 'electrical', pos: [len / 2, 0.6, 3], dir: [1, 0, 0], role: 'power', imax: 5, groupId: 'v5', solderable: true },
      { id: 'dout', label: 'Data out', kind: 'electrical', pos: [len / 2, 0.6, 0], dir: [1, 0, 0], role: 'io', imax: 0.02, solderable: true },
      { id: 'gndo', label: 'GND out', kind: 'electrical', pos: [len / 2, 0.6, -3], dir: [1, 0, 0], role: 'gnd', imax: 5, groupId: 'gnd', solderable: true },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'pixels', 8))
      const pattern = str(p, 'pattern', 'rainbow')
      const bright = num(p, 'brightness', 60) / 100
      // Roughly 1 mA quiescent per pixel plus up to 20 mA per lit die. A
      // rainbow averages about one and a bit dice on at a time.
      const dice = pattern === 'off' ? 0 : pattern === 'white' ? 3 : pattern === 'rainbow' ? 1.4 : 1
      const amps = n * (0.001 + dice * 0.02 * bright)
      return [
        { type: 'resistor', r: 5 / Math.max(amps, 1e-6), a: 'v5', b: 'gnd' },
        // The data line is a CMOS input with a little series resistance.
        { type: 'resistor', r: 1e6, a: 'din', b: 'gnd' },
        { type: 'resistor', r: 330, a: 'din', b: 'dout' },
      ]
    },
    limits: { vmax: 5.5 },
  },
  price: (p) => 0.05 * Math.round(num(p, 'pixels', 8)) + 1.5,
  readouts: (p) => {
    const n = Math.round(num(p, 'pixels', 8))
    const pitch = 1000 / (parseFloat(str(p, 'density', '60')) || 60)
    const bright = num(p, 'brightness', 60) / 100
    const pattern = str(p, 'pattern', 'rainbow')
    const dice = pattern === 'off' ? 0 : pattern === 'white' ? 3 : pattern === 'rainbow' ? 1.4 : 1
    const amps = n * (0.001 + dice * 0.02 * bright)
    return [
      { label: 'Pixels', value: `${n} over ${(n * pitch).toFixed(0)} mm` },
      { label: 'Current now', value: `${amps.toFixed(2)} A` },
      { label: 'Worst case', value: `${(n * 0.06).toFixed(2)} A, all white` },
      { label: 'Feed', value: n * 0.06 > 2 ? 'Inject power at both ends' : 'One end is enough' },
    ]
  },
}

/* ================================================================== */
/* LED matrix                                                          */
/* ================================================================== */

const ledMatrix: PartDef = {
  id: 'led-matrix-8x8',
  name: 'LED matrix',
  category: 'display',
  blurb: '8 x 8 dots on a MAX7219, chainable',
  tags: ['matrix', 'led', 'max7219', '8x8', 'dot matrix', 'display', 'spi', 'scroll'],
  doc: {
    mpn: 'MAX7219',
    price: 2.2,
    description:
      'An 8 by 8 matrix with a MAX7219 behind it. The driver multiplexes one row at a time fast enough to look continuous, and sets the current for all 64 dots with a single resistor.',
  },
  params: [
    { key: 'modules', label: 'Modules chained', type: 'number', default: 1, min: 1, max: 8, step: 1, group: 'Module' },
    {
      key: 'color', label: 'Dot colour', type: 'enum', default: 'red', group: 'Module',
      options: [{ value: 'red', label: 'Red' }, { value: 'green', label: 'Green' }, { value: 'blue', label: 'Blue' }, { value: 'white', label: 'White' }],
    },
    { key: 'intensity', label: 'Intensity', type: 'number', default: 8, min: 0, max: 15, step: 1, group: 'Display', help: 'The MAX7219 has sixteen brightness steps, not a PWM pin.' },
    { key: 'lit', label: 'Dots lit', type: 'number', unit: '%', default: 25, min: 0, max: 100, step: 1, group: 'Display' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'modules', 1))
    const colors: Record<string, string> = { red: '#FF2A18', green: '#2BFF6A', blue: '#4C9BFF', white: '#FFF4E0' }
    const emit = colors[str(p, 'color', 'red')] ?? colors.red
    const lit = num(p, 'lit', 25) / 100
    const glow = (num(p, 'intensity', 8) / 15) * 1.8
    const MOD = 32
    const total = n * MOD
    const T = 1.2
    const out: Solid[] = [
      {
        kind: 'extrude', mat: 'fr4-black',
        profile: { outline: roundRect(total, MOD, 1, 0, 0, 3) },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
    ]
    for (let m = 0; m < n; m++) {
      const ox = -total / 2 + MOD / 2 + m * MOD
      // The moulded black carrier the dots sit in.
      out.push({ kind: 'box', mat: { color: '#0C0E11', rough: 0.75, density: 1.4 }, size: [MOD - 0.6, 6, MOD - 0.6], at: [ox, T + 3, 0], bevel: 0.4 })
      for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
          // A fixed scatter, so the panel reads as showing something rather
          // than as a grid of identical beads.
          const on = ((r * 8 + col + m * 3) % 7) / 7 < lit
          out.push({
            kind: 'cyl', mat: {
              color: on ? emit : '#3A0A08', rough: 0.3, density: 1.2,
              emissive: emit, emissiveIntensity: on ? glow : 0,
            },
            r: 1.5, h: 0.6, at: [ox + (col - 3.5) * 3.8, T + 6.2, (r - 3.5) * 3.8], seg: 12,
          })
        }
      }
      // The driver on the back and the two five-pin headers.
      out.push({ kind: 'box', mat: 'epoxy-black', size: [7.5, 3.3, 22], at: [ox, -1.6, 0], noCollide: true })
    }
    out.push(...malePins(-total / 2 + 4, -MOD / 2 + 2.5, 5, T))
    out.push(...malePins(total / 2 - 4 - 4 * P, -MOD / 2 + 2.5, 5, T))
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'modules', 1))
    const MOD = 32
    const total = n * MOD
    const z = -MOD / 2 + 2.5
    const names: [string, string, Port['role']][] = [
      ['vcc', 'VCC', 'power'], ['gnd', 'GND', 'gnd'], ['din', 'DIN', 'io'], ['cs', 'CS', 'io'], ['clk', 'CLK', 'io'],
    ]
    const out: Port[] = names.map(([id, label, role], i) => ({
      id, label, kind: 'electrical' as const,
      pos: [-total / 2 + 4 + i * P, -1.4, z] as Vec3, dir: [0, -1, 0] as Vec3, role, imax: 0.5, solderable: true,
    }))
    names.forEach(([id, label, role], i) => {
      out.push({
        id: `${id}o`, label: `${label} out`, kind: 'electrical',
        pos: [total / 2 - 4 - 4 * P + i * P, -1.4, z], dir: [0, -1, 0], role, imax: 0.5,
        groupId: id === 'din' || id === 'cs' ? undefined : id, solderable: true,
      })
    })
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'modules', 1))
      const lit = num(p, 'lit', 25) / 100
      const intensity = num(p, 'intensity', 8) / 15
      // A MAX7219 multiplexes eight rows, so average current is an eighth of
      // the peak. About 40 mA a module at full scatter and full brightness.
      const amps = n * (0.004 + 0.04 * lit * intensity)
      const out: DeviceModel[] = [{ type: 'resistor', r: 5 / Math.max(amps, 1e-6), a: 'vcc', b: 'gnd' }]
      for (const pin of ['din', 'cs', 'clk']) out.push({ type: 'resistor', r: 1e6, a: pin, b: 'gnd' })
      out.push({ type: 'resistor', r: 100, a: 'din', b: 'dino' })
      return out
    },
    limits: { vmax: 5.5 },
  },
  price: (p) => 2.2 * Math.round(num(p, 'modules', 1)),
  readouts: (p) => {
    const n = Math.round(num(p, 'modules', 1))
    const lit = num(p, 'lit', 25) / 100
    const intensity = num(p, 'intensity', 8) / 15
    return [
      { label: 'Dots', value: `${n * 64} in ${n * 8} x 8` },
      { label: 'Interface', value: 'SPI, 4 wires, chainable' },
      { label: 'Current', value: `${(n * (0.004 + 0.04 * lit * intensity) * 1000).toFixed(0)} mA` },
      { label: 'Brightness', value: `${Math.round(num(p, 'intensity', 8))} of 15` },
    ]
  },
}

/* ================================================================== */
/* LED bar graph                                                       */
/* ================================================================== */

const barGraph: PartDef = {
  id: 'led-bargraph',
  name: 'LED bar graph',
  category: 'display',
  blurb: 'Ten separate LEDs in one block, twenty pins',
  tags: ['bargraph', 'bar graph', 'led', 'level', 'meter', 'vu', 'indicator', 'display'],
  doc: {
    mpn: 'DIP-20 bargraph',
    price: 0.6,
    description:
      'Ten independent LEDs in a DIP-20 block. Nothing inside joins them, so every segment needs its own resistor and its own pin, which is what a driver chip is usually there to deal with.',
  },
  params: [
    {
      key: 'color', label: 'Colour', type: 'enum', default: 'red', group: 'Optical',
      options: [
        { value: 'red', label: 'Red' }, { value: 'green', label: 'Green' },
        { value: 'yellow', label: 'Yellow' }, { value: 'tricolor', label: 'Red, yellow and green' },
      ],
    },
    { key: 'segments', label: 'Segments', type: 'number', default: 10, min: 4, max: 10, step: 1, group: 'Body' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'segments', 10))
    const pitch = P
    const W = n * pitch
    const D = 10.2
    const H = 8
    const scheme = str(p, 'color', 'red')
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1A1C20', rough: 0.7, density: 1.5 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 0.3 },
    ]
    for (let i = 0; i < n; i++) {
      const frac = i / Math.max(n - 1, 1)
      const body =
        scheme === 'tricolor' ? (frac < 0.5 ? '#B31217' : frac < 0.8 ? '#B58B0E' : '#0E7A34')
        : scheme === 'green' ? '#0E7A34'
        : scheme === 'yellow' ? '#B58B0E'
        : '#B31217'
      const emit =
        scheme === 'tricolor' ? (frac < 0.5 ? '#FF2A18' : frac < 0.8 ? '#FFD23A' : '#2BFF6A')
        : scheme === 'green' ? '#2BFF6A'
        : scheme === 'yellow' ? '#FFD23A'
        : '#FF2A18'
      out.push({
        kind: 'box', tag: `seg${i}`,
        mat: { color: body, rough: 0.4, opacity: 0.92, density: 1.2, emissive: emit, emissiveIntensity: 0 },
        size: [1.8, 0.6, 7.6], at: [-W / 2 + (i + 0.5) * pitch, H + 0.05, 0],
      })
      // Two pins per segment, anode at the front row.
      out.push({ kind: 'box', mat: 'tin', size: [0.5, 4.2, 0.3], at: [-W / 2 + (i + 0.5) * pitch, -2.1, D / 2 - 1.1] })
      out.push({ kind: 'box', mat: 'tin', size: [0.5, 4.2, 0.3], at: [-W / 2 + (i + 0.5) * pitch, -2.1, -D / 2 + 1.1] })
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'segments', 10))
    const W = n * P
    const D = 10.2
    const out: Port[] = []
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (i + 0.5) * P
      out.push({ id: `a${i + 1}`, label: `Anode ${i + 1}`, kind: 'electrical', pos: [x, -4.2, D / 2 - 1.1], dir: [0, -1, 0], role: 'passive', imax: 0.025, solderable: true })
      out.push({ id: `c${i + 1}`, label: `Cathode ${i + 1}`, kind: 'electrical', pos: [x, -4.2, -D / 2 + 1.1], dir: [0, -1, 0], role: 'passive', imax: 0.025, solderable: true })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'segments', 10))
      const scheme = str(p, 'color', 'red')
      const out: DeviceModel[] = []
      for (let i = 0; i < n; i++) {
        const frac = i / Math.max(n - 1, 1)
        const vf =
          scheme === 'tricolor' ? (frac < 0.5 ? 1.95 : frac < 0.8 ? 2.05 : 2.1)
          : scheme === 'green' ? 2.1 : scheme === 'yellow' ? 2.05 : 1.95
        out.push({ type: 'diode', a: `a${i + 1}`, c: `c${i + 1}`, vf, n: 2.2, rs: 10, luminous: true })
      }
      return out
    },
    limits: { imax: 0.025 },
  },
  readouts: (p) => [
    { label: 'Segments', value: String(Math.round(num(p, 'segments', 10))) },
    { label: 'Pins', value: `${Math.round(num(p, 'segments', 10)) * 2}, nothing joined inside` },
    { label: 'Per segment', value: '20 mA, needs its own resistor' },
    { label: 'R for 5 V', value: '150 Ω each' },
  ],
}

registerParts([oled, ledStrip, ledMatrix, barGraph])
