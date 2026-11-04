import type { DeviceModel, PartDef, Port, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, REGION_PARAM, STEEL, amps, load, mainsPorts } from './setup'
import { BLACK_PLASTIC, SOFT, signalPorts } from './setup2'
import { usbLoad, usbPorts } from './peripherals'

/**
 * Everything that makes or carries sound.
 *
 * Two questions run through this file and neither is answered anywhere else
 * in the catalogue.
 *
 *   Geometry. A pair of monitors is not placed where there is room for it:
 *   the speakers and your head make an equilateral triangle, the tweeters
 *   sit at ear height, and the front baffle wants to be off the wall. Those
 *   are dimensions, the desk already has dimensions, and the two constraints
 *   either meet or they do not.
 *
 *   Phantom power. A condenser microphone needs 48 V up the same pair the
 *   signal comes down, and the thing that supplies it is the interface. A
 *   bus-powered interface has to make that 48 V out of 5 V, which is why a
 *   phantom channel on a laptop port is where the noise comes from.
 *
 * Conventions are `setup.ts`: mains as l/n/e, loads in watts, signal ports
 * that carry no current. USB power uses `vbus` and `gnd` from
 * `peripherals.ts`, so one lead reaches any of it.
 */

const CONE = { color: '#15171A', rough: 0.85, density: 0.6 }
const MDF = { color: '#1D1E21', rough: 0.78, density: 0.75 }
const MESH = { color: '#8E949C', metal: 1, rough: 0.55, density: 7.8 }

/* ================================================================== */
/* Monitors                                                            */
/* ================================================================== */

const studioMonitor: PartDef = {
  id: 'monitor-studio',
  name: 'Studio monitor',
  category: 'audio',
  blurb: 'An active nearfield, which has to be placed rather than put',
  tags: ['studio monitor', 'speaker', 'nearfield', 'active speaker', 'monitor', 'audio', 'desk', 'setup', 'mixing'],
  doc: {
    price: 320,
    description:
      'An active two-way nearfield. Each one is its own amplifier and its own mains load, which is the half people forget: a pair of 5 inch monitors is two plugs and 120 W of amplifier, idling at 12 W each all day.\n\nThe placement readouts are the reason it is parametric. The tweeter has to be at ear height, which for a 740 mm desk and a 470 mm seat is around 1150 mm off the floor and nearly always means a stand or a riser rather than the desk top. The pair and your head make an equilateral triangle, so the spacing sets the listening distance and the distance sets the spacing.',
  },
  params: [
    REGION_PARAM,
    { key: 'driver', label: 'Woofer', type: 'enum', default: '5', group: 'Monitor', options: ['3', '5', '7', '8'].map((v) => ({ value: v, label: `${v}" cone` })) },
    { key: 'spacing', label: 'Pair spacing', type: 'number', unit: 'mm', default: 1100, min: 500, max: 2500, step: 50, group: 'Placement', help: 'Tweeter to tweeter. The triangle says your ears sit the same distance back.' },
    { key: 'earHeight', label: 'Ear height', type: 'number', unit: 'mm', default: 1150, min: 900, max: 1400, step: 10, group: 'Placement' },
    { key: 'port', label: 'Port', type: 'enum', default: 'rear', group: 'Monitor', options: [{ value: 'rear', label: 'Rear ported' }, { value: 'front', label: 'Front ported' }] },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
    { key: 'level', label: 'Driven', type: 'number', unit: '%', default: 15, min: 0, max: 100, step: 5, group: 'Control', help: 'Average output, not peak. Monitors spend their life under 20%.' },
  ],
  solids: (p) => {
    const inches = parseInt(str(p, 'driver', '5'), 10) || 5
    const coneR = (inches * 25.4) / 2
    const w = coneR * 2 + 46
    const h = w * 1.62
    const d = w * 1.1
    const out: Solid[] = [
      { kind: 'box', mat: MDF, size: [w, h, d], at: [0, h / 2, 0], bevel: 6 },
      // Woofer: surround, cone, dust cap.
      { kind: 'cyl', mat: { color: '#0E0F11', rough: 0.9, density: 1.1 }, r: coneR + 8, h: 6, seg: 32, rot: [90, 0, 0], at: [0, h * 0.33, d / 2 + 1] },
      { kind: 'cyl', mat: CONE, r: coneR, r2: coneR * 0.3, h: 26, seg: 32, rot: [-90, 0, 0], at: [0, h * 0.33, d / 2 - 12] },
      { kind: 'sphere', mat: CONE, r: coneR * 0.3, seg: 18, at: [0, h * 0.33, d / 2 - 2] },
      // Tweeter in its waveguide, at the top where ear height is measured.
      { kind: 'cyl', mat: { color: '#101113', rough: 0.8, density: 1.1 }, r: 26, h: 10, seg: 24, rot: [90, 0, 0], at: [0, h * 0.78, d / 2 - 2] },
      { kind: 'sphere', mat: { color: '#C9CDD3', metal: 0.8, rough: 0.35, density: 2.7 }, r: 13, seg: 18, at: [0, h * 0.78, d / 2 + 1] },
    ]
    if (str(p, 'port', 'rear') === 'front') {
      out.push({ kind: 'cyl', mat: DARK, r: coneR * 0.5, h: 30, seg: 20, rot: [90, 0, 0], at: [0, h * 0.12, d / 2 - 14] })
    } else {
      out.push({ kind: 'cyl', mat: DARK, r: coneR * 0.5, h: 30, seg: 20, rot: [90, 0, 0], at: [0, h * 0.6, -d / 2 + 14] })
    }
    return out
  },
  ports: (p) => {
    const inches = parseInt(str(p, 'driver', '5'), 10) || 5
    const coneR = (inches * 25.4) / 2
    const w = coneR * 2 + 46
    const h = w * 1.62
    const d = w * 1.1
    return [
      ...mainsPorts([-w / 5, h * 0.2, -d / 2], [0, 0, -1], '', [10, 0, 0]),
      ...signalPorts([['xlr', 'XLR in'], ['trs', 'TRS in']], [w / 5, h * 0.2, -d / 2], [0, 0, -1], 22),
      { id: 'base', label: 'Base', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const inches = parseInt(str(p, 'driver', '5'), 10) || 5
    // Class D amplifier: about 11 W of rated output per inch of woofer, drawn
    // in proportion to level, over an idle that never goes away.
    const rated = inches * 11
    const idle = 8 + inches * 0.8
    return bool(p, 'on', true) ? idle + (rated * num(p, 'level', 15)) / 100 / 0.82 : 0.4
  }),
  mass: (p) => {
    const inches = parseInt(str(p, 'driver', '5'), 10) || 5
    return 2200 + inches * 1150
  },
  price: (p) => {
    const inches = parseInt(str(p, 'driver', '5'), 10) || 5
    return 120 + inches * 48
  },
  readouts: (p) => {
    const inches = parseInt(str(p, 'driver', '5'), 10) || 5
    const spacing = num(p, 'spacing', 1100)
    const rated = inches * 11
    const idle = 8 + inches * 0.8
    const w = bool(p, 'on', true) ? idle + (rated * num(p, 'level', 15)) / 100 / 0.82 : 0.4
    // An equilateral triangle: ears the same distance back as the pair is wide.
    const back = spacing * 0.866
    const coneR = (inches * 25.4) / 2
    const cabW = coneR * 2 + 46
    return [
      { label: 'Amplifier', value: `${rated} W rated, ${idle.toFixed(1)} W idle` },
      { label: 'Drawing now', value: `${w.toFixed(1)} W, ${amps(p, w)} — each` },
      { label: 'Triangle', value: `${spacing} mm apart puts your ears ${Math.round(back)} mm back` },
      { label: 'Tweeter at', value: `${num(p, 'earHeight', 1150)} mm, so the cabinet base sits at ${Math.round(num(p, 'earHeight', 1150) - cabW * 1.62 * 0.78)} mm` },
      { label: 'Off the wall', value: str(p, 'port', 'rear') === 'rear' ? `${Math.round(cabW * 1.1 * 0.5 + 80)} mm clear behind, it is rear ported` : 'Can go against the wall, it is front ported' },
    ]
  },
}

const subwoofer: PartDef = {
  id: 'subwoofer-desk',
  name: 'Subwoofer',
  category: 'audio',
  blurb: 'A box under the desk with a crossover and 200 W behind it',
  tags: ['subwoofer', 'sub', 'bass', 'speaker', 'audio', 'crossover', 'under desk', 'setup', '2.1'],
  doc: {
    price: 380,
    description:
      'Under the desk, where it takes the footwell. Two numbers come out of it: the floor area it occupies, which is the one that conflicts with a chair base and a tower, and the crossover frequency, which has to sit at or below where the monitors above it start rolling off.',
  },
  params: [
    REGION_PARAM,
    { key: 'driver', label: 'Driver', type: 'enum', default: '8', group: 'Sub', options: ['6', '8', '10', '12'].map((v) => ({ value: v, label: `${v}" cone` })) },
    { key: 'crossover', label: 'Crossover', type: 'number', unit: 'Hz', default: 80, min: 40, max: 160, step: 5, group: 'Sub' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
    { key: 'level', label: 'Driven', type: 'number', unit: '%', default: 20, min: 0, max: 100, step: 5, group: 'Control' },
  ],
  solids: (p) => {
    const inches = parseInt(str(p, 'driver', '8'), 10) || 8
    const s = inches * 25.4 + 90
    const coneR = (inches * 25.4) / 2
    return [
      { kind: 'box', mat: MDF, size: [s, s, s], at: [0, s / 2 + 20, 0], bevel: 8 },
      { kind: 'cyl', mat: { color: '#0E0F11', rough: 0.9, density: 1.1 }, r: coneR + 10, h: 8, seg: 32, rot: [90, 0, 0], at: [0, s / 2 + 20, s / 2 + 1] },
      { kind: 'cyl', mat: CONE, r: coneR, r2: coneR * 0.35, h: 40, seg: 32, rot: [-90, 0, 0], at: [0, s / 2 + 20, s / 2 - 20] },
      { kind: 'cyl', mat: DARK, r: coneR * 0.55, h: 40, seg: 22, rot: [90, 0, 0], at: [0, s * 0.3, -s / 2 + 20] },
      // Feet, which is why it is 20 mm off the floor.
      ...([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => ({
          kind: 'cyl' as const, mat: { color: '#1A1B1E', rough: 0.95, density: 1.2 }, r: 14, h: 20, seg: 14,
          at: [sx * (s / 2 - 26), 10, sz * (s / 2 - 26)] as [number, number, number],
        })),
      ),
    ]
  },
  ports: (p) => {
    const inches = parseInt(str(p, 'driver', '8'), 10) || 8
    const s = inches * 25.4 + 90
    return [
      ...mainsPorts([-s / 5, s * 0.6, -s / 2], [0, 0, -1], '', [11, 0, 0]),
      ...signalPorts([['in', 'Line in'], ['out', 'High-pass out']], [s / 5, s * 0.6, -s / 2], [0, 0, -1], 24),
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const inches = parseInt(str(p, 'driver', '8'), 10) || 8
    const rated = inches * 25
    return bool(p, 'on', true) ? 14 + (rated * num(p, 'level', 20)) / 100 / 0.8 : 0.5
  }),
  mass: (p) => {
    const inches = parseInt(str(p, 'driver', '8'), 10) || 8
    return 6000 + inches * 1400
  },
  price: (p) => 120 + (parseInt(str(p, 'driver', '8'), 10) || 8) * 32,
  readouts: (p) => {
    const inches = parseInt(str(p, 'driver', '8'), 10) || 8
    const s = inches * 25.4 + 90
    const rated = inches * 25
    const w = bool(p, 'on', true) ? 14 + (rated * num(p, 'level', 20)) / 100 / 0.8 : 0.5
    const f = num(p, 'crossover', 80)
    return [
      { label: 'Footwell taken', value: `${Math.round(s)} × ${Math.round(s)} mm` },
      { label: 'Amplifier', value: `${rated} W rated` },
      { label: 'Drawing now', value: `${w.toFixed(1)} W, ${amps(p, w)}` },
      { label: 'Crossover', value: `${f} Hz, a ${(343000 / f / 4).toFixed(0)} mm quarter wavelength` },
    ]
  },
}

/* ================================================================== */
/* The signal chain                                                    */
/* ================================================================== */

const audioInterface: PartDef = {
  id: 'interface-audio',
  name: 'Audio interface',
  category: 'audio',
  blurb: 'Two preamps, and 48 V made out of a 5 V bus',
  tags: ['audio interface', 'interface', 'preamp', 'xlr', 'phantom', '48v', 'adc', 'usb audio', 'recording', 'podcast'],
  doc: {
    price: 190,
    description:
      'The box everything else in the chain plugs into. It is bus powered, so the whole of it — two microphone preamps, the converters, the headphone amplifier and a 48 V phantom rail made by a boost converter — comes out of one 5 V port.\n\nThat is the point of having it here. Phantom power on both channels adds about 0.6 W at the bus, and a headphone load adds more; on a laptop port shared with a hub, that is where the noise floor comes from.',
  },
  params: [
    {
      key: 'channels', label: 'Inputs', type: 'enum', default: '2', group: 'Interface',
      options: [{ value: '1', label: 'One mic input' }, { value: '2', label: 'Two mic inputs' }, { value: '4', label: 'Four, two mic two line' }],
    },
    { key: 'phantom', label: 'Phantom 48 V', type: 'bool', default: true, group: 'Interface', help: 'A condenser microphone needs it. A dynamic one does not and does not mind.' },
    { key: 'rate', label: 'Sample rate', type: 'enum', default: '48', group: 'Interface', options: ['44.1', '48', '96', '192'].map((v) => ({ value: v, label: `${v} kHz` })) },
    { key: 'headphones', label: 'Headphone load', type: 'enum', default: '250', group: 'Control', options: ['32', '80', '250', '600'].map((v) => ({ value: v, label: `${v} Ω` })) },
  ],
  solids: (p) => {
    const ch = parseInt(str(p, 'channels', '2'), 10) || 2
    const w = 70 + ch * 40
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#B4342C', rough: 0.45, density: 2.2 }, size: [w, 48, 110], at: [0, 24, 0], bevel: 5 },
      { kind: 'box', mat: DARK, size: [w - 10, 40, 3], at: [0, 24, 55] },
    ]
    for (let i = 0; i < Math.min(ch, 2); i++) {
      const x = (i - (Math.min(ch, 2) - 1) / 2) * 40
      // A combo jack: XLR shell with a quarter-inch hole in the middle of it.
      out.push({ kind: 'cyl', mat: MESH, r: 13, h: 10, seg: 22, rot: [90, 0, 0], at: [x, 24, 56] })
      out.push({ kind: 'cyl', mat: DARK, r: 6.5, h: 12, seg: 18, rot: [90, 0, 0], at: [x, 24, 57] })
      out.push({ kind: 'cyl', mat: { color: '#2A2C30', rough: 0.4, density: 1.3 }, r: 11, h: 14, seg: 22, at: [x, 55, -20] })
    }
    out.push({ kind: 'cyl', mat: { color: '#2A2C30', rough: 0.4, density: 1.3 }, r: 15, h: 16, seg: 26, at: [w / 2 - 22, 56, -20] })
    return out
  },
  ports: (p) => {
    const ch = parseInt(str(p, 'channels', '2'), 10) || 2
    const w = 70 + ch * 40
    const out: Port[] = [...usbPorts([-w / 2 + 14, 24, -56], [0, 0, -1], 1)]
    for (let i = 0; i < Math.min(ch, 2); i++) {
      const x = (i - (Math.min(ch, 2) - 1) / 2) * 40
      out.push({
        id: `in${i + 1}`, label: `Mic ${i + 1} XLR`, kind: 'electrical',
        pos: [x, 24, 62], dir: [0, 0, 1], role: 'analog', imax: 0.02, solderable: false,
      })
    }
    out.push(...signalPorts([['outl', 'Out L'], ['outr', 'Out R'], ['hp', 'Headphones']], [w / 6, 24, -56], [0, 0, -1], 18))
    out.push({ id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: usbLoad(
    (p) => {
      const ch = parseInt(str(p, 'channels', '2'), 10) || 2
      const rate = parseFloat(str(p, 'rate', '48')) || 48
      // Converters cost power with rate; phantom costs 0.3 W a channel at
      // the bus once the boost converter's losses are counted.
      const base = 0.9 + ch * 0.22 + (rate > 96 ? 0.35 : rate > 48 ? 0.18 : 0)
      const phantom = bool(p, 'phantom', true) ? Math.min(ch, 2) * 0.3 : 0
      const hp = 125 / (parseInt(str(p, 'headphones', '250'), 10) || 250) / 1000 + 0.15
      return base + phantom + hp
    },
    (p) =>
      // Phantom is a real 48 V rail with 6.8k feed resistors on each leg; the
      // microphone sees 48 V through 3.4k, which is why it can only have 10 mA.
      bool(p, 'phantom', true)
        ? (Array.from({ length: Math.min(parseInt(str(p, 'channels', '2'), 10) || 2, 2) }, (_, i) => ({
            type: 'vsource' as const, v: 48, a: `in${i + 1}`, b: 'gnd', rint: 3400,
          })) as DeviceModel[])
        : [],
  ),
  mass: (p) => 400 + (parseInt(str(p, 'channels', '2'), 10) || 2) * 90,
  price: (p) => {
    const ch = parseInt(str(p, 'channels', '2'), 10) || 2
    return ch <= 1 ? 120 : ch <= 2 ? 190 : 330
  },
  readouts: (p) => {
    const ch = parseInt(str(p, 'channels', '2'), 10) || 2
    const rate = parseFloat(str(p, 'rate', '48')) || 48
    const z = parseInt(str(p, 'headphones', '250'), 10) || 250
    const base = 0.9 + ch * 0.22 + (rate > 96 ? 0.35 : rate > 48 ? 0.18 : 0)
    const phantom = bool(p, 'phantom', true) ? Math.min(ch, 2) * 0.3 : 0
    const hp = 125 / z / 1000 + 0.15
    const total = base + phantom + hp
    return [
      { label: 'Bus draw', value: `${total.toFixed(2)} W, ${Math.round((total / 5) * 1000)} mA at 5 V` },
      { label: 'Of a USB 3 port', value: `${Math.round((total / 5 / 0.9) * 100)}% of 900 mA` },
      { label: 'Phantom', value: bool(p, 'phantom', true) ? `48 V through 6.8k a leg, 10 mA a channel` : 'Off' },
      { label: 'Latency floor', value: `${((128 / (rate * 1000)) * 1000).toFixed(1)} ms at a 128 sample buffer` },
    ]
  },
}

const condenserMic: PartDef = {
  id: 'mic-condenser',
  name: 'Condenser microphone',
  category: 'audio',
  blurb: 'A capsule that needs feeding, on a body that needs clearance',
  tags: ['microphone', 'mic', 'condenser', 'xlr', 'usb mic', 'phantom', 'cardioid', 'podcast', 'stream', 'recording'],
  doc: {
    price: 170,
    description:
      'A large-diaphragm condenser. Two things about it are design constraints rather than taste: it needs 48 V phantom from whatever it is plugged into, and it has to end up 150 to 250 mm from your mouth, which is a position in space, not a shelf. Those two put the arm and the interface in the build with it.\n\nThe USB variants are the same capsule with the interface inside, which moves the load from an XLR pair to the 5 V bus.',
  },
  params: [
    {
      key: 'link', label: 'Output', type: 'enum', default: 'xlr', group: 'Microphone',
      options: [{ value: 'xlr', label: 'XLR, needs phantom' }, { value: 'usb', label: 'USB, interface inside' }],
    },
    {
      key: 'pattern', label: 'Pattern', type: 'enum', default: 'cardioid', group: 'Microphone',
      options: [{ value: 'cardioid', label: 'Cardioid' }, { value: 'omni', label: 'Omnidirectional' }, { value: 'fig8', label: 'Figure of eight' }],
    },
    { key: 'shock', label: 'Shock mount', type: 'bool', default: true, group: 'Mount' },
    { key: 'distance', label: 'Working distance', type: 'number', unit: 'mm', default: 180, min: 50, max: 600, step: 10, group: 'Mount', help: 'Capsule to mouth. Past 300 mm the room is louder than you are.' },
  ],
  solids: (p) => {
    const usb = str(p, 'link', 'xlr') === 'usb'
    const out: Solid[] = [
      { kind: 'cyl', mat: { color: '#23262B', rough: 0.4, density: 2.6 }, r: 24, h: 120, seg: 28, at: [0, 60, 0], chamfer: 3 },
      { kind: 'cyl', mat: MESH, r: 25, h: 46, seg: 28, at: [0, 142, 0] },
      { kind: 'cyl', mat: { color: '#D4AF52', metal: 1, rough: 0.4, density: 8.4 }, r: 17, h: 3, seg: 24, at: [0, 142, 9] },
    ]
    if (bool(p, 'shock', true)) {
      out.push({ kind: 'torus', mat: BLACK_PLASTIC, r: 46, tube: 5, seg: 28, rot: [90, 0, 0], at: [0, 96, 0] })
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        out.push({ kind: 'tube', mat: { color: '#2E3135', rough: 0.9, density: 1.1 }, r: 1.4, seg: 6, path: [[Math.cos(a) * 44, 96, Math.sin(a) * 44], [Math.cos(a) * 24, 80, Math.sin(a) * 24]] })
      }
    }
    out.push({ kind: 'cyl', mat: usb ? ALU : MESH, r: 11, h: 22, seg: 20, at: [0, 10, 0] })
    return out
  },
  ports: (p) => {
    const usb = str(p, 'link', 'xlr') === 'usb'
    const out: Port[] = [{ id: 'mount', label: 'Thread, 5/8"', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'thread', size: 15.9 } }]
    if (usb) out.push(...usbPorts([0, 6, -12], [0, 0, -1], 0.5))
    else {
      out.push({ id: 'hot', label: 'XLR 2, hot', kind: 'electrical', pos: [-4, 2, -12], dir: [0, -1, 0], role: 'analog', imax: 0.02, solderable: false })
      out.push({ id: 'cold', label: 'XLR 3, cold', kind: 'electrical', pos: [4, 2, -12], dir: [0, -1, 0], role: 'analog', imax: 0.02, solderable: false })
      out.push({ id: 'shield', label: 'XLR 1, shield', kind: 'electrical', pos: [0, 2, -16], dir: [0, -1, 0], role: 'shield', imax: 0.02, solderable: false })
    }
    return out
  },
  electrical: {
    devices: (p) =>
      str(p, 'link', 'xlr') === 'usb'
        ? [{ type: 'resistor', a: 'vbus', b: 'gnd', r: 25 / 0.45 }]
        : /*
           * A phantom-powered capsule, as the supply sees it: the head
           * amplifier draws about 4 mA from each leg, which is what both
           * 6.8k feed resistors are sized around. Hot and cold are loaded
           * equally, because that symmetry is the whole reason a balanced
           * pair rejects hum.
           */
          [
            { type: 'resistor', a: 'hot', b: 'shield', r: 12000 },
            { type: 'resistor', a: 'cold', b: 'shield', r: 12000 },
          ],
    limits: { vmax: 60 },
  },
  mass: () => 480,
  price: (p) => (str(p, 'link', 'xlr') === 'usb' ? 140 : 180) + (bool(p, 'shock', true) ? 25 : 0),
  readouts: (p) => {
    const d = num(p, 'distance', 180)
    const pattern = str(p, 'pattern', 'cardioid')
    return [
      { label: 'Working distance', value: `${d} mm` },
      {
        label: 'Proximity',
        value:
          pattern === 'omni'
            ? 'None, it is omnidirectional'
            : `${d < 120 ? 'Heavy' : d < 220 ? 'Useful' : 'Gone'} bass lift at ${d} mm`,
      },
      { label: 'Needs', value: str(p, 'link', 'xlr') === 'usb' ? '0.45 W from the bus' : '48 V phantom, 4 mA a leg' },
      { label: 'Height to capsule', value: `${bool(p, 'shock', true) ? 165 : 142} mm above its mount` },
    ]
  },
}

const boomArm: PartDef = {
  id: 'arm-mic-boom',
  name: 'Microphone boom arm',
  category: 'audio',
  blurb: 'Two links that swing a circle over the desk',
  tags: ['boom arm', 'mic arm', 'microphone stand', 'desk clamp', 'arm', 'audio', 'stream', 'podcast', 'mount'],
  doc: {
    price: 95,
    description:
      'A clamp and two links. What it is for, dimensionally, is putting a 500 g microphone 180 mm from your mouth without anything standing on the desk, and the thing that decides whether it can is reach — the two links added together against the distance from the clamp to where your head is.\n\nIt also sweeps. A 400 plus 400 arm swings an 800 mm circle around its clamp, and everything on the desk inside that circle is something the arm hits.',
  },
  params: [
    { key: 'link1', label: 'Lower link', type: 'number', unit: 'mm', default: 400, min: 200, max: 600, step: 10, group: 'Arm' },
    { key: 'link2', label: 'Upper link', type: 'number', unit: 'mm', default: 400, min: 200, max: 600, step: 10, group: 'Arm' },
    { key: 'riser', label: 'Clamp riser', type: 'number', unit: 'mm', default: 260, min: 0, max: 500, step: 10, group: 'Arm' },
    { key: 'payload', label: 'Microphone mass', type: 'number', unit: 'g', default: 500, min: 100, max: 1500, step: 50, group: 'Load' },
    {
      key: 'mount', label: 'Mount', type: 'enum', default: 'clamp', group: 'Mount',
      options: [{ value: 'clamp', label: 'Desk clamp' }, { value: 'grommet', label: 'Through a grommet hole' }],
    },
    { key: 'extend', label: 'Extended', type: 'number', unit: '%', default: 70, min: 10, max: 100, step: 5, group: 'Load', help: 'How far out it is reaching, which is what sets the moment on the clamp.' },
  ],
  solids: (p) => {
    const l1 = num(p, 'link1', 400)
    const l2 = num(p, 'link2', 400)
    const riser = num(p, 'riser', 260)
    const ext = num(p, 'extend', 70) / 100
    const out: Solid[] = []
    if (str(p, 'mount', 'clamp') === 'clamp') {
      out.push({ kind: 'box', mat: STEEL, size: [50, 70, 24], at: [0, 35, 0], bevel: 3 })
      out.push({ kind: 'box', mat: STEEL, size: [50, 12, 60], at: [0, 6, 30], bevel: 3 })
      out.push({ kind: 'cyl', mat: STEEL, r: 9, h: 40, seg: 14, at: [0, -16, 30] })
    } else {
      out.push({ kind: 'cyl', mat: STEEL, r: 22, h: 14, seg: 20, at: [0, 7, 0] })
    }
    out.push({ kind: 'cyl', mat: STEEL, r: 11, h: riser, seg: 16, at: [0, riser / 2 + 14, 0] })
    // The two links, swung out by the extension. Spring arms carry their
    // springs on the outside, which is most of what they look like.
    const a1 = (1 - ext) * 55 + 12
    const a2 = -(1 - ext) * 40 - 20
    out.push({ kind: 'box', mat: STEEL, size: [14, l1, 22], at: [0, riser + 14 + (l1 / 2) * Math.cos((a1 * Math.PI) / 180), (l1 / 2) * Math.sin((a1 * Math.PI) / 180)], rot: [a1, 0, 0], bevel: 2 })
    const jx = riser + 14 + l1 * Math.cos((a1 * Math.PI) / 180)
    const jz = l1 * Math.sin((a1 * Math.PI) / 180)
    out.push({ kind: 'cyl', mat: { color: '#24262A', rough: 0.5, density: 2 }, r: 14, h: 26, seg: 18, rot: [0, 0, 90], at: [0, jx, jz] })
    out.push({ kind: 'box', mat: STEEL, size: [14, l2, 22], at: [0, jx + (l2 / 2) * Math.cos((a2 * Math.PI) / 180), jz + (l2 / 2) * Math.sin((a2 * Math.PI) / 180)], rot: [a2, 0, 0], bevel: 2 })
    return out
  },
  ports: (p) => {
    const l1 = num(p, 'link1', 400)
    const l2 = num(p, 'link2', 400)
    const riser = num(p, 'riser', 260)
    const ext = num(p, 'extend', 70) / 100
    const a1 = (1 - ext) * 55 + 12
    const a2 = -(1 - ext) * 40 - 20
    const jx = riser + 14 + l1 * Math.cos((a1 * Math.PI) / 180)
    const jz = l1 * Math.sin((a1 * Math.PI) / 180)
    return [
      { id: 'tip', label: 'Thread, 5/8"', kind: 'mechanical', pos: [0, jx + l2 * Math.cos((a2 * Math.PI) / 180), jz + l2 * Math.sin((a2 * Math.PI) / 180)], dir: [0, 1, 0], mate: { type: 'stud', size: 15.9 } },
      { id: 'clamp', label: 'Desk edge', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => 900 + (num(p, 'link1', 400) + num(p, 'link2', 400)) * 1.1,
  price: (p) => 55 + (num(p, 'link1', 400) + num(p, 'link2', 400)) * 0.05,
  readouts: (p) => {
    const l1 = num(p, 'link1', 400)
    const l2 = num(p, 'link2', 400)
    const ext = num(p, 'extend', 70) / 100
    const payload = num(p, 'payload', 500)
    const reach = (l1 + l2) * ext
    // Moment at the clamp: the microphone at its reach, plus the arm's own
    // mass taken as acting at half of it.
    const armMass = 900 + (l1 + l2) * 1.1
    const moment = ((payload * reach) / 1000 + (armMass * reach) / 2 / 1000) * 9.81e-3
    return [
      { label: 'Reach now', value: `${Math.round(reach)} mm of ${l1 + l2} mm folded out` },
      { label: 'Swing circle', value: `${Math.round((l1 + l2) * 2)} mm across the clamp` },
      { label: 'Moment at the clamp', value: `${moment.toFixed(1)} N·m` },
      { label: 'Clamp needs', value: moment > 6 ? 'A through-grommet mount, this is past a clamp' : 'A desk thicker than 20 mm' },
    ]
  },
}

const headphoneStand: PartDef = {
  id: 'stand-headphone',
  name: 'Headphone stand',
  category: 'audio',
  blurb: 'A hook with a yoke, and 120 mm of desk for it',
  tags: ['headphone stand', 'headset stand', 'hook', 'desk', 'stand', 'audio', 'accessory', 'tidy', 'cosmetic'],
  doc: {
    price: 35,
    description:
      'Takes a 120 mm square of desk and gives back the 300 by 200 the headphones were lying in. The yoke has to be wide enough not to crush the headband, which is 110 mm for most full-size pairs, and the hook has to be high enough to keep the cups off the desk.',
  },
  params: [
    {
      key: 'style', label: 'Style', type: 'enum', default: 'post', group: 'Stand',
      options: [{ value: 'post', label: 'Post on a base' }, { value: 'hook', label: 'Under-desk hook' }, { value: 'wood', label: 'Wood and aluminium' }],
    },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 280, min: 120, max: 400, step: 10, group: 'Stand' },
    { key: 'yoke', label: 'Yoke width', type: 'number', unit: 'mm', default: 110, min: 70, max: 160, step: 5, group: 'Stand' },
  ],
  solids: (p) => {
    const h = num(p, 'height', 280)
    const yoke = num(p, 'yoke', 110)
    const style = str(p, 'style', 'post')
    const wood = { color: '#6B4A2E', rough: 0.72, density: 0.7 }
    if (style === 'hook') {
      return [
        { kind: 'box', mat: ALU, size: [70, 10, 90], at: [0, -5, 0], bevel: 2 },
        { kind: 'tube', mat: ALU, r: 7, seg: 14, path: [[0, -10, 40], [0, -70, 60], [0, -90, 20], [0, -78, -10]] },
      ]
    }
    const base = style === 'wood' ? wood : { color: '#1E2024', rough: 0.55, density: 2.6 }
    return [
      style === 'wood'
        ? { kind: 'box', mat: base, size: [130, 20, 110], at: [0, 10, 0], bevel: 4 }
        : { kind: 'cyl', mat: base, r: 62, h: 16, seg: 32, at: [0, 8, 0], chamfer: 2 },
      { kind: 'cyl', mat: ALU, r: 11, h: h - 40, seg: 18, at: [0, (h - 40) / 2 + 16, 0] },
      { kind: 'tube', mat: ALU, r: 9, seg: 14, path: [[0, h - 40, 0], [0, h - 12, -10], [-yoke / 2, h, -26], [-yoke / 2, h - 8, -40]] },
      { kind: 'tube', mat: ALU, r: 9, seg: 14, path: [[0, h - 40, 0], [0, h - 12, -10], [yoke / 2, h, -26], [yoke / 2, h - 8, -40]] },
      { kind: 'box', mat: SOFT, size: [yoke + 18, 10, 26], at: [0, h - 2, -30], bevel: 5 },
    ]
  },
  ports: (p) => {
    const h = num(p, 'height', 280)
    const hook = str(p, 'style', 'post') === 'hook'
    return [
      { id: 'desk', label: hook ? 'Desk underside' : 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, hook ? 1 : -1, 0], mate: { type: 'face' } },
      { id: 'hang', label: 'Headband', kind: 'mechanical', pos: [0, hook ? -80 : h, hook ? 40 : -30], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => (str(p, 'style', 'post') === 'hook' ? 180 : 620 + num(p, 'height', 280) * 0.9),
  price: (p) => (str(p, 'style', 'post') === 'wood' ? 48 : str(p, 'style', 'post') === 'hook' ? 14 : 28),
  readouts: (p) => {
    const style = str(p, 'style', 'post')
    return [
      { label: 'Desk taken', value: style === 'hook' ? 'None, it hangs under' : style === 'wood' ? '130 × 110 mm' : '124 mm circle' },
      { label: 'Headband gap', value: `${num(p, 'yoke', 110)} mm` },
      { label: 'Cups clear the desk by', value: `${Math.max(0, Math.round(num(p, 'height', 280) - 190))} mm` },
    ]
  },
}

const mixer: PartDef = {
  id: 'mixer-compact',
  name: 'Compact mixer',
  category: 'audio',
  blurb: 'Faders, and a 1U height that decides where it lives',
  tags: ['mixer', 'mixing desk', 'console', 'faders', 'audio', 'live', 'stream', 'xlr', 'phantom'],
  doc: {
    price: 260,
    description:
      'Where more than two sources have to be summed without a computer in the path. Its reason for being in the catalogue is physical: it is 300 mm deep with cables on the back, so a mixer on the desk is a mixer whose depth you have to find, and the usual answer is a shelf or a rack.',
  },
  params: [
    REGION_PARAM,
    { key: 'channels', label: 'Channels', type: 'enum', default: '8', group: 'Mixer', options: ['4', '8', '12', '16'].map((v) => ({ value: v, label: `${v} channel` })) },
    { key: 'phantom', label: 'Phantom 48 V', type: 'bool', default: true, group: 'Mixer' },
    {
      key: 'mount', label: 'Mount', type: 'enum', default: 'desk', group: 'Mount',
      options: [{ value: 'desk', label: 'On the desk' }, { value: 'rack', label: 'Rack ears, 3U' }],
    },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const ch = parseInt(str(p, 'channels', '8'), 10) || 8
    const w = 120 + ch * 28
    const d = 300
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#23252A', rough: 0.55, density: 2.4 }, size: [w, 60, d], at: [0, 30, 0], bevel: 3 },
      { kind: 'box', mat: { color: '#2B2E33', rough: 0.5, density: 2.4 }, size: [w - 10, 6, d - 20], at: [0, 60, 10], rot: [-6, 0, 0] },
    ]
    for (let i = 0; i < ch; i++) {
      const x = (i - (ch - 1) / 2) * 28
      // One strip: a gain knob, two small ones, and a fader in its slot.
      out.push({ kind: 'cyl', mat: { color: '#E8E4DC', rough: 0.5, density: 1.2 }, r: 7, h: 12, seg: 16, at: [x, 66, -d / 2 + 50] })
      out.push({ kind: 'cyl', mat: { color: '#3A3D42', rough: 0.5, density: 1.2 }, r: 5, h: 9, seg: 14, at: [x, 65, -d / 2 + 90] })
      out.push({ kind: 'cyl', mat: { color: '#3A3D42', rough: 0.5, density: 1.2 }, r: 5, h: 9, seg: 14, at: [x, 65, -d / 2 + 120] })
      out.push({ kind: 'box', mat: DARK, size: [5, 2, 90], at: [x, 63, d / 2 - 80], noCollide: true })
      out.push({ kind: 'box', mat: { color: '#C9CDD3', rough: 0.4, density: 1.2 }, size: [14, 8, 16], at: [x, 66, d / 2 - 100] })
    }
    return out
  },
  ports: (p) => {
    const ch = parseInt(str(p, 'channels', '8'), 10) || 8
    const w = 120 + ch * 28
    const out: Port[] = [...mainsPorts([-w / 2 + 30, 26, -152], [0, 0, -1], '', [11, 0, 0])]
    for (let i = 0; i < Math.min(ch, 8); i++) {
      out.push({
        id: `ch${i + 1}`, label: `Channel ${i + 1} XLR`, kind: 'electrical',
        pos: [(i - (Math.min(ch, 8) - 1) / 2) * 28, 26, -153], dir: [0, 0, -1], role: 'analog', imax: 0.02, solderable: false,
      })
    }
    out.push(...signalPorts([['mainl', 'Main out L'], ['mainr', 'Main out R'], ['usb', 'USB out']], [w / 2 - 60, 26, -152], [0, 0, -1], 20))
    out.push({ id: 'base', label: 'Base', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: load((p) => {
    const ch = parseInt(str(p, 'channels', '8'), 10) || 8
    if (!bool(p, 'on', true)) return 0.3
    return 9 + ch * 1.1 + (bool(p, 'phantom', true) ? Math.min(ch, 8) * 0.5 : 0)
  }),
  mass: (p) => 1400 + (parseInt(str(p, 'channels', '8'), 10) || 8) * 320,
  price: (p) => 90 + (parseInt(str(p, 'channels', '8'), 10) || 8) * 22,
  readouts: (p) => {
    const ch = parseInt(str(p, 'channels', '8'), 10) || 8
    const w = 120 + ch * 28
    const watts = bool(p, 'on', true) ? 9 + ch * 1.1 + (bool(p, 'phantom', true) ? Math.min(ch, 8) * 0.5 : 0) : 0.3
    return [
      { label: 'Footprint', value: `${w} × 300 mm, plus cable depth behind` },
      { label: 'Drawing', value: `${watts.toFixed(1)} W, ${amps(p, watts)}` },
      { label: 'Rack height', value: str(p, 'mount', 'desk') === 'rack' ? '3U, 133 mm' : 'Not racked' },
    ]
  },
}

registerParts([studioMonitor, subwoofer, audioInterface, condenserMic, boomArm, headphoneStand, mixer])
