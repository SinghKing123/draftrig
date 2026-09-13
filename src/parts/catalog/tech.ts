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
/* Laptop                                                              */
/* ================================================================== */

const LAPTOPS: Record<string, { w: number; d: number; label: string }> = {
  '13': { w: 300, d: 212, label: '13 in' },
  '14': { w: 313, d: 221, label: '14 in' },
  '16': { w: 356, d: 248, label: '16 in' },
}

const laptop: PartDef = {
  id: 'laptop',
  name: 'Laptop',
  category: 'peripheral',
  blurb: 'Opens to any angle, screen on or off',
  tags: ['laptop', 'notebook', 'computer', 'macbook', 'ultrabook', 'screen', 'keyboard'],
  doc: { price: 1200, description: 'A thin laptop. The lid hinges from the back edge, so the space it needs behind it on a desk depends on how far it is open.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: '14', group: 'Laptop', options: Object.entries(LAPTOPS).map(([value, l]) => ({ value, label: l.label })) },
    { key: 'open', label: 'Lid angle', type: 'number', unit: '°', default: 110, min: 0, max: 140, step: 5, group: 'Laptop' },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'silver', group: 'Laptop', options: [{ value: 'silver', label: 'Silver' }, { value: 'grey', label: 'Space grey' }, { value: 'black', label: 'Black' }] },
    { key: 'on', label: 'Screen on', type: 'bool', default: true, group: 'Laptop' },
  ],
  solids: (p) => {
    const l = LAPTOPS[str(p, 'size', '14')] ?? LAPTOPS['14']
    const W = l.w
    const D = l.d
    const H = 14
    const finishes: Record<string, string> = { silver: '#C9CDD2', grey: '#5E6369', black: '#1E2024' }
    const body = { color: finishes[str(p, 'finish', 'silver')] ?? finishes.silver, metal: 0.9, rough: 0.42, density: 2.7, name: 'Anodised aluminium' }
    const angle = num(p, 'open', 110)
    const out: Solid[] = [
      { kind: 'box', mat: body, size: [W, H, D], at: [0, H / 2, 0], bevel: 3 },
      { kind: 'box', mat: DARK, size: [W - 36, 0.6, 104], at: [0, H + 0.1, -D / 2 + 70], noCollide: true },
      { kind: 'box', mat: { color: finishes[str(p, 'finish', 'silver')] ?? finishes.silver, metal: 0.6, rough: 0.2, density: 2.5 }, size: [W * 0.38, 0.4, D * 0.3], at: [0, H + 0.1, D / 2 - D * 0.17], noCollide: true },
    ]
    // Keys: six rows, fifteen across, the space bar made wide.
    const pitch = (W - 44) / 15
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 15; c++) {
        if (r === 5 && c > 4 && c < 10) {
          if (c === 5) out.push({ kind: 'box', mat: { color: '#16181B', rough: 0.6, density: 1.1 }, size: [pitch * 5 - 2.4, 0.9, pitch - 2.4], at: [-W / 2 + 22 + (c + 2.5) * pitch, H + 0.5, -D / 2 + 22 + r * pitch], noCollide: true })
          continue
        }
        out.push({ kind: 'box', mat: { color: '#16181B', rough: 0.6, density: 1.1 }, size: [pitch - 2.4, 0.9, (r === 0 ? pitch * 0.6 : pitch) - 2.4], at: [-W / 2 + 22 + (c + 0.5) * pitch, H + 0.5, -D / 2 + 22 + r * pitch - (r === 0 ? pitch * 0.2 : 0)], noCollide: true })
      }
    }
    // The lid, hinged along the back edge. Closed it lies on the base.
    out.push({ kind: 'cyl', mat: body, r: 4, h: W * 0.7, rot: [0, 0, 90], at: [0, H, -D / 2 + 3], seg: 16 })
    out.push({
      kind: 'group', mat: body, at: [0, H, -D / 2 + 3], rot: [-angle, 0, 0], children: [
        { kind: 'box', mat: body, size: [W, 6, D - 4], at: [0, 3, (D - 4) / 2], bevel: 2 },
        { kind: 'box', mat: { color: '#050608', rough: 0.1, clearcoat: 1, density: 2.5 }, size: [W - 8, 0.6, D - 12], at: [0, -0.3, (D - 4) / 2], noCollide: true },
        {
          kind: 'box', mat: { color: '#06080B', rough: 0.08, density: 2.5, emissive: '#2B5D9E', emissiveIntensity: p.on === false || angle < 20 ? 0 : 0.42 },
          size: [W - 20, 0.4, D - 34], at: [0, -0.65, (D - 4) / 2 + 4], noCollide: true,
        },
        { kind: 'cyl', mat: DARK, r: 1.4, h: 0.5, at: [0, -0.7, D - 12], seg: 10, noCollide: true },
      ],
    })
    return out
  },
  ports: (p) => {
    const l = LAPTOPS[str(p, 'size', '14')] ?? LAPTOPS['14']
    return [
      { id: 'usbc1', label: 'USB-C, power in', kind: 'electrical', pos: [-l.w / 2 - 1, 6, -l.d / 2 + 30], dir: [-1, 0, 0], role: 'power', imax: 5 },
      { id: 'usbc2', label: 'USB-C', kind: 'electrical', pos: [-l.w / 2 - 1, 6, -l.d / 2 + 48], dir: [-1, 0, 0], role: 'io', imax: 3 },
      { id: 'hdmi', label: 'HDMI out', kind: 'electrical', pos: [l.w / 2 + 1, 6, -l.d / 2 + 40], dir: [1, 0, 0], role: 'io', imax: 0.05 },
      { id: 'base', label: 'Feet', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => ({ '13': 1240, '14': 1550, '16': 2150 })[str(p, 'size', '14')] ?? 1550,
  readouts: (p) => {
    const l = LAPTOPS[str(p, 'size', '14')] ?? LAPTOPS['14']
    const a = (num(p, 'open', 110) * Math.PI) / 180
    const behind = Math.max(0, -Math.cos(a) * l.d)
    return [
      { label: 'Footprint', value: `${l.w} x ${l.d} mm` },
      { label: 'Lid reaches back', value: `${Math.round(behind)} mm past the hinge` },
      { label: 'Height open', value: `${Math.round(14 + Math.sin(a) * l.d)} mm` },
    ]
  },
}

/* ================================================================== */
/* Wi-Fi router                                                        */
/* ================================================================== */

const router: PartDef = {
  id: 'router-wifi',
  name: 'Wi-Fi router',
  category: 'module',
  blurb: 'Antennas up, four LAN ports and a WAN on the back',
  tags: ['router', 'wifi', 'wi-fi', 'network', 'ethernet', 'access point', 'internet', 'lan'],
  doc: { price: 90, description: 'A home router on a 12 V supply. The antennas are set at angles to each other on purpose: a radio receives best from an antenna parallel to its own.' },
  params: [
    { key: 'antennas', label: 'Antennas', type: 'enum', default: '4', group: 'Router', options: [{ value: '2', label: '2' }, { value: '4', label: '4' }, { value: '6', label: '6' }] },
    { key: 'on', label: 'Powered', type: 'bool', default: true, group: 'Router' },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'antennas', '4'), 10) || 4
    const W = 230
    const D = 150
    const H = 38
    const on = p.on !== false
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#16181C', rough: 0.4, clearcoat: 0.5, density: 1.1 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 10 },
    ]
    for (let i = 0; i < 14; i++) out.push({ kind: 'box', mat: DARK, size: [W * 0.6, 0.6, 3], at: [0, H + 0.05, -D / 2 + 30 + i * 7], noCollide: true })
    for (let i = 0; i < 6; i++) out.push(ledDot([-40 + i * 16, H - 14, D / 2 + 0.2], i === 0 ? '#2BFF6A' : '#3C8CFF', on))
    // Five RJ45 sockets on the back, the WAN one yellow.
    for (let i = 0; i < 5; i++) {
      out.push({ kind: 'box', mat: i === 0 ? { color: '#D8A814', rough: 0.5, density: 1.2 } : DARK, size: [15, 13, 1], at: [-60 + i * 22, 16, -D / 2 - 0.2], noCollide: true })
    }
    // Antennas along the back edge, fanned out.
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 22 + (i * (W - 44)) / Math.max(n - 1, 1)
      const tilt = (i - (n - 1) / 2) * 7
      out.push({
        kind: 'group', mat: 'abs-black', at: [x, H - 6, -D / 2 - 6], rot: [-6, 0, tilt], children: [
          { kind: 'cyl', mat: 'abs-black', r: 7, h: 14, rot: [0, 0, 90], at: [0, 0, 0], seg: 16 },
          { kind: 'cyl', mat: { color: '#16181C', rough: 0.45, density: 1.1 }, r: 6.5, h: 170, at: [0, 88, 0], seg: 16, chamfer: 3 },
        ],
      })
    }
    return out
  },
  ports: () => {
    const D = 150
    const out: Port[] = [
      { id: 'wan', label: 'WAN', kind: 'electrical', pos: [-60, 16, -D / 2 - 2], dir: [0, 0, -1], role: 'io', imax: 0.05 },
    ]
    for (let i = 1; i <= 4; i++) out.push({ id: `lan${i}`, label: `LAN ${i}`, kind: 'electrical', pos: [-60 + i * 22, 16, -D / 2 - 2], dir: [0, 0, -1], role: 'io', imax: 0.05 })
    out.push({ id: 'vin', label: '12 V in', kind: 'electrical', pos: [80, 16, -D / 2 - 2], dir: [0, 0, -1], role: 'power', imax: 2 })
    out.push({ id: 'gnd', label: 'Ground', kind: 'electrical', pos: [92, 16, -D / 2 - 2], dir: [0, 0, -1], role: 'gnd', imax: 2 })
    out.push({ id: 'base', label: 'Feet', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    // About 12 W, which at 12 V is a 12 ohm load.
    devices: (p) => [{ type: 'resistor', r: p.on === false ? 1e7 : 12, a: 'vin', b: 'gnd' }],
    limits: { vmax: 13.5 },
  },
  mass: () => 620,
  readouts: () => [
    { label: 'Supply', value: '12 V at 1 A' },
    { label: 'Ports', value: '1 WAN, 4 LAN' },
    { label: 'Radio', value: '2.4 and 5 GHz' },
  ],
}

/* ================================================================== */
/* Webcam                                                              */
/* ================================================================== */

const webcam: PartDef = {
  id: 'webcam',
  name: 'Webcam',
  category: 'peripheral',
  blurb: 'Clips over the top of a monitor',
  tags: ['webcam', 'camera', 'streaming', 'video call', 'usb camera', 'peripheral'],
  doc: { price: 70, description: 'A 1080p webcam on a folding clip that hooks over a monitor bezel.' },
  params: [{ key: 'on', label: 'Recording', type: 'bool', default: false, group: 'Webcam' }],
  solids: (p) => [
    { kind: 'box', mat: 'abs-black', size: [92, 30, 30], at: [0, 64, 0], bevel: 13 },
    { kind: 'cyl', mat: { color: '#1C1E22', rough: 0.3, metal: 0.5, density: 2.7 }, r: 13, h: 3, rot: [90, 0, 0], at: [0, 64, 15.5], seg: 28 },
    { kind: 'cyl', mat: { color: '#0A1422', rough: 0.05, clearcoat: 1, density: 2.5 }, r: 9, h: 2, rot: [90, 0, 0], at: [0, 64, 16.5], seg: 28 },
    { kind: 'cyl', mat: { color: '#3A4B6A', rough: 0.1, density: 2.5 }, r: 3.5, h: 1, rot: [90, 0, 0], at: [0, 64, 17.3], seg: 16, noCollide: true },
    { kind: 'cyl', mat: { color: '#1A1D22', rough: 0.3, density: 1.2, emissive: '#FFFFFF', emissiveIntensity: p.on === true ? 2 : 0 }, r: 1.2, h: 1, rot: [90, 0, 0], at: [24, 64, 15.5], seg: 10, noCollide: true },
    // The clip: a hinge under the body, a front lip and a rear leg.
    { kind: 'cyl', mat: 'abs-black', r: 5, h: 36, rot: [0, 0, 90], at: [0, 46, 0], seg: 16 },
    { kind: 'box', mat: 'abs-black', size: [34, 10, 22], at: [0, 42, 8], bevel: 3 },
    { kind: 'box', mat: 'abs-black', size: [34, 44, 8], at: [0, 22, -26], rot: [18, 0, 0], bevel: 3 },
    { kind: 'box', mat: 'rubber', size: [30, 3, 18], at: [0, 36, 8], noCollide: true },
    { kind: 'tube', mat: 'abs-black', r: 1.8, seg: 8, path: [[0, 55, -14], [0, 30, -40], [0, 4, -60], [0, 2, -140]] },
  ],
  ports: () => [
    { id: 'usb', label: 'USB', kind: 'electrical', pos: [0, 2, -140], dir: [0, 0, -1], role: 'io', imax: 0.5 },
    { id: 'clip', label: 'Clip', kind: 'mechanical', pos: [0, 36, 8], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  mass: () => 160,
}

/* ================================================================== */
/* USB hub                                                             */
/* ================================================================== */

const usbHub: PartDef = {
  id: 'usb-hub',
  name: 'USB hub',
  category: 'peripheral',
  blurb: 'One port in, four or seven out, switched individually',
  tags: ['usb hub', 'hub', 'usb', 'ports', 'splitter', 'peripheral'],
  doc: { price: 25, description: 'A powered USB hub. Every downstream port shares the one upstream link, so seven drives copying at once are seven drives sharing one cable.' },
  params: [
    { key: 'ports', label: 'Ports', type: 'enum', default: '4', group: 'Hub', options: [{ value: '4', label: '4' }, { value: '7', label: '7' }] },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'ports', '4'), 10) || 4
    const W = n * 18 + 22
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#5E6369', metal: 0.9, rough: 0.42, density: 2.7 }, size: [W, 16, 34], at: [0, 8, 0], bevel: 5 },
    ]
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 18 + i * 18
      out.push({ kind: 'box', mat: DARK, size: [12.5, 5, 1], at: [x, 8, 17.2], noCollide: true })
      out.push({ kind: 'box', mat: { color: '#1F5FCC', rough: 0.5, density: 1.2 }, size: [10, 1.4, 0.6], at: [x, 9.3, 17.4], noCollide: true })
      out.push(ledDot([x, 16.1, 8], '#3C8CFF', true))
    }
    out.push({ kind: 'tube', mat: 'abs-black', r: 2, seg: 8, path: [[-W / 2, 8, 0], [-W / 2 - 30, 6, 0], [-W / 2 - 60, 3, 20], [-W / 2 - 110, 3, 30]] })
    out.push({ kind: 'box', mat: 'abs-black', size: [28, 10, 16], at: [-W / 2 - 124, 5, 30], bevel: 2 })
    out.push({ kind: 'box', mat: SHELL_METAL, size: [12, 4.5, 12], at: [-W / 2 - 144, 5, 30] })
    return out
  },
  ports: (p) => {
    const n = parseInt(str(p, 'ports', '4'), 10) || 4
    const W = n * 18 + 22
    const out: Port[] = [
      { id: 'up', label: 'Upstream', kind: 'electrical', pos: [-W / 2 - 150, 5, 30], dir: [-1, 0, 0], role: 'io', imax: 0.9 },
    ]
    for (let i = 0; i < n; i++) {
      out.push({ id: `p${i + 1}`, label: `Port ${i + 1}`, kind: 'electrical', pos: [-W / 2 + 18 + i * 18, 8, 18], dir: [0, 0, 1], role: 'io', imax: 0.9 })
    }
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  mass: (p) => (str(p, 'ports', '4') === '7' ? 190 : 120),
}

/* ================================================================== */
/* Power bank                                                          */
/* ================================================================== */

const powerBank: PartDef = {
  id: 'power-bank',
  name: 'Power bank',
  category: 'power',
  blurb: '5 V from lithium cells, with the sag a real one has',
  tags: ['power bank', 'battery pack', 'usb power', 'portable', '5v', 'charger', 'battery'],
  doc: {
    price: 30,
    description:
      'Lithium cells behind a boost converter set to 5 V. The rating printed on it is at the cell voltage, so a 10 000 mAh bank delivers about 6 000 mAh at 5 V once the conversion is paid for.',
  },
  params: [
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '10000', group: 'Bank', options: ['5000', '10000', '20000'].map((c) => ({ value: c, label: `${Number(c).toLocaleString('en-GB')} mAh` })) },
    { key: 'charge', label: 'Charge', type: 'number', unit: '%', default: 80, min: 0, max: 100, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const cap = parseInt(str(p, 'capacity', '10000'), 10) || 10000
    const L = 90 + cap / 250
    const charge = num(p, 'charge', 80)
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1C1E22', rough: 0.5, density: 1.8 }, size: [70, 24, L], at: [0, 12, 0], bevel: 9 },
      { kind: 'box', mat: DARK, size: [13, 5.5, 1], at: [-14, 12, L / 2 + 0.2], noCollide: true },
      { kind: 'box', mat: DARK, size: [9, 3.4, 1], at: [10, 12, L / 2 + 0.2], noCollide: true },
    ]
    for (let i = 0; i < 4; i++) out.push(ledDot([-12 + i * 8, 24.1, L / 2 - 14], '#3C8CFF', charge > i * 25 + 5))
    return out
  },
  ports: (p) => {
    const L = 90 + (parseInt(str(p, 'capacity', '10000'), 10) || 10000) / 250
    return [
      { id: 'vbus', label: 'USB 5 V', kind: 'electrical', pos: [-17, 12, L / 2 + 2], dir: [0, 0, 1], role: 'power', imax: 3 },
      { id: 'gnd', label: 'USB ground', kind: 'electrical', pos: [-11, 12, L / 2 + 2], dir: [0, 0, 1], role: 'gnd', imax: 3 },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      // Flat output until the cells run low, then the converter gives up.
      const c = num(p, 'charge', 80)
      const v = c < 3 ? 0.2 : 5.1 - (c < 10 ? (10 - c) * 0.03 : 0)
      return [{ type: 'vsource', v, a: 'vbus', b: 'gnd', rint: 0.12 }]
    },
    supplies: ['vbus'],
    limits: { imax: 3 },
  },
  price: (p) => ({ '5000': 18, '10000': 30, '20000': 45 })[str(p, 'capacity', '10000')] ?? 30,
  readouts: (p) => {
    const cap = parseInt(str(p, 'capacity', '10000'), 10) || 10000
    const wh = (cap * 3.7) / 1000
    return [
      { label: 'Energy', value: `${wh.toFixed(1)} Wh` },
      { label: 'At 5 V', value: `About ${Math.round((wh * 0.85 * 1000) / 5)} mAh` },
      { label: 'At 1 A', value: `${((wh * 0.85) / 5).toFixed(1)} hours` },
    ]
  },
}

/* ================================================================== */
/* Power adapter                                                       */
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

/* ================================================================== */
/* Gamepad                                                             */
/* ================================================================== */

const gamepad: PartDef = {
  id: 'gamepad',
  name: 'Gamepad',
  category: 'peripheral',
  blurb: 'Two sticks, a d-pad, four face buttons and triggers',
  tags: ['gamepad', 'controller', 'joypad', 'xbox', 'playstation', 'game controller', 'peripheral'],
  doc: { price: 60, description: 'A standard game controller layout with offset sticks.' },
  params: [
    { key: 'color', label: 'Shell', type: 'enum', default: 'black', group: 'Gamepad', options: [{ value: 'black', label: 'Black' }, { value: 'white', label: 'White' }, { value: 'blue', label: 'Blue' }] },
  ],
  solids: (p) => {
    const shells: Record<string, string> = { black: '#1B1D21', white: '#E6E8EB', blue: '#1F4FA8' }
    const shell = { color: shells[str(p, 'color', 'black')] ?? shells.black, rough: 0.55, density: 1.1 }
    const out: Solid[] = [
      { kind: 'extrude', mat: shell, profile: { outline: roundRect(104, 56, 26, 0, 0, 6) }, depth: 14, bevel: 8, rot: [-90, 0, 0], at: [0, 16, 0] },
      ...[-1, 1].map((s): Solid => ({
        kind: 'extrude', mat: shell, profile: { outline: circle(24, s * 44, -24, 28) }, depth: 14, bevel: 8, rot: [-90, 0, 0], at: [0, 14, 0],
      })),
    ]
    const top = 31
    // Sticks.
    for (const [x, z] of [[-30, -6], [22, 14]] as const) {
      out.push({ kind: 'cyl', mat: DARK, r: 11, h: 1, at: [x, top, z], seg: 24, noCollide: true })
      out.push({ kind: 'cyl', mat: 'steel', r: 4, h: 6, at: [x, top + 3, z], seg: 12 })
      out.push({ kind: 'cyl', mat: 'rubber', r: 10, h: 4, at: [x, top + 7, z], seg: 24, chamfer: 1.5 })
    }
    // D-pad.
    out.push({ kind: 'box', mat: { color: '#2A2D32', rough: 0.4, density: 1.1 }, size: [18, 3, 6], at: [-22, top + 1, 14], bevel: 1 })
    out.push({ kind: 'box', mat: { color: '#2A2D32', rough: 0.4, density: 1.1 }, size: [6, 3, 18], at: [-22, top + 1, 14], bevel: 1 })
    // Face buttons.
    const faces: [number, number, string][] = [[34, -2, '#E0A81E'], [44, -12, '#2F6FE0'], [44, 8, '#2BA84A'], [54, -2, '#C4262C']]
    for (const [x, z, c] of faces) out.push({ kind: 'cyl', mat: { color: c, rough: 0.35, density: 1.2 }, r: 4.5, h: 4, at: [x, top + 1, z], seg: 16 })
    // Bumpers and triggers along the back edge.
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'box', mat: { color: '#2A2D32', rough: 0.45, density: 1.1 }, size: [34, 7, 8], at: [s * 36, 24, -30], bevel: 2 })
      out.push({ kind: 'box', mat: { color: '#2A2D32', rough: 0.45, density: 1.1 }, size: [22, 14, 14], at: [s * 36, 22, -36], rot: [-30, 0, 0], bevel: 3 })
    }
    out.push({ kind: 'cyl', mat: { color: '#1A1D22', rough: 0.3, density: 1.2, emissive: '#FFFFFF', emissiveIntensity: 0.9 }, r: 5, h: 1, at: [0, top, -12], seg: 20, noCollide: true })
    return out
  },
  ports: () => [
    { id: 'usb', label: 'USB-C', kind: 'electrical', pos: [0, 16, -34], dir: [0, 0, -1], role: 'io', imax: 0.5 },
    { id: 'base', label: 'Grips', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  mass: () => 260,
}

registerParts([raspberryPi, laptop, router, webcam, usbHub, powerBank, powerAdapter, gamepad])

