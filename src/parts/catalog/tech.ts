import type { DeviceModel, PartDef, Port, SilkItem, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Everyday tech: single-board computers, laptops, routers, the bricks and
 * banks that power everything else.
 *
 * Where a part is a source it is one electrically, with the internal
 * resistance it really has, so a power bank sags under a motor the way a real
 * one does and a Pi's 5 V pin is a supply a circuit can draw from.
 */

const P = 2.54
const DARK = { color: '#0A0C0F', rough: 0.9, density: 0.01 }
const SHELL_METAL = { color: '#AEB4BC', metal: 1, rough: 0.46, density: 7.8 }

/** An LED as a small emissive dome. */
const ledDot = (at: Vec3, color: string, lit: boolean): Solid => ({
  kind: 'cyl', mat: { color: '#1A1D22', rough: 0.3, density: 1.2, emissive: color, emissiveIntensity: lit ? 1.6 : 0 },
  r: 1.4, h: 1, at, seg: 12, noCollide: true,
})

/* ================================================================== */
/* Raspberry Pi                                                        */
/* ================================================================== */

/** The 40-pin header, pin 1 first, as printed in every pinout. */
const PI_HEADER = [
  '3V3', '5V', 'GPIO2 SDA', '5V', 'GPIO3 SCL', 'GND', 'GPIO4', 'GPIO14 TXD', 'GND', 'GPIO15 RXD',
  'GPIO17', 'GPIO18', 'GPIO27', 'GND', 'GPIO22', 'GPIO23', '3V3', 'GPIO24', 'GPIO10 MOSI', 'GND',
  'GPIO9 MISO', 'GPIO25', 'GPIO11 SCLK', 'GPIO8 CE0', 'GND', 'GPIO7 CE1', 'ID_SD', 'ID_SC', 'GPIO5', 'GND',
  'GPIO6', 'GPIO12', 'GPIO13', 'GND', 'GPIO19', 'GPIO16', 'GPIO26', 'GPIO20', 'GND', 'GPIO21',
]

const piPortId = (label: string, pin: number): string =>
  label.startsWith('GPIO') ? label.split(' ')[0].toLowerCase()
  : label === '3V3' ? `v33_${pin}`
  : label === '5V' ? `v5_${pin}`
  : label === 'GND' ? `gnd_${pin}`
  : label.toLowerCase()

const PI_W = 85
const PI_D = 56
const PI_T = 1.4

/** X of header pin `pin` (1-based), and which row it is on. */
const piPin = (pin: number): [number, number] => {
  const col = Math.floor((pin - 1) / 2)
  // Odd pins are the inner row, even pins the board edge.
  return [-PI_W / 2 + 8.13 + col * P, pin % 2 === 1 ? -PI_D / 2 + 4.77 : -PI_D / 2 + 2.23]
}

const raspberryPi: PartDef = {
  id: 'sbc-raspberry-pi',
  name: 'Raspberry Pi',
  category: 'module',
  blurb: 'A whole computer on a credit card, 40 GPIO pins down one edge',
  tags: ['raspberry pi', 'pi 5', 'pi 4', 'sbc', 'single board computer', 'linux', 'gpio', 'computer'],
  doc: {
    manufacturer: 'Raspberry Pi',
    mpn: 'SC1112',
    price: 80,
    datasheet: 'https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf',
    description:
      'A Linux computer with a 40-pin header. The 5 V pins come straight off the USB-C input and the 3V3 pins off the board regulator, so either can power a small circuit, and the GPIO pins are 3.3 V logic that a 5 V signal will damage.',
  },
  params: [
    { key: 'model', label: 'Model', type: 'enum', default: 'pi5', group: 'Board', options: [{ value: 'pi5', label: 'Raspberry Pi 5' }, { value: 'pi4', label: 'Raspberry Pi 4' }] },
    { key: 'ram', label: 'Memory', type: 'enum', default: '8', group: 'Board', options: ['2', '4', '8', '16'].map((g) => ({ value: g, label: `${g} GB` })) },
    { key: 'cooler', label: 'Active cooler', type: 'bool', default: true, group: 'Board' },
  ],
  solids: (p) => {
    const pi5 = str(p, 'model', 'pi5') === 'pi5'
    const T = PI_T
    const holes = ([[-39, -24.5], [19, -24.5], [-39, 24.5], [19, 24.5]] as const).map(([x, z]) => circle(1.35, x, z, 12))
    const silk: SilkItem[] = [
      { t: 'text', at: [-8, -8], text: pi5 ? 'Raspberry Pi 5' : 'Raspberry Pi 4 Model B', size: 2.4, bold: true },
      { t: 'text', at: [-8, -12], text: '© Raspberry Pi Ltd', size: 1.4 },
      { t: 'text', at: [PI_W / 2 - 34, PI_D / 2 - 5], text: 'HDMI0     HDMI1', size: 1.4 },
      { t: 'rect', at: [-PI_W / 2 + 32.3, -PI_D / 2 + 3.5], size: [52, 6], w: 0.25 },
    ]
    const out: Solid[] = [
      { kind: 'extrude', mat: 'fr4-green', profile: { outline: roundRect(PI_W, PI_D, 3, 0, 0, 4), holes }, depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0] },
      { kind: 'silk', size: [PI_W, PI_D], items: silk, mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 22, noCollide: true },
      // SoC under its spreader, memory beside it.
      { kind: 'box', mat: 'nickel', size: [15, 1.6, 15], at: [-12, T + 0.8, 2] },
      { kind: 'box', mat: 'epoxy-black', size: [10, 1.1, 14], at: [6, T + 0.55, 2], noCollide: true },
      { kind: 'box', mat: 'epoxy-black', size: [7, 1, 7], at: [14, T + 0.5, -10], noCollide: true },
    ]

    // The header: a 2 x 20 strip of pins in one spacer.
    const [xFirst] = piPin(1)
    out.push({ kind: 'box', mat: 'nylon-black', size: [20 * P, 2.5, 2 * P], at: [xFirst + 9.5 * P, T + 1.25, -PI_D / 2 + 3.5], bevel: 0.15 })
    for (let pin = 1; pin <= 40; pin++) {
      const [x, z] = piPin(pin)
      out.push({ kind: 'box', mat: 'gold', size: [0.64, 11, 0.64], at: [x, T + 3, z] })
    }

    // Right-hand edge: Ethernet and two USB stacks, their order swapped between models.
    const edge = PI_W / 2 - 17.5 / 2 + 2
    const slots = pi5 ? ['eth', 'usb3', 'usb2'] : ['usb2', 'usb3', 'eth']
    slots.forEach((kind, i) => {
      const z = -18 + i * 18
      if (kind === 'eth') {
        out.push({ kind: 'box', mat: SHELL_METAL, size: [21, 13.5, 16], at: [PI_W / 2 - 10.5 + 2, T + 6.75, z] })
        out.push({ kind: 'box', mat: DARK, size: [1, 8, 12], at: [PI_W / 2 + 2.6, T + 6, z], noCollide: true })
      } else {
        out.push({ kind: 'box', mat: SHELL_METAL, size: [17.5, 16, 13.5], at: [edge, T + 8, z] })
        for (const dy of [-3.6, 3.6]) {
          out.push({ kind: 'box', mat: kind === 'usb3' ? { color: '#1F5FCC', rough: 0.5, density: 1.2 } : DARK, size: [1, 1.8, 11], at: [PI_W / 2 + 2.4, T + 8 + dy, z], noCollide: true })
        }
      }
    })

    // Bottom edge: USB-C power and two micro HDMI.
    out.push({ kind: 'box', mat: SHELL_METAL, size: [9, 3.2, 7.5], at: [-PI_W / 2 + 11.2, T + 1.6, PI_D / 2 - 3] })
    for (const x of [-PI_W / 2 + 26, -PI_W / 2 + 39.5]) {
      out.push({ kind: 'box', mat: SHELL_METAL, size: [7, 3, 7.5], at: [x, T + 1.5, PI_D / 2 - 3] })
    }

    if (p.cooler !== false) {
      out.push({ kind: 'box', mat: 'alu-anod-black', size: [34, 3, 34], at: [-6, T + 3.5, 4] })
      for (let i = 0; i < 7; i++) {
        out.push({ kind: 'box', mat: 'alu-anod-black', size: [1.6, 6, 34], at: [-22 + i * 5.4 + 6, T + 8, 4] })
      }
      out.push({ kind: 'cyl', mat: 'abs-black', r: 12, h: 7, at: [-6, T + 14, 4], seg: 28 })
      for (let i = 0; i < 7; i++) {
        out.push({ kind: 'box', mat: { color: '#2A2E34', rough: 0.6, density: 1.1 }, size: [10, 1, 3], at: [-6 + Math.cos((i / 7) * Math.PI * 2) * 6, T + 17.6, 4 + Math.sin((i / 7) * Math.PI * 2) * 6], rot: [0, (-i / 7) * 360, 0], noCollide: true })
      }
    }
    out.push(ledDot([-PI_W / 2 + 3, T + 0.5, PI_D / 2 - 8], '#FF2A18', true))
    out.push(ledDot([-PI_W / 2 + 3, T + 0.5, PI_D / 2 - 11], '#2BFF6A', true))
    return out
  },
  ports: () => {
    const out: Port[] = PI_HEADER.map((label, i) => {
      const pin = i + 1
      const [x, z] = piPin(pin)
      const role: Port['role'] = label === 'GND' ? 'gnd' : label === '3V3' || label === '5V' ? 'power' : 'io'
      return {
        id: piPortId(label, pin), label: `${pin} ${label}`, kind: 'electrical' as const,
        pos: [x, PI_T + 8.2, z] as Vec3, dir: [0, 1, 0] as Vec3, role,
        imax: role === 'power' ? 1 : 0.016,
      }
    })
    let m = 0
    for (const x of [-39, 19]) {
      for (const z of [-24.5, 24.5]) {
        out.push({ id: `mount${m++}`, label: 'M2.5 mount', kind: 'mechanical', pos: [x, PI_T, z], dir: [0, 1, 0], mate: { type: 'hole', size: 2.7 }, groupId: 'mounts' })
      }
    }
    out.push({ id: 'usbc', label: 'USB-C power in', kind: 'electrical', pos: [-PI_W / 2 + 11.2, PI_T + 1.6, PI_D / 2 + 1], dir: [0, 0, 1], role: 'power', imax: 5 })
    return out
  },
  electrical: {
    devices: () => {
      const out: DeviceModel[] = [
        { type: 'vsource', v: 5.1, a: 'v5_2', b: 'gnd_6', rint: 0.08 },
        { type: 'vsource', v: 3.3, a: 'v33_1', b: 'gnd_6', rint: 0.25 },
        { type: 'short', a: 'v5_4', b: 'v5_2' },
        { type: 'short', a: 'v33_17', b: 'v33_1' },
        { type: 'short', a: 'usbc', b: 'v5_2' },
      ]
      for (const pin of [9, 14, 20, 25, 30, 34, 39]) out.push({ type: 'short', a: `gnd_${pin}`, b: 'gnd_6' })
      return out
    },
    supplies: ['v5_2', 'v33_1'],
    limits: { vmax: 3.6 },
  },
  price: (p) => ({ '2': 50, '4': 60, '8': 80, '16': 120 })[str(p, 'ram', '8')] ?? 80,
  readouts: (p) => [
    { label: 'Processor', value: str(p, 'model', 'pi5') === 'pi5' ? 'BCM2712, 4 x Cortex-A76' : 'BCM2711, 4 x Cortex-A72' },
    { label: 'Memory', value: `${str(p, 'ram', '8')} GB` },
    { label: 'GPIO logic', value: '3.3 V, not 5 V tolerant' },
    { label: 'Supply', value: str(p, 'model', 'pi5') === 'pi5' ? '5 V at 5 A' : '5 V at 3 A' },
  ],
}

/* ================================================================== */
/* Mains adapter                                                       */
/* ================================================================== */

const ADAPTER_V = ['5', '9', '12', '19', '24']

const powerAdapter: PartDef = {
  id: 'power-adapter',
  name: 'Power adapter',
  category: 'power',
  blurb: 'Mains to DC on a barrel plug, UK, EU or US pins',
  tags: ['power adapter', 'wall wart', 'power supply', 'charger', 'dc adapter', 'barrel', 'plug', '12v'],
  doc: {
    price: 12,
    description:
      'A switch-mode wall adapter. It holds its voltage up to its rated current and the output resistance past that is what sets how far it droops.',
  },
  params: [
    { key: 'volts', label: 'Output', type: 'enum', default: '12', group: 'Adapter', options: ADAPTER_V.map((v) => ({ value: v, label: `${v} V` })) },
    { key: 'amps', label: 'Rating', type: 'number', unit: 'A', default: 2, min: 0.5, max: 10, step: 0.5, group: 'Adapter' },
    { key: 'plug', label: 'Mains pins', type: 'enum', default: 'uk', group: 'Adapter', options: [{ value: 'uk', label: 'UK' }, { value: 'eu', label: 'EU' }, { value: 'us', label: 'US' }] },
  ],
  solids: (p) => {
    const a = num(p, 'amps', 2)
    const v = parseFloat(str(p, 'volts', '12'))
    const size = Math.min(1.6, 0.8 + (a * v) / 120)
    const W = 50 * size
    const H = 36 * size
    const D = 70 * size
    const plug = str(p, 'plug', 'uk')
    const out: Solid[] = [
      { kind: 'box', mat: 'abs-black', size: [W, H, D], at: [0, H / 2, 0], bevel: 6 },
      {
        kind: 'silk', size: [W - 10, D - 16], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, H + 0.02, 0], px: 14, noCollide: true,
        items: [
          { t: 'text', at: [0, 8], text: `${v} V`, size: 7, bold: true },
          { t: 'text', at: [0, -4], text: `${a.toFixed(1)} A`, size: 5 },
          { t: 'text', at: [0, -14], text: '100-240 V~', size: 3 },
        ],
      },
    ]
    // Pins out of the back face.
    const pin = 'brass'
    if (plug === 'uk') {
      out.push({ kind: 'box', mat: pin, size: [4, 8, 18], at: [0, H / 2 + 10, -D / 2 - 9] })
      for (const s of [-1, 1]) out.push({ kind: 'box', mat: pin, size: [6, 4, 17], at: [s * 11, H / 2 - 8, -D / 2 - 8.5] })
    } else if (plug === 'eu') {
      for (const s of [-1, 1]) out.push({ kind: 'cyl', mat: 'nickel', r: 2, h: 19, rot: [90, 0, 0], at: [s * 9.5, H / 2, -D / 2 - 9.5], seg: 12 })
    } else {
      for (const s of [-1, 1]) out.push({ kind: 'box', mat: pin, size: [1.5, 6.5, 16], at: [s * 6.3, H / 2, -D / 2 - 8] })
    }
    // Cable to a barrel plug.
    out.push({ kind: 'tube', mat: 'abs-black', r: 2, seg: 8, path: [[0, H / 2, D / 2], [0, H / 2 - 4, D / 2 + 40], [20, 4, D / 2 + 110], [40, 4, D / 2 + 260]] })
    out.push({ kind: 'cyl', mat: 'abs-black', r: 5, h: 22, rot: [90, 0, 0], at: [40, 5, D / 2 + 271], seg: 16, chamfer: 1 })
    out.push({ kind: 'cyl', mat: 'nickel', r: 2.75, h: 10, rot: [90, 0, 0], at: [40, 5, D / 2 + 287], seg: 16 })
    return out
  },
  ports: (p) => {
    const a = num(p, 'amps', 2)
    const v = parseFloat(str(p, 'volts', '12'))
    const D = 70 * Math.min(1.6, 0.8 + (a * v) / 120)
    return [
      { id: 'p', label: 'Centre pin (+)', kind: 'electrical', pos: [40, 5, D / 2 + 293], dir: [0, 0, 1], role: 'power', imax: a },
      { id: 'n', label: 'Barrel (−)', kind: 'electrical', pos: [36, 5, D / 2 + 293], dir: [0, 0, 1], role: 'gnd', imax: a },
    ]
  },
  electrical: {
    devices: (p) => {
      const v = parseFloat(str(p, 'volts', '12'))
      const a = num(p, 'amps', 2)
      // Five per cent of droop at full rated current.
      return [{ type: 'vsource', v, a: 'p', b: 'n', rint: (v * 0.05) / a }]
    },
    supplies: ['p'],
  },
  price: (p) => 6 + num(p, 'amps', 2) * parseFloat(str(p, 'volts', '12')) * 0.12,
  readouts: (p) => {
    const v = parseFloat(str(p, 'volts', '12'))
    const a = num(p, 'amps', 2)
    return [
      { label: 'Output', value: `${v} V at ${a} A` },
      { label: 'Power', value: `${(v * a).toFixed(0)} W` },
      { label: 'Output resistance', value: eng((v * 0.05) / a, 'Ω') },
      { label: 'Plug', value: '5.5 / 2.1 mm, centre positive' },
    ]
  },
}

registerParts([raspberryPi, powerAdapter])
