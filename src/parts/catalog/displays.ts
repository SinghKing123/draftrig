import type { DeviceModel, PartDef, Port, SilkItem, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

const P = 2.54

/* ------------------------------------------------------------------ */
/* Shared furniture                                                    */
/* ------------------------------------------------------------------ */

/** A row of male header pins standing off a board. */
function malePins(x0: number, z: number, n: number, y0: number, len = 11.5): Solid[] {
  const out: Solid[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      kind: 'box', mat: 'tin', size: [0.64, len, 0.64],
      at: [x0 + i * P, y0 + len / 2 - 3, z],
    })
  }
  // The black nylon spacer the pins are moulded into.
  out.push({
    kind: 'box', mat: 'nylon-black', size: [n * P, 2.5, 2.5],
    at: [x0 + ((n - 1) * P) / 2, y0 + 1.25, z], bevel: 0.15,
  })
  return out
}

/* ================================================================== */
/* HD44780 character LCD                                               */
/* ================================================================== */

interface LcdGeom {
  w: number
  d: number
  cols: number
  rows: number
  /** Metal bezel outer size. */
  bw: number
  bd: number
  /** Viewing area. */
  vw: number
  vd: number
  holeX: number
  holeZ: number
}

const LCD_FORMATS: Record<string, LcdGeom> = {
  // Dimensions from the common LCD1602A and LCD2004A modules.
  '1602': { w: 80, d: 36, cols: 16, rows: 2, bw: 71.3, bd: 24.3, vw: 64.5, vd: 16.4, holeX: 75, holeZ: 31 },
  '2004': { w: 98, d: 60, cols: 20, rows: 4, bw: 84.5, bd: 31.5, vw: 76, vd: 25.2, holeX: 93, holeZ: 55 },
}

const LCD_PINS = [
  ['vss', 'VSS'], ['vdd', 'VDD'], ['v0', 'V0'], ['rs', 'RS'], ['rw', 'RW'], ['e', 'E'],
  ['d0', 'DB0'], ['d1', 'DB1'], ['d2', 'DB2'], ['d3', 'DB3'],
  ['d4', 'DB4'], ['d5', 'DB5'], ['d6', 'DB6'], ['d7', 'DB7'],
  ['a', 'LED+'], ['k', 'LED-'],
]

/** Pin 1 sits this far in from the left edge, on the back long edge. */
const LCD_PIN_X0 = -33.5

function lcdSilk(g: LcdGeom, format: string): SilkItem[] {
  const items: SilkItem[] = []
  const zPin = -g.d / 2 + 2.5

  // Header footprint and its numbering, which is the marking people actually
  // look for when they are counting pins with a jumper wire in one hand.
  items.push({ t: 'pads', at: [LCD_PIN_X0, zPin], n: 16, pitch: P, r: 0.95 })
  items.push({ t: 'rect', at: [LCD_PIN_X0, zPin], size: [1.9, 1.9], w: 0.22 })
  for (let i = 0; i < 16; i++) {
    items.push({ t: 'text', at: [LCD_PIN_X0 + i * P, zPin + 2.6], text: String(i + 1), size: 1.5 })
  }
  items.push({ t: 'text', at: [LCD_PIN_X0 - 2.6, zPin], text: '1', size: 1.8, bold: true })

  // Part markings along the bottom edge.
  items.push({ t: 'text', at: [-g.w / 2 + 10, g.d / 2 - 2.6], text: `LCD${format}`, size: 2.4, bold: true, align: 'left' })
  items.push({ t: 'text', at: [g.w / 2 - 3, g.d / 2 - 2.6], text: 'HD44780', size: 1.8, align: 'right' })
  items.push({ t: 'text', at: [-g.w / 2 + 3, g.d / 2 - 2.6], text: 'A', size: 1.6, align: 'left' })

  // Mounting hole rings.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      items.push({ t: 'circle', at: [(sx * g.holeX) / 2, (sz * g.holeZ) / 2], r: 2.6, w: 0.25 })
    }
  }
  return items
}

const lcdCharacter: PartDef = {
  id: 'display-lcd-character',
  name: 'Character LCD',
  category: 'display',
  blurb: '16x2 HD44780 module, driven over its real bus',
  tags: ['lcd', 'display', 'screen', 'hd44780', '1602', '2004', 'character', 'text', 'module'],
  doc: {
    manufacturer: 'Generic',
    mpn: 'LCD1602A',
    price: 4.2,
    datasheet: 'https://www.sparkfun.com/datasheets/LCD/HD44780.pdf',
    description:
      'A standard HD44780 character module. The controller here decodes the real bus: RS, R/W, E and the data lines, in four-bit or eight-bit mode. It shows text only once a driver has initialised it, and shows nonsense if the pins are crossed, because nothing about the picture is faked.',
  },
  params: [
    { key: 'format', label: 'Size', type: 'enum', default: '1602', group: 'Module', options: [
      { value: '1602', label: '16 x 2' }, { value: '2004', label: '20 x 4' },
    ] },
    { key: 'mask', label: 'Board colour', type: 'enum', default: 'fr4-green', group: 'Module', options: [
      { value: 'fr4-green', label: 'Green' }, { value: 'fr4-blue', label: 'Blue' }, { value: 'fr4-black', label: 'Black' },
    ] },
    {
      key: 'contrastSource', label: 'Contrast from', type: 'enum', default: 'preset', group: 'Display',
      help: 'Real modules set contrast with a pot on V0. The preset stands in for one that is already adjusted.',
      options: [{ value: 'preset', label: 'Preset (ignores V0)' }, { value: 'pin', label: 'The V0 pin' }],
    },
    {
      key: 'contrast', label: 'Contrast', type: 'number', unit: '', default: 0.62, min: 0, max: 1, step: 0.02,
      group: 'Display', showIf: (p) => p.contrastSource !== 'pin',
    },
    {
      key: 'backlightR', label: 'Backlight resistor fitted', type: 'bool', default: true, group: 'Display',
      help: 'Most modules include one. Turn this off to model a bare LED+ pin that needs its own resistor.',
    },
  ],
  solids: (p) => {
    const g = LCD_FORMATS[str(p, 'format', '1602')] ?? LCD_FORMATS['1602']
    const mask = str(p, 'mask', 'fr4-green')
    const T = 1.6
    const bezelH = 4.6
    const holes = [
      circle(1.5, -g.holeX / 2, -g.holeZ / 2, 10),
      circle(1.5, g.holeX / 2, -g.holeZ / 2, 10),
      circle(1.5, -g.holeX / 2, g.holeZ / 2, 10),
      circle(1.5, g.holeX / 2, g.holeZ / 2, 10),
    ]

    // The bezel is a stamped steel frame: a rectangular ring, not a solid slab.
    const bezelOuter = roundRect(g.bw, g.bd, 1.2, 0, 0, 3)
    const bezelWindow = roundRect(g.vw, g.vd, 0.8, 0, 0, 3)

    return [
      {
        kind: 'extrude', mat: mask, profile: { outline: roundRect(g.w, g.d, 2, 0, 0, 4), holes },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      // Silkscreen, one printed layer just above the solder mask.
      {
        kind: 'silk', size: [g.w, g.d], items: lcdSilk(g, str(p, 'format', '1602')),
        mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 18, noCollide: true,
      },
      // The panel stack under the window. Not clear glass: a real LCD is a
      // dark polarised sandwich, and modelling it as transmissive left a
      // translucent slab hanging in front of the picture.
      {
        kind: 'box', mat: { color: '#5A6B33', rough: 0.35, clearcoat: 0.4, density: 2.5 },
        size: [g.vw + 1.2, 2.8, g.vd + 1.2],
        at: [0, T + 1.4, -1.2], noCollide: true,
      },
      {
        kind: 'extrude', mat: { color: '#7E858F', metal: 1, rough: 0.38, density: 7.85 },
        profile: { outline: bezelOuter, holes: [bezelWindow] },
        depth: bezelH, rot: [-90, 0, 0], at: [0, T + bezelH / 2, -1.2],
      },
      // The live picture, just under the lip of the frame as the glass is.
      {
        kind: 'screen', size: [g.vw, g.vd], screen: 'main',
        mat: 'lcd-glass', rot: [-90, 0, 0], at: [0, T + bezelH - 0.5, -1.2], noCollide: true,
      },
      ...malePins(LCD_PIN_X0, -g.d / 2 + 2.5, 16, T),
      // Controller blob and the ribbon bond, visible under the glass edge.
      { kind: 'box', mat: 'epoxy-black', size: [g.vw * 0.55, 1.1, 3], at: [0, T + 0.55, g.bd / 2 - 3.4], noCollide: true },
    ]
  },
  ports: (p) => {
    const g = LCD_FORMATS[str(p, 'format', '1602')] ?? LCD_FORMATS['1602']
    const zPin = -g.d / 2 + 2.5
    const out: Port[] = LCD_PINS.map(([id, label], i) => ({
      id,
      label,
      kind: 'electrical' as const,
      pos: [LCD_PIN_X0 + i * P, -1.4, zPin] as Vec3,
      dir: [0, -1, 0] as Vec3,
      role: id === 'vss' ? 'gnd' : id === 'vdd' ? 'power' : 'io',
      imax: 0.05,
    }))
    let m = 0
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push({
          id: `mount${m++}`, label: 'M3 mount', kind: 'mechanical',
          pos: [(sx * g.holeX) / 2, 1.6, (sz * g.holeZ) / 2], dir: [0, 1, 0],
          mate: { type: 'hole', size: 3 }, groupId: 'mounts',
        })
      }
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const out: DeviceModel[] = [
        {
          type: 'behavioral',
          evalId: 'hd44780',
          ref: 'vss',
          pins: ['rs', 'rw', 'e', 'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'vdd', 'v0', 'a', 'k'],
        },
        // Quiescent logic current, about 1 mA at 5 V.
        { type: 'resistor', r: 4700, a: 'vdd', b: 'vss' },
      ]
      // The backlight is a real LED array, so wiring LED+ straight to 5 V with
      // the internal resistor removed burns it exactly as it would in life.
      if (p.backlightR === false) {
        out.push({ type: 'diode', a: 'a', c: 'k', vf: 3.1, rs: 6, n: 1.9 })
      } else {
        out.push({ type: 'resistor', r: 100, a: 'a', b: '#bl' })
        out.push({ type: 'diode', a: '#bl', c: 'k', vf: 3.1, rs: 6, n: 1.9 })
      }
      return out
    },
    limits: { vmax: 5.5 },
  },
  readouts: (p) => {
    const g = LCD_FORMATS[str(p, 'format', '1602')] ?? LCD_FORMATS['1602']
    return [
      { label: 'Characters', value: `${g.cols} x ${g.rows}` },
      { label: 'Controller', value: 'HD44780, 4 or 8 bit' },
      { label: 'Viewing area', value: `${g.vw} x ${g.vd} mm` },
    ]
  },
}

/* ================================================================== */
/* Seven-segment display                                               */
/* ================================================================== */

const sevenSeg: PartDef = {
  id: 'display-seven-seg',
  name: 'Seven-segment display',
  category: 'display',
  blurb: 'Multiplexed digit array, common cathode or anode',
  tags: ['seven', '7seg', 'segment', 'display', 'digit', 'number', 'screen', 'led', '5641as'],
  doc: {
    manufacturer: 'Generic',
    mpn: '5641AS',
    price: 0.9,
    description:
      'A multiplexed digit array. Segment pins are shared and one digit is enabled at a time, so a driver that scans too slowly produces visible flicker here, just as it does on a bench.',
  },
  params: [
    { key: 'digits', label: 'Digits', type: 'number', default: 4, min: 1, max: 8, step: 1, group: 'Module' },
    { key: 'common', label: 'Common', type: 'enum', default: 'cathode', group: 'Module', options: [
      { value: 'cathode', label: 'Cathode' }, { value: 'anode', label: 'Anode' },
    ] },
    { key: 'height', label: 'Digit height', type: 'number', unit: 'mm', default: 14.2, min: 7, max: 25, step: 0.1, group: 'Module' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'digits', 4))
    const dh = num(p, 'height', 14.2)
    const w = n * (dh * 0.62) + 6
    const d = dh * 1.32
    const bodyH = 8
    const pinsPerSide = Math.ceil((n + 8) / 2)
    const x0 = -((pinsPerSide - 1) * P) / 2

    return [
      { kind: 'box', mat: { color: '#131417', rough: 0.72, density: 1.4 }, size: [w, bodyH, d], at: [0, bodyH / 2, 0], bevel: 0.4 },
      // The red filter window the digits sit behind.
      { kind: 'box', mat: { color: '#2A0D0A', rough: 0.24, clearcoat: 0.5, density: 1.2 }, size: [w - 2.4, 0.9, d - 2.4], at: [0, bodyH - 0.2, 0], noCollide: true },
      { kind: 'screen', size: [w - 3, d - 3], screen: 'main', mat: 'epoxy-black', rot: [-90, 0, 0], at: [0, bodyH + 0.3, 0], noCollide: true },
      ...[-1, 1].flatMap((sz) =>
        Array.from({ length: pinsPerSide }, (_, i): Solid => ({
          kind: 'box', mat: 'tin', size: [0.5, 6, 0.4],
          at: [x0 + i * P, -1.4, (sz * (d - 2)) / 2],
        })),
      ),
    ]
  },
  ports: (p) => {
    const n = Math.round(num(p, 'digits', 4))
    const dh = num(p, 'height', 14.2)
    const d = dh * 1.32
    const segs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']
    const ids = [...segs, ...Array.from({ length: n }, (_, i) => `d${i + 1}`)]
    const pinsPerSide = Math.ceil(ids.length / 2)
    const x0 = -((pinsPerSide - 1) * P) / 2
    return ids.map((id, i) => {
      const side = i < pinsPerSide ? -1 : 1
      const col = i % pinsPerSide
      return {
        id,
        label: id.startsWith('d') && id.length > 1 ? `Digit ${id.slice(1)}` : `Segment ${id.toUpperCase()}`,
        kind: 'electrical' as const,
        pos: [x0 + col * P, -4.4, (side * (d - 2)) / 2] as Vec3,
        dir: [0, -1, 0] as Vec3,
        role: 'io' as const,
        imax: 0.03,
      }
    })
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'digits', 4))
      const anode = str(p, 'common', 'cathode') === 'anode'
      const segs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']
      const out: DeviceModel[] = [
        {
          type: 'behavioral',
          evalId: 'seven-seg',
          pins: [...segs, ...Array.from({ length: n }, (_, i) => `d${i + 1}`)],
        },
      ]
      // Every segment is a real LED between its segment pin and its digit
      // common, so a display driven without series resistors overheats here
      // the same way it does on a breadboard.
      for (let dgt = 0; dgt < n; dgt++) {
        for (const s of segs) {
          const common = `d${dgt + 1}`
          out.push(
            anode
              ? { type: 'diode', a: common, c: `${s}`, vf: 1.9, rs: 14, n: 1.9 }
              : { type: 'diode', a: `${s}`, c: common, vf: 1.9, rs: 14, n: 1.9 },
          )
        }
      }
      return out
    },
    limits: { imax: 0.02 },
  },
  readouts: (p) => [
    { label: 'Digits', value: String(Math.round(num(p, 'digits', 4))) },
    { label: 'Common', value: str(p, 'common', 'cathode') === 'anode' ? 'Anode' : 'Cathode' },
    { label: 'Segment current', value: '10 to 20 mA, needs a resistor' },
  ],
}

registerParts([lcdCharacter, sevenSeg])

export const DISPLAY_PARTS = [lcdCharacter, sevenSeg]
