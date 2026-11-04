import type { DeviceModel, PartDef, Port, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, REGION_PARAM, amps, load, mainsPorts, volts } from './setup'
import { BLACK_PLASTIC, signalPorts } from './setup2'
import { usbLoad, usbPorts } from './peripherals'

/**
 * Light, which is the part of a setup that is always done last and decides
 * how all of it looks.
 *
 * `setup3.ts` has a desk lamp, and that was the whole of lighting. The rest
 * of it is here, and three things in this file are calculations rather than
 * shapes.
 *
 *   A strip is a cable. A 24 V COB strip at 14 W a metre on a five metre run
 *   is 2.9 A entering a copper trace with real resistance in it, so the far
 *   end sits at a lower voltage than the near end and is visibly dimmer. The
 *   fix is feeding both ends, and the readouts say whether you need to.
 *
 *   A driver is sized, not bought. 80% of rated is the number to design to,
 *   because a supply run at its label all day is a supply that gets hot and
 *   dies early.
 *
 *   Colour temperature and CRI are not decoration. A 2700 K lamp beside a
 *   6500 K monitor is the single commonest reason a desk photographs badly,
 *   and the mismatch is a number you can set here and look at.
 *
 * Conventions are `setup.ts`: mains as l/n/e, loads sized in watts,
 * everything standing on its own footprint at y = 0 facing +z.
 */

const DIFFUSER = { color: '#E8E6E0', rough: 0.9, density: 1.2, opacity: 0.9 }

/** A lit emissive material at a colour temperature, roughly. */
const glow = (on: boolean, kelvin: number, strength = 1.1) => {
  // Blackbody, approximated well enough for a surface colour: warm is red
  // shifted, cool is blue shifted, and 5000 K is neutral.
  const t = Math.min(1, Math.max(0, (kelvin - 2200) / 4300))
  const r = Math.round(255 - t * 40)
  const g = Math.round(180 + t * 55)
  const b = Math.round(110 + t * 140)
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  return on
    ? { color: hex, rough: 0.9, density: 1.2, emissive: hex, emissiveIntensity: strength }
    : { color: '#D8D5CE', rough: 0.9, density: 1.2 }
}

/** Lumens from watts, at the efficacy a given source really manages. */
const lumens = (w: number, eff: number): string => `${Math.round(w * eff)} lm`

/* ================================================================== */
/* Strip, and the supply behind it                                     */
/* ================================================================== */

const cobStrip: PartDef = {
  id: 'strip-cob-24v',
  name: 'COB LED strip',
  category: 'lighting',
  blurb: 'A continuous line of light, and a volt drop along it',
  tags: ['led strip', 'cob', 'strip light', 'cove', '24v', '12v', 'tape light', 'lighting', 'bias', 'dot free'],
  doc: {
    price: 28,
    description:
      'A reel of continuous-phosphor strip, which reads as a line of light rather than a row of dots. Cut to length, so length is a parameter and everything follows from it: the watts, the current, and the drop along the copper.\n\nThat drop is the thing to design around. Five metres of 14 W/m strip at 24 V takes 2.9 A in at one end, and the trace carrying it has about 0.5 ohm there and back, so the far end sees nearly a volt and a half less and runs visibly dimmer. Feeding both ends halves the current in each half of the trace and takes the error to a quarter.',
  },
  params: [
    {
      key: 'volts', label: 'Strip voltage', type: 'enum', default: '24', group: 'Strip',
      options: [{ value: '12', label: '12 V' }, { value: '24', label: '24 V' }],
    },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 3000, min: 100, max: 10000, step: 50, group: 'Strip' },
    { key: 'wpm', label: 'Power density', type: 'number', unit: 'W', default: 14, min: 4, max: 30, step: 1, group: 'Strip', help: 'Watts per metre. 8 is accent, 14 is usable work light, 24 and up needs a heatsink channel.' },
    { key: 'kelvin', label: 'Colour temperature', type: 'number', unit: 'K', default: 4000, min: 2200, max: 6500, step: 100, group: 'Light' },
    { key: 'cri', label: 'CRI', type: 'number', unit: '', default: 95, min: 70, max: 98, step: 1, group: 'Light' },
    { key: 'feed', label: 'Fed', type: 'enum', default: 'one', group: 'Wiring', options: [{ value: 'one', label: 'One end' }, { value: 'both', label: 'Both ends' }] },
    { key: 'dim', label: 'Dimmed to', type: 'number', unit: '%', default: 100, min: 0, max: 100, step: 5, group: 'Control' },
  ],
  solids: (p) => {
    const l = num(p, 'length', 3000)
    const on = num(p, 'dim', 100) > 0
    return [
      { kind: 'box', mat: { color: '#D9D7D2', rough: 0.6, density: 1.1 }, size: [l, 1.6, 10], at: [0, 1, 0] },
      { kind: 'box', mat: glow(on, num(p, 'kelvin', 4000), (num(p, 'dim', 100) / 100) * 1.4), size: [l - 4, 1, 8], at: [0, 2, 0], noCollide: true },
    ]
  },
  ports: (p) => {
    const l = num(p, 'length', 3000)
    const out: Port[] = [
      { id: 'vin', label: `+${str(p, 'volts', '24')} V in`, kind: 'electrical', pos: [-l / 2, 1.6, 3], dir: [-1, 0, 0], role: 'power', imax: 6, solderable: true },
      { id: 'gnd', label: 'Return in', kind: 'electrical', pos: [-l / 2, 1.6, -3], dir: [-1, 0, 0], role: 'gnd', imax: 6, solderable: true },
    ]
    if (str(p, 'feed', 'one') === 'both') {
      out.push({ id: 'vin2', label: `+${str(p, 'volts', '24')} V far end`, kind: 'electrical', pos: [l / 2, 1.6, 3], dir: [1, 0, 0], role: 'power', imax: 6, solderable: true })
      out.push({ id: 'gnd2', label: 'Return far end', kind: 'electrical', pos: [l / 2, 1.6, -3], dir: [1, 0, 0], role: 'gnd', imax: 6, solderable: true })
    }
    out.push({ id: 'back', label: 'Adhesive face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    /*
     * The strip as two halves with the trace between them, which is the
     * cheapest model that shows the real effect. Each half is a resistance
     * sized for half the light; between them sits the copper. Fed from one
     * end the whole current crosses that copper; fed from both, the far half
     * is supplied directly and the drop is shared.
     */
    devices: (p) => {
      const l = num(p, 'length', 3000) / 1000
      const v = parseInt(str(p, 'volts', '24'), 10) || 24
      const w = Math.max(0.2, l * num(p, 'wpm', 14) * (num(p, 'dim', 100) / 100))
      // 0.17 ohm a metre a conductor for the 10 mm two-ounce copper on a
      // typical strip, which is the figure the drop readouts use too.
      const trace = (l / 2) * 0.17 * 2
      const half = (v * v) / Math.max(0.1, w / 2)
      const out: DeviceModel[] = [
        { type: 'resistor', a: 'vin', b: 'gnd', r: half },
        { type: 'resistor', a: 'vin', b: '#mid', r: trace },
        { type: 'resistor', a: '#mid', b: 'gnd', r: half },
      ]
      if (str(p, 'feed', 'one') === 'both') {
        out.push({ type: 'resistor', a: 'vin2', b: '#mid', r: trace * 0.2 })
        out.push({ type: 'short', a: 'gnd2', b: 'gnd' })
      }
      return out
    },
    limits: { vmax: 30 },
  },
  mass: (p) => (num(p, 'length', 3000) / 1000) * 48,
  price: (p) => (num(p, 'length', 3000) / 1000) * (6 + num(p, 'wpm', 14) * 0.35),
  readouts: (p) => {
    const l = num(p, 'length', 3000) / 1000
    const v = parseInt(str(p, 'volts', '24'), 10) || 24
    const wpm = num(p, 'wpm', 14)
    const dim = num(p, 'dim', 100) / 100
    const w = l * wpm * dim
    const i = w / v
    const trace = l * 0.17 * 2
    const both = str(p, 'feed', 'one') === 'both'
    // Fed one end the whole current crosses the whole trace; fed both ends
    // each half carries half of it over half the length.
    const drop = both ? (i / 2) * (trace / 2) : i * trace
    const eff = num(p, 'cri', 95) >= 95 ? 95 : 115
    return [
      { label: 'Total', value: `${w.toFixed(1)} W, ${i.toFixed(2)} A at ${v} V` },
      { label: 'Output', value: `${lumens(w, eff)}, ${Math.round(w * eff / Math.max(0.1, l))} lm a metre` },
      { label: 'Trace resistance', value: `${trace.toFixed(2)} Ω over ${l.toFixed(2)} m, there and back` },
      { label: 'Far end drop', value: `${drop.toFixed(2)} V, ${((drop / v) * 100).toFixed(1)}% dimmer` },
      {
        label: 'Verdict',
        value: drop / v > 0.08 ? (both ? 'Still too long, split it into two runs' : 'Feed the far end as well') : 'Even enough to read as one line',
      },
      { label: 'Colour', value: `${num(p, 'kelvin', 4000)} K, CRI ${num(p, 'cri', 95)}` },
    ]
  },
}

const ledDriver: PartDef = {
  id: 'driver-led',
  name: 'LED driver',
  category: 'lighting',
  blurb: 'Mains to 24 V, sized at eighty per cent',
  tags: ['led driver', 'psu', 'power supply', 'transformer', '24v', '12v', 'constant voltage', 'meanwell', 'lighting'],
  doc: {
    price: 32,
    description:
      'A constant-voltage supply for strip. The only decision in it is the rating, and the rule is to design to 80% of it: a 100 W driver running 95 W of strip gets hot, ages its own capacitors and fails in a year, while the same driver at 75 W lasts ten.\n\nIt is also the thing that makes strip dimmable or not. A plain driver with a wall dimmer in front of it flickers; a dimmable one takes a 0-10 V or PWM signal and does it properly.',
  },
  params: [
    REGION_PARAM,
    { key: 'vout', label: 'Output', type: 'enum', default: '24', group: 'Driver', options: [{ value: '12', label: '12 V' }, { value: '24', label: '24 V' }, { value: '48', label: '48 V' }] },
    { key: 'rating', label: 'Rating', type: 'enum', default: '100', group: 'Driver', options: ['30', '60', '100', '150', '240', '320'].map((v) => ({ value: v, label: `${v} W` })) },
    { key: 'ip', label: 'Enclosure', type: 'enum', default: 'ip20', group: 'Driver', options: [{ value: 'ip20', label: 'IP20, indoors' }, { value: 'ip67', label: 'IP67, potted' }] },
    { key: 'dimmable', label: 'Dimmable', type: 'bool', default: true, group: 'Driver' },
    { key: 'loadW', label: 'Strip connected', type: 'number', unit: 'W', default: 42, min: 0, max: 320, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const rated = parseInt(str(p, 'rating', '100'), 10) || 100
    const l = 110 + rated * 0.42
    const w = 52 + rated * 0.06
    const h = 30 + rated * 0.03
    const potted = str(p, 'ip', 'ip20') === 'ip67'
    const out: Solid[] = [
      { kind: 'box', mat: potted ? { color: '#2A2C30', rough: 0.75, density: 1.5 } : ALU, size: [l, h, w], at: [0, h / 2, 0], bevel: 3 },
    ]
    if (!potted) {
      // The vented case and the terminal block at one end.
      for (let i = 0; i < 8; i++) out.push({ kind: 'box', mat: DARK, size: [l * 0.06, h * 0.6, 1], at: [-l / 2 + 14 + i * (l * 0.09), h / 2, w / 2], noCollide: true })
      out.push({ kind: 'box', mat: { color: '#1E8A4A', rough: 0.6, density: 1.9 }, size: [34, h * 0.8, 14], at: [l / 2 - 18, h / 2, 0] })
    } else {
      out.push({ kind: 'tube', mat: { color: '#1A1A1C', rough: 0.9, density: 1.1 }, r: 3.5, seg: 10, path: [[-l / 2, h / 2, 0], [-l / 2 - 60, h / 2, 0]] })
      out.push({ kind: 'tube', mat: { color: '#1A1A1C', rough: 0.9, density: 1.1 }, r: 3.5, seg: 10, path: [[l / 2, h / 2, 0], [l / 2 + 60, h / 2, 0]] })
    }
    return out
  },
  ports: (p) => {
    const rated = parseInt(str(p, 'rating', '100'), 10) || 100
    const l = 110 + rated * 0.42
    const h = 30 + rated * 0.03
    const out: Port[] = [
      ...mainsPorts([-l / 2 - 4, h / 2, 0], [-1, 0, 0], '', [0, 0, 9]),
      { id: 'vout', label: `+${str(p, 'vout', '24')} V out`, kind: 'electrical', pos: [l / 2 + 4, h / 2, 6], dir: [1, 0, 0], role: 'power', imax: 15, solderable: false },
      { id: 'vneg', label: 'Return', kind: 'electrical', pos: [l / 2 + 4, h / 2, -6], dir: [1, 0, 0], role: 'gnd', imax: 15, solderable: false },
    ]
    if (bool(p, 'dimmable', true)) {
      out.push({ id: 'dim', label: '0-10 V dim', kind: 'electrical', pos: [l / 2 + 4, h / 2, -18], dir: [1, 0, 0], role: 'analog', imax: 0.01, solderable: false })
    }
    out.push({ id: 'base', label: 'Base', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const vout = parseInt(str(p, 'vout', '24'), 10) || 24
      const v = volts(p)
      const drawn = num(p, 'loadW', 42)
      // 88% efficient at this size, plus a watt of standby that is there
      // whether anything is connected or not.
      const fromWall = drawn / 0.88 + 1
      return [
        { type: 'vsource', v: vout, a: 'vout', b: 'vneg', rint: 0.08 },
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / Math.max(0.5, fromWall) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
    },
    supplies: ['vout'],
    limits: { vmax: 400 },
  },
  mass: (p) => 180 + (parseInt(str(p, 'rating', '100'), 10) || 100) * 3.4,
  price: (p) => 10 + (parseInt(str(p, 'rating', '100'), 10) || 100) * 0.22 + (str(p, 'ip', 'ip20') === 'ip67' ? 14 : 0),
  readouts: (p) => {
    const rated = parseInt(str(p, 'rating', '100'), 10) || 100
    const vout = parseInt(str(p, 'vout', '24'), 10) || 24
    const connected = num(p, 'loadW', 42)
    const headroom = rated * 0.8 - connected
    return [
      { label: 'Rated', value: `${rated} W, ${(rated / vout).toFixed(1)} A at ${vout} V` },
      { label: 'Design limit', value: `${(rated * 0.8).toFixed(0)} W, which is 80% of the label` },
      { label: 'Connected', value: `${connected} W, ${Math.round((connected / rated) * 100)}% of rated` },
      { label: 'Headroom', value: headroom >= 0 ? `${headroom.toFixed(0)} W spare` : `${(-headroom).toFixed(0)} W past the design limit` },
      { label: 'From the wall', value: `${(connected / 0.88 + 1).toFixed(1)} W, ${amps(p, connected / 0.88 + 1)}` },
    ]
  },
}

/* ================================================================== */
/* Fixtures                                                            */
/* ================================================================== */

const monitorLightBar: PartDef = {
  id: 'light-bar-monitor',
  name: 'Monitor light bar',
  category: 'lighting',
  blurb: 'Light on the desk and none on the screen',
  tags: ['light bar', 'screen bar', 'monitor light', 'asymmetric', 'desk light', 'lighting', 'usb', 'bias', 'glare'],
  doc: {
    price: 75,
    description:
      'A bar that hangs on the top edge of a monitor and throws light forward onto the desk and not back onto the panel. It exists because the alternative — a lamp beside the screen — either reflects in the panel or lights one side of your face.\n\nThe useful figure is the asymmetric throw: the beam is cut off at about 25 degrees behind vertical, which is what keeps it off the screen, and covers around 600 mm of desk in front of it.',
  },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 450, min: 250, max: 750, step: 10, group: 'Bar' },
    { key: 'kelvin', label: 'Colour temperature', type: 'number', unit: 'K', default: 4000, min: 2700, max: 6500, step: 100, group: 'Light' },
    { key: 'cri', label: 'CRI', type: 'number', unit: '', default: 95, min: 80, max: 98, step: 1, group: 'Light' },
    { key: 'brightness', label: 'Brightness', type: 'number', unit: '%', default: 70, min: 0, max: 100, step: 5, group: 'Control' },
    { key: 'panelThickness', label: 'Monitor top thickness', type: 'number', unit: 'mm', default: 14, min: 4, max: 40, step: 1, group: 'Mount', help: 'The counterweight clamp has a range. A thick-bezelled panel or a very thin one both fall outside it.' },
  ],
  solids: (p) => {
    const l = num(p, 'length', 450)
    const on = num(p, 'brightness', 70) > 0
    const t = num(p, 'panelThickness', 14)
    return [
      { kind: 'cyl', mat: ALU, r: 14, h: l, seg: 22, rot: [0, 0, 90], at: [0, 40, 0], chamfer: 2 },
      { kind: 'box', mat: glow(on, num(p, 'kelvin', 4000), (num(p, 'brightness', 70) / 100) * 1.5), size: [l - 20, 3, 16], at: [0, 29, 6], rot: [-28, 0, 0], noCollide: true },
      // The counterweight hook, which is the whole mechanism.
      { kind: 'box', mat: BLACK_PLASTIC, size: [52, 30, 10], at: [0, 20, -6], bevel: 2 },
      { kind: 'box', mat: BLACK_PLASTIC, size: [52, 12, 26 + t], at: [0, 6, -14 - t / 2], bevel: 2 },
      { kind: 'box', mat: { color: '#2A2C30', rough: 0.5, density: 4 }, size: [52, 34, 12], at: [0, -10, -22 - t], bevel: 2 },
    ]
  },
  ports: (p) => {
    const l = num(p, 'length', 450)
    return [
      ...usbPorts([-l / 2 + 10, 40, -14], [0, 0, -1], 1),
      { id: 'monitor', label: 'Monitor top edge', kind: 'mechanical', pos: [0, 0, -14], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: usbLoad((p) => 1 + (num(p, 'length', 450) / 450) * 4.5 * (num(p, 'brightness', 70) / 100)),
  mass: (p) => 380 + num(p, 'length', 450) * 0.6,
  price: (p) => 40 + num(p, 'length', 450) * 0.08,
  readouts: (p) => {
    const l = num(p, 'length', 450)
    const b = num(p, 'brightness', 70) / 100
    const w = 1 + (l / 450) * 4.5 * b
    const eff = num(p, 'cri', 95) >= 95 ? 90 : 110
    return [
      { label: 'Output', value: `${lumens(w - 0.6, eff)} at ${Math.round(b * 100)}%` },
      { label: 'Covers', value: `${Math.round(l + 150)} × 600 mm of desk in front` },
      { label: 'Draw', value: `${w.toFixed(1)} W, ${Math.round((w / 5) * 1000)} mA at 5 V` },
      { label: 'Colour', value: `${num(p, 'kelvin', 4000)} K, CRI ${num(p, 'cri', 95)}` },
      { label: 'Clamp range', value: num(p, 'panelThickness', 14) > 30 ? 'Past most clamps, check before buying' : 'Within range' },
    ]
  },
}

const keyLight: PartDef = {
  id: 'light-key-panel',
  name: 'Key light',
  category: 'lighting',
  blurb: 'A soft panel on a pole, at 45 degrees to the camera',
  tags: ['key light', 'panel light', 'softbox', 'elgato', 'stream', 'video', 'lighting', 'bi-colour', 'camera'],
  doc: {
    price: 190,
    description:
      'A flat panel behind a diffuser, which is what makes it soft: the bigger the lit surface relative to your distance from it, the softer the shadow it casts. A 250 mm panel at 700 mm is soft; the same output from a bare bulb at the same distance is not.\n\nThe placement rule it is here to serve is 45 degrees horizontally and 30 up, which for a desk means the panel ends up over the corner of it on a pole, where the monitor arm already is.',
  },
  params: [
    REGION_PARAM,
    { key: 'size', label: 'Panel', type: 'enum', default: '250', group: 'Light', options: ['180', '250', '350', '500'].map((v) => ({ value: v, label: `${v} mm square` })) },
    { key: 'kelvin', label: 'Colour temperature', type: 'number', unit: 'K', default: 5600, min: 2900, max: 7000, step: 100, group: 'Light' },
    { key: 'brightness', label: 'Brightness', type: 'number', unit: '%', default: 60, min: 0, max: 100, step: 5, group: 'Control' },
    { key: 'distance', label: 'Distance to subject', type: 'number', unit: 'mm', default: 700, min: 300, max: 2500, step: 50, group: 'Placement' },
    {
      key: 'mount', label: 'Mount', type: 'enum', default: 'pole', group: 'Mount',
      options: [{ value: 'pole', label: 'Desk pole clamp' }, { value: 'stand', label: 'Floor stand' }, { value: 'arm', label: 'On a monitor arm' }],
    },
  ],
  solids: (p) => {
    const s = parseInt(str(p, 'size', '250'), 10) || 250
    const on = num(p, 'brightness', 60) > 0
    const mount = str(p, 'mount', 'pole')
    const poleH = mount === 'stand' ? 1500 : 620
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#F2F0EC', rough: 0.5, density: 1.4 }, size: [s, s * 0.62, 34], at: [0, poleH, -17], bevel: 5 },
      { kind: 'box', mat: DIFFUSER, size: [s - 16, s * 0.62 - 16, 4], at: [0, poleH, 2] },
      { kind: 'box', mat: glow(on, num(p, 'kelvin', 5600), (num(p, 'brightness', 60) / 100) * 1.8), size: [s - 22, s * 0.62 - 22, 2], at: [0, poleH, 3], noCollide: true },
      { kind: 'cyl', mat: ALU, r: 11, h: poleH, seg: 18, at: [0, poleH / 2, -34] },
    ]
    if (mount === 'stand') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2
        out.push({ kind: 'box', mat: { color: '#1E2024', rough: 0.6, density: 2.6 }, size: [16, 10, 320], at: [Math.cos(a) * 110, 5, -34 + Math.sin(a) * 110], rot: [0, (-a * 180) / Math.PI, 0] })
      }
    } else if (mount === 'pole') {
      out.push({ kind: 'box', mat: { color: '#1E2024', rough: 0.6, density: 2.6 }, size: [60, 24, 90], at: [0, 12, -34], bevel: 3 })
    }
    return out
  },
  ports: (p) => {
    const mount = str(p, 'mount', 'pole')
    const poleH = mount === 'stand' ? 1500 : 620
    return [
      ...mainsPorts([0, poleH, -36], [0, 0, -1], '', [9, 0, 0]),
      { id: 'base', label: mount === 'stand' ? 'Floor' : 'Desk edge', kind: 'mechanical', pos: [0, 0, -34], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const s = parseInt(str(p, 'size', '250'), 10) || 250
    const rated = (s / 250) ** 2 * 30
    return 1.2 + rated * (num(p, 'brightness', 60) / 100)
  }),
  mass: (p) => {
    const s = parseInt(str(p, 'size', '250'), 10) || 250
    return 900 + s * 2.2 + (str(p, 'mount', 'pole') === 'stand' ? 1800 : 0)
  },
  price: (p) => {
    const s = parseInt(str(p, 'size', '250'), 10) || 250
    return 90 + s * 0.42
  },
  readouts: (p) => {
    const s = parseInt(str(p, 'size', '250'), 10) || 250
    const rated = (s / 250) ** 2 * 30
    const b = num(p, 'brightness', 60) / 100
    const w = 1.2 + rated * b
    const d = num(p, 'distance', 700)
    // Lux at the subject, from lumens over the hemisphere the panel throws
    // into, which is the honest version of the lux figure on the box.
    const lm = rated * b * 85
    const lux = lm / (2 * Math.PI * (d / 1000) ** 2)
    return [
      { label: 'Output', value: `${lumens(rated * b, 85)} at ${Math.round(b * 100)}%` },
      { label: `At ${d} mm`, value: `${Math.round(lux)} lux on the subject` },
      { label: 'Softness', value: `${((s / d) * 100).toFixed(0)}% source-to-distance, ${s / d > 0.35 ? 'soft' : s / d > 0.2 ? 'medium' : 'hard'} shadows` },
      { label: 'Drawing', value: `${w.toFixed(1)} W, ${amps(p, w)}` },
      { label: 'Place at', value: `45° off the camera axis, ${Math.round(d * 0.7)} mm to the side and ${Math.round(d * 0.5)} mm up` },
    ]
  },
}

const smartBulb: PartDef = {
  id: 'bulb-smart',
  name: 'Smart bulb',
  category: 'lighting',
  blurb: 'A lamp fitting with a radio and nine watts in it',
  tags: ['bulb', 'smart bulb', 'lamp', 'e27', 'b22', 'gu10', 'hue', 'rgbw', 'lighting', 'wifi', 'zigbee'],
  doc: {
    price: 18,
    description:
      'Here for the sum that trips people: a smart bulb never goes off. The radio in it draws 0.4 W standing by, which is 3.5 kWh a year each, and the whole point of the thing is that you have fifteen of them. Fifteen bulbs idle is 6 W permanently, before anybody turns a light on.\n\nThe other number is colour. An RGBW bulb at full colour output is a third as bright as the same bulb in white, because the white die is doing almost all of the work.',
  },
  params: [
    REGION_PARAM,
    { key: 'fitting', label: 'Fitting', type: 'enum', default: 'e27', group: 'Bulb', options: [{ value: 'e27', label: 'E27 screw' }, { value: 'b22', label: 'B22 bayonet' }, { value: 'gu10', label: 'GU10 spot' }, { value: 'e14', label: 'E14 small screw' }] },
    { key: 'watts', label: 'Rated', type: 'number', unit: 'W', default: 9, min: 2, max: 20, step: 0.5, group: 'Bulb' },
    { key: 'radio', label: 'Radio', type: 'enum', default: 'zigbee', group: 'Bulb', options: [{ value: 'none', label: 'None, plain bulb' }, { value: 'zigbee', label: 'Zigbee' }, { value: 'wifi', label: 'Wi-Fi' }] },
    { key: 'colour', label: 'Colour', type: 'enum', default: 'tunable', group: 'Light', options: [{ value: 'warm', label: 'Fixed warm white' }, { value: 'tunable', label: 'Tunable white' }, { value: 'rgbw', label: 'Colour and white' }] },
    { key: 'kelvin', label: 'Set to', type: 'number', unit: 'K', default: 2700, min: 2200, max: 6500, step: 100, group: 'Light' },
    { key: 'level', label: 'Level', type: 'number', unit: '%', default: 100, min: 0, max: 100, step: 5, group: 'Control' },
  ],
  solids: (p) => {
    const fitting = str(p, 'fitting', 'e27')
    const on = num(p, 'level', 100) > 0
    const lit = glow(on, num(p, 'kelvin', 2700), (num(p, 'level', 100) / 100) * 1.6)
    if (fitting === 'gu10') {
      return [
        { kind: 'cyl', mat: { color: '#D7D5D0', rough: 0.5, density: 1.4 }, r: 25, h: 40, seg: 26, at: [0, 20, 0], chamfer: 3 },
        { kind: 'cyl', mat: lit, r: 22, h: 4, seg: 26, at: [0, 42, 0], noCollide: true },
        ...([-1, 1] as const).map((sx) => ({ kind: 'cyl' as const, mat: ALU, r: 2.2, h: 12, seg: 10, at: [sx * 5, -6, 0] as [number, number, number] })),
      ]
    }
    const r = fitting === 'e14' ? 18 : 30
    return [
      { kind: 'sphere', mat: lit, r, seg: 26, at: [0, 30 + r, 0] },
      { kind: 'cyl', mat: { color: '#E6E4DF', rough: 0.6, density: 1.4 }, r: r * 0.62, r2: r * 0.78, h: 26, seg: 22, at: [0, 17, 0] },
      { kind: 'cyl', mat: ALU, r: r * 0.5, h: 18, seg: 20, at: [0, 5, 0] },
    ]
  },
  ports: () => [
    ...mainsPorts([0, 0, 0], [0, -1, 0], '', [6, 0, 0]),
    { id: 'fitting', label: 'Lamp holder', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'thread', size: 27 } },
  ],
  electrical: load((p) => {
    const rated = num(p, 'watts', 9)
    const level = num(p, 'level', 100) / 100
    const idle = str(p, 'radio', 'zigbee') === 'wifi' ? 0.6 : str(p, 'radio', 'zigbee') === 'zigbee' ? 0.4 : 0
    // Driver losses do not scale down with dimming, so a bulb at 10% draws
    // more than a tenth of its rating.
    return idle + (level > 0 ? 0.5 + (rated - 0.5) * level : 0)
  }),
  mass: () => 95,
  price: (p) => {
    const radio = str(p, 'radio', 'zigbee')
    const colour = str(p, 'colour', 'tunable')
    return (radio === 'none' ? 3 : radio === 'zigbee' ? 14 : 11) + (colour === 'rgbw' ? 12 : colour === 'tunable' ? 5 : 0)
  },
  readouts: (p) => {
    const rated = num(p, 'watts', 9)
    const level = num(p, 'level', 100) / 100
    const colour = str(p, 'colour', 'tunable')
    const idle = str(p, 'radio', 'zigbee') === 'wifi' ? 0.6 : str(p, 'radio', 'zigbee') === 'zigbee' ? 0.4 : 0
    const w = idle + (level > 0 ? 0.5 + (rated - 0.5) * level : 0)
    const eff = colour === 'rgbw' ? 75 : 95
    return [
      { label: 'Output', value: `${lumens(rated * level, eff)}${colour === 'rgbw' ? ', a third of that in colour' : ''}` },
      { label: 'Equivalent to', value: `a ${Math.round(rated * eff / 13)} W filament lamp` },
      { label: 'Drawing', value: `${w.toFixed(2)} W, ${amps(p, w)}` },
      { label: 'Standing by', value: idle > 0 ? `${idle.toFixed(1)} W always, ${(idle * 8.76).toFixed(1)} kWh a year` : 'Nothing, it has no radio' },
    ]
  },
}

const ceilingFixture: PartDef = {
  id: 'fixture-ceiling',
  name: 'Ceiling fixture',
  category: 'lighting',
  blurb: 'Ambient light from above, and the switched live that feeds it',
  tags: ['ceiling light', 'pendant', 'downlight', 'fixture', 'luminaire', 'batten', 'lighting', 'room', 'ambient'],
  doc: {
    price: 45,
    description:
      'The light the room already has, which is why it is here: every other fixture in a setup is judged against it. A single 1200 lumen pendant in a 3.5 by 4 metre room is 85 lux at the floor, which is a quarter of what an office is designed to and most of the reason a desk needs its own light.\n\nThe lux figure is the useful one and it is a real calculation: lumens, over the floor area, times a utilisation factor for how much of the light gets there.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'style', label: 'Style', type: 'enum', default: 'pendant', group: 'Fixture',
      options: [{ value: 'pendant', label: 'Pendant on a flex' }, { value: 'flush', label: 'Flush panel' }, { value: 'track', label: 'Track with spots' }],
    },
    { key: 'lamps', label: 'Lamps', type: 'number', unit: '', default: 1, min: 1, max: 8, step: 1, group: 'Fixture' },
    { key: 'watts', label: 'Per lamp', type: 'number', unit: 'W', default: 9, min: 3, max: 40, step: 1, group: 'Fixture' },
    { key: 'drop', label: 'Drop', type: 'number', unit: 'mm', default: 400, min: 0, max: 1800, step: 50, group: 'Fixture', help: 'How far below the ceiling it hangs. Over a desk this is head clearance.' },
    { key: 'roomArea', label: 'Room area', type: 'number', unit: '', default: 14, min: 4, max: 60, step: 1, group: 'Room', help: 'Square metres, for the lux at the floor.' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const style = str(p, 'style', 'pendant')
    const n = Math.round(num(p, 'lamps', 1))
    const drop = num(p, 'drop', 400)
    const on = bool(p, 'on', true)
    const lit = glow(on, 3000, 1.5)
    const out: Solid[] = []
    if (style === 'flush') {
      out.push({ kind: 'cyl', mat: { color: '#E9E7E2', rough: 0.5, density: 1.4 }, r: 160, h: 60, seg: 36, at: [0, -30, 0], chamfer: 8 })
      out.push({ kind: 'cyl', mat: lit, r: 148, h: 6, seg: 36, at: [0, -60, 0], noCollide: true })
    } else if (style === 'track') {
      const l = 300 + n * 160
      out.push({ kind: 'box', mat: { color: '#1C1E22', rough: 0.55, density: 2.7 }, size: [l, 36, 36], at: [0, -18, 0], bevel: 3 })
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 160
        out.push({ kind: 'cyl', mat: { color: '#1C1E22', rough: 0.5, density: 2.7 }, r: 34, h: 90, seg: 22, rot: [30, 0, 0], at: [x, -80, 10] })
        out.push({ kind: 'cyl', mat: lit, r: 30, h: 4, seg: 22, rot: [30, 0, 0], at: [x, -120, 33], noCollide: true })
      }
    } else {
      out.push({ kind: 'cyl', mat: { color: '#D7D5D0', rough: 0.6, density: 1.4 }, r: 50, h: 18, seg: 24, at: [0, -9, 0] })
      out.push({ kind: 'tube', mat: { color: '#1A1A1C', rough: 0.9, density: 1.1 }, r: 3, seg: 8, path: [[0, -18, 0], [0, -drop, 0]] })
      out.push({ kind: 'lathe', mat: { color: '#23262B', rough: 0.5, density: 2.6 }, seg: 32, points: [[1, 0], [120, 0], [116, 10], [60, 130], [26, 150], [26, 160], [1, 160]], at: [0, -drop - 160, 0] })
      out.push({ kind: 'sphere', mat: lit, r: 34, seg: 20, at: [0, -drop - 18, 0] })
    }
    return out
  },
  ports: (p) => {
    const drop = num(p, 'drop', 400)
    const style = str(p, 'style', 'pendant')
    const low = style === 'pendant' ? -drop - 200 : style === 'flush' ? -66 : -126
    return [
      ...mainsPorts([0, -6, 0], [0, 1, 0], '', [8, 0, 0]),
      { id: 'ceiling', label: 'Ceiling rose', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'lowest', label: 'Lowest point', kind: 'mechanical', pos: [0, low, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const n = Math.round(num(p, 'lamps', 1))
    const w = num(p, 'watts', 9)
    return bool(p, 'on', true) ? n * (w + 0.4) : 0.1
  }),
  mass: (p) => {
    const style = str(p, 'style', 'pendant')
    const n = Math.round(num(p, 'lamps', 1))
    return style === 'track' ? 900 + n * 420 : style === 'flush' ? 1400 : 700 + num(p, 'drop', 400) * 0.2
  },
  price: (p) => {
    const n = Math.round(num(p, 'lamps', 1))
    const style = str(p, 'style', 'pendant')
    return (style === 'track' ? 60 : style === 'flush' ? 45 : 28) + n * 16
  },
  readouts: (p) => {
    const n = Math.round(num(p, 'lamps', 1))
    const w = num(p, 'watts', 9)
    const area = num(p, 'roomArea', 14)
    const on = bool(p, 'on', true)
    const lm = on ? n * w * 95 : 0
    // Utilisation factor: about 0.55 of the light from a ceiling fixture
    // reaches the working plane in a normally finished room.
    const lux = (lm * 0.55) / Math.max(1, area)
    const total = on ? n * (w + 0.4) : 0.1
    return [
      { label: 'Output', value: `${lm} lm from ${n} lamp${n === 1 ? '' : 's'}` },
      { label: 'At the floor', value: `${Math.round(lux)} lux over ${area} m²` },
      { label: 'An office wants', value: `300 to 500 lux, so this is ${lux >= 300 ? 'enough' : `${Math.ceil(300 / Math.max(1, lux))}× short`}` },
      { label: 'Drawing', value: `${total.toFixed(1)} W, ${amps(p, total)}` },
      { label: 'Head clearance', value: str(p, 'style', 'pendant') === 'pendant' ? `${Math.round(2400 - num(p, 'drop', 400) - 200)} mm under it, in a 2400 mm room` : 'Flush, nothing to walk into' },
    ]
  },
}

const ledSign: PartDef = {
  id: 'sign-led',
  name: 'LED sign',
  category: 'lighting',
  blurb: 'Flexible neon on a backing board, and twelve watts',
  tags: ['neon sign', 'led neon', 'sign', 'wall light', 'decor', 'cosmetic', 'accent', 'lighting', 'rgb'],
  doc: {
    price: 60,
    description:
      'Cosmetic, and in the catalogue on those terms. What it contributes to a plan is a lit rectangle on a wall with a mass to hang and a 12 V supply to hide, and the supply is the part that gets forgotten until there is a brick dangling behind the desk.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 600, min: 150, max: 1500, step: 10, group: 'Sign' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 300, min: 100, max: 900, step: 10, group: 'Sign' },
    { key: 'tint', label: 'Colour', type: 'color', default: '#FF4FA3', group: 'Sign' },
    {
      key: 'backing', label: 'Backing', type: 'enum', default: 'clear', group: 'Sign',
      options: [{ value: 'clear', label: 'Clear acrylic' }, { value: 'black', label: 'Black acrylic' }, { value: 'cut', label: 'Cut to the outline' }],
    },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const w = num(p, 'width', 600)
    const h = num(p, 'height', 300)
    const tint = str(p, 'tint', '#FF4FA3')
    const on = bool(p, 'on', true)
    const backing = str(p, 'backing', 'clear')
    const out: Solid[] = []
    if (backing !== 'cut') {
      out.push({
        kind: 'box',
        mat: backing === 'black' ? { color: '#0E0F11', rough: 0.3, clearcoat: 0.6, density: 1.2 } : { color: '#C8CCD2', rough: 0.1, clearcoat: 1, density: 1.2, opacity: 0.25, transmission: 0.8 },
        size: [w, h, 5],
        at: [0, h / 2, 0],
      })
    }
    // The tube, as a run of segments that reads as a drawn line.
    const seg = Math.max(3, Math.round(w / 90))
    for (let i = 0; i < seg; i++) {
      const x = -w / 2 + 30 + (i * (w - 60)) / Math.max(1, seg - 1)
      const y = h / 2 + Math.sin((i / seg) * Math.PI * 2) * (h * 0.22)
      out.push({
        kind: 'sphere',
        mat: on ? { color: tint, rough: 0.5, density: 1.2, emissive: tint, emissiveIntensity: 1.3 } : { color: '#D8D5CE', rough: 0.7, density: 1.2 },
        r: 7,
        seg: 14,
        at: [x, y, 8],
      })
    }
    return out
  },
  ports: (p) => {
    const w = num(p, 'width', 600)
    return [
      { id: 'v12', label: '+12 V', kind: 'electrical', pos: [-w / 2 + 10, 8, -6], dir: [0, 0, -1], role: 'power', imax: 2, solderable: false },
      { id: 'gnd', label: 'Return', kind: 'electrical', pos: [-w / 2 + 22, 8, -6], dir: [0, 0, -1], role: 'gnd', imax: 2, solderable: false },
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, 0, -3], dir: [0, 0, -1], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      // Flexible neon runs about 8 W a metre of tube; the tube in a sign is
      // roughly twice the width of it once the lettering is counted.
      const tube = (num(p, 'width', 600) / 1000) * 2
      const w = bool(p, 'on', true) ? Math.max(0.5, tube * 8) : 0.05
      return [{ type: 'resistor', a: 'v12', b: 'gnd', r: 144 / w } as DeviceModel]
    },
    limits: { vmax: 24 },
  },
  mass: (p) => (num(p, 'width', 600) * num(p, 'height', 300)) / 1000 * 2.6,
  price: (p) => 25 + (num(p, 'width', 600) * num(p, 'height', 300)) / 10000 * 1.6,
  readouts: (p) => {
    const tube = (num(p, 'width', 600) / 1000) * 2
    const w = bool(p, 'on', true) ? Math.max(0.5, tube * 8) : 0.05
    return [
      { label: 'Wall area', value: `${num(p, 'width', 600)} × ${num(p, 'height', 300)} mm` },
      { label: 'Tube', value: `${tube.toFixed(1)} m at 8 W a metre` },
      { label: 'Drawing', value: `${w.toFixed(1)} W, ${(w / 12).toFixed(2)} A at 12 V` },
      { label: 'Needs', value: `a ${Math.ceil((w * 1.3) / 6) * 6} W 12 V supply, hidden somewhere` },
    ]
  },
}

/* Signal-only, but it belongs with the fixtures it switches. */
const dimmer: PartDef = {
  id: 'dimmer-wall',
  name: 'Wall dimmer',
  category: 'lighting',
  blurb: 'A switched live, phase cut, and a minimum load',
  tags: ['dimmer', 'switch', 'trailing edge', 'phase cut', 'wall switch', 'lighting', 'mains', '0-10v', 'control'],
  doc: {
    price: 24,
    description:
      'The part that explains flickering LEDs. A mains dimmer cuts the waveform, and a trailing-edge one has a minimum load — typically 10 W — below which it cannot hold a stable firing point. Two 5 W bulbs on a 10 W minimum dimmer flicker, and the fault is the dimmer, not the bulbs.\n\nA 0-10 V output instead drives an LED driver directly, which is the right answer when the load is strip.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'kind', label: 'Type', type: 'enum', default: 'trailing', group: 'Dimmer',
      options: [
        { value: 'leading', label: 'Leading edge, for filament' },
        { value: 'trailing', label: 'Trailing edge, for LED' },
        { value: '0-10', label: '0-10 V, drives a driver' },
      ],
    },
    { key: 'minLoad', label: 'Minimum load', type: 'number', unit: 'W', default: 10, min: 0, max: 60, step: 1, group: 'Dimmer' },
    { key: 'maxLoad', label: 'Maximum load', type: 'number', unit: 'W', default: 250, min: 25, max: 1000, step: 25, group: 'Dimmer' },
    { key: 'connected', label: 'Load connected', type: 'number', unit: 'W', default: 36, min: 0, max: 1000, step: 1, group: 'Control' },
    { key: 'set', label: 'Set to', type: 'number', unit: '%', default: 70, min: 0, max: 100, step: 5, group: 'Control' },
  ],
  solids: () => [
    { kind: 'box', mat: { color: '#F0EEE9', rough: 0.5, density: 1.4 }, size: [86, 86, 12], at: [0, 43, 6], bevel: 3 },
    { kind: 'cyl', mat: { color: '#E4E2DD', rough: 0.45, density: 1.4 }, r: 22, h: 14, seg: 28, rot: [90, 0, 0], at: [0, 43, 18], chamfer: 2 },
    { kind: 'box', mat: DARK, size: [3, 10, 2], at: [0, 58, 25], noCollide: true },
    { kind: 'box', mat: { color: '#C9C7C2', rough: 0.6, density: 1.4 }, size: [70, 70, 35], at: [0, 43, -14] },
  ],
  ports: (p) => {
    const out: Port[] = [
      ...mainsPorts([0, 20, -32], [0, 0, -1], '', [11, 0, 0]),
      { id: 'sl', label: 'Switched live', kind: 'electrical', pos: [0, 60, -32], dir: [0, 0, -1], role: 'power', imax: 6, solderable: false },
    ]
    if (str(p, 'kind', 'trailing') === '0-10') {
      out.push(...signalPorts([['ctrl', '0-10 V out']], [26, 60, -32], [0, 0, -1], 18))
    }
    out.push({ id: 'wall', label: 'Back box', kind: 'mechanical', pos: [0, 0, -30], dir: [0, 0, -1], mate: { type: 'face' } })
    return out
  },
  electrical: {
    /*
     * A dimmer is a switch with a conduction angle: live to switched live
     * through a resistance that rises as the setting falls. The solver is DC,
     * so the phase cut is modelled as the equivalent resistance that passes
     * the same mean power, which is what every reading in this tool is
     * after anyway.
     */
    devices: (p) => {
      const set = num(p, 'set', 100) / 100
      const v = volts(p)
      const connected = Math.max(0.5, num(p, 'connected', 36))
      const wanted = connected * set
      const rLoad = (v * v) / connected
      const rTotal = set > 0.01 ? (v * v) / Math.max(0.1, wanted) : 1e7
      return [
        { type: 'resistor', a: 'l', b: 'sl', r: Math.max(0.2, rTotal - rLoad) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
    },
    supplies: ['sl'],
    limits: { vmax: 400, pmax: 1000 },
  },
  mass: () => 140,
  price: (p) => (str(p, 'kind', 'trailing') === '0-10' ? 38 : 22),
  readouts: (p) => {
    const kind = str(p, 'kind', 'trailing')
    const min = num(p, 'minLoad', 10)
    const max = num(p, 'maxLoad', 250)
    const connected = num(p, 'connected', 36)
    const set = num(p, 'set', 70)
    return [
      { label: 'Range', value: kind === '0-10' ? 'No minimum, it is a signal' : `${min} to ${max} W` },
      { label: 'Connected', value: `${connected} W` },
      {
        label: 'Verdict',
        value:
          kind === '0-10'
            ? 'Fine, the driver does the dimming'
            : connected < min
              ? `Under the minimum by ${(min - connected).toFixed(0)} W, expect flicker`
              : connected > max
                ? `Over the maximum by ${(connected - max).toFixed(0)} W`
                : 'Within range',
      },
      { label: 'Passing', value: `${((connected * set) / 100).toFixed(1)} W at ${set}%, ${amps(p, (connected * set) / 100)}` },
      { label: 'Suits', value: kind === 'leading' ? 'Filament and wound transformers' : kind === 'trailing' ? 'LED and electronic drivers' : 'Constant-voltage LED drivers' },
    ]
  },
}

registerParts([cobStrip, ledDriver, monitorLightBar, keyLight, smartBulb, ceilingFixture, ledSign, dimmer])
