import type { DeviceModel, ElectricalSpec, Params, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, REGION_PARAM, amps, load, mainsPorts, screen, volts } from './setup'
import { BLACK_PLASTIC, SOFT, signalPorts } from './setup2'

/**
 * What your hands and eyes are on, and what feeds it.
 *
 * The room files above this one cover the mains, the screens, the machines
 * and the furniture. This is the layer between: the peripherals, and the
 * small supplies they hang off.
 *
 * The test each part had to pass is the one `setup3.ts` sets out — it must
 * change an answer. These change two in particular, and both are questions
 * people get wrong:
 *
 *   USB power is a budget, not a given. A bus-powered hub has 500 mA for
 *   everything downstream of it, and a drive that wants 900 takes the whole
 *   lot. That is a sum, the parts carry the numbers for it, and the solver
 *   does it.
 *
 *   A peak is not an average. A laser printer idles at 8 W and pulls 900 the
 *   moment the fuser warms, which is most of a 13 A socket for ten seconds,
 *   and is why it trips a socket it has shared with a kettle for a year.
 *
 * Conventions are the ones in `setup.ts`: mains as l/n/e, loads sized in
 * watts at the region voltage, signal ports that carry no current and exist
 * for reach and the bill of materials, everything authored standing on its
 * own footprint at y = 0 facing +z.
 */

const RUBBER = { color: '#1A1B1E', rough: 0.95, density: 1.2 }
const GREY_PLASTIC = { color: '#3A3D42', rough: 0.6, density: 1.2 }

/* ------------------------------------------------------------------ */
/* USB, as a power budget                                              */
/* ------------------------------------------------------------------ */

/**
 * The two power pins of a USB connector.
 *
 * Data is not modelled and should not be: nothing in this tool asks what is
 * on the differential pair, and everything asks what the thing draws. The
 * ports are named `vbus` and `gnd` everywhere so a lead from any supply
 * reaches any device without thinking about it.
 */
export function usbPorts(at: Vec3, dir: Vec3, imax = 1.5, prefix = ''): Port[] {
  return [
    {
      id: prefix + 'vbus', label: prefix ? `${prefix.toUpperCase()} +5 V` : 'USB +5 V',
      kind: 'electrical', pos: [at[0] - 2, at[1], at[2]], dir, role: 'power', imax, solderable: false,
    },
    {
      id: prefix + 'gnd', label: prefix ? `${prefix.toUpperCase()} GND` : 'USB GND',
      kind: 'electrical', pos: [at[0] + 2, at[1], at[2]], dir, role: 'gnd', imax, solderable: false,
    },
  ]
}

/**
 * A bus-powered device: a resistance across vbus and gnd that draws the
 * stated power at the voltage it is actually given.
 *
 * Sized at 5 V and left as a resistance, so a device on a long thin cable
 * reads the sag rather than hiding it. That is the failure this models: a
 * drive at the end of three metres of 28 AWG browns out, and the reason is
 * visible here as volt drop rather than as a mystery.
 */
export function usbLoad(wattsOf: (p: Params) => number, extra: (p: Params) => DeviceModel[] = () => []): ElectricalSpec {
  return {
    devices: (p) => [
      { type: 'resistor', a: 'vbus', b: 'gnd', r: 25 / Math.max(0.05, wattsOf(p)) },
      ...extra(p),
    ],
    limits: { vmax: 24 },
  }
}

/** Watts as a current at 5 V, written the way a datasheet writes it. */
const mA = (w: number): string => `${Math.round((w / 5) * 1000)} mA at 5 V`

/* ================================================================== */
/* On the desk                                                         */
/* ================================================================== */

const mouse: PartDef = {
  id: 'mouse-desk',
  name: 'Mouse',
  category: 'peripheral',
  blurb: 'A hand-sized puck that either needs a cable or a charge',
  tags: ['mouse', 'pointer', 'peripheral', 'input', 'wireless', 'usb', 'desk', 'setup', 'gaming mouse'],
  doc: {
    price: 60,
    description:
      'Here for two reasons. It is the thing that decides how much clear desk a layout has to leave to the right of the keyboard — about 250 mm of swing for a low sensitivity grip, which is more than most plans allow. And a wired one is a load on the bus the keyboard is already on.',
  },
  params: [
    {
      key: 'link', label: 'Connection', type: 'enum', default: 'dongle', group: 'Mouse',
      options: [
        { value: 'wired', label: 'USB cable' },
        { value: 'dongle', label: '2.4 GHz dongle' },
        { value: 'bt', label: 'Bluetooth' },
      ],
    },
    { key: 'size', label: 'Length', type: 'number', unit: 'mm', default: 125, min: 100, max: 135, step: 1, group: 'Mouse' },
    { key: 'swing', label: 'Swing needed', type: 'number', unit: 'mm', default: 250, min: 120, max: 450, step: 10, group: 'Desk', help: 'Clear desk to the side of the keyboard. Low sensitivity and a palm grip want 350 and up.' },
    { key: 'rate', label: 'Polling', type: 'enum', default: '1000', group: 'Mouse', options: ['125', '500', '1000', '4000', '8000'].map((v) => ({ value: v, label: `${v} Hz` })) },
  ],
  solids: (p) => {
    const l = num(p, 'size', 125)
    const w = l * 0.54
    const out: Solid[] = [
      { kind: 'box', mat: BLACK_PLASTIC, size: [w, 26, l], at: [0, 16, 0], bevel: 12 },
      { kind: 'box', mat: SOFT, size: [w - 8, 10, l * 0.5], at: [0, 32, -l * 0.18], bevel: 8 },
      // The two main buttons, as the split between them.
      { kind: 'box', mat: DARK, size: [1.4, 6, l * 0.42], at: [0, 36, -l * 0.26], noCollide: true },
      { kind: 'cyl', mat: RUBBER, r: 5, h: 10, seg: 16, rot: [0, 0, 90], at: [0, 37, -l * 0.3] },
    ]
    if (str(p, 'link', 'dongle') === 'wired') {
      out.push({ kind: 'tube', mat: { color: '#1A1A1C', rough: 0.9, density: 1.1 }, r: 1.8, seg: 10, path: [[0, 14, l / 2], [0, 12, l / 2 + 40], [0, 4, l / 2 + 90]] })
    }
    return out
  },
  ports: (p) => {
    const l = num(p, 'size', 125)
    const out: Port[] = [{ id: 'floor', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } }]
    if (str(p, 'link', 'dongle') === 'wired') out.push(...usbPorts([0, 4, l / 2 + 92], [0, 0, 1], 0.5))
    return out
  },
  // A wireless mouse runs off its own cell and draws nothing from the build.
  electrical: {
    devices: (p) => (str(p, 'link', 'dongle') === 'wired' ? [{ type: 'resistor', a: 'vbus', b: 'gnd', r: 25 / 0.5 }] : []),
    limits: { vmax: 24 },
  },
  mass: (p) => (str(p, 'link', 'dongle') === 'wired' ? 78 : 95),
  readouts: (p) => {
    const swing = num(p, 'swing', 250)
    const link = str(p, 'link', 'dongle')
    return [
      { label: 'Desk to the side', value: `${swing} mm clear` },
      { label: 'Draw', value: link === 'wired' ? `0.5 W, ${mA(0.5)}` : 'Own cell, nothing from the build' },
      { label: 'Report interval', value: `${(1000 / (parseInt(str(p, 'rate', '1000'), 10) || 1000)).toFixed(2)} ms` },
    ]
  },
}

const webcam: PartDef = {
  id: 'webcam-usb',
  name: 'Webcam',
  category: 'peripheral',
  blurb: 'A sensor on a monitor lip, covering a width at a distance',
  tags: ['webcam', 'camera', 'usb camera', 'video', 'call', 'stream', 'peripheral', 'setup', '1080p', '4k'],
  doc: {
    price: 90,
    description:
      'What this answers is framing. A 78 degree lens at 700 mm covers 1.13 m, which takes in you and both sides of a two-monitor desk; a 65 degree lens at the same distance covers 890 mm and crops the second screen out. The number nobody checks until the call starts.',
  },
  params: [
    {
      key: 'res', label: 'Sensor', type: 'enum', default: '1080p60', group: 'Camera',
      options: [
        { value: '1080p30', label: '1080p, 30 fps' },
        { value: '1080p60', label: '1080p, 60 fps' },
        { value: '4k30', label: '4K, 30 fps' },
      ],
    },
    { key: 'fov', label: 'Field of view', type: 'number', unit: '°', default: 78, min: 55, max: 110, step: 1, group: 'Camera' },
    { key: 'distance', label: 'Sitting distance', type: 'number', unit: 'mm', default: 700, min: 350, max: 2000, step: 50, group: 'Camera' },
    {
      key: 'mount', label: 'Mount', type: 'enum', default: 'monitor', group: 'Mount',
      options: [{ value: 'monitor', label: 'Monitor lip' }, { value: 'tripod', label: 'Tripod thread' }],
    },
  ],
  solids: (p) => {
    const out: Solid[] = [
      { kind: 'cyl', mat: BLACK_PLASTIC, r: 22, h: 30, seg: 28, rot: [0, 0, 90], at: [0, 36, 0], chamfer: 2 },
      { kind: 'cyl', mat: { color: '#0A0B0D', rough: 0.1, clearcoat: 1, density: 2.4 }, r: 11, h: 6, seg: 24, at: [0, 36, 16] },
      { kind: 'cyl', mat: { color: '#121316', rough: 0.2, density: 2.4 }, r: 6, h: 3, seg: 20, at: [0, 36, 19] },
    ]
    if (str(p, 'mount', 'monitor') === 'monitor') {
      // The hinge and the lip that hooks over a panel.
      out.push({ kind: 'box', mat: BLACK_PLASTIC, size: [34, 6, 40], at: [0, 16, -6], bevel: 2 })
      out.push({ kind: 'box', mat: BLACK_PLASTIC, size: [34, 24, 5], at: [0, 6, -24], bevel: 2 })
    } else {
      out.push({ kind: 'cyl', mat: ALU, r: 6, h: 14, seg: 16, at: [0, 11, 0] })
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2
        out.push({ kind: 'box', mat: ALU, size: [7, 4, 70], at: [Math.cos(a) * 24, 2, Math.sin(a) * 24], rot: [0, (-a * 180) / Math.PI, 0] })
      }
    }
    return out
  },
  ports: () => [
    ...usbPorts([0, 36, -26], [0, 0, -1], 0.5),
    { id: 'mount', label: 'Mount', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: usbLoad((p) => (str(p, 'res', '1080p60') === '4k30' ? 2.5 : 1.4)),
  mass: () => 160,
  price: (p) => (str(p, 'res', '1080p60') === '4k30' ? 180 : 75),
  readouts: (p) => {
    const fov = num(p, 'fov', 78)
    const d = num(p, 'distance', 700)
    const cover = 2 * d * Math.tan(((fov / 2) * Math.PI) / 180)
    const w = str(p, 'res', '1080p60') === '4k30' ? 2.5 : 1.4
    return [
      { label: `Covers at ${d} mm`, value: `${Math.round(cover)} mm wide` },
      { label: 'Draw', value: `${w.toFixed(1)} W, ${mA(w)}` },
    ]
  },
}

const macroPad: PartDef = {
  id: 'macropad-keys',
  name: 'Macro pad',
  category: 'peripheral',
  blurb: 'A grid of keys with screens in them, or without',
  tags: ['macro pad', 'stream deck', 'hotkey', 'keypad', 'shortcut', 'peripheral', 'input', 'desk', 'setup'],
  doc: {
    price: 150,
    description:
      'A block of keys that sits where it can be hit without looking, which means beside the keyboard rather than above it, and takes a footprint out of the desk to do it. The screen-key variants are a real load — fifteen small LCDs with their backlights on is 5 W, which is a tenth of what the monitor beside it uses.',
  },
  params: [
    {
      key: 'keys', label: 'Keys', type: 'enum', default: '15', group: 'Pad',
      options: [{ value: '6', label: '6, two by three' }, { value: '15', label: '15, three by five' }, { value: '32', label: '32, four by eight' }],
    },
    { key: 'screens', label: 'Screen keys', type: 'bool', default: true, group: 'Pad', help: 'An LCD behind each cap, so a key shows what it does. Off is a plain mechanical pad.' },
    { key: 'on', label: 'Lit', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'keys', '15'), 10) || 15
    const cols = n === 6 ? 3 : n === 15 ? 5 : 8
    const rows = Math.max(1, Math.round(n / cols))
    const pitch = 24
    const bodyW = cols * pitch + 16
    const bodyD = rows * pitch + 22
    const lit = bool(p, 'screens', true) && bool(p, 'on', true)
    const out: Solid[] = [
      { kind: 'box', mat: BLACK_PLASTIC, size: [bodyW, 14, bodyD], at: [0, 7, 0], bevel: 3 },
      { kind: 'box', mat: GREY_PLASTIC, size: [bodyW - 6, 10, 18], at: [0, 12, -bodyD / 2 + 8], rot: [-12, 0, 0] },
    ]
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * pitch
        const z = (r - (rows - 1) / 2) * pitch + 6
        out.push({
          kind: 'box',
          mat: bool(p, 'screens', true) ? screen(lit, '#5E7FA8') : { color: '#23262B', rough: 0.72, density: 1.1 },
          size: [pitch - 4, 6, pitch - 4],
          at: [x, 16, z],
          bevel: 1.2,
        })
      }
    }
    return out
  },
  ports: (p) => {
    const n = parseInt(str(p, 'keys', '15'), 10) || 15
    const cols = n === 6 ? 3 : n === 15 ? 5 : 8
    const rows = Math.max(1, Math.round(n / cols))
    const bodyD = rows * cols === 0 ? 50 : rows * 24 + 22
    return [
      ...usbPorts([0, 7, -bodyD / 2], [0, 0, -1], 1),
      { id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: usbLoad((p) => {
    const n = parseInt(str(p, 'keys', '15'), 10) || 15
    if (!bool(p, 'screens', true)) return bool(p, 'on', true) ? 0.6 : 0.2
    // About 0.33 W per lit LCD key, measured across the three sizes.
    return bool(p, 'on', true) ? 1.1 + n * 0.33 : 0.4
  }),
  mass: (p) => {
    const n = parseInt(str(p, 'keys', '15'), 10) || 15
    return 90 + n * 9
  },
  price: (p) => {
    const n = parseInt(str(p, 'keys', '15'), 10) || 15
    return bool(p, 'screens', true) ? 80 + n * 7 : 30 + n * 3
  },
  readouts: (p) => {
    const n = parseInt(str(p, 'keys', '15'), 10) || 15
    const cols = n === 6 ? 3 : n === 15 ? 5 : 8
    const rows = Math.max(1, Math.round(n / cols))
    const w = bool(p, 'screens', true) ? (bool(p, 'on', true) ? 1.1 + n * 0.33 : 0.4) : 0.6
    return [
      { label: 'Footprint', value: `${cols * 24 + 16} × ${rows * 24 + 22} mm` },
      { label: 'Draw', value: `${w.toFixed(1)} W, ${mA(w)}` },
    ]
  },
}

const penDisplay: PartDef = {
  id: 'tablet-pen-display',
  name: 'Pen display',
  category: 'peripheral',
  blurb: 'A screen you draw on, lying flat and taking the desk with it',
  tags: ['pen display', 'graphics tablet', 'drawing tablet', 'wacom', 'stylus', 'cintiq', 'peripheral', 'input', 'desk'],
  doc: {
    price: 450,
    description:
      'The peripheral that breaks a desk plan. It lies flat in front of you at a shallow angle, which means it wants the depth the keyboard is using and the keyboard has to go somewhere — usually on a riser above the screens. A 16 inch one is 420 mm wide and needs 300 mm of depth at 20 degrees.\n\nIt is also a real load, because it is a monitor: 25 W over USB-C, which is past what a bus port gives and is why it ships with a brick.',
  },
  params: [
    { key: 'size', label: 'Diagonal', type: 'enum', default: '16', group: 'Display', options: ['11', '13', '16', '24'].map((v) => ({ value: v, label: `${v}"` })) },
    { key: 'tilt', label: 'Tilt', type: 'number', unit: '°', default: 20, min: 0, max: 45, step: 1, group: 'Stand' },
    {
      key: 'supply', label: 'Power', type: 'enum', default: 'brick', group: 'Power',
      options: [{ value: 'brick', label: 'Own supply' }, { value: 'usbc', label: 'USB-C from the host' }],
    },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const inches = parseInt(str(p, 'size', '16'), 10) || 16
    const w = inches * 25.4 * 0.86
    const h = w * 0.62
    const tilt = num(p, 'tilt', 20)
    const lit = bool(p, 'on', true)
    return [
      { kind: 'box', mat: BLACK_PLASTIC, size: [w + 24, 16, h + 40], at: [0, 8 + (h / 2) * Math.sin((tilt * Math.PI) / 180), 0], rot: [-tilt, 0, 0], bevel: 3 },
      { kind: 'box', mat: screen(lit, '#5A7CA8'), size: [w, 3, h], at: [0, 17 + (h / 2) * Math.sin((tilt * Math.PI) / 180), 6], rot: [-tilt, 0, 0] },
      // The pen, which lives in a cradle on the back edge and is never in it.
      { kind: 'cyl', mat: BLACK_PLASTIC, r: 5.5, h: 150, seg: 14, rot: [0, 0, 90], at: [w / 2 + 30, 6, -h / 2] },
    ]
  },
  ports: (p) => {
    const inches = parseInt(str(p, 'size', '16'), 10) || 16
    const w = inches * 25.4 * 0.86
    const h = w * 0.62
    const out: Port[] = [
      ...signalPorts([['hdmi', 'HDMI in'], ['usb', 'USB data']], [-w / 4, 10, -h / 2 - 18], [0, 0, -1], 22),
      { id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
    if (str(p, 'supply', 'brick') === 'usbc') out.push(...usbPorts([w / 4, 10, -h / 2 - 18], [0, 0, -1], 3))
    else out.push(...mainsPorts([w / 4, 10, -h / 2 - 18], [0, 0, -1], '', [9, 0, 0]))
    return out
  },
  electrical: {
    devices: (p) => {
      const inches = parseInt(str(p, 'size', '16'), 10) || 16
      // A pen display is a panel with a digitiser behind it: 0.9 W an inch of
      // diagonal lit, a tenth of that asleep.
      const w = bool(p, 'on', true) ? inches * 0.9 + 6 : 0.9
      if (str(p, 'supply', 'brick') === 'usbc') {
        // Over USB-C it is fed at 20 V, not 5: a 20 W panel at 5 V would be
        // 4 A, which no bus port gives and no cable here is sized for.
        return [{ type: 'resistor', a: 'vbus', b: 'gnd', r: 400 / Math.max(0.2, w) }]
      }
      const v = volts(p)
      return [
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / Math.max(0.2, w / 0.9) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
    },
    limits: { vmax: 400 },
  },
  mass: (p) => {
    const inches = parseInt(str(p, 'size', '16'), 10) || 16
    return 300 + inches * 95
  },
  price: (p) => {
    const inches = parseInt(str(p, 'size', '16'), 10) || 16
    return inches <= 11 ? 230 : inches <= 13 ? 350 : inches <= 16 ? 560 : 1400
  },
  readouts: (p) => {
    const inches = parseInt(str(p, 'size', '16'), 10) || 16
    const w = inches * 25.4 * 0.86
    const h = w * 0.62
    const tilt = num(p, 'tilt', 20)
    const depth = h * Math.cos((tilt * Math.PI) / 180) + 40
    const watts = bool(p, 'on', true) ? inches * 0.9 + 6 : 0.9
    return [
      { label: 'Desk taken', value: `${Math.round(w + 24)} × ${Math.round(depth)} mm` },
      { label: 'Draw', value: `${watts.toFixed(1)} W` },
      ...(str(p, 'supply', 'brick') === 'usbc' && watts > 15
        ? [{ label: 'Over USB-C', value: `${watts.toFixed(0)} W needs a PD host, not a bus port` }]
        : []),
    ]
  },
}

/* ================================================================== */
/* Hubs, docks and drives — where the budget runs out                  */
/* ================================================================== */

const usbHub: PartDef = {
  id: 'hub-usb',
  name: 'USB hub',
  category: 'peripheral',
  blurb: 'Four ports sharing one, and a budget that runs out',
  tags: ['usb hub', 'hub', 'splitter', 'usb', 'powered hub', 'peripheral', 'ports', 'dock'],
  doc: {
    price: 25,
    description:
      'The part that explains a drive that unmounts itself. A bus-powered hub has one upstream port to live off: 500 mA on USB 2, 900 mA on USB 3, shared between everything plugged into it and the hub itself. A self-powered one brings its own supply and gives every port the full allowance.\n\nIt carries its own current limit, so a build that overloads it says so rather than being found out later.',
  },
  params: [
    { key: 'ports', label: 'Downstream ports', type: 'number', unit: '', default: 4, min: 2, max: 10, step: 1, group: 'Hub' },
    {
      key: 'powered', label: 'Supply', type: 'enum', default: 'bus', group: 'Power',
      options: [{ value: 'bus', label: 'Bus powered' }, { value: 'self', label: 'Self powered, own brick' }],
    },
    {
      key: 'gen', label: 'Generation', type: 'enum', default: '3', group: 'Hub',
      options: [{ value: '2', label: 'USB 2.0, 500 mA' }, { value: '3', label: 'USB 3.2, 900 mA' }],
    },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'ports', 4))
    const len = 24 + n * 17
    const out: Solid[] = [
      { kind: 'box', mat: ALU, size: [len, 12, 42], at: [0, 6, 0], bevel: 2.5 },
      { kind: 'box', mat: DARK, size: [10, 5, 4], at: [-len / 2 + 2, 6, -16] },
    ]
    for (let i = 0; i < n; i++) {
      out.push({ kind: 'box', mat: DARK, size: [13, 6, 4], at: [(i - (n - 1) / 2) * 17, 6, 20] })
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'ports', 4))
    const len = 24 + n * 17
    const out: Port[] = [...usbPorts([-len / 2 - 2, 6, -16], [-1, 0, 0], 3, 'up')]
    for (let i = 0; i < n; i++) {
      out.push(...usbPorts([(i - (n - 1) / 2) * 17, 6, 23], [0, 0, 1], 0.9, `p${i + 1}`))
    }
    out.push({ id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'ports', 4))
      const self = str(p, 'powered', 'bus') === 'self'
      const out: DeviceModel[] = []
      /*
       * A hub is a switch, not a supply, unless it has its own brick. Bus
       * powered, every downstream port is simply tied to the upstream rail
       * through the resistance of the switch inside it, which is where the
       * sag that unmounts a drive actually happens — about 60 milliohms a
       * port, plus the hub's own 50 mA of housekeeping.
       */
      out.push({ type: 'resistor', a: 'upvbus', b: 'upgnd', r: 25 / 0.25 })
      for (let i = 1; i <= n; i++) {
        if (self) {
          // Its own supply, so each port is a source in its own right.
          out.push({ type: 'vsource', v: 5.1, a: `p${i}vbus`, b: `p${i}gnd`, rint: 0.06 })
        } else {
          out.push({ type: 'resistor', a: 'upvbus', b: `p${i}vbus`, r: 0.06 })
          out.push({ type: 'short', a: 'upgnd', b: `p${i}gnd` })
        }
      }
      return out
    },
    supplies: Array.from({ length: 10 }, (_, i) => `p${i + 1}vbus`),
    limits: { vmax: 24 },
  },
  mass: (p) => 40 + Math.round(num(p, 'ports', 4)) * 12,
  price: (p) => (str(p, 'powered', 'bus') === 'self' ? 34 : 14) + Math.round(num(p, 'ports', 4)) * 3,
  readouts: (p) => {
    const n = Math.round(num(p, 'ports', 4))
    const gen = str(p, 'gen', '3')
    const each = gen === '3' ? 0.9 : 0.5
    const self = str(p, 'powered', 'bus') === 'self'
    return [
      { label: 'Per port', value: `${(each * 1000).toFixed(0)} mA, ${(each * 5).toFixed(1)} W` },
      {
        label: 'Budget',
        value: self
          ? `${(n * each * 5).toFixed(0)} W from its own supply`
          : `${(each * 5).toFixed(1)} W shared across ${n} ports, less 0.25 W for the hub`,
      },
      ...(self ? [] : [{ label: 'Watch', value: `One drive can take ${(each * 1000).toFixed(0)} mA on its own` }]),
    ]
  },
}

const dock: PartDef = {
  id: 'dock-usbc',
  name: 'USB-C dock',
  category: 'peripheral',
  blurb: 'One cable to the laptop, and a watt budget to split',
  tags: ['dock', 'docking station', 'usb-c', 'thunderbolt', 'hub', 'laptop dock', 'pd', 'power delivery', 'desk'],
  doc: {
    price: 230,
    description:
      'A dock has one job that goes wrong: it feeds the laptop and everything else from one brick. A 180 W brick that promises 96 W to the host has 84 W left for the screens, the drives and the bus, and the two screens take 10 W of that before anything is plugged in. The sum is here.',
  },
  params: [
    { key: 'brick', label: 'Supply', type: 'enum', default: '180', group: 'Power', options: ['100', '135', '180', '230'].map((v) => ({ value: v, label: `${v} W brick` })) },
    { key: 'host', label: 'To the host', type: 'enum', default: '96', group: 'Power', options: ['60', '85', '96', '140'].map((v) => ({ value: v, label: `${v} W` })) },
    { key: 'displays', label: 'Displays', type: 'number', unit: '', default: 2, min: 0, max: 4, step: 1, group: 'Dock' },
    { key: 'usb', label: 'USB ports', type: 'number', unit: '', default: 4, min: 1, max: 8, step: 1, group: 'Dock' },
    { key: 'draw', label: 'Peripheral draw', type: 'number', unit: 'W', default: 12, min: 0, max: 90, step: 1, group: 'Control', help: 'What is actually hanging off the downstream ports right now.' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'usb', 4))
    const len = 150 + n * 6
    const out: Solid[] = [
      { kind: 'box', mat: ALU, size: [len, 26, 78], at: [0, 13, 0], bevel: 4 },
      { kind: 'box', mat: DARK, size: [len - 8, 3, 70], at: [0, 1, 0] },
      { kind: 'cyl', mat: { color: '#2F3338', rough: 0.5, density: 1.2, emissive: '#4C8DFF', emissiveIntensity: 0.4 }, r: 2.2, h: 1, seg: 12, rot: [90, 0, 0], at: [-len / 2 + 12, 13, 39] },
    ]
    for (let i = 0; i < n; i++) out.push({ kind: 'box', mat: DARK, size: [13, 6, 4], at: [(i - (n - 1) / 2) * 18, 14, -40] })
    const d = Math.round(num(p, 'displays', 2))
    for (let i = 0; i < d; i++) out.push({ kind: 'box', mat: DARK, size: [20, 8, 5], at: [(i - (d - 1) / 2) * 26, 14, 41] })
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'usb', 4))
    const len = 150 + n * 6
    const d = Math.round(num(p, 'displays', 2))
    const out: Port[] = [
      ...mainsPorts([-len / 2 + 20, 13, -41], [0, 0, -1], '', [9, 0, 0]),
      ...usbPorts([len / 2 - 24, 13, -41], [0, 0, -1], 5, 'host'),
    ]
    for (let i = 0; i < n; i++) out.push(...usbPorts([(i - (n - 1) / 2) * 18, 14, -42], [0, 0, -1], 0.9, `p${i + 1}`))
    for (let i = 0; i < d; i++) {
      out.push({
        id: `dp${i + 1}`, label: `Display ${i + 1}`, kind: 'electrical',
        pos: [(i - (d - 1) / 2) * 26, 14, 44], dir: [0, 0, 1], role: 'io', imax: 0.5, solderable: false,
      })
    }
    out.push({ id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const v = volts(p)
      const host = parseInt(str(p, 'host', '96'), 10) || 96
      const dr = num(p, 'draw', 12)
      const d = Math.round(num(p, 'displays', 2))
      // Dock housekeeping plus 5 W a display controller, plus what the host
      // and the peripherals take, over a supply that is about 90% efficient.
      const total = (8 + d * 5 + host + dr) / 0.9
      const out: DeviceModel[] = [
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / Math.max(1, total) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
        { type: 'vsource', v: 20, a: 'hostvbus', b: 'hostgnd', rint: 0.04 },
      ]
      const n = Math.round(num(p, 'usb', 4))
      for (let i = 1; i <= n; i++) out.push({ type: 'vsource', v: 5.1, a: `p${i}vbus`, b: `p${i}gnd`, rint: 0.07 })
      return out
    },
    supplies: ['hostvbus', ...Array.from({ length: 8 }, (_, i) => `p${i + 1}vbus`)],
    limits: { vmax: 400 },
  },
  mass: () => 520,
  price: (p) => 110 + (parseInt(str(p, 'brick', '180'), 10) || 180) * 0.6,
  readouts: (p) => {
    const brick = parseInt(str(p, 'brick', '180'), 10) || 180
    const host = parseInt(str(p, 'host', '96'), 10) || 96
    const d = Math.round(num(p, 'displays', 2))
    const dr = num(p, 'draw', 12)
    const overhead = 8 + d * 5
    const left = brick - host - overhead - dr
    return [
      { label: 'Brick', value: `${brick} W` },
      { label: 'Committed', value: `${host} W host, ${overhead} W dock and displays, ${dr} W peripherals` },
      { label: 'Headroom', value: left >= 0 ? `${left} W spare` : `${-left} W over the brick` },
      { label: 'From the wall', value: amps(p, (overhead + host + dr) / 0.9) },
    ]
  },
}

const portableSsd: PartDef = {
  id: 'ssd-portable',
  name: 'Portable SSD',
  category: 'peripheral',
  blurb: 'A drive in a pocket, and 900 mA when it is writing',
  tags: ['ssd', 'external drive', 'portable ssd', 'nvme', 'usb drive', 'storage', 'backup', 'peripheral'],
  doc: {
    price: 110,
    description:
      'The commonest thing on the end of an overloaded hub. Writing, an NVMe enclosure takes 4.5 W, which is most of a USB 3 port allowance on its own; a SATA one takes 2.5. The number matters because this is usually the device that drops off the bus, not the one that caused it.',
  },
  params: [
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '2', group: 'Drive', options: ['0.5', '1', '2', '4', '8'].map((v) => ({ value: v, label: `${v} TB` })) },
    {
      key: 'bus', label: 'Interface', type: 'enum', default: 'nvme', group: 'Drive',
      options: [{ value: 'sata', label: 'SATA, 540 MB/s' }, { value: 'nvme', label: 'NVMe, 1050 MB/s' }, { value: 'tb', label: 'Thunderbolt, 2800 MB/s' }],
    },
    {
      key: 'state', label: 'State', type: 'enum', default: 'idle', group: 'Control',
      options: [{ value: 'idle', label: 'Idle' }, { value: 'read', label: 'Reading' }, { value: 'write', label: 'Writing' }],
    },
  ],
  solids: () => [
    { kind: 'box', mat: { color: '#2A2D33', rough: 0.4, density: 2.1 }, size: [58, 10, 100], at: [0, 5, 0], bevel: 5 },
    { kind: 'box', mat: ALU, size: [50, 2, 90], at: [0, 10.5, 0], bevel: 3 },
    { kind: 'box', mat: DARK, size: [9, 3.5, 3], at: [0, 5, -51] },
  ],
  ports: () => [
    ...usbPorts([0, 5, -53], [0, 0, -1], 1),
    { id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: usbLoad((p) => {
    const bus = str(p, 'bus', 'nvme')
    const peak = bus === 'tb' ? 6.5 : bus === 'nvme' ? 4.5 : 2.5
    const state = str(p, 'state', 'idle')
    return state === 'write' ? peak : state === 'read' ? peak * 0.8 : 0.6
  }),
  mass: () => 58,
  price: (p) => {
    const tb = parseFloat(str(p, 'capacity', '2')) || 2
    const mult = str(p, 'bus', 'nvme') === 'tb' ? 110 : str(p, 'bus', 'nvme') === 'nvme' ? 62 : 45
    return Math.round(28 + tb * mult)
  },
  readouts: (p) => {
    const bus = str(p, 'bus', 'nvme')
    const rate = bus === 'tb' ? 2800 : bus === 'nvme' ? 1050 : 540
    const tb = parseFloat(str(p, 'capacity', '2')) || 2
    const peak = bus === 'tb' ? 6.5 : bus === 'nvme' ? 4.5 : 2.5
    const state = str(p, 'state', 'idle')
    const w = state === 'write' ? peak : state === 'read' ? peak * 0.8 : 0.6
    return [
      { label: 'Sequential', value: `${rate} MB/s` },
      { label: 'Fill time', value: `${((tb * 1e6) / rate / 60).toFixed(0)} min at full rate` },
      { label: 'Draw', value: `${w.toFixed(1)} W, ${mA(w)}` },
    ]
  },
}

/* ================================================================== */
/* The one with a peak                                                 */
/* ================================================================== */

const laserPrinter: PartDef = {
  id: 'printer-laser',
  name: 'Laser printer',
  category: 'peripheral',
  blurb: 'Eight watts idle, nine hundred the moment it prints',
  tags: ['printer', 'laser printer', 'laserjet', 'mono', 'office', 'fuser', 'mains', 'peak load', 'setup'],
  doc: {
    price: 220,
    description:
      'In the catalogue for one number. A small mono laser idles at 8 W and draws 900 W for the ten seconds the fuser takes to reach temperature, which is 3.9 A of a 13 A socket in the UK and 7.5 A of a 15 A circuit in the US. Share that socket with a kettle and the breaker goes, months after the printer was installed and apparently at random.\n\nSet the state to Warming to see the peak in the build rather than reading about it.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'kind', label: 'Type', type: 'enum', default: 'mono', group: 'Printer',
      options: [{ value: 'mono', label: 'Mono, A4' }, { value: 'colour', label: 'Colour, A4' }, { value: 'mfp', label: 'Colour MFP with scanner' }],
    },
    {
      key: 'state', label: 'State', type: 'enum', default: 'idle', group: 'Control',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'sleep', label: 'Sleep' },
        { value: 'idle', label: 'Ready' },
        { value: 'print', label: 'Printing' },
        { value: 'warm', label: 'Warming the fuser' },
      ],
    },
  ],
  solids: (p) => {
    const kind = str(p, 'kind', 'mono')
    const w = kind === 'mono' ? 380 : 420
    const d = kind === 'mono' ? 360 : 420
    const h = kind === 'mfp' ? 420 : kind === 'colour' ? 310 : 220
    const body = { color: '#D9D7D2', rough: 0.6, density: 1.3 }
    const out: Solid[] = [
      { kind: 'box', mat: body, size: [w, h, d], at: [0, h / 2, 0], bevel: 8 },
      // The paper tray, proud of the front by the length of an A4 sheet.
      { kind: 'box', mat: { color: '#C9C7C2', rough: 0.65, density: 1.3 }, size: [w - 30, 60, 90], at: [0, 40, d / 2 + 40], bevel: 4 },
      // The output slot, which is where the stack grows into the room.
      { kind: 'box', mat: DARK, size: [w - 60, 10, d - 120], at: [0, h - 6, 10], noCollide: true },
    ]
    if (kind === 'mfp') {
      out.push({ kind: 'box', mat: { color: '#2C2E31', rough: 0.3, clearcoat: 0.7, density: 2.2 }, size: [w - 40, 4, d - 60], at: [0, h + 3, 0] })
      out.push({ kind: 'box', mat: body, size: [w - 30, 40, d - 50], at: [0, h + 26, 0], bevel: 6 })
    }
    return out
  },
  ports: (p) => {
    const kind = str(p, 'kind', 'mono')
    const w = kind === 'mono' ? 380 : 420
    const d = kind === 'mono' ? 360 : 420
    return [
      ...mainsPorts([-w / 4, 60, -d / 2], [0, 0, -1], '', [11, 0, 0]),
      ...signalPorts([['usb', 'USB B'], ['lan', 'Ethernet']], [w / 4, 60, -d / 2], [0, 0, -1], 24),
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const kind = str(p, 'kind', 'mono')
    const peak = kind === 'mono' ? 900 : kind === 'colour' ? 1100 : 1250
    switch (str(p, 'state', 'idle')) {
      case 'off': return 0.3
      case 'sleep': return kind === 'mono' ? 1.1 : 1.8
      case 'print': return peak * 0.55
      case 'warm': return peak
      default: return kind === 'mono' ? 8 : 14
    }
  }),
  mass: (p) => {
    const kind = str(p, 'kind', 'mono')
    return kind === 'mono' ? 7200 : kind === 'colour' ? 17500 : 23000
  },
  price: (p) => {
    const kind = str(p, 'kind', 'mono')
    return kind === 'mono' ? 190 : kind === 'colour' ? 430 : 620
  },
  readouts: (p) => {
    const kind = str(p, 'kind', 'mono')
    const peak = kind === 'mono' ? 900 : kind === 'colour' ? 1100 : 1250
    const region = str(p, 'region', 'uk')
    const socket = region === 'us' ? 15 : region === 'eu' ? 16 : 13
    const peakA = peak / volts(p)
    return [
      { label: 'Fuser peak', value: `${peak} W, ${peakA.toFixed(1)} A` },
      { label: 'Of the socket', value: `${Math.round((peakA / socket) * 100)}% of ${socket} A` },
      { label: 'Idle', value: `${kind === 'mono' ? 8 : 14} W` },
      { label: 'Share it with', value: `${Math.max(0, Math.round(socket * volts(p) - peak))} W of anything else, while it warms` },
    ]
  },
}

registerParts([mouse, webcam, macroPad, penDisplay, usbHub, dock, portableSsd, laserPrinter])
