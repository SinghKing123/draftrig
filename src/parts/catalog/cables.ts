import type { DeviceModel, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { num, str } from './_helpers'

/**
 * Cables with plugs on, and the hardware that manages them.
 *
 * A cable here is its conductors as well as its jacket: a USB lead carries
 * four of them, each with the resistance of its own gauge, which is why a
 * long thin one cannot charge a phone at full speed and does not here either.
 */

const RHO_CU = 1.68e-8
const ohms = (mm: number, mm2: number): number => (RHO_CU * mm * 1e3) / Math.max(mm2, 1e-4)

const DARK = { color: '#0A0C0F', rough: 0.9, density: 0.01 }
const METAL = { color: '#B8BDC4', metal: 1, rough: 0.36, density: 7.8 }

/** A gentle sag from end to end, so a cable does not read as a rod. */
function drape(len: number, y: number, sag: number, z = 0, steps = 16): Vec3[] {
  const out: Vec3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    out.push([-len / 2 + t * len, y + sag * Math.min(len, 400) * 4 * t * (1 - t), z])
  }
  return out
}

const JACKETS: Record<string, { color: string; rough: number; label: string }> = {
  black: { color: '#1B1D21', rough: 0.6, label: 'Black' },
  white: { color: '#E8EAEC', rough: 0.55, label: 'White' },
  braided: { color: '#8E1A1F', rough: 0.95, label: 'Braided red' },
  grey: { color: '#8A9099', rough: 0.6, label: 'Grey' },
}
const jacket = (k: string) => {
  const j = JACKETS[k] ?? JACKETS.black
  return { color: j.color, rough: j.rough, density: 1.3, name: 'Cable jacket' }
}

/* ================================================================== */
/* USB cable                                                           */
/* ================================================================== */

type UsbEnd = 'a' | 'c' | 'micro' | 'b'

/** Overmould and metal shell, as [length along the cable, height, width]. */
const PLUGS: Record<UsbEnd, { mold: Vec3; shell: Vec3; bevel: number; label: string }> = {
  a: { mold: [28, 9, 17], shell: [12, 4.5, 12], bevel: 0.2, label: 'USB-A' },
  c: { mold: [22, 6.5, 12], shell: [6.5, 2.6, 8.4], bevel: 1.2, label: 'USB-C' },
  micro: { mold: [18, 6, 11], shell: [6, 1.8, 6.9], bevel: 0.4, label: 'Micro-B' },
  b: { mold: [24, 12, 14], shell: [9, 10.5, 12], bevel: 1.4, label: 'USB-B' },
}

const USB_ENDS: Record<string, [UsbEnd, UsbEnd]> = {
  'a-c': ['a', 'c'], 'c-c': ['c', 'c'], 'a-micro': ['a', 'micro'], 'a-b': ['a', 'b'],
}

const plugLen = (e: UsbEnd): number => PLUGS[e].mold[0] + PLUGS[e].shell[0]

function usbPlug(e: UsbEnd, x: number, sign: 1 | -1, y: number, moldMat: object): Solid[] {
  const pl = PLUGS[e]
  return [
    { kind: 'box', mat: moldMat as never, size: pl.mold, at: [x + (sign * pl.mold[0]) / 2, y, 0], bevel: Math.min(2.5, pl.mold[1] / 3) },
    { kind: 'box', mat: METAL, size: pl.shell, at: [x + sign * (pl.mold[0] + pl.shell[0] / 2), y, 0], bevel: pl.bevel },
    { kind: 'box', mat: DARK, size: [0.6, pl.shell[1] * 0.5, pl.shell[2] * 0.7], at: [x + sign * (pl.mold[0] + pl.shell[0] + 0.1), y, 0], noCollide: true },
  ]
}

const usbCable: PartDef = {
  id: 'cable-usb',
  name: 'USB cable',
  category: 'wire',
  blurb: 'Four conductors, each with the resistance its gauge gives it',
  tags: ['usb cable', 'usb', 'usb-c', 'cable', 'charging cable', 'lead', 'micro usb', 'data cable'],
  doc: {
    price: 8,
    description:
      'A USB lead with power on 24 AWG and data on 28 AWG, as most are. The power pair is what limits charging: at 3 A a two metre cable drops a few hundred millivolts, and a device that sees less than 4.75 V slows down to protect itself.',
  },
  params: [
    { key: 'ends', label: 'Ends', type: 'enum', default: 'a-c', group: 'Cable', options: Object.entries(USB_ENDS).map(([value, [a, b]]) => ({ value, label: `${PLUGS[a].label} to ${PLUGS[b].label}` })) },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 1000, min: 150, max: 3000, step: 50, group: 'Cable' },
    { key: 'jacket', label: 'Jacket', type: 'enum', default: 'black', group: 'Cable', options: Object.entries(JACKETS).map(([value, j]) => ({ value, label: j.label })) },
  ],
  solids: (p) => {
    const [ea, eb] = USB_ENDS[str(p, 'ends', 'a-c')] ?? USB_ENDS['a-c']
    const len = num(p, 'length', 1000)
    const body = Math.max(len - plugLen(ea) - plugLen(eb), 30)
    const y = 5
    const mold = jacket(str(p, 'jacket', 'black'))
    return [
      { kind: 'tube', mat: jacket(str(p, 'jacket', 'black')), r: 2, seg: 10, path: drape(body, y, 0.04) },
      ...usbPlug(ea, -body / 2, -1, y, mold),
      ...usbPlug(eb, body / 2, 1, y, mold),
    ]
  },
  ports: (p) => {
    const [ea, eb] = USB_ENDS[str(p, 'ends', 'a-c')] ?? USB_ENDS['a-c']
    const len = num(p, 'length', 1000)
    const body = Math.max(len - plugLen(ea) - plugLen(eb), 30)
    const out: Port[] = []
    const pins: [string, string, Port['role']][] = [['vbus', 'VBUS', 'power'], ['dm', 'D−', 'io'], ['dp', 'D+', 'io'], ['gnd', 'GND', 'gnd']]
    for (const [end, e, sign] of [['a', ea, -1], ['b', eb, 1]] as const) {
      const tip = sign * (body / 2 + plugLen(e) + 0.5)
      pins.forEach(([id, label, role], i) => {
        out.push({
          id: `${end}_${id}`, label: `${PLUGS[e].label} ${label}`, kind: 'electrical',
          pos: [tip, 5, -1.8 + i * 1.2], dir: [sign, 0, 0], role, imax: id === 'vbus' || id === 'gnd' ? 5 : 0.1,
        })
      })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const len = num(p, 'length', 1000)
      const power = ohms(len, 0.205)
      const data = ohms(len, 0.081)
      return [
        { type: 'resistor', r: power, a: 'a_vbus', b: 'b_vbus' },
        { type: 'resistor', r: power, a: 'a_gnd', b: 'b_gnd' },
        { type: 'resistor', r: data, a: 'a_dp', b: 'b_dp' },
        { type: 'resistor', r: data, a: 'a_dm', b: 'b_dm' },
      ] as DeviceModel[]
    },
  },
  price: (p) => 4 + num(p, 'length', 1000) * 0.003,
  readouts: (p) => {
    const len = num(p, 'length', 1000)
    const loop = ohms(len, 0.205) * 2
    return [
      { label: 'Power loop', value: eng(loop, 'Ω') },
      { label: 'Drop at 3 A', value: `${(loop * 3).toFixed(2)} V` },
      { label: 'At the device from 5 V', value: `${(5 - loop * 3).toFixed(2)} V at 3 A` },
    ]
  },
}

/* ================================================================== */
/* HDMI and Ethernet                                                   */
/* ================================================================== */

const hdmiCable: PartDef = {
  id: 'cable-hdmi',
  name: 'HDMI cable',
  category: 'wire',
  blurb: 'Full-size plugs, rated by the resolution it carries',
  tags: ['hdmi', 'hdmi cable', 'video cable', 'display cable', 'monitor cable', '4k'],
  doc: { price: 10, description: 'An HDMI lead. Past about five metres a passive cable stops carrying 4K reliably, which is the length the rating actually describes.' },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 1500, min: 300, max: 10000, step: 100, group: 'Cable' },
    { key: 'jacket', label: 'Jacket', type: 'enum', default: 'black', group: 'Cable', options: Object.entries(JACKETS).map(([value, j]) => ({ value, label: j.label })) },
  ],
  solids: (p) => {
    const len = num(p, 'length', 1500)
    const body = Math.max(len - 84, 40)
    const y = 7
    const mold = jacket(str(p, 'jacket', 'black'))
    const out: Solid[] = [{ kind: 'tube', mat: mold, r: 3.5, seg: 12, path: drape(body, y, 0.04) }]
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'box', mat: mold, size: [30, 12, 22], at: [s * (body / 2 + 15), y, 0], bevel: 3 })
      out.push({ kind: 'box', mat: METAL, size: [12, 4.5, 14], at: [s * (body / 2 + 36), y, 0], bevel: 0.6 })
    }
    return out
  },
  ports: (p) => {
    const body = Math.max(num(p, 'length', 1500) - 84, 40)
    return [
      { id: 'a', label: 'Plug A', kind: 'electrical', pos: [-(body / 2 + 42.5), 7, 0], dir: [-1, 0, 0], role: 'io', imax: 0.05 },
      { id: 'b', label: 'Plug B', kind: 'electrical', pos: [body / 2 + 42.5, 7, 0], dir: [1, 0, 0], role: 'io', imax: 0.05 },
    ]
  },
  price: (p) => 5 + num(p, 'length', 1500) * 0.003,
  readouts: (p) => {
    const m = num(p, 'length', 1500) / 1000
    return [
      { label: 'Length', value: `${m.toFixed(1)} m` },
      { label: 'Carries', value: m <= 3 ? '4K at 120 Hz' : m <= 5 ? '4K at 60 Hz' : '1080p, 4K is not reliable this long' },
    ]
  },
}

const ethernetCable: PartDef = {
  id: 'cable-ethernet',
  name: 'Ethernet cable',
  category: 'wire',
  blurb: 'Clear RJ45 plugs with coloured boots',
  tags: ['ethernet', 'ethernet cable', 'rj45', 'cat6', 'cat5e', 'network cable', 'patch cable', 'lan'],
  doc: { price: 6, description: 'A patch lead of four twisted pairs. Up to 100 m is inside the standard at any speed the category supports.' },
  params: [
    { key: 'cat', label: 'Category', type: 'enum', default: '6', group: 'Cable', options: [{ value: '5e', label: 'Cat 5e' }, { value: '6', label: 'Cat 6' }, { value: '6a', label: 'Cat 6a' }] },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 2000, min: 250, max: 30000, step: 250, group: 'Cable' },
    { key: 'color', label: 'Colour', type: 'enum', default: 'blue', group: 'Cable', options: [{ value: 'blue', label: 'Blue' }, { value: 'grey', label: 'Grey' }, { value: 'yellow', label: 'Yellow' }, { value: 'red', label: 'Red' }] },
  ],
  solids: (p) => {
    const len = num(p, 'length', 2000)
    const body = Math.max(len - 76, 40)
    const colors: Record<string, string> = { blue: '#1F5FCC', grey: '#8A9099', yellow: '#D8A814', red: '#C4262C' }
    const c = colors[str(p, 'color', 'blue')] ?? colors.blue
    const y = 7
    const out: Solid[] = [{ kind: 'tube', mat: { color: c, rough: 0.55, density: 1.3 }, r: 3, seg: 10, path: drape(body, y, 0.04) }]
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'box', mat: { color: c, rough: 0.5, density: 1.2 }, size: [16, 13, 15], at: [s * (body / 2 + 8), y, 0], bevel: 4 })
      out.push({ kind: 'box', mat: { color: '#E4ECF0', rough: 0.12, opacity: 0.55, transmission: 0.6, density: 1.2, name: 'Clear polycarbonate' }, size: [22, 12, 14], at: [s * (body / 2 + 27), y, 0], bevel: 1 })
      for (let i = 0; i < 8; i++) {
        out.push({ kind: 'box', mat: 'gold', size: [4, 0.8, 0.8], at: [s * (body / 2 + 35), y + 5.4, -4.9 + i * 1.4], noCollide: true })
      }
      out.push({ kind: 'box', mat: { color: '#E4ECF0', rough: 0.2, opacity: 0.7, density: 1.2 }, size: [14, 1.2, 6], at: [s * (body / 2 + 28), y - 7, 0], rot: [0, 0, s * 12] })
    }
    return out
  },
  ports: (p) => {
    const body = Math.max(num(p, 'length', 2000) - 76, 40)
    return [
      { id: 'a', label: 'RJ45 A', kind: 'electrical', pos: [-(body / 2 + 38.5), 7, 0], dir: [-1, 0, 0], role: 'io', imax: 0.5 },
      { id: 'b', label: 'RJ45 B', kind: 'electrical', pos: [body / 2 + 38.5, 7, 0], dir: [1, 0, 0], role: 'io', imax: 0.5 },
    ]
  },
  price: (p) => 2 + num(p, 'length', 2000) * 0.0015,
  readouts: (p) => {
    const cat = str(p, 'cat', '6')
    const m = num(p, 'length', 2000) / 1000
    const speed = cat === '5e' ? '1 Gbit' : cat === '6' ? (m <= 55 ? '10 Gbit' : '1 Gbit') : '10 Gbit'
    return [
      { label: 'Length', value: `${m.toFixed(2)} m` },
      { label: 'Speed', value: speed },
      { label: 'PoE', value: 'Up to 90 W on all four pairs' },
    ]
  },
}

/* ================================================================== */
/* Mains cord                                                          */
/* ================================================================== */

const powerCord: PartDef = {
  id: 'cable-power-cord',
  name: 'Mains power cord',
  category: 'wire',
  blurb: 'Wall plug to an IEC C13, live, neutral and earth',
  tags: ['power cord', 'mains lead', 'iec', 'c13', 'kettle lead', 'plug', 'ac cable', 'pc power cable'],
  doc: { price: 7, description: 'The lead a PC, monitor or bench supply takes. Three 0.75 mm² conductors, good for 10 A, with the earth running through to the equipment chassis.' },
  params: [
    { key: 'plug', label: 'Plug', type: 'enum', default: 'uk', group: 'Cord', options: [{ value: 'uk', label: 'UK, BS 1363' }, { value: 'eu', label: 'EU, Schuko' }, { value: 'us', label: 'US, NEMA 5-15' }] },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 1800, min: 500, max: 5000, step: 100, group: 'Cord' },
  ],
  solids: (p) => {
    const len = num(p, 'length', 1800)
    const body = Math.max(len - 90, 60)
    const plug = str(p, 'plug', 'uk')
    const y = 22
    const out: Solid[] = [{ kind: 'tube', mat: jacket('black'), r: 3.6, seg: 12, path: drape(body, y, 0.05) }]
    const L = -body / 2
    if (plug === 'uk') {
      out.push({ kind: 'box', mat: 'abs-black', size: [30, 44, 50], at: [L - 15, y, 0], bevel: 4 })
      out.push({ kind: 'box', mat: 'brass', size: [18, 8, 4], at: [L - 39, y + 11, 0] })
      for (const s of [-1, 1]) out.push({ kind: 'box', mat: 'brass', size: [17, 4, 6.3], at: [L - 38.5, y - 11, s * 11] })
    } else if (plug === 'eu') {
      out.push({ kind: 'cyl', mat: 'abs-black', r: 20, h: 36, rot: [0, 0, 90], at: [L - 18, y, 0], seg: 28, chamfer: 3 })
      for (const s of [-1, 1]) out.push({ kind: 'cyl', mat: 'nickel', r: 2.4, h: 19, rot: [0, 0, 90], at: [L - 45.5, y, s * 9.5], seg: 12 })
    } else {
      out.push({ kind: 'box', mat: 'abs-black', size: [30, 24, 34], at: [L - 15, y, 0], bevel: 4 })
      for (const s of [-1, 1]) out.push({ kind: 'box', mat: 'brass', size: [16, 6.5, 1.5], at: [L - 38, y + 2, s * 6.35] })
      out.push({ kind: 'cyl', mat: 'brass', r: 2.4, h: 18, rot: [0, 0, 90], at: [L - 39, y - 8, 0], seg: 12 })
    }
    // IEC C13 on the other end.
    const R = body / 2
    out.push({ kind: 'box', mat: 'abs-black', size: [34, 24, 28], at: [R + 17, y, 0], bevel: 3 })
    for (const [dy, dz] of [[4, 0], [-4, -7], [-4, 7]] as const) {
      out.push({ kind: 'box', mat: DARK, size: [0.6, 5, 2], at: [R + 34.2, y + dy, dz], noCollide: true })
    }
    return out
  },
  ports: (p) => {
    const body = Math.max(num(p, 'length', 1800) - 90, 60)
    const plug = str(p, 'plug', 'uk')
    const tipA = -body / 2 - (plug === 'eu' ? 55 : 48)
    const tipB = body / 2 + 35
    const out: Port[] = []
    for (const [end, x, dir] of [['a', tipA, -1], ['b', tipB, 1]] as const) {
      ;([['l', 'Live', 'power'], ['n', 'Neutral', 'passive'], ['e', 'Earth', 'shield']] as const).forEach(([id, label, role], i) => {
        out.push({ id: `${end}_${id}`, label: `${end === 'a' ? 'Plug' : 'C13'} ${label}`, kind: 'electrical', pos: [x, 22 - 6 + i * 6, 0], dir: [dir, 0, 0], role, imax: 10 })
      })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const r = ohms(num(p, 'length', 1800), 0.75)
      return [
        { type: 'resistor', r, a: 'a_l', b: 'b_l' },
        { type: 'resistor', r, a: 'a_n', b: 'b_n' },
        { type: 'resistor', r, a: 'a_e', b: 'b_e' },
      ] as DeviceModel[]
    },
    limits: { imax: 10, vmax: 250 },
  },
  readouts: (p) => [
    { label: 'Conductors', value: '3 x 0.75 mm²' },
    { label: 'Rating', value: str(p, 'plug', 'uk') === 'us' ? '10 A, 125 V' : '10 A, 250 V' },
    { label: 'Per conductor', value: eng(ohms(num(p, 'length', 1800), 0.75), 'Ω') },
  ],
}

/* ================================================================== */
/* Servo extension                                                     */
/* ================================================================== */

const servoLead: PartDef = {
  id: 'cable-servo',
  name: 'Servo extension',
  category: 'wire',
  blurb: 'Brown, red and orange in a flat three-way lead',
  tags: ['servo extension', 'servo lead', 'servo cable', 'rc', '3 pin', 'dupont', 'jr', 'futaba'],
  doc: { price: 1.2, description: 'The flat three-wire lead every hobby servo uses, 26 AWG, with a three-way housing at each end. Brown is ground, red is power, orange is signal.' },
  params: [{ key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 100, max: 1500, step: 50, group: 'Cable' }],
  solids: (p) => {
    const len = num(p, 'length', 300)
    const body = Math.max(len - 30, 30)
    const y = 1.3
    const cols = ['#6B3F20', '#C4262C', '#E07A1E']
    const out: Solid[] = cols.map((c, i): Solid => ({ kind: 'tube', mat: { color: c, rough: 0.6, density: 1.3 }, r: 0.62, seg: 6, path: drape(body, y, 0.05, -1.27 + i * 1.27, 12) }))
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'box', mat: 'abs-black', size: [15, 2.8, 7.8], at: [s * (body / 2 + 7.5), y, 0], bevel: 0.3 })
    }
    return out
  },
  ports: (p) => {
    const body = Math.max(num(p, 'length', 300) - 30, 30)
    const out: Port[] = []
    for (const [end, sign] of [['a', -1], ['b', 1]] as const) {
      ;([['gnd', 'Ground, brown', 'gnd'], ['vcc', 'Power, red', 'power'], ['sig', 'Signal, orange', 'io']] as const).forEach(([id, label, role], i) => {
        out.push({ id: `${end}_${id}`, label, kind: 'electrical', pos: [sign * (body / 2 + 15.5), 1.3, -2.54 + i * 2.54], dir: [sign, 0, 0], role, imax: 2 })
      })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const r = ohms(num(p, 'length', 300), 0.129)
      return ['gnd', 'vcc', 'sig'].map((w) => ({ type: 'resistor' as const, r, a: `a_${w}`, b: `b_${w}` }))
    },
  },
  readouts: (p) => [
    { label: 'Per conductor', value: eng(ohms(num(p, 'length', 300), 0.129), 'Ω') },
    { label: 'Drop at 2 A stall', value: `${(ohms(num(p, 'length', 300), 0.129) * 4).toFixed(2)} V there and back` },
  ],
}

/* ================================================================== */
/* Heat shrink and cable ties                                          */
/* ================================================================== */

const heatShrink: PartDef = {
  id: 'heat-shrink',
  name: 'Heat shrink',
  category: 'wire',
  blurb: 'Shrinks to half its size over a joint',
  tags: ['heat shrink', 'heatshrink', 'sleeving', 'insulation', 'shrink tube', 'solder joint'],
  doc: { price: 0.05, description: 'Polyolefin tubing with a 2:1 shrink ratio. It has to go on the wire before the joint is soldered, which everyone forgets exactly once.' },
  params: [
    { key: 'dia', label: 'Supplied diameter', type: 'enum', default: '4.8', group: 'Tube', options: ['1.6', '2.4', '3.2', '4.8', '6.4', '9.5', '12.7'].map((d) => ({ value: d, label: `${d} mm` })) },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 25, min: 5, max: 200, step: 1, group: 'Tube' },
    { key: 'shrunk', label: 'Shrunk', type: 'bool', default: false, group: 'Tube' },
    { key: 'color', label: 'Colour', type: 'enum', default: 'black', group: 'Tube', options: [{ value: 'black', label: 'Black' }, { value: 'red', label: 'Red' }, { value: 'clear', label: 'Clear' }] },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'dia', '4.8'))
    const shrunk = p.shrunk === true
    const rin = (shrunk ? d / 2 : d) / 2
    const wall = Math.max(0.25, d * 0.06) * (shrunk ? 1.6 : 1)
    const L = num(p, 'length', 25) * (shrunk ? 0.95 : 1)
    const colors: Record<string, object> = {
      black: { color: '#17191C', rough: 0.4, density: 1.1 },
      red: { color: '#B01A1A', rough: 0.4, density: 1.1 },
      clear: { color: '#E6EEF2', rough: 0.2, opacity: 0.5, transmission: 0.6, density: 1.1 },
    }
    return [{
      kind: 'lathe', mat: (colors[str(p, 'color', 'black')] ?? colors.black) as never, seg: 20,
      points: [[rin, -L / 2], [rin + wall, -L / 2], [rin + wall, L / 2], [rin, L / 2], [rin, -L / 2]],
      rot: [0, 0, 90], at: [0, rin + wall, 0],
    }]
  },
  ports: (p) => {
    const d = parseFloat(str(p, 'dia', '4.8'))
    const rin = (p.shrunk === true ? d / 2 : d) / 2
    const L = num(p, 'length', 25)
    return [{ id: 'bore', label: 'Bore', kind: 'mechanical', pos: [L / 2, rin + 0.5, 0], dir: [1, 0, 0], mate: { type: 'hole', size: rin * 2 } }]
  },
  readouts: (p) => {
    const d = parseFloat(str(p, 'dia', '4.8'))
    return [
      { label: 'Fits over', value: `Up to ${(d * 0.9).toFixed(1)} mm` },
      { label: 'Grips down to', value: `${(d / 2).toFixed(1)} mm` },
      { label: 'Shrinks at', value: '90 °C' },
    ]
  },
}

const cableTie: PartDef = {
  id: 'cable-tie',
  name: 'Cable tie',
  category: 'wire',
  blurb: 'A loop pulled tight round a bundle',
  tags: ['cable tie', 'zip tie', 'tie wrap', 'cable management', 'bundle', 'ratchet'],
  doc: { price: 0.03, description: 'A nylon ratchet tie. The width sets the strength; the length sets the biggest bundle it can close round.' },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 150, min: 80, max: 400, step: 10, group: 'Tie' },
    { key: 'bundle', label: 'Bundle diameter', type: 'number', unit: 'mm', default: 15, min: 4, max: 110, step: 1, group: 'Tie' },
    { key: 'color', label: 'Colour', type: 'enum', default: 'black', group: 'Tie', options: [{ value: 'black', label: 'Black, UV stable' }, { value: 'white', label: 'Natural' }, { value: 'blue', label: 'Blue' }] },
  ],
  solids: (p) => {
    const len = num(p, 'length', 150)
    const maxD = (len - 25) / Math.PI
    const d = Math.min(num(p, 'bundle', 15), maxD)
    const r = d / 2 + 0.7
    const colors: Record<string, string> = { black: '#17191C', white: '#E8E4D8', blue: '#1F5FCC' }
    const mat = { color: colors[str(p, 'color', 'black')] ?? colors.black, rough: 0.5, density: 1.14, name: 'Nylon 66' }
    const loop: Vec3[] = []
    for (let a = 12; a <= 348; a += 12) loop.push([r * Math.sin((a * Math.PI) / 180), r + r * Math.cos((a * Math.PI) / 180) + 1.2, 0])
    const tail = Math.max(len - Math.PI * d - 12, 2)
    return [
      { kind: 'tube', mat, r: 1.2, seg: 6, path: loop },
      { kind: 'box', mat, size: [8, 5, 6], at: [0, 2.5, 0], bevel: 0.6 },
      { kind: 'tube', mat, r: 1.2, seg: 6, path: [[0, 1.2, 0], [tail, 1.2, 0]] },
    ]
  },
  ports: (p) => [
    { id: 'loop', label: 'Loop', kind: 'mechanical', pos: [0, num(p, 'bundle', 15) / 2 + 1.9, 0], dir: [0, 0, 1], mate: { type: 'face' } },
  ],
  readouts: (p) => {
    const len = num(p, 'length', 150)
    return [
      { label: 'Closes round', value: `Up to ${Math.round((len - 25) / Math.PI)} mm` },
      { label: 'Strength', value: `${len >= 250 ? 22 : len >= 150 ? 18 : 8} kg` },
    ]
  },
}

/* ================================================================== */
/* Lever connector                                                     */
/* ================================================================== */

const leverConnector: PartDef = {
  id: 'wago-lever',
  name: 'Lever connector',
  category: 'connector',
  blurb: 'Lift a lever, push the wire in, drop it',
  tags: ['wago', '221', 'lever connector', 'splice', 'wire connector', 'junction', 'terminal'],
  doc: {
    manufacturer: 'WAGO',
    mpn: '221-413',
    price: 0.6,
    description: 'A splice for two to five wires. Every way is the same clamp bar inside, so everything in it is one node, and the clear housing shows whether each wire went in far enough.',
  },
  params: [
    { key: 'ways', label: 'Ways', type: 'enum', default: '3', group: 'Connector', options: ['2', '3', '5'].map((w) => ({ value: w, label: w })) },
    { key: 'open', label: 'Levers open', type: 'bool', default: false, group: 'Connector' },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'ways', '3'), 10) || 3
    const W = n * 6.2 + 1
    const L = 20
    const H = 8.2
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#D9E3E8', rough: 0.15, opacity: 0.55, transmission: 0.6, density: 1.2, name: 'Clear polycarbonate' }, size: [W, H, L], at: [0, H / 2, 0], bevel: 0.8 },
      { kind: 'box', mat: METAL, size: [W - 3, 2, 12], at: [0, 3.5, 1], noCollide: true },
    ]
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 3.6 + i * 6.2
      out.push({ kind: 'cyl', mat: DARK, r: 2, h: 1, rot: [90, 0, 0], at: [x, 3.8, L / 2 + 0.2], seg: 12, noCollide: true })
      out.push({
        kind: 'group', mat: { color: '#E07A1E', rough: 0.45, density: 1.2 }, at: [x, H, -L / 2 + 2], rot: [p.open === true ? -58 : 0, 0, 0], children: [
          { kind: 'box', mat: { color: '#E07A1E', rough: 0.45, density: 1.2 }, size: [5.2, 2.2, 16], at: [0, 1.1, 8], bevel: 0.5 },
        ],
      })
    }
    return out
  },
  ports: (p) => {
    const n = parseInt(str(p, 'ways', '3'), 10) || 3
    const W = n * 6.2 + 1
    return Array.from({ length: n }, (_, i): Port => ({
      id: `w${i + 1}`, label: `Way ${i + 1}`, kind: 'electrical',
      pos: [-W / 2 + 3.6 + i * 6.2, 3.8, 11], dir: [0, 0, 1], role: 'passive', imax: 32, groupId: 'bus',
    }))
  },
  readouts: () => [
    { label: 'Rating', value: '32 A, 450 V' },
    { label: 'Wire', value: '0.2 to 4 mm², solid or stranded' },
    { label: 'Strip length', value: '11 mm' },
  ],
}

/* ================================================================== */
/* Cable chain                                                         */
/* ================================================================== */

const dragChain: PartDef = {
  id: 'drag-chain',
  name: 'Cable chain',
  category: 'motion',
  blurb: 'Keeps a moving axis\'s cables from being dragged into it',
  tags: ['drag chain', 'cable chain', 'energy chain', 'cable carrier', 'cnc', '3d printer', 'igus'],
  doc: {
    price: 12,
    description:
      'Snap-together links that carry cables along with a moving carriage without letting them bend tighter than their minimum radius. The chain only needs to be half the travel plus the bend, because the loop rolls along as the carriage moves.',
  },
  params: [
    { key: 'travel', label: 'Travel', type: 'number', unit: 'mm', default: 500, min: 150, max: 1500, step: 10, group: 'Chain' },
    { key: 'radius', label: 'Bend radius', type: 'enum', default: '38', group: 'Chain', options: ['28', '38', '48', '75'].map((r) => ({ value: r, label: `${r} mm` })) },
    { key: 'position', label: 'Carriage', type: 'number', unit: '%', default: 50, min: 0, max: 100, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const T = num(p, 'travel', 500)
    const R = parseFloat(str(p, 'radius', '38'))
    const f = num(p, 'position', 50) / 100
    const pitch = 18
    const W = 25
    const H = 18
    const lower = T * (0.1 + 0.8 * (1 - f)) * 0.5 + 20
    const total = T / 2 + Math.PI * R + 20
    const upper = Math.max(total - lower - Math.PI * R, 0)
    const link = { color: '#1B1D21', rough: 0.55, density: 1.14, name: 'Nylon' }
    const out: Solid[] = []
    const n = Math.floor(total / pitch)
    for (let i = 0; i <= n; i++) {
      const s = i * pitch
      let x: number
      let y: number
      let a: number
      if (s < lower) {
        x = s; y = H / 2; a = 0
      } else if (s < lower + Math.PI * R) {
        const t = (s - lower) / R
        x = lower + R * Math.sin(t); y = H / 2 + R - R * Math.cos(t); a = t
      } else {
        x = lower - (s - lower - Math.PI * R); y = H / 2 + 2 * R; a = Math.PI
        if (s - lower - Math.PI * R > upper) break
      }
      out.push({
        kind: 'group', mat: link, at: [x, y, 0], rot: [0, 0, (a * 180) / Math.PI], children: [
          { kind: 'box', mat: link, size: [pitch - 1.2, H, 2.4], at: [0, 0, W / 2 - 1.2], bevel: 1.2 },
          { kind: 'box', mat: link, size: [pitch - 1.2, H, 2.4], at: [0, 0, -W / 2 + 1.2], bevel: 1.2 },
          { kind: 'box', mat: link, size: [5, 2, W - 3], at: [0, H / 2 - 1, 0] },
          { kind: 'box', mat: link, size: [5, 2, W - 3], at: [0, -H / 2 + 1, 0] },
        ],
      })
    }
    out.push({ kind: 'box', mat: 'steel', size: [20, 3, W + 10], at: [-10, 1.5, 0] })
    return out
  },
  ports: (p) => {
    const T = num(p, 'travel', 500)
    const R = parseFloat(str(p, 'radius', '38'))
    const f = num(p, 'position', 50) / 100
    const lower = T * (0.1 + 0.8 * (1 - f)) * 0.5 + 20
    const upper = Math.max(T / 2 + Math.PI * R + 20 - lower - Math.PI * R, 0)
    return [
      { id: 'fixed', label: 'Fixed end', kind: 'mechanical', pos: [-10, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'moving', label: 'Moving end', kind: 'mechanical', pos: [lower - upper, 18 + 2 * R, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const T = num(p, 'travel', 500)
    const R = parseFloat(str(p, 'radius', '38'))
    const len = T / 2 + Math.PI * R + 20
    return [
      { label: 'Chain length', value: `${Math.round(len)} mm` },
      { label: 'Links', value: `${Math.ceil(len / 18)}` },
      { label: 'Bend radius', value: `${R} mm, larger than any cable inside needs` },
    ]
  },
}

/* ================================================================== */
/* Spool and spiral wrap                                               */
/* ================================================================== */

const wireSpool: PartDef = {
  id: 'wire-spool',
  name: 'Wire spool',
  category: 'wire',
  blurb: 'A reel of hook-up wire, as it comes',
  tags: ['wire spool', 'reel', 'hook-up wire', 'spool', 'awg', 'stock'],
  doc: { price: 9, description: 'Hook-up wire on a plastic reel. The whole length is one conductor, so its resistance is the reason nobody runs a circuit through the spool.' },
  params: [
    { key: 'gauge', label: 'Gauge', type: 'enum', default: '22', group: 'Spool', options: ['16', '18', '20', '22', '24', '26'].map((g) => ({ value: g, label: `${g} AWG` })) },
    { key: 'metres', label: 'Length', type: 'number', unit: 'm', default: 30, min: 5, max: 100, step: 5, group: 'Spool' },
    { key: 'color', label: 'Colour', type: 'enum', default: 'red', group: 'Spool', options: [{ value: 'red', label: 'Red' }, { value: 'black', label: 'Black' }, { value: 'blue', label: 'Blue' }, { value: 'yellow', label: 'Yellow' }, { value: 'green', label: 'Green' }] },
  ],
  solids: (p) => {
    const colors: Record<string, string> = { red: '#C4262C', black: '#1A1C1E', blue: '#1F5FCC', yellow: '#D8A814', green: '#1F9E4B' }
    const fill = Math.min(num(p, 'metres', 30) / 100, 1)
    // Not white: a pale disc face-on to the key light clears the bloom threshold.
    const spool = { color: '#BDB7AA', rough: 0.8, density: 1.05 }
    return [
      { kind: 'cyl', mat: spool, r: 42, h: 3, at: [0, 1.5, 0], seg: 40 },
      { kind: 'cyl', mat: spool, r: 42, h: 3, at: [0, 48.5, 0], seg: 40 },
      { kind: 'cyl', mat: spool, r: 16, h: 44, at: [0, 25, 0], seg: 28 },
      { kind: 'cyl', mat: { color: colors[str(p, 'color', 'red')] ?? colors.red, rough: 0.55, density: 5 }, r: 17 + 22 * fill, h: 43, at: [0, 25, 0], seg: 40 },
      { kind: 'cyl', mat: DARK, r: 8, h: 51, at: [0, 25, 0], seg: 20, noCollide: true },
    ]
  },
  ports: () => [{ id: 'base', label: 'Flange', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } }],
  readouts: (p) => {
    const areas: Record<string, number> = { '16': 1.309, '18': 0.823, '20': 0.519, '22': 0.325, '24': 0.205, '26': 0.129 }
    const a = areas[str(p, 'gauge', '22')] ?? 0.325
    const m = num(p, 'metres', 30)
    return [
      { label: 'End to end', value: eng(ohms(m * 1000, a), 'Ω') },
      { label: 'Copper', value: `${Math.round(a * m * 8.96)} g` },
    ]
  },
}

const spiralWrap: PartDef = {
  id: 'spiral-wrap',
  name: 'Spiral wrap',
  category: 'wire',
  blurb: 'Bundles cables that still need to branch out',
  tags: ['spiral wrap', 'cable wrap', 'cable management', 'sleeve', 'loom', 'harness'],
  doc: { price: 2, description: 'A cut spiral of polyethylene strip. Unlike braided sleeving a wire can leave it anywhere along its length.' },
  params: [
    { key: 'dia', label: 'Diameter', type: 'number', unit: 'mm', default: 12, min: 4, max: 40, step: 1, group: 'Wrap' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 50, max: 2000, step: 10, group: 'Wrap' },
    { key: 'color', label: 'Colour', type: 'enum', default: 'black', group: 'Wrap', options: [{ value: 'black', label: 'Black' }, { value: 'clear', label: 'Natural' }] },
  ],
  solids: (p) => {
    const R = num(p, 'dia', 12) / 2
    const L = num(p, 'length', 300)
    const pitch = Math.max(R * 1.6, 6)
    const perTurn = 12
    const turns = Math.min(L / pitch, 200)
    const path: Vec3[] = []
    for (let i = 0; i <= turns * perTurn; i++) {
      const t = i / perTurn
      path.push([-L / 2 + t * pitch, R + R * Math.cos(t * Math.PI * 2), R * Math.sin(t * Math.PI * 2)])
    }
    const mat = str(p, 'color', 'black') === 'clear'
      ? { color: '#E6EEF2', rough: 0.3, opacity: 0.7, density: 0.95 }
      : { color: '#1A1C1E', rough: 0.45, density: 0.95 }
    return [{ kind: 'tube', mat, r: Math.max(0.6, R * 0.14), seg: 6, path }]
  },
  ports: (p) => [
    { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-num(p, 'length', 300) / 2, num(p, 'dia', 12) / 2, 0], dir: [-1, 0, 0], mate: { type: 'face' } },
    { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [num(p, 'length', 300) / 2, num(p, 'dia', 12) / 2, 0], dir: [1, 0, 0], mate: { type: 'face' } },
  ],
}

registerParts([usbCable, hdmiCable, ethernetCable, powerCord, servoLead, heatShrink, cableTie, leverConnector, dragChain, wireSpool, spiralWrap])
