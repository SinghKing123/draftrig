import type { DeviceModel, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, PLASTIC, REGION_PARAM, STEEL, amps, dutyWatts, load, mainsPorts, screen, volts } from './setup'

/**
 * Screens, computers and the furniture they stand on.
 *
 * The mains convention and the helpers are in `setup.ts`: three ports named
 * l, n and e, a resistive load sized from watts, and a current rating that
 * the engine enforces. Everything here is a load; nothing here is a source.
 *
 * Signal ports — HDMI, DisplayPort, USB, Ethernet — are real ports with real
 * positions, so a lead between two of them is a lead of the length the lead
 * has to be. They carry no current worth modelling, so they are nodes and
 * nothing else; what they are for is reach, routing and the bill of
 * materials. A 1.5 m HDMI that has to get from a tower on the floor to an
 * arm-mounted monitor is the commonest mistake in a desk build and it is
 * one this can show before the cable is bought.
 *
 * Everything is authored standing on its own footprint at y = 0, facing +z,
 * so a part dropped on a desk is the right way up and the right way round.
 */

const BLACK_PLASTIC = { color: '#1B1D21', rough: 0.62, density: 1.2 }
const SOFT = { color: '#2A2D33', rough: 0.85, density: 1.1 }

/** A horizontal row of signal sockets along the back of something. */
function signalPorts(
  list: [string, string][],
  at: Vec3,
  dir: Vec3,
  pitch = 18,
): Port[] {
  const half = ((list.length - 1) * pitch) / 2
  return list.map(([id, label], i) => ({
    id,
    label,
    kind: 'electrical' as const,
    pos: [at[0] - half + i * pitch, at[1], at[2]] as Vec3,
    dir,
    role: 'io' as const,
    imax: 0.5,
    solderable: false,
  }))
}

/** The sockets drawn, so the back of a thing looks like the back of a thing. */
function socketBlocks(list: number, at: Vec3, pitch = 18, size: Vec3 = [15, 7, 4]): Solid[] {
  const half = ((list - 1) * pitch) / 2
  return Array.from({ length: list }, (_, i) => ({
    kind: 'box' as const,
    mat: { color: '#0B0C0F', rough: 0.5, density: 1.2 },
    size,
    at: [at[0] - half + i * pitch, at[1], at[2]] as Vec3,
  }))
}

/** Diagonal inches to a 16:9 panel in millimetres. */
const panel169 = (inches: number): [number, number] => {
  const d = inches * 25.4
  const w = d * 0.8716
  return [w, w * 9 / 16]
}

/* ================================================================== */
/* Screens and AV                                                      */
/* ================================================================== */

const television: PartDef = {
  id: 'tv-set',
  /*
   * No mesh: models/tv.glb does not draw.
   *
   * The file fetches (200), the loader accepts it, and the part's selection
   * box comes out the right size -- and nothing is rendered inside it. The
   * other seven scans in this catalogue work through the same path, so the
   * loader and the fit are not the fault; this one file is. It is the only
   * one carrying a node scale (0.01) and the only one with a single
   * untextured material, which is where to start looking.
   *
   * Until it draws, the television uses the geometry below. A part that
   * looks plainer is a part; a part that renders nothing is a hole in the
   * room. The credit is removed with it, because we are not showing the
   * author's work and crediting them for a blank space would be worse than
   * not crediting them at all.
   */
  name: 'Television',
  category: 'av',
  blurb: 'A flat panel on feet, sized by the diagonal',
  tags: ['tv', 'television', 'screen', 'flat screen', 'oled', 'display', 'hdmi', 'lounge', 'av', '4k'],
  doc: {
    price: 420,
    description:
      'A modern flat panel. The thing worth laying out before buying one is not the picture, it is whether the feet land inside the unit it is standing on and whether the arm you have is rated for the mass — both of which come off the diagonal and neither of which is on the box.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'diagonal', label: 'Diagonal', type: 'enum', default: '55', group: 'Panel',
      options: ['32', '43', '50', '55', '65', '75', '85'].map((d) => ({ value: d, label: `${d}"` })),
    },
    { key: 'stand', label: 'Stand', type: 'enum', default: 'feet', group: 'Panel', options: [{ value: 'feet', label: 'Two feet' }, { value: 'pedestal', label: 'Centre pedestal' }, { value: 'none', label: 'Wall mount, no stand' }] },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const d = parseInt(str(p, 'diagonal', '55'), 10) || 55
    const [w, h] = panel169(d)
    const stand = str(p, 'stand', 'feet')
    const lift = stand === 'none' ? 0 : 70
    const out: Solid[] = [
      { kind: 'box', mat: BLACK_PLASTIC, size: [w + 10, h + 10, 26], at: [0, lift + h / 2 + 5, -13], bevel: 2 },
      { kind: 'box', mat: screen(bool(p, 'on', true), '#4A6E9E'), size: [w, h, 2], at: [0, lift + h / 2 + 5, 1] },
      ...socketBlocks(4, [-w / 4, lift + 40, -27], 20),
    ]
    if (stand === 'feet') {
      for (const sx of [-1, 1] as const) {
        out.push({ kind: 'box', mat: ALU, size: [12, lift, 90], at: [sx * (w / 2 - 70), lift / 2, -10] })
        out.push({ kind: 'box', mat: ALU, size: [40, 8, 150], at: [sx * (w / 2 - 70), 4, -10], bevel: 2 })
      }
    } else if (stand === 'pedestal') {
      out.push({ kind: 'box', mat: ALU, size: [60, lift, 40], at: [0, lift / 2, -14] })
      out.push({ kind: 'cyl', mat: ALU, r: 110, h: 10, seg: 36, at: [0, 5, -14] })
    }
    return out
  },
  ports: (p) => {
    const d = parseInt(str(p, 'diagonal', '55'), 10) || 55
    const [w, h] = panel169(d)
    const lift = str(p, 'stand', 'none') === 'none' ? 0 : 70
    return [
      ...mainsPorts([w / 2 - 60, lift + 20, -28], [0, 0, -1], '', [14, 0, 0]),
      ...signalPorts(
        [['hdmi1', 'HDMI 1'], ['hdmi2', 'HDMI 2'], ['hdmi3', 'HDMI 3 eARC'], ['eth', 'Ethernet']],
        [-w / 4, lift + 40, -30], [0, 0, -1], 20,
      ),
      { id: 'vesa', label: 'VESA pattern', kind: 'mechanical', pos: [0, lift + h / 2 + 5, -27], dir: [0, 0, -1], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const d = parseInt(str(p, 'diagonal', '55'), 10) || 55
    // Roughly 0.055 W a square inch of panel, which lands a 55" at about 100 W.
    return dutyWatts(p, 0.035 * d * d, 0.5)
  }),
  mass: (p) => {
    const d = parseInt(str(p, 'diagonal', '55'), 10) || 55
    return 0.0055 * d * d * 1000
  },
  price: (p) => {
    const d = parseInt(str(p, 'diagonal', '55'), 10) || 55
    return 40 + 0.13 * d * d
  },
  readouts: (p) => {
    const d = parseInt(str(p, 'diagonal', '55'), 10) || 55
    const [w, h] = panel169(d)
    const run = dutyWatts(p, 0.035 * d * d, 0.5)
    return [
      { label: 'Panel', value: `${w.toFixed(0)} x ${h.toFixed(0)} mm, 16:9` },
      { label: 'Drawing', value: `${run.toFixed(0)} W, ${amps(p, run)}` },
      { label: 'Standby', value: '0.5 W, about £1.10 a year' },
      { label: 'Mass', value: `${(0.0055 * d * d).toFixed(1)} kg, before the stand` },
    ]
  },
}

const desktopMonitor: PartDef = {
  id: 'monitor-desk',
  /* Same as the television: the scan has a stand in it, so it is only the
     right picture for the configuration that has one. On an arm the panel
     draws itself. */
  model: (p) =>
    bool(p, 'stand', true)
      ? { url: 'models/monitor-27.glb', fit: 'bbox', credit: { title: 'LG moniter', author: 'Mohamed Ahmed', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/lg-moniter-f899bb43701f4e95b1e44c4bf21ed29c' } }
      : undefined,
  name: 'Desktop monitor',
  category: 'av',
  blurb: 'A monitor on a stand, DisplayPort and USB-C in',
  tags: ['monitor', 'screen', 'display', 'desktop', 'ultrawide', 'displayport', 'usb-c', 'vesa', 'desk', '144hz'],
  doc: {
    price: 230,
    description:
      'A desktop monitor with a real stand footprint, which is the number that decides whether two of them fit the desk. USB-C carries picture and power the other way, so one lead to a laptop is one lead rather than three.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'diagonal', label: 'Diagonal', type: 'enum', default: '27', group: 'Panel',
      options: ['22', '24', '27', '32', '34', '38', '49'].map((d) => ({ value: d, label: `${d}"` })),
    },
    { key: 'ultrawide', label: 'Ultrawide', type: 'bool', default: false, group: 'Panel', help: '21:9 rather than 16:9, which is wider and shorter for the same diagonal.' },
    { key: 'hz', label: 'Refresh', type: 'enum', default: '144', group: 'Panel', options: ['60', '75', '120', '144', '240'].map((v) => ({ value: v, label: `${v} Hz` })) },
    { key: 'stand', label: 'On its stand', type: 'bool', default: true, group: 'Panel' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const d = parseInt(str(p, 'diagonal', '27'), 10) || 27
    const wide = bool(p, 'ultrawide', false)
    const dia = d * 25.4
    const w = wide ? dia * 0.918 : dia * 0.8716
    const h = wide ? (w * 9) / 21 : (w * 9) / 16
    const onStand = bool(p, 'stand', true)
    const lift = onStand ? 120 : 0
    const out: Solid[] = [
      { kind: 'box', mat: BLACK_PLASTIC, size: [w + 8, h + 8, 20], at: [0, lift + h / 2 + 20, -10], bevel: 1.6 },
      { kind: 'box', mat: screen(bool(p, 'on', true), '#5878A8'), size: [w, h, 2], at: [0, lift + h / 2 + 20, 1] },
      ...socketBlocks(4, [0, lift + 32, -21], 18, [13, 6, 4]),
    ]
    if (onStand) {
      out.push({ kind: 'box', mat: BLACK_PLASTIC, size: [70, lift + 30, 24], at: [0, lift / 2 + 14, -22], bevel: 3 })
      out.push({ kind: 'box', mat: BLACK_PLASTIC, size: [230, 14, 190], at: [0, 7, -50], bevel: 4 })
    }
    return out
  },
  ports: (p) => {
    const d = parseInt(str(p, 'diagonal', '27'), 10) || 27
    const wide = bool(p, 'ultrawide', false)
    const dia = d * 25.4
    const w = wide ? dia * 0.918 : dia * 0.8716
    const h = wide ? (w * 9) / 21 : (w * 9) / 16
    const lift = bool(p, 'stand', true) ? 120 : 0
    return [
      ...mainsPorts([w / 2 - 50, lift + 26, -22], [0, 0, -1], '', [13, 0, 0]),
      ...signalPorts(
        [['hdmi', 'HDMI'], ['dp', 'DisplayPort'], ['usbc', 'USB-C'], ['usb', 'USB hub out']],
        [0, lift + 32, -24], [0, 0, -1], 18,
      ),
      { id: 'vesa', label: 'VESA 100', kind: 'mechanical', pos: [0, lift + h / 2 + 20, -21], dir: [0, 0, -1], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const d = parseInt(str(p, 'diagonal', '27'), 10) || 27
    const hz = parseInt(str(p, 'hz', '144'), 10) || 144
    return dutyWatts(p, 0.045 * d * d * (1 + (hz - 60) / 600), 0.3)
  }),
  price: (p) => {
    const d = parseInt(str(p, 'diagonal', '27'), 10) || 27
    const hz = parseInt(str(p, 'hz', '144'), 10) || 144
    return 60 + 0.2 * d * d + hz * 0.45 + (bool(p, 'ultrawide', false) ? 120 : 0)
  },
  readouts: (p) => {
    const d = parseInt(str(p, 'diagonal', '27'), 10) || 27
    const wide = bool(p, 'ultrawide', false)
    const dia = d * 25.4
    const w = wide ? dia * 0.918 : dia * 0.8716
    const run = dutyWatts(p, 0.045 * d * d, 0.3)
    return [
      { label: 'Panel', value: `${w.toFixed(0)} mm wide, ${wide ? '21:9' : '16:9'}` },
      { label: 'Stand footprint', value: bool(p, 'stand', true) ? '230 x 190 mm' : 'None, VESA only' },
      { label: 'Drawing', value: `${run.toFixed(0)} W, ${amps(p, run)}` },
    ]
  },
}

const projector: PartDef = {
  id: 'projector',
  name: 'Projector',
  category: 'av',
  blurb: 'Lumens, a throw ratio, and the image that follows from them',
  tags: ['projector', 'beamer', 'throw', 'lumens', 'cinema', 'hdmi', 'screen', 'av', 'home cinema'],
  doc: {
    price: 600,
    description:
      'A projector is the one AV part whose placement is arithmetic rather than taste: throw ratio times image width is how far back it has to be, and there is no arranging a room around it until that number is known.',
  },
  params: [
    REGION_PARAM,
    { key: 'lumens', label: 'Brightness', type: 'enum', default: '2500', group: 'Projector', options: ['1000', '2000', '2500', '3500', '5000'].map((v) => ({ value: v, label: `${v} lm` })) },
    { key: 'throw', label: 'Throw ratio', type: 'number', default: 1.5, min: 0.25, max: 3, step: 0.05, group: 'Projector', help: 'Distance divided by image width. Under 0.5 is short throw; under 0.3 is the kind that sits under the screen.' },
    { key: 'image', label: 'Image width', type: 'number', unit: 'mm', default: 2200, min: 600, max: 6000, step: 100, group: 'Projector' },
    { key: 'on', label: 'Lamp on', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const lm = parseInt(str(p, 'lumens', '2500'), 10) || 2500
    const s = 180 + lm * 0.024
    const on = bool(p, 'on', true)
    return [
      { kind: 'box', mat: { color: '#E9E7E2', rough: 0.5, density: 1.3 }, size: [s, s * 0.42, s * 0.78], at: [0, (s * 0.42) / 2, 0], bevel: 6 },
      { kind: 'cyl', mat: BLACK_PLASTIC, r: s * 0.12, h: 16, seg: 28, at: [s * 0.26, s * 0.24, s * 0.39], rot: [90, 0, 0] },
      {
        kind: 'cyl', seg: 28, r: s * 0.09, h: 2, at: [s * 0.26, s * 0.24, s * 0.4 + 8], rot: [90, 0, 0],
        mat: on
          ? { color: '#F2F6FF', rough: 0.1, density: 2.4, emissive: '#DCEBFF', emissiveIntensity: 2.4 }
          : { color: '#1A1E26', rough: 0.2, density: 2.4 },
      },
      // Exhaust, which is also the reason it cannot go in a cupboard.
      { kind: 'box', mat: { color: '#3A3D44', rough: 0.8, density: 1.2 }, size: [6, s * 0.2, s * 0.3], at: [-s / 2 - 1, s * 0.22, 0] },
      ...socketBlocks(3, [0, s * 0.12, -s * 0.4], 20),
      { kind: 'cyl', mat: SOFT, r: 9, h: 6, seg: 14, at: [s * 0.38, 3, s * 0.28] },
      { kind: 'cyl', mat: SOFT, r: 9, h: 6, seg: 14, at: [-s * 0.38, 3, -s * 0.28] },
    ]
  },
  ports: (p) => {
    const lm = parseInt(str(p, 'lumens', '2500'), 10) || 2500
    const s = 180 + lm * 0.024
    return [
      ...mainsPorts([-s * 0.3, s * 0.12, -s * 0.41], [0, 0, -1], '', [14, 0, 0]),
      ...signalPorts([['hdmi1', 'HDMI 1'], ['hdmi2', 'HDMI 2'], ['eth', 'Ethernet']], [0, s * 0.12, -s * 0.42], [0, 0, -1], 20),
    ]
  },
  electrical: load((p) => dutyWatts(p, (parseInt(str(p, 'lumens', '2500'), 10) || 2500) * 0.1 + 30, 0.4)),
  price: (p) => 150 + (parseInt(str(p, 'lumens', '2500'), 10) || 2500) * 0.16,
  readouts: (p) => {
    const t = num(p, 'throw', 1.5)
    const img = num(p, 'image', 2200)
    const run = dutyWatts(p, (parseInt(str(p, 'lumens', '2500'), 10) || 2500) * 0.1 + 30, 0.4)
    return [
      { label: 'Stand it back', value: `${(t * img / 1000).toFixed(2)} m from the screen` },
      { label: 'Image', value: `${(img / 1000).toFixed(2)} x ${(img * 9 / 16 / 1000).toFixed(2)} m, ${(Math.hypot(img, img * 9 / 16) / 25.4).toFixed(0)}"` },
      { label: 'Drawing', value: `${run.toFixed(0)} W, ${amps(p, run)}` },
    ]
  },
}

const soundbar: PartDef = {
  id: 'soundbar',
  model: { url: 'models/soundbar.glb', fit: 'bbox', credit: { title: 'Q-Acoustics M3 Soundbar', author: 'Q-Acoustics', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/7cf33febf603401586ffa5e18c312d31' } },
  name: 'Soundbar',
  category: 'av',
  blurb: 'A bar under the screen, on eARC',
  tags: ['soundbar', 'speaker', 'audio', 'sound', 'av', 'arc', 'earc', 'optical', 'cinema', 'tv sound'],
  doc: {
    price: 180,
    description:
      'A bar of drivers. It goes under the television, which means its height is the number that matters: more than the gap under the screen and it stands in front of the picture.',
  },
  params: [
    REGION_PARAM,
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 950, min: 400, max: 1600, step: 10, group: 'Bar' },
    { key: 'watts', label: 'Rated output', type: 'number', unit: 'W', default: 200, min: 40, max: 800, step: 10, group: 'Bar' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const L = num(p, 'length', 950)
    const H = 62
    const out: Solid[] = [
      { kind: 'box', mat: SOFT, size: [L, H, 110], at: [0, H / 2, 0], bevel: 8 },
      { kind: 'box', mat: { color: '#1F2228', rough: 0.95, density: 0.4 }, size: [L - 24, H - 18, 2], at: [0, H / 2, 56] },
    ]
    for (const sx of [-1, 1] as const) out.push({ kind: 'cyl', mat: SOFT, r: 10, h: 6, seg: 14, at: [sx * (L / 2 - 60), 3, 0] })
    return out
  },
  ports: (p) => {
    const L = num(p, 'length', 950)
    return [
      ...mainsPorts([-L / 2 + 70, 24, -56], [0, 0, -1], '', [13, 0, 0]),
      ...signalPorts([['arc', 'HDMI eARC'], ['optical', 'Optical in']], [L / 4, 24, -56], [0, 0, -1], 20),
    ]
  },
  electrical: load((p) => dutyWatts(p, 12 + num(p, 'watts', 200) * 0.12, 0.5)),
  price: (p) => 70 + num(p, 'watts', 200) * 0.5,
  readouts: (p) => [
    { label: 'Needs a gap of', value: '62 mm under the screen' },
    { label: 'Typical draw', value: `${(12 + num(p, 'watts', 200) * 0.12).toFixed(0)} W at normal volume` },
    { label: 'Peak', value: `${num(p, 'watts', 200)} W rated, briefly` },
  ],
}

/* ================================================================== */
/* Computers and consoles                                             */
/* ================================================================== */

const pcTower: PartDef = {
  id: 'pc-tower',
  model: { url: 'models/pc-tower.glb', fit: 'bbox', credit: { title: 'Fractal Design Meshify C — PC Case', author: 'MUSHROOM_BUILDS', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/a46526af2ac84fa098edc3f01c012450' } },
  name: 'Desktop PC',
  category: 'computer',
  blurb: 'A tower, its supply, and what it pulls under load',
  tags: ['pc', 'desktop', 'tower', 'computer', 'gaming pc', 'atx', 'psu', 'gpu', 'case', 'workstation'],
  doc: {
    price: 900,
    description:
      'A tower case. The number this part exists to give you is the one off the back of the supply, under load, with everything else in the room on the same socket — which is how you find out that the extension lead was the problem.',
  },
  params: [
    REGION_PARAM,
    { key: 'size', label: 'Case', type: 'enum', default: 'midi', group: 'Case', options: [{ value: 'sff', label: 'Small form factor' }, { value: 'midi', label: 'Mid tower' }, { value: 'full', label: 'Full tower' }] },
    { key: 'psu', label: 'Supply', type: 'enum', default: '750', group: 'Case', options: ['450', '650', '750', '850', '1000', '1200'].map((v) => ({ value: v, label: `${v} W` })) },
    { key: 'gpu', label: 'Discrete graphics', type: 'bool', default: true, group: 'Case' },
    { key: 'load', label: 'Load', type: 'number', unit: '%', default: 35, min: 0, max: 100, step: 5, group: 'Control', help: 'Idle is about a tenth of the peak. Gaming is 60 to 80; a render is 100.' },
    { key: 'glass', label: 'Glass side', type: 'bool', default: true, group: 'Case' },
  ],
  solids: (p) => {
    const size = str(p, 'size', 'midi')
    const dim: Record<string, Vec3> = { sff: [180, 350, 320], midi: [215, 460, 450], full: [240, 580, 520] }
    const [W, H, D] = dim[size] ?? dim.midi
    const lit = num(p, 'load', 35) > 0
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#17191D', rough: 0.56, density: 1.3 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 3 },
    ]
    if (bool(p, 'glass', true)) {
      out.push({
        kind: 'box',
        mat: { color: '#2A3038', rough: 0.08, density: 2.4, opacity: 0.34, transmission: 0.8, clearcoat: 1 },
        size: [3, H - 40, D - 40], at: [W / 2 - 1, H / 2, 0],
      })
      // Something to see through it.
      out.push({ kind: 'box', mat: { color: '#1C4D2E', rough: 0.7, density: 1.9 }, size: [4, 244, 220], at: [-W / 2 + 26, H * 0.52, -20] })
      if (bool(p, 'gpu', true)) {
        out.push({ kind: 'box', mat: { color: '#202329', rough: 0.5, density: 2 }, size: [60, 50, 300], at: [-10, H * 0.46, 10], bevel: 2 })
        for (const fz of [-70, 30] as const) {
          out.push({
            kind: 'cyl', seg: 24, r: 24, h: 8, at: [12, H * 0.46 + 26, fz],
            mat: lit
              ? { color: '#2A2E36', rough: 0.6, density: 1.1, emissive: '#45C8FF', emissiveIntensity: 0.9 }
              : { color: '#2A2E36', rough: 0.6, density: 1.1 },
          })
        }
      }
    }
    // Front intake and the power button.
    out.push({ kind: 'box', mat: { color: '#101216', rough: 0.9, density: 0.9 }, size: [W - 30, H - 90, 3], at: [0, H / 2, D / 2 + 1] })
    out.push({
      kind: 'cyl', seg: 20, r: 7, h: 3, at: [0, H - 26, D / 2 + 2],
      mat: lit
        ? { color: '#DDE6F2', rough: 0.3, density: 1.2, emissive: '#9FD0FF', emissiveIntensity: 1.8 }
        : { color: '#3A3F47', rough: 0.6, density: 1.2 },
    })
    // The supply's inlet and switch, bottom rear.
    out.push({ kind: 'box', mat: STEEL, size: [48, 48, 4], at: [-W / 2 + 60, 44, -D / 2 - 2] })
    out.push(...socketBlocks(4, [W / 2 - 70, H * 0.3, -D / 2 - 2], 18, [13, 6, 4]))
    return out
  },
  ports: (p) => {
    const dim: Record<string, Vec3> = { sff: [180, 350, 320], midi: [215, 460, 450], full: [240, 580, 520] }
    const [W, H, D] = dim[str(p, 'size', 'midi')] ?? dim.midi
    const out: Port[] = [
      ...mainsPorts([-W / 2 + 60, 44, -D / 2 - 6], [0, 0, -1], '', [14, 0, 0]),
      ...signalPorts(
        [['dp1', 'DisplayPort 1'], ['dp2', 'DisplayPort 2'], ['hdmi', 'HDMI out'], ['eth', 'Ethernet']],
        [W / 2 - 70, H * 0.3, -D / 2 - 6], [0, 0, -1], 18,
      ),
      ...signalPorts([['usb1', 'USB 1'], ['usb2', 'USB 2']], [W / 2 - 70, H * 0.3 - 22, -D / 2 - 6], [0, 0, -1], 18),
    ]
    out.push({ id: 'usbf', label: 'Front USB-C', kind: 'electrical', pos: [W / 2 - 40, H - 54, D / 2 + 4], dir: [0, 0, 1], role: 'io', imax: 3, solderable: false })
    return out
  },
  electrical: load((p) => {
    const psu = parseInt(str(p, 'psu', '750'), 10) || 750
    /* The supply's rating is the headroom, not the draw. A 750 W build with
       a card in it is about 450 W flat out and 55 W sitting there, and the
       supply is 90 per cent efficient at the top of that range. */
    const peak = psu * (bool(p, 'gpu', true) ? 0.6 : 0.33)
    const idle = peak * 0.12
    return (idle + (peak - idle) * (num(p, 'load', 35) / 100)) / 0.9
  }),
  mass: (p) => ({ sff: 5200, midi: 9400, full: 14000 })[str(p, 'size', 'midi')] ?? 9400,
  price: (p) => (bool(p, 'gpu', true) ? 900 : 480) + (parseInt(str(p, 'psu', '750'), 10) || 750) * 0.12,
  readouts: (p) => {
    const psu = parseInt(str(p, 'psu', '750'), 10) || 750
    const peak = psu * (bool(p, 'gpu', true) ? 0.6 : 0.33)
    const idle = peak * 0.12
    const now = (idle + (peak - idle) * (num(p, 'load', 35) / 100)) / 0.9
    return [
      { label: 'Drawing now', value: `${now.toFixed(0)} W, ${amps(p, now)}` },
      { label: 'Flat out', value: `${(peak / 0.9).toFixed(0)} W from the wall` },
      { label: 'Idle', value: `${(idle / 0.9).toFixed(0)} W` },
      { label: 'Supply headroom', value: `${psu} W rated, ${(100 - (peak / psu) * 100).toFixed(0)} % spare at peak` },
    ]
  },
}

const laptop: PartDef = {
  id: 'laptop',
  model: { url: 'models/laptop.glb', fit: 'bbox', credit: { title: 'MacBook Pro 16" 2021', author: 'rtql8d', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/macbook-pro-16-2021-8ac16bda501c4bcc8ba93ac3eb63a8e1' } },
  name: 'Laptop',
  category: 'computer',
  blurb: 'Open on the desk, charging over USB-C',
  tags: ['laptop', 'notebook', 'computer', 'macbook', 'usb-c', 'dock', 'desk', 'portable'],
  doc: {
    price: 1100,
    description:
      'A laptop, open. Its footprint and the angle of the lid are what decide whether it fits under a monitor arm or in front of one, which is the thing a desk layout actually turns on.',
  },
  params: [
    {
      key: 'diagonal', label: 'Diagonal', type: 'enum', default: '14', group: 'Laptop',
      options: ['13', '14', '15', '16', '17'].map((d) => ({ value: d, label: `${d}"` })),
    },
    { key: 'lid', label: 'Lid angle', type: 'number', unit: '°', default: 105, min: 0, max: 130, step: 5, group: 'Laptop' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
    { key: 'watts', label: 'Charger', type: 'enum', default: '65', group: 'Power', options: ['30', '45', '65', '96', '140'].map((v) => ({ value: v, label: `${v} W` })) },
  ],
  solids: (p) => {
    const d = parseInt(str(p, 'diagonal', '14'), 10) || 14
    const [w, h] = panel169(d)
    const W = w + 18
    const D = h + 26
    const ang = num(p, 'lid', 105)
    const body: Solid[] = [
      { kind: 'box', mat: { color: '#9FA4AB', metal: 0.9, rough: 0.42, density: 2.7 }, size: [W, 14, D], at: [0, 7, 0], bevel: 2 },
      { kind: 'box', mat: { color: '#1C1E22', rough: 0.8, density: 1.2 }, size: [W - 60, 1.5, D * 0.52], at: [0, 14.4, -D * 0.12] },
      { kind: 'box', mat: { color: '#2A2D33', rough: 0.5, density: 1.2 }, size: [W * 0.34, 1, D * 0.26], at: [0, 14.4, D * 0.3] },
    ]
    // The lid, hinged at the back edge.
    const hingeZ = -D / 2 + 6
    body.push({
      kind: 'box', mat: { color: '#9FA4AB', metal: 0.9, rough: 0.42, density: 2.7 },
      size: [W, h + 16, 7], at: [0, 14 + Math.sin((ang * Math.PI) / 180) * (h + 16) / 2, hingeZ - Math.cos((ang * Math.PI) / 180) * (h + 16) / 2],
      rot: [ang - 90, 0, 0], bevel: 1.5,
    })
    body.push({
      kind: 'box', mat: screen(bool(p, 'on', true), '#4C6E9E'),
      size: [w, h, 1.5], at: [0, 14 + Math.sin((ang * Math.PI) / 180) * (h + 16) / 2 + Math.cos((ang * Math.PI) / 180) * 4, hingeZ - Math.cos((ang * Math.PI) / 180) * (h + 16) / 2 + Math.sin((ang * Math.PI) / 180) * 4],
      rot: [ang - 90, 0, 0],
    })
    return body
  },
  ports: (p) => {
    const d = parseInt(str(p, 'diagonal', '14'), 10) || 14
    const [w, h] = panel169(d)
    const W = w + 18
    const D = h + 26
    return [
      /* Both pins of the charge port. One pin is not a port: wired as a
         single node it has nowhere to return to, and anything feeding it
         is feeding a short. */
      { id: 'usbc', label: 'USB-C in, +', kind: 'electrical', pos: [-W / 2 - 2, 9, -D * 0.1], dir: [-1, 0, 0], role: 'power', imax: 5, solderable: false },
      { id: 'usbcg', label: 'USB-C in, GND', kind: 'electrical', pos: [-W / 2 - 2, 4, -D * 0.1], dir: [-1, 0, 0], role: 'gnd', imax: 5, solderable: false },
      { id: 'usbc2', label: 'USB-C 2', kind: 'electrical', pos: [-W / 2 - 2, 7, D * 0.06], dir: [-1, 0, 0], role: 'io', imax: 5, solderable: false },
      { id: 'hdmi', label: 'HDMI out', kind: 'electrical', pos: [W / 2 + 2, 7, -D * 0.1], dir: [1, 0, 0], role: 'io', imax: 0.5, solderable: false },
    ]
  },
  electrical: {
    devices: (p) => {
      const w = parseInt(str(p, 'watts', '65'), 10) || 65
      const draw = bool(p, 'on', true) ? w * 0.55 : w * 0.05
      // Power delivery settles at 20 V for anything this size.
      return [{ type: 'resistor', a: 'usbc', b: 'usbcg', r: (20 * 20) / Math.max(0.5, draw) }] as DeviceModel[]
    },
    limits: { vmax: 28 },
  },
  mass: (p) => 900 + (parseInt(str(p, 'diagonal', '14'), 10) || 14) * 55,
  price: (p) => 450 + (parseInt(str(p, 'diagonal', '14'), 10) || 14) * 55,
  readouts: (p) => {
    const d = parseInt(str(p, 'diagonal', '14'), 10) || 14
    const [w, h] = panel169(d)
    const watt = parseInt(str(p, 'watts', '65'), 10) || 65
    return [
      { label: 'Footprint', value: `${(w + 18).toFixed(0)} x ${(h + 26).toFixed(0)} mm` },
      { label: 'Lid height', value: `${(14 + Math.sin((num(p, 'lid', 105) * Math.PI) / 180) * (h + 16)).toFixed(0)} mm at ${num(p, 'lid', 105)}°` },
      { label: 'Charger', value: `${watt} W over USB-C` },
    ]
  },
}

const console_: PartDef = {
  id: 'console-game',
  // Only upright: the photoscan is a standing PS5, so a layout that lays the
  // console flat or docks a handheld falls back to the built-in box.
  model: (p) =>
    str(p, 'style', 'tower') === 'tower'
      ? { url: 'models/ps5-console.glb', fit: 'bbox', credit: { title: 'PS5', author: 'rtql8d', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/ps5-d788de3735964151a3e24fd59c0f1956' } }
      : undefined,
  name: 'PlayStation 5',
  category: 'computer',
  blurb: '390 mm of console, upright or flat, and hot either way',
  tags: ['ps5', 'playstation', 'playstation 5', 'console', 'games console', 'xbox', 'series x', 'switch', 'gaming', 'hdmi', 'av', 'tv'],
  doc: {
    price: 480,
    description:
      'A PlayStation 5, at 104 by 390 by 260 mm. It wants two things from a layout and they fight: clearance for the intake, and somewhere out of the way.\n\nUpright it is drawn with a scan of the real console, so the shape you build around is the shape. Lying flat it is the same object on its side, drawn as the box it is, because the scan is of a console standing up.\n\nUse it for any console of about this size. The name is the one it was measured from.',
  },
  params: [
    REGION_PARAM,
    { key: 'style', label: 'Standing', type: 'enum', default: 'tower', group: 'Console', options: [{ value: 'tower', label: 'Upright' }, { value: 'flat', label: 'On its side' }] },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
    { key: 'load', label: 'Load', type: 'number', unit: '%', default: 70, min: 0, max: 100, step: 5, group: 'Control' },
  ],
  solids: (p) => {
    const style = str(p, 'style', 'tower')
    /* One object, two ways up. Flat is the upright figure with width and
       height swapped, which is what lying a console down actually does to
       it; the old numbers here described a different, smaller console. */
    const dim: Record<string, Vec3> = { tower: [104, 390, 260], flat: [390, 104, 260] }
    const [W, H, D] = dim[style] ?? dim.tower
    const on = bool(p, 'on', true)
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1A1C20', rough: 0.55, density: 1.3 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 5 },
      {
        kind: 'box',
        mat: on
          ? { color: '#2F4C6E', rough: 0.4, density: 1.2, emissive: '#4FA8FF', emissiveIntensity: 1.1 }
          : { color: '#2A2D33', rough: 0.6, density: 1.2 },
        size: [W * 0.7, 2.4, 2.4], at: [0, H * 0.14, D / 2 + 1],
      },
      // Vent, on the face it is actually on.
      { kind: 'box', mat: { color: '#101216', rough: 0.95, density: 0.8 }, size: [W - 16, H * 0.5, 2], at: [0, H * 0.6, -D / 2 - 1] },
      ...socketBlocks(3, [0, H * 0.12, -D / 2 - 2], 20),
    ]
    return out
  },
  ports: (p) => {
    /* One object, two ways up. Flat is the upright figure with width and
       height swapped, which is what lying a console down actually does to
       it; the old numbers here described a different, smaller console. */
    const dim: Record<string, Vec3> = { tower: [104, 390, 260], flat: [390, 104, 260] }
    const [, H, D] = dim[str(p, 'style', 'tower')] ?? dim.tower
    return [
      ...mainsPorts([-40, H * 0.12, -D / 2 - 6], [0, 0, -1], '', [13, 0, 0]),
      ...signalPorts([['hdmi', 'HDMI out'], ['eth', 'Ethernet'], ['usb', 'USB']], [20, H * 0.12, -D / 2 - 6], [0, 0, -1], 20),
    ]
  },
  electrical: load((p) => {
    const peak = 210
    return bool(p, 'on', true) ? 28 + (peak - 28) * (num(p, 'load', 70) / 100) : 0.4
  }),
  readouts: (p) => {
    const now = bool(p, 'on', true) ? 28 + 182 * (num(p, 'load', 70) / 100) : 0.4
    return [
      { label: 'Drawing', value: `${now.toFixed(0)} W, ${amps(p, now)}` },
      { label: 'Clearance wanted', value: '100 mm behind, 50 mm each side' },
      { label: 'Standby', value: '0.4 W, or 12 W if it downloads overnight' },
    ]
  },
}

const phone: PartDef = {
  id: 'phone-handset',
  // The scan stands upright on its long axis; the handset lies flat on the
  // desk, so the mesh is turned a quarter-turn to lie down with it. In a stand
  // it is tilted back on a cradle the mesh has no notion of, so that one draws
  // its own geometry instead.
  model: (p) =>
    bool(p, 'stand', false)
      ? undefined
      : { url: 'models/phone.glb', fit: 'bbox', rot: [90, 0, 0], credit: { title: 'Apple iPhone 13 Pro Max', author: 'DatSketch', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/apple-iphone-13-pro-max-4328dea00e47497dbeac73c556121bc9' } },
  name: 'Phone',
  category: 'computer',
  blurb: 'A handset, flat or in a stand',
  tags: ['phone', 'mobile', 'handset', 'smartphone', 'iphone', 'android', 'usb-c', 'charging', 'desk'],
  doc: {
    price: 700,
    description:
      'A handset at real size. On a desk layout it is the thing that decides where the charging lead has to reach to, which is almost never where the socket is.',
  },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: 'standard', group: 'Phone', options: [{ value: 'compact', label: 'Compact, 6.1"' }, { value: 'standard', label: 'Standard, 6.4"' }, { value: 'max', label: 'Large, 6.9"' }] },
    { key: 'stand', label: 'In a stand', type: 'bool', default: false, group: 'Phone' },
    { key: 'on', label: 'Screen on', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const dim: Record<string, [number, number]> = { compact: [71, 147], standard: [77, 160], max: [83, 168] }
    const [W, H] = dim[str(p, 'size', 'standard')] ?? dim.standard
    const stand = bool(p, 'stand', false)
    const tilt = stand ? -62 : -90
    const lift = stand ? 14 : 4
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#23262B', rough: 0.35, density: 2 }, size: [W, H, 8], at: [0, lift + (stand ? H / 2 * 0.9 : 0), stand ? -H * 0.22 : 0], rot: [tilt, 0, 0], bevel: 4 },
      { kind: 'box', mat: screen(bool(p, 'on', true), '#6E8CC0'), size: [W - 6, H - 8, 1], at: [0, lift + (stand ? H / 2 * 0.9 : 0) + (stand ? 3.6 : 4.4), stand ? -H * 0.22 + (stand ? 1.9 : 0) : 0], rot: [tilt, 0, 0] },
    ]
    if (stand) {
      out.push({ kind: 'box', mat: ALU, size: [W + 16, 8, 90], at: [0, 4, -20], bevel: 2 })
      out.push({ kind: 'box', mat: ALU, size: [W + 16, 70, 8], at: [0, 38, -56], rot: [20, 0, 0], bevel: 2 })
    }
    return out
  },
  ports: (p) => {
    const dim: Record<string, [number, number]> = { compact: [71, 147], standard: [77, 160], max: [83, 168] }
    const [, H] = dim[str(p, 'size', 'standard')] ?? dim.standard
    const stand = bool(p, 'stand', false)
    return [
      {
        id: 'usbc', label: 'USB-C +', kind: 'electrical',
        pos: stand ? [-4, 10, -H * 0.22 + 30] : [-4, 4, -H / 2 - 2],
        dir: stand ? [0, -1, 0] : [0, 0, -1],
        role: 'power', imax: 3, solderable: false,
      },
      {
        id: 'usbcg', label: 'USB-C GND', kind: 'electrical',
        pos: stand ? [4, 10, -H * 0.22 + 30] : [4, 4, -H / 2 - 2],
        dir: stand ? [0, -1, 0] : [0, 0, -1],
        role: 'gnd', imax: 3, solderable: false,
      },
    ]
  },
  electrical: {
    // Nine volts negotiated, about 25 W awake and a trickle asleep.
    devices: (p) => [{ type: 'resistor', a: 'usbc', b: 'usbcg', r: bool(p, 'on', true) ? 16 : 260 }] as DeviceModel[],
    limits: { vmax: 21 },
  },
  mass: (p) => ({ compact: 170, standard: 196, max: 221 })[str(p, 'size', 'standard')] ?? 196,
  readouts: (p) => {
    const dim: Record<string, [number, number]> = { compact: [71, 147], standard: [77, 160], max: [83, 168] }
    const [W, H] = dim[str(p, 'size', 'standard')] ?? dim.standard
    return [
      { label: 'Body', value: `${W} x ${H} x 8 mm` },
      { label: 'Charging at', value: bool(p, 'on', true) ? 'about 25 W' : 'about 1.5 W' },
      { label: 'Over', value: 'USB-C, negotiated' },
    ]
  },
}

const router: PartDef = {
  id: 'router-wifi',
  model: { url: 'models/router-wifi.glb', fit: 'bbox', credit: { title: '3D Router', author: 'SanForge Studio', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/3d-router-fc90c018647c4fd1a3a9f62559bf67f0' } },
  name: 'Router',
  category: 'computer',
  blurb: 'Four ports, a WAN, and the aerials that decide where it goes',
  tags: ['router', 'wifi', 'network', 'ethernet', 'modem', 'access point', 'lan', 'wan', 'broadband'],
  doc: {
    price: 90,
    description:
      'A domestic router. It wants to be high, central and not in a cupboard, and the aerials are modelled because they are the reason the last of those is true.',
  },
  params: [
    { key: 'aerials', label: 'Aerials', type: 'number', default: 4, min: 0, max: 8, step: 1, group: 'Router' },
    { key: 'ports', label: 'LAN ports', type: 'enum', default: '4', group: 'Router', options: ['2', '4', '8'].map((v) => ({ value: v, label: v })) },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'aerials', 4))
    const W = 240
    const D = 160
    const H = 38
    const on = bool(p, 'on', true)
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1D2026', rough: 0.6, density: 1.2 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 5 },
    ]
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : -W / 2 + 24 + (i * (W - 48)) / Math.max(1, n - 1)
      const lean = (i - (n - 1) / 2) * 12
      out.push({ kind: 'cyl', mat: { color: '#16181C', rough: 0.6, density: 1.2 }, r: 5, h: 150, seg: 14, at: [x, H + 70, -D / 2 + 8], rot: [0, 0, lean] })
    }
    for (let i = 0; i < 5; i++) {
      out.push({
        kind: 'cyl', seg: 12, r: 2, h: 1.2, at: [-W / 2 + 30 + i * 16, H + 0.6, D / 2 - 18],
        mat: on
          ? { color: '#8FE3A0', rough: 0.3, density: 1.1, emissive: '#39E06B', emissiveIntensity: 1.4 }
          : { color: '#2A2D33', rough: 0.6, density: 1.1 },
      })
    }
    const lan = parseInt(str(p, 'ports', '4'), 10) || 4
    out.push(...socketBlocks(lan + 1, [0, 14, -D / 2 - 2], 20, [16, 13, 4]))
    return out
  },
  ports: (p) => {
    const lan = parseInt(str(p, 'ports', '4'), 10) || 4
    const names: [string, string][] = [['wan', 'WAN']]
    for (let i = 1; i <= lan; i++) names.push([`lan${i}`, `LAN ${i}`])
    return [
      ...signalPorts(names, [0, 14, -84], [0, 0, -1], 20),
      { id: 'v12', label: '12 V in', kind: 'electrical', pos: [100, 14, -84], dir: [0, 0, -1], role: 'power', imax: 2, solderable: false },
      { id: 'gnd', label: 'GND', kind: 'electrical', pos: [112, 14, -84], dir: [0, 0, -1], role: 'gnd', imax: 2, solderable: false },
    ]
  },
  electrical: {
    devices: (p) => [{ type: 'resistor', a: 'v12', b: 'gnd', r: bool(p, 'on', true) ? 144 / 11 : 1e5 }] as DeviceModel[],
    limits: { vmax: 15 },
  },
  readouts: (p) => [
    { label: 'Draw', value: bool(p, 'on', true) ? '11 W at 12 V' : 'Off' },
    { label: 'Height with aerials', value: `${38 + 150} mm` },
    { label: 'Ports', value: `${str(p, 'ports', '4')} LAN, one WAN` },
  ],
}

/* ================================================================== */
/* Desk and room                                                       */
/* ================================================================== */

const desk: PartDef = {
  id: 'desk',
  // The scan is one desk: an oak top on a sit-stand column. It stands in only
  // for that configuration — a walnut top or a four-legged frame is a different
  // object, and the solids draw those at whatever width is set. Uniform fit
  // keeps the mesh honest at the default size; very wide tops it cannot follow.
  model: (p) =>
    str(p, 'top', 'oak') === 'oak' && str(p, 'frame', 'sit-stand') === 'sit-stand'
      ? { url: 'models/desk.glb', fit: 'bbox', credit: { title: 'Adjustable Wooden Desk', author: 'twopixels', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/57ba9e7b17464b58998e91f05dae9035' } }
      : undefined,
  name: 'Desk',
  category: 'furniture',
  blurb: 'A top at a height, which is what everything else is measured from',
  tags: ['desk', 'table', 'worktop', 'standing desk', 'furniture', 'room', 'office', 'setup'],
  doc: {
    price: 220,
    description:
      'The reference plane for a whole setup. Nothing else in this section means anything without one: a monitor arm clamps to the back edge of it, a tower stands under it, and whether two 27 inch monitors fit is a question about its width.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 1400, min: 600, max: 3000, step: 50, group: 'Desk' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 700, min: 400, max: 1200, step: 50, group: 'Desk' },
    { key: 'height', label: 'Top height', type: 'number', unit: 'mm', default: 740, min: 600, max: 1250, step: 10, group: 'Desk', help: 'Seated is 720 to 750. Standing is 1050 to 1200, and a sit-stand frame covers both.' },
    { key: 'top', label: 'Top', type: 'enum', default: 'oak', group: 'Desk', options: [{ value: 'oak', label: 'Oak' }, { value: 'walnut', label: 'Walnut' }, { value: 'plywood', label: 'Birch ply' }, { value: 'mdf', label: 'Laminated MDF' }] },
    { key: 'frame', label: 'Frame', type: 'enum', default: 'sit-stand', group: 'Desk', options: [{ value: 'sit-stand', label: 'Sit-stand column' }, { value: 'legs', label: 'Four legs' }] },
  ],
  solids: (p) => {
    const W = num(p, 'width', 1400)
    const D = num(p, 'depth', 700)
    const H = num(p, 'height', 740)
    const T = 25
    const out: Solid[] = [
      { kind: 'box', mat: str(p, 'top', 'oak'), size: [W, T, D], at: [0, H - T / 2, 0], bevel: 2 },
    ]
    if (str(p, 'frame', 'sit-stand') === 'sit-stand') {
      for (const sx of [-1, 1] as const) {
        const x = sx * (W / 2 - 110)
        out.push({ kind: 'box', mat: { color: '#2B2E33', rough: 0.6, density: 7.8 }, size: [80, H - T - 60, 80], at: [x, (H - T) / 2 + 30, 0] })
        out.push({ kind: 'box', mat: { color: '#2B2E33', rough: 0.6, density: 7.8 }, size: [60, 60, D - 80], at: [x, 30, 0], bevel: 4 })
        out.push({ kind: 'box', mat: { color: '#2B2E33', rough: 0.6, density: 7.8 }, size: [140, 24, D - 40], at: [x, H - T - 12, 0], bevel: 3 })
      }
      out.push({ kind: 'box', mat: { color: '#2B2E33', rough: 0.6, density: 7.8 }, size: [W - 300, 50, 50], at: [0, H - T - 90, 0] })
    } else {
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          out.push({ kind: 'box', mat: { color: '#2B2E33', rough: 0.6, density: 7.8 }, size: [50, H - T, 50], at: [sx * (W / 2 - 60), (H - T) / 2, sz * (D / 2 - 60)] })
        }
      }
    }
    return out
  },
  ports: (p) => {
    const W = num(p, 'width', 1400)
    const D = num(p, 'depth', 700)
    const H = num(p, 'height', 740)
    return [
      { id: 'top', label: 'Worktop', kind: 'mechanical', pos: [0, H, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'rear', label: 'Rear edge', kind: 'mechanical', pos: [0, H - 12, -D / 2], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'under', label: 'Underside', kind: 'mechanical', pos: [0, H - 25, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'left', label: 'Left edge', kind: 'mechanical', pos: [-W / 2, H - 12, 0], dir: [-1, 0, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => num(p, 'width', 1400) * num(p, 'depth', 700) * 25 * 0.0007 + 22000,
  price: (p) => 120 + (num(p, 'width', 1400) * num(p, 'depth', 700)) / 6000 + (str(p, 'frame', 'sit-stand') === 'sit-stand' ? 240 : 0),
  readouts: (p) => [
    { label: 'Top', value: `${num(p, 'width', 1400)} x ${num(p, 'depth', 700)} mm at ${num(p, 'height', 740)} mm` },
    { label: 'Knee clearance', value: `${num(p, 'height', 740) - 25 - 90} mm under the beam` },
    { label: 'Two 27 inch monitors', value: num(p, 'width', 1400) >= 1300 ? 'Fit side by side' : 'Will not fit side by side' },
  ],
}

const monitorArm: PartDef = {
  id: 'monitor-arm',
  name: 'Monitor arm',
  category: 'furniture',
  blurb: 'A clamp, two joints and a VESA plate',
  tags: ['monitor arm', 'arm', 'vesa', 'clamp', 'desk mount', 'ergonomic', 'gas spring', 'furniture'],
  doc: {
    price: 70,
    description:
      'A gas-spring arm. The rating is a range rather than a maximum — too light a screen on a stiff arm floats up, which is the failure nobody expects.',
  },
  params: [
    { key: 'reach', label: 'Reach', type: 'number', unit: 'mm', default: 450, min: 200, max: 800, step: 10, group: 'Arm' },
    { key: 'height', label: 'Post height', type: 'number', unit: 'mm', default: 420, min: 200, max: 800, step: 10, group: 'Arm' },
    { key: 'load', label: 'Rated for', type: 'enum', default: '2-9', group: 'Arm', options: [{ value: '1-5', label: '1 to 5 kg' }, { value: '2-9', label: '2 to 9 kg' }, { value: '5-15', label: '5 to 15 kg' }] },
  ],
  solids: (p) => {
    const reach = num(p, 'reach', 450)
    const H = num(p, 'height', 420)
    return [
      { kind: 'box', mat: { color: '#26292E', rough: 0.55, density: 7.8 }, size: [60, 90, 36], at: [0, -20, 0], bevel: 3 },
      { kind: 'cyl', mat: { color: '#26292E', rough: 0.55, density: 7.8 }, r: 19, h: H, seg: 22, at: [0, H / 2, 0] },
      { kind: 'box', mat: { color: '#2E3238', rough: 0.5, density: 2.7 }, size: [reach * 0.55, 34, 48], at: [reach * 0.26, H - 20, 0], bevel: 5 },
      { kind: 'box', mat: { color: '#2E3238', rough: 0.5, density: 2.7 }, size: [reach * 0.5, 28, 40], at: [reach * 0.74, H - 54, 0], rot: [0, 0, -8], bevel: 5 },
      { kind: 'box', mat: { color: '#1F2227', rough: 0.6, density: 7.8 }, size: [8, 100, 100], at: [reach, H - 70, 0], bevel: 2 },
    ]
  },
  ports: (p) => {
    const reach = num(p, 'reach', 450)
    const H = num(p, 'height', 420)
    return [
      { id: 'clamp', label: 'Desk clamp', kind: 'mechanical', pos: [0, -65, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'vesa', label: 'VESA 100', kind: 'mechanical', pos: [reach + 4, H - 70, 0], dir: [1, 0, 0], mate: { type: 'face' } },
    ]
  },
  price: (p) => 45 + num(p, 'reach', 450) * 0.05,
  readouts: (p) => {
    const [lo, hi] = str(p, 'load', '2-9').split('-')
    return [
      { label: 'Carries', value: `${lo} to ${hi} kg` },
      { label: 'Reach', value: `${num(p, 'reach', 450)} mm from the clamp` },
      { label: 'Screen centre at', value: `${num(p, 'height', 420) - 70} mm above the clamp` },
    ]
  },
}

registerParts([television, desktopMonitor, projector, soundbar, pcTower, laptop, console_, phone, router, desk, monitorArm])

void PLASTIC
void DARK
void volts
