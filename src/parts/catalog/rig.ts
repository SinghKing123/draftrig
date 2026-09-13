import type { DeviceModel, PartDef, Port, Solid, Vec2, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Sim rigs and the things a person sits at.
 *
 * Everything here faces +z: the driver is on the +z side of a seat, a wheel's
 * face points at +z, a monitor's screen looks down +z. Built that way so a rig
 * assembles by moving parts along one axis rather than rotating each one.
 *
 * The controls are wired as what they are electrically. A pedal is a divider
 * whose wiper follows the pedal, a shifter is a set of switches to a common,
 * so a board reading them sees the voltages a real one would.
 */

const DEG = Math.PI / 180

/** A side profile drawn in (z, y), for an extrude turned [0, 90, 0] to lie along X. */
const side = (pts: [number, number][]): Vec2[] => pts.map(([z, y]) => [-z, y])

const cap = (s: string): string => s[0].toUpperCase() + s.slice(1)

const DARK = { color: '#0A0C0F', rough: 0.9, density: 0.01 }
const CARBON = { color: '#17191C', rough: 0.3, clearcoat: 0.9, metal: 0.1, density: 1.6, name: 'Carbon fibre' }
const SHELL = { color: '#141619', rough: 0.36, clearcoat: 0.6, density: 1.8, name: 'Fibreglass shell' }
const CHROME = { color: '#C9CED5', metal: 1, rough: 0.18, density: 7.85, name: 'Chromed steel' }
const SUEDE = (c: string) => ({ color: c, rough: 0.97, density: 0.3, name: 'Suede' })

const FABRICS: Record<string, string> = {
  black: '#1B1D21', red: '#8E1A1F', blue: '#1F3B80', grey: '#4B5058', tan: '#86673F',
}
const ACCENTS: Record<string, string> = {
  red: '#C4262C', white: '#E6E9ED', yellow: '#E0A81E', blue: '#2F6FE0',
}
const fabric = (c: string) => ({ color: c, rough: 0.94, density: 0.1, name: 'Fabric over foam' })

const fabricOptions = Object.keys(FABRICS).map((value) => ({ value, label: cap(value) }))
const accentOptions = Object.keys(ACCENTS).map((value) => ({ value, label: cap(value) }))

/** A divider whose wiper sits at `f`, the electrical truth of a pedal or an axis. */
function divider(top: string, out: string, bottom: string, f: number, total = 10000): DeviceModel[] {
  const k = Math.min(Math.max(f, 0), 1)
  return [
    { type: 'resistor', r: 1 + total * (1 - k), a: top, b: out },
    { type: 'resistor', r: 1 + total * k, a: out, b: bottom },
  ]
}

/** Four holes on a rectangle, as mechanical ports sharing a group. */
function holePorts(prefix: string, xs: number[], zs: number[], y: number, dir: Vec3, size: number, thread = false): Port[] {
  const out: Port[] = []
  let i = 0
  for (const x of xs) {
    for (const z of zs) {
      out.push({
        id: `${prefix}${i++}`, label: thread ? `M${size} thread` : `${size} mm hole`, kind: 'mechanical',
        pos: [x, y, z], dir, mate: thread ? { type: 'thread', size } : { type: 'hole', size }, groupId: prefix,
      })
    }
  }
  return out
}

/* ================================================================== */
/* Racing seat                                                         */
/* ================================================================== */

const racingSeat: PartDef = {
  id: 'racing-seat',
  name: 'Racing seat',
  category: 'peripheral',
  blurb: 'Bucket or recliner, on steel side brackets',
  tags: ['racing seat', 'seat', 'bucket', 'chair', 'sim rig', 'cockpit', 'sim racing', 'recliner'],
  doc: {
    price: 260,
    description:
      'A fibreglass bucket on steel side brackets, which is how a sim rig takes a seat: the brackets bolt to the base rails and the seat bolts to the brackets. The fixed bucket holds you still under a motion platform; the recliner is more comfortable and moves on its own.',
  },
  params: [
    {
      key: 'style', label: 'Style', type: 'enum', default: 'bucket', group: 'Seat',
      options: [{ value: 'bucket', label: 'Fixed bucket' }, { value: 'recliner', label: 'Reclining' }],
    },
    { key: 'recline', label: 'Back angle', type: 'number', unit: '°', default: 22, min: 8, max: 45, step: 1, group: 'Seat', showIf: (p) => p.style === 'recliner' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 540, min: 480, max: 620, step: 10, group: 'Seat' },
    { key: 'harness', label: 'Harness slots', type: 'bool', default: true, group: 'Seat' },
    { key: 'fabric', label: 'Fabric', type: 'enum', default: 'black', group: 'Trim', options: fabricOptions },
    { key: 'accent', label: 'Accent', type: 'enum', default: 'red', group: 'Trim', options: accentOptions },
  ],
  solids: (p) => {
    const W = num(p, 'width', 540)
    const recliner = str(p, 'style', 'bucket') === 'recliner'
    const lean = recliner ? num(p, 'recline', 22) : 14
    const cloth = fabric(FABRICS[str(p, 'fabric', 'black')] ?? FABRICS.black)
    const accent = { color: ACCENTS[str(p, 'accent', 'red')] ?? ACCENTS.red, rough: 0.8, density: 0.1 }
    const out: Solid[] = []

    // Steel side brackets, the only thing that touches the rig.
    for (const s of [-1, 1] as const) {
      out.push({
        kind: 'extrude', mat: 'steel',
        profile: {
          outline: side([[-230, 0], [230, 0], [230, 50], [140, 100], [-140, 100], [-230, 60]]),
          holes: [circle(4.5, -150, 30, 14), circle(4.5, 150, 30, 14), circle(5, -80, 75, 14), circle(5, 80, 75, 14)],
        },
        depth: 5, rot: [0, 90, 0], at: [s * (W / 2 - 22), 0, 0],
      })
    }

    // Seat pan: a tub of shell with the cushion in it, front edge lifted.
    out.push({
      kind: 'group', mat: SHELL, at: [0, 112, 40], rot: [-6, 0, 0], children: [
        { kind: 'box', mat: SHELL, size: [W - 60, 26, 430], at: [0, -34, -10], bevel: 10 },
        { kind: 'box', mat: cloth, size: [W - 170, 56, 380], at: [0, 0, 0], bevel: 22 },
        ...[-1, 1].map((sx): Solid => ({
          kind: 'box', mat: accent, size: [26, 2, 360], at: [sx * 58, 28.5, 0], noCollide: true,
        })),
        ...(p.harness !== false
          ? [{ kind: 'box' as const, mat: DARK, size: [40, 3, 70] as Vec3, at: [0, 28, 150] as Vec3, noCollide: true }]
          : []),
      ],
    })

    // Thigh bolsters, as a side profile rising toward the back.
    for (const s of [-1, 1] as const) {
      out.push({
        kind: 'extrude', mat: cloth,
        profile: { outline: side([[245, 84], [245, 150], [165, 196], [-40, 206], [-150, 236], [-175, 84]]) },
        depth: 78, bevel: 12, rot: [0, 90, 0], at: [s * (W / 2 - 58), 0, 30],
      })
    }

    // Back, in its own frame: y runs up the back, z toward the driver.
    out.push({
      kind: 'group', mat: SHELL, at: [0, 400, -205], rot: [-lean, 0, 0], children: [
        { kind: 'box', mat: SHELL, size: [W - 50, 830, 26], at: [0, 70, -90], bevel: 10 },
        { kind: 'box', mat: cloth, size: [W - 180, 520, 72], at: [0, 0, 0], bevel: 22 },
        ...[-1, 1].flatMap((sx): Solid[] => [
          { kind: 'box', mat: cloth, size: [84, 560, 156], at: [sx * (W / 2 - 58), 20, -28], bevel: 30 },
          { kind: 'box', mat: cloth, size: [72, 190, 136], at: [sx * (W / 2 - 66), 310, -28], bevel: 26 },
          { kind: 'box', mat: accent, size: [26, 480, 2], at: [sx * 58, 0, 37], noCollide: true },
        ]),
        { kind: 'box', mat: cloth, size: [W * 0.46, 210, 96], at: [0, 385, -12], bevel: 30 },
        { kind: 'cyl', mat: accent, r: 34, h: 2, rot: [90, 0, 0], at: [0, 400, 37], seg: 28, noCollide: true },
        ...(p.harness !== false
          ? [-1, 1].map((sx): Solid => ({
              kind: 'box', mat: DARK, size: [46, 22, 120], at: [sx * 72, 272, -30], noCollide: true,
            }))
          : []),
      ],
    })

    if (recliner) {
      // The recline mechanism: a hinge boss each side and a lever on the right.
      for (const s of [-1, 1] as const) {
        out.push({ kind: 'cyl', mat: 'steel', r: 26, h: 14, rot: [0, 0, 90], at: [s * (W / 2 - 14), 150, -160], seg: 22 })
      }
      out.push({
        kind: 'tube', mat: 'abs-black', r: 7, seg: 10,
        path: [[W / 2 - 8, 150, -160], [W / 2 + 6, 150, -60], [W / 2 + 6, 140, 20]],
      })
    }
    return out
  },
  ports: (p) => {
    const W = num(p, 'width', 540)
    const out: Port[] = []
    let i = 0
    for (const s of [-1, 1] as const) {
      for (const z of [-150, 150]) {
        out.push({
          id: `mount${i++}`, label: 'M8 bracket hole', kind: 'mechanical',
          pos: [s * (W / 2 - 22 + 2.5), 30, z], dir: [s, 0, 0], mate: { type: 'hole', size: 8.5 }, groupId: 'mounts',
        })
      }
    }
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  mass: (p) => (str(p, 'style', 'bucket') === 'recliner' ? 19000 : 11500),
  price: (p) => (str(p, 'style', 'bucket') === 'recliner' ? 340 : 260),
  readouts: (p) => [
    { label: 'Width', value: `${num(p, 'width', 540)} mm` },
    { label: 'Back angle', value: `${str(p, 'style', 'bucket') === 'recliner' ? num(p, 'recline', 22) : 14}°` },
    { label: 'Weight', value: str(p, 'style', 'bucket') === 'recliner' ? '19 kg' : '11.5 kg' },
    { label: 'Mounting', value: '4 x M8, 300 mm apart' },
  ],
}

/* ================================================================== */
/* Wheel base                                                          */
/* ================================================================== */

const wheelBase: PartDef = {
  id: 'wheel-base',
  name: 'Wheel base',
  category: 'peripheral',
  blurb: 'Direct drive or belt, with a quick release hub',
  tags: ['wheel base', 'direct drive', 'force feedback', 'ffb', 'sim racing', 'motor', 'steering', 'fanatec', 'simucube'],
  doc: {
    price: 550,
    description:
      'The motor a steering wheel bolts to. A direct drive base puts the wheel straight on the motor shaft, which is why it feels every kerb; a belt base gears a smaller motor down and smooths the detail out. Torque is the number that decides how strong a rig has to be.',
  },
  params: [
    {
      key: 'drive', label: 'Drive', type: 'enum', default: 'direct', group: 'Base',
      options: [{ value: 'direct', label: 'Direct drive' }, { value: 'belt', label: 'Belt' }],
    },
    { key: 'torque', label: 'Peak torque', type: 'number', unit: 'Nm', default: 12, min: 2, max: 32, step: 1, group: 'Base' },
    { key: 'on', label: 'Powered', type: 'bool', default: true, group: 'Base' },
  ],
  solids: (p) => {
    const direct = str(p, 'drive', 'direct') === 'direct'
    const torque = num(p, 'torque', 12)
    const out: Solid[] = []
    const glow = { color: '#101418', rough: 0.3, density: 1.2, emissive: '#3C8CFF', emissiveIntensity: p.on === false ? 0 : 1.3 }

    if (direct) {
      const R = 46 + torque * 1.2
      const L = 110 + torque * 4.5
      const y = R + 8
      out.push({ kind: 'box', mat: 'alu-anod-black', size: [R * 2 - 10, 10, L * 0.8], at: [0, 5, -L * 0.1], bevel: 3 })
      out.push({ kind: 'cyl', mat: 'alu-anod-black', r: R, h: L, rot: [90, 0, 0], at: [0, y, -L / 2], seg: 40 })
      // Cooling ribs round the stator.
      const ribs = Math.max(4, Math.round(L / 22))
      for (let i = 0; i < ribs; i++) {
        out.push({
          kind: 'cyl', mat: { color: '#23272D', metal: 0.8, rough: 0.45, density: 2.7 }, r: R + 2.5, h: 5,
          rot: [90, 0, 0], at: [0, y, -L + 14 + (i * (L - 28)) / (ribs - 1)], seg: 40, noCollide: true,
        })
      }
      out.push({ kind: 'cyl', mat: 'alu-6063', r: R + 4, h: 14, rot: [90, 0, 0], at: [0, y, 7], seg: 40, chamfer: 2 })
      out.push({ kind: 'torus', mat: glow, r: R - 10, tube: 2.2, at: [0, y, 14.5], noCollide: true })
      out.push({ kind: 'cyl', mat: 'alu-6063', r: 30, h: 12, rot: [90, 0, 0], at: [0, y, 20], seg: 32 })
      out.push({ kind: 'cyl', mat: 'steel', r: 24, h: 36, rot: [90, 0, 0], at: [0, y, 40], seg: 32, chamfer: 2 })
      // Back cap and its two connectors.
      out.push({ kind: 'cyl', mat: 'abs-black', r: R - 6, h: 10, rot: [90, 0, 0], at: [0, y, -L - 5], seg: 36 })
      out.push({ kind: 'box', mat: 'steel', size: [16, 12, 8], at: [18, y, -L - 13] })
      out.push({ kind: 'cyl', mat: 'steel', r: 7, h: 10, rot: [90, 0, 0], at: [-18, y, -L - 14], seg: 16 })
    } else {
      const H = 150
      out.push({ kind: 'box', mat: 'abs-black', size: [190, H, 230], at: [0, H / 2, -115], bevel: 12 })
      out.push({ kind: 'box', mat: CARBON, size: [170, H - 20, 3], at: [0, H / 2, 1], noCollide: true })
      // Vents down each side.
      for (const s of [-1, 1] as const) {
        for (let i = 0; i < 6; i++) {
          out.push({ kind: 'box', mat: DARK, size: [1, 80, 6], at: [s * 95.2, H / 2, -40 - i * 22], noCollide: true })
        }
      }
      out.push({ kind: 'torus', mat: glow, r: 34, tube: 2, at: [0, 95, 3], noCollide: true })
      out.push({ kind: 'cyl', mat: 'alu-6063', r: 30, h: 12, rot: [90, 0, 0], at: [0, 95, 8], seg: 32 })
      out.push({ kind: 'cyl', mat: 'steel', r: 24, h: 36, rot: [90, 0, 0], at: [0, 95, 30], seg: 32, chamfer: 2 })
    }
    return out
  },
  ports: (p) => {
    const direct = str(p, 'drive', 'direct') === 'direct'
    const torque = num(p, 'torque', 12)
    const R = 46 + torque * 1.2
    const L = direct ? 110 + torque * 4.5 : 230
    const y = direct ? R + 8 : 95
    const hubZ = direct ? 58 : 48
    return [
      { id: 'hub', label: 'Quick release hub', kind: 'mechanical', pos: [0, y, hubZ], dir: [0, 0, 1], mate: { type: 'stud', size: 50 } },
      { id: 'vin', label: 'Power in (+)', kind: 'electrical', pos: [18, y, -L - 17], dir: [0, 0, -1], role: 'power', imax: 15 },
      { id: 'gnd', label: 'Power in (−)', kind: 'electrical', pos: [10, y, -L - 17], dir: [0, 0, -1], role: 'gnd', imax: 15 },
      { id: 'usb', label: 'USB', kind: 'electrical', pos: [-18, y, -L - 19], dir: [0, 0, -1], role: 'io', imax: 0.5 },
      ...holePorts('mount', [-40, 40], [-L * 0.55, -L * 0.15], 0, [0, -1, 0], 6, true),
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, -L / 2], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    // Idling a servo drive holds a few watts in the motor even with no load.
    devices: (p) => [{ type: 'resistor', r: p.on === false ? 1e7 : 24 * 24 / (6 + num(p, 'torque', 12) * 0.6), a: 'vin', b: 'gnd' }],
    limits: { vmax: 56, imax: 20 },
  },
  mass: (p) => (str(p, 'drive', 'direct') === 'direct' ? 3500 + num(p, 'torque', 12) * 280 : 5200),
  price: (p) => (str(p, 'drive', 'direct') === 'direct' ? 180 + num(p, 'torque', 12) * 38 : 300),
  readouts: (p) => {
    const t = num(p, 'torque', 12)
    return [
      { label: 'Peak torque', value: `${t} Nm` },
      { label: 'Force at a 300 mm rim', value: `${Math.round((t / 0.15) / 9.81)} kg` },
      { label: 'Peak power', value: `${Math.round(60 + t * 18)} W` },
      { label: 'Rig needs', value: t > 15 ? 'A 4040 profile frame. A desk clamp will not hold it' : 'A desk clamp or a light frame' },
    ]
  },
}

/* ================================================================== */
/* Steering wheel                                                      */
/* ================================================================== */

const steeringWheel: PartDef = {
  id: 'steering-wheel',
  name: 'Steering wheel',
  category: 'peripheral',
  blurb: 'Round, D-shaped or formula, with paddles that are real switches',
  tags: ['steering wheel', 'wheel', 'rim', 'racing wheel', 'sim racing', 'paddle shifter', 'formula', 'gt'],
  doc: {
    price: 240,
    description:
      'A rim for a wheel base, on a 50 mm quick release. The paddles are two switches to a common, so wiring them into a controller behaves like wiring the real thing.',
  },
  params: [
    {
      key: 'shape', label: 'Shape', type: 'enum', default: 'round', group: 'Rim',
      options: [{ value: 'round', label: 'Round, GT' }, { value: 'd', label: 'D-shape, rally' }, { value: 'formula', label: 'Formula' }],
    },
    { key: 'diameter', label: 'Diameter', type: 'number', unit: 'mm', default: 300, min: 260, max: 360, step: 10, group: 'Rim' },
    { key: 'grip', label: 'Grip', type: 'enum', default: 'black', group: 'Rim', options: [
      { value: 'black', label: 'Black suede' }, { value: 'grey', label: 'Grey suede' }, { value: 'tan', label: 'Tan leather' },
    ] },
    { key: 'accent', label: 'Top marker', type: 'enum', default: 'red', group: 'Rim', options: accentOptions },
    {
      key: 'paddle', label: 'Paddle held', type: 'enum', default: 'none', group: 'Control',
      options: [{ value: 'none', label: 'Neither' }, { value: 'up', label: 'Right, shift up' }, { value: 'down', label: 'Left, shift down' }],
    },
  ],
  solids: (p) => {
    const shape = str(p, 'shape', 'round')
    const D = num(p, 'diameter', 300)
    const tube = 15
    const R = D / 2 - tube
    const grips: Record<string, string> = { black: '#1A1B1E', grey: '#4E5359', tan: '#7A5A36' }
    const grip = SUEDE(grips[str(p, 'grip', 'black')] ?? grips.black)
    const accent = { color: ACCENTS[str(p, 'accent', 'red')] ?? ACCENTS.red, rough: 0.6, density: 1.2 }
    const paddle = str(p, 'paddle', 'none')
    const out: Solid[] = []

    if (shape === 'formula') {
      const w = D * 0.92
      const h = D * 0.44
      out.push({ kind: 'extrude', mat: CARBON, profile: { outline: roundRect(w - 80, h, 34, 0, 0, 6) }, depth: 22, bevel: 4, at: [0, 0, 0] })
      for (const s of [-1, 1] as const) {
        out.push({ kind: 'box', mat: grip, size: [64, h + 40, 52], at: [s * (w / 2 - 34), -8, -2], bevel: 22 })
      }
      // Display and the buttons round it.
      out.push({
        kind: 'box', mat: { color: '#070A0E', rough: 0.15, density: 2.5, emissive: '#3E7BFF', emissiveIntensity: 0.55 },
        size: [118, 46, 3], at: [0, 22, 15], noCollide: true,
      })
      const cols = ['#C4262C', '#E0A81E', '#2F6FE0', '#2BA84A', '#E6E9ED', '#1A1C1E']
      cols.forEach((c, i) => {
        const x = (i < 3 ? -1 : 1) * (78 + (i % 3) * 0)
        const y = 18 - (i % 3) * 26
        out.push({ kind: 'cyl', mat: { color: c, rough: 0.4, density: 1.2 }, r: 8, h: 8, rot: [90, 0, 0], at: [x, y, 15], seg: 18 })
      })
      for (const x of [-38, 0, 38]) {
        out.push({ kind: 'cyl', mat: 'alu-6063', r: 11, h: 12, rot: [90, 0, 0], at: [x, -36, 16], seg: 22, chamfer: 1.5 })
      }
    } else {
      if (shape === 'round') {
        out.push({ kind: 'torus', mat: grip, r: R, tube, seg: 64 })
      } else {
        // D-shape: an arc over the top and a straight chord across the bottom.
        const path: Vec3[] = []
        for (let a = -52; a <= 232; a += 8) path.push([R * Math.cos(a * DEG), R * Math.sin(a * DEG), 0])
        path.push([R * Math.cos(-52 * DEG), R * Math.sin(-52 * DEG), 0])
        out.push({ kind: 'tube', mat: grip, r: tube, seg: 14, path })
      }
      out.push({ kind: 'box', mat: accent, size: [26, tube * 2 + 1, tube * 2 + 1], at: [0, R, 0] })
      // Three spokes, dished back toward the hub.
      for (const s of [-1, 1] as const) {
        out.push({ kind: 'box', mat: 'alu-anod-black', size: [R - 40, 34, 12], at: [s * (40 + (R - 40) / 2), -6, -8], bevel: 3 })
      }
      const bottom = shape === 'd' ? R * Math.sin(52 * DEG) : R
      out.push({ kind: 'box', mat: 'alu-anod-black', size: [40, bottom - 40, 12], at: [0, -(40 + (bottom - 40) / 2), -8], bevel: 3 })
      out.push({ kind: 'cyl', mat: 'alu-anod-black', r: 56, h: 18, rot: [90, 0, 0], at: [0, 0, -6], seg: 36, chamfer: 3 })
      out.push({ kind: 'cyl', mat: accent, r: 26, h: 2, rot: [90, 0, 0], at: [0, 0, 4], seg: 28, noCollide: true })
      // Buttons on the spokes.
      const cols = ['#C4262C', '#2F6FE0', '#E0A81E', '#2BA84A']
      cols.forEach((c, i) => {
        const s = i < 2 ? -1 : 1
        out.push({
          kind: 'cyl', mat: { color: c, rough: 0.4, density: 1.2 }, r: 7, h: 6, rot: [90, 0, 0],
          at: [s * R * 0.52, i % 2 === 0 ? 7 : -19, 1], seg: 16,
        })
      })
    }

    // Quick release, and the paddles behind it.
    out.push({ kind: 'cyl', mat: 'alu-6063', r: 28, h: 34, rot: [90, 0, 0], at: [0, 0, -30], seg: 32, chamfer: 2 })
    out.push({ kind: 'cyl', mat: { color: '#C4262C', rough: 0.5, density: 2.7 }, r: 30, h: 6, rot: [90, 0, 0], at: [0, 0, -40], seg: 32 })
    for (const s of [-1, 1] as const) {
      const held = (s > 0 && paddle === 'up') || (s < 0 && paddle === 'down')
      out.push({
        kind: 'box', mat: CARBON, size: [70, 118, 5], at: [s * 76, 28, held ? -44 : -50],
        rot: [0, 0, s * 16], bevel: 2,
      })
    }
    return out
  },
  ports: () => [
    { id: 'hub', label: 'Quick release', kind: 'mechanical', pos: [0, 0, -47], dir: [0, 0, -1], mate: { type: 'hole', size: 50 } },
    { id: 'up', label: 'Paddle, shift up', kind: 'electrical', pos: [8, -20, -47], dir: [0, 0, -1], role: 'io', imax: 0.02 },
    { id: 'down', label: 'Paddle, shift down', kind: 'electrical', pos: [-8, -20, -47], dir: [0, 0, -1], role: 'io', imax: 0.02 },
    { id: 'com', label: 'Paddle common', kind: 'electrical', pos: [0, -24, -47], dir: [0, 0, -1], role: 'gnd', imax: 0.02 },
  ],
  electrical: {
    devices: (p) => [
      { type: 'switch', a: 'up', b: 'com', closed: str(p, 'paddle', 'none') === 'up', ron: 0.1, roff: 1e9 },
      { type: 'switch', a: 'down', b: 'com', closed: str(p, 'paddle', 'none') === 'down', ron: 0.1, roff: 1e9 },
    ],
  },
  mass: (p) => (str(p, 'shape', 'round') === 'formula' ? 1100 : 900 + num(p, 'diameter', 300) * 1.2),
  readouts: (p) => [
    { label: 'Diameter', value: `${num(p, 'diameter', 300)} mm` },
    { label: 'Hub', value: '50 mm quick release' },
    { label: 'Paddles', value: str(p, 'paddle', 'none') === 'none' ? 'Both open' : `${cap(str(p, 'paddle', 'none'))} closed` },
  ],
}

/* ================================================================== */
/* Pedal set                                                           */
/* ================================================================== */

const pedals: PartDef = {
  id: 'pedal-set',
  name: 'Pedal set',
  category: 'peripheral',
  blurb: 'Throttle, brake and clutch, each a real analogue output',
  tags: ['pedals', 'pedal set', 'load cell', 'brake', 'throttle', 'clutch', 'sim racing', 'sim rig'],
  doc: {
    price: 190,
    description:
      'Pedals on a steel base plate. Each one is a divider whose wiper follows the pedal, so a board reading them sees a voltage that rises as it goes down. A load cell brake measures how hard you push rather than how far, which is what a real brake does.',
  },
  params: [
    { key: 'count', label: 'Pedals', type: 'enum', default: '3', group: 'Set', options: [{ value: '2', label: 'Throttle and brake' }, { value: '3', label: 'With a clutch' }] },
    {
      key: 'brake', label: 'Brake sensor', type: 'enum', default: 'loadcell', group: 'Set',
      options: [{ value: 'loadcell', label: 'Load cell' }, { value: 'hall', label: 'Hall sensor' }],
    },
    { key: 'throttle', label: 'Throttle', type: 'number', unit: '%', default: 0, min: 0, max: 100, step: 1, group: 'Control' },
    { key: 'brakeAt', label: 'Brake', type: 'number', unit: '%', default: 0, min: 0, max: 100, step: 1, group: 'Control' },
    { key: 'clutch', label: 'Clutch', type: 'number', unit: '%', default: 0, min: 0, max: 100, step: 1, group: 'Control', showIf: (p) => p.count !== '2' },
  ],
  solids: (p) => {
    const three = str(p, 'count', '3') === '3'
    const W = three ? 430 : 300
    const D = 300
    const loadcell = str(p, 'brake', 'loadcell') === 'loadcell'
    const out: Solid[] = [
      {
        kind: 'extrude', mat: 'alu-anod-black',
        profile: {
          outline: roundRect(W, D, 14, 0, 0, 4),
          holes: ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => circle(4.5, sx * (W / 2 - 18), sz * (D / 2 - 18), 12)),
        },
        depth: 6, rot: [-90, 0, 0], at: [0, 3, 0],
      },
    ]
    const set: { x: number; f: number; kind: 'throttle' | 'brake' | 'clutch' }[] = three
      ? [
          { x: -140, f: num(p, 'clutch', 0) / 100, kind: 'clutch' },
          { x: 0, f: num(p, 'brakeAt', 0) / 100, kind: 'brake' },
          { x: 140, f: num(p, 'throttle', 0) / 100, kind: 'throttle' },
        ]
      : [
          { x: -75, f: num(p, 'brakeAt', 0) / 100, kind: 'brake' },
          { x: 75, f: num(p, 'throttle', 0) / 100, kind: 'throttle' },
        ]

    for (const pd of set) {
      const pivot: Vec3 = [pd.x, 40, 105]
      const travel = pd.kind === 'brake' && loadcell ? 6 : 22
      const theta = -(34 + travel * pd.f)
      out.push({ kind: 'box', mat: 'steel', size: [60, 36, 50], at: [pd.x, 24, 105], bevel: 3 })
      out.push({ kind: 'cyl', mat: 'steel', r: 6, h: 72, rot: [0, 0, 90], at: pivot, seg: 14 })
      out.push({
        kind: 'group', mat: 'alu-6063', at: pivot, rot: [theta, 0, 0], children: [
          { kind: 'box', mat: 'alu-6063', size: [22, 240, 16], at: [0, 120, 0], bevel: 3 },
          { kind: 'box', mat: 'alu-anod-black', size: [pd.kind === 'throttle' ? 60 : 92, 136, 10], at: [0, 214, 12], bevel: 3 },
          ...[0, 1, 2, 3].map((i): Solid => ({
            kind: 'box', mat: 'rubber', size: [pd.kind === 'throttle' ? 50 : 80, 6, 3], at: [0, 168 + i * 30, 18.5], noCollide: true,
          })),
        ],
      })
      // The damper or load cell, from the far end of the plate to the arm.
      const t = theta * DEG
      const armPt: Vec3 = [pd.x, 40 + 150 * Math.cos(t), 105 + 150 * Math.sin(t)]
      const anchor: Vec3 = [pd.x, 22, -115]
      out.push({ kind: 'box', mat: 'steel', size: [34, 30, 26], at: [pd.x, 18, -115], bevel: 2 })
      out.push({ kind: 'tube', mat: 'steel', r: 6, seg: 12, path: [anchor, armPt] })
      const mid = (k: number): Vec3 => [pd.x, anchor[1] + (armPt[1] - anchor[1]) * k, anchor[2] + (armPt[2] - anchor[2]) * k]
      if (pd.kind === 'brake' && loadcell) {
        out.push({ kind: 'tube', mat: { color: '#C4262C', rough: 0.7, density: 1.2, name: 'Elastomer' }, r: 15, seg: 16, path: [mid(0.18), mid(0.5)] })
        out.push({ kind: 'tube', mat: 'alu-6063', r: 11, seg: 16, path: [mid(0.5), mid(0.62)] })
      } else {
        out.push({ kind: 'tube', mat: 'abs-black', r: 11, seg: 14, path: [mid(0.12), mid(0.52)] })
        out.push({ kind: 'tube', mat: { color: '#E0A81E', metal: 0.6, rough: 0.4, density: 7.8 }, r: 13, seg: 14, path: [mid(0.55), mid(0.78)] })
      }
    }
    return out
  },
  ports: (p) => {
    const three = str(p, 'count', '3') === '3'
    const W = three ? 430 : 300
    const out: Port[] = [
      { id: 'vcc', label: 'Sensor supply', kind: 'electrical', pos: [-30, 8, -150], dir: [0, 0, -1], role: 'power', imax: 0.05 },
      { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [-18, 8, -150], dir: [0, 0, -1], role: 'gnd', imax: 0.05 },
      { id: 'thr', label: 'Throttle out', kind: 'electrical', pos: [-6, 8, -150], dir: [0, 0, -1], role: 'analog', imax: 0.01 },
      { id: 'brk', label: 'Brake out', kind: 'electrical', pos: [6, 8, -150], dir: [0, 0, -1], role: 'analog', imax: 0.01 },
    ]
    if (three) out.push({ id: 'clu', label: 'Clutch out', kind: 'electrical', pos: [18, 8, -150], dir: [0, 0, -1], role: 'analog', imax: 0.01 })
    out.push(...holePorts('mount', [-(W / 2 - 18), W / 2 - 18], [-132, 132], 6, [0, 1, 0], 8.5))
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const brake = num(p, 'brakeAt', 0) / 100
      // A load cell reads force, and force climbs steeply at the end of the
      // elastomer's travel, so equal steps of pedal are not equal steps of signal.
      const brakeOut = str(p, 'brake', 'loadcell') === 'loadcell' ? Math.pow(brake, 1.8) : brake
      const out: DeviceModel[] = [
        ...divider('vcc', 'thr', 'gnd', num(p, 'throttle', 0) / 100),
        ...divider('vcc', 'brk', 'gnd', brakeOut),
      ]
      if (str(p, 'count', '3') === '3') out.push(...divider('vcc', 'clu', 'gnd', num(p, 'clutch', 0) / 100))
      return out
    },
    limits: { vmax: 5.5 },
  },
  mass: (p) => (str(p, 'count', '3') === '3' ? 7800 : 5600),
  readouts: (p) => {
    const brake = num(p, 'brakeAt', 0)
    const lc = str(p, 'brake', 'loadcell') === 'loadcell'
    return [
      { label: 'Throttle', value: `${num(p, 'throttle', 0)} %` },
      { label: 'Brake', value: lc ? `${Math.round(Math.pow(brake / 100, 1.8) * 100)} kg of 100` : `${brake} %` },
      { label: 'Brake sensor', value: lc ? 'Load cell, reads force' : 'Hall, reads travel' },
      { label: 'Outputs', value: 'Ratiometric to the supply' },
    ]
  },
}

/* ================================================================== */
/* Shifter                                                             */
/* ================================================================== */

/** H-pattern gate positions: column across, and +1 forward or -1 back. */
const GATE: Record<string, [number, number]> = {
  N: [0, 0], '1': [-1.5, 1], '2': [-1.5, -1], '3': [-0.5, 1], '4': [-0.5, -1],
  '5': [0.5, 1], '6': [0.5, -1], R: [1.5, 1],
}

const shifter: PartDef = {
  id: 'gear-shifter',
  name: 'Shifter',
  category: 'peripheral',
  blurb: 'H-pattern or sequential, every gate a switch',
  tags: ['shifter', 'gear shifter', 'h pattern', 'sequential', 'gear stick', 'sim racing', 'sim rig'],
  doc: {
    price: 140,
    description:
      'A gear lever in a gated housing. Each gate closes its own switch to the common, so the gear a controller reads is the gear the lever is in. The sequential mode uses the up and down contacts instead.',
  },
  params: [
    { key: 'mode', label: 'Pattern', type: 'enum', default: 'h', group: 'Shifter', options: [{ value: 'h', label: 'H-pattern, 6 + R' }, { value: 'seq', label: 'Sequential' }] },
    { key: 'gear', label: 'Gear', type: 'enum', default: 'N', group: 'Control', options: Object.keys(GATE).map((g) => ({ value: g, label: g })), showIf: (p) => p.mode !== 'seq' },
    {
      key: 'seq', label: 'Lever', type: 'enum', default: 'centre', group: 'Control', showIf: (p) => p.mode === 'seq',
      options: [{ value: 'centre', label: 'Centre' }, { value: 'up', label: 'Pulled, up' }, { value: 'down', label: 'Pushed, down' }],
    },
  ],
  solids: (p) => {
    const seq = str(p, 'mode', 'h') === 'seq'
    const out: Solid[] = [
      { kind: 'box', mat: 'abs-black', size: [120, 80, 150], at: [0, 40, 0], bevel: 8 },
      { kind: 'box', mat: 'alu-anod-black', size: [104, 4, 134], at: [0, 82, 0], bevel: 1.5 },
      { kind: 'lathe', mat: 'rubber', seg: 24, points: [[34, 84], [32, 90], [22, 100], [12, 108], [9, 111]] },
    ]
    // The gate, cut in the top plate.
    if (seq) {
      out.push({ kind: 'box', mat: DARK, size: [8, 2, 74], at: [0, 84.2, 0], noCollide: true })
    } else {
      out.push({ kind: 'box', mat: DARK, size: [72, 2, 8], at: [0, 84.2, 0], noCollide: true })
      for (const c of [-1.5, -0.5, 0.5]) out.push({ kind: 'box', mat: DARK, size: [8, 2, 62], at: [c * 20, 84.2, 0], noCollide: true })
      out.push({ kind: 'box', mat: DARK, size: [8, 2, 31], at: [30, 84.2, -15.5], noCollide: true })
    }

    let ax = 0
    let az = 0
    if (seq) {
      const s = str(p, 'seq', 'centre')
      ax = s === 'up' ? 12 : s === 'down' ? -12 : 0
    } else {
      const [c, f] = GATE[str(p, 'gear', 'N')] ?? GATE.N
      // Forward in the gate is away from the driver, which is -z.
      ax = -f * 13
      az = -c * 9
    }
    out.push({
      kind: 'group', mat: CHROME, at: [0, 84, 0], rot: [ax, 0, az], children: [
        { kind: 'cyl', mat: CHROME, r: 5.5, h: 118, at: [0, 59, 0], seg: 14 },
        ...(seq
          ? [{ kind: 'cyl' as const, mat: 'abs-black', r: 17, h: 64, at: [0, 140, 0] as Vec3, chamfer: 6, seg: 24 }]
          : [
              { kind: 'sphere' as const, mat: { color: '#111214', rough: 0.25, clearcoat: 0.8, density: 1.2 }, r: 23, at: [0, 128, 0] as Vec3, seg: 28 },
              {
                kind: 'silk' as const, size: [26, 26] as [number, number], mat: 'silkscreen', rot: [-90, 0, 0] as Vec3, at: [0, 151.2, 0] as Vec3, px: 30, noCollide: true,
                items: [
                  { t: 'line' as const, from: [-9, 0] as [number, number], to: [9, 0] as [number, number], w: 0.8 },
                  ...[-1.5, -0.5, 0.5, 1.5].map((c) => ({ t: 'line' as const, from: [c * 6, c === 1.5 ? 0 : -7] as [number, number], to: [c * 6, 7] as [number, number], w: 0.8 })),
                ],
              },
            ]),
      ],
    })
    return out
  },
  ports: () => {
    const ids: [string, string][] = [
      ['com', 'Common'], ['g1', 'Gear 1'], ['g2', 'Gear 2'], ['g3', 'Gear 3'], ['g4', 'Gear 4'],
      ['g5', 'Gear 5'], ['g6', 'Gear 6'], ['gr', 'Reverse'], ['up', 'Sequential up'], ['down', 'Sequential down'],
    ]
    const out: Port[] = ids.map(([id, label], i) => ({
      id, label, kind: 'electrical' as const, pos: [-36 + i * 8, 10, -76] as Vec3, dir: [0, 0, -1] as Vec3,
      role: (id === 'com' ? 'gnd' : 'io') as Port['role'], imax: 0.02,
    }))
    out.push({ id: 'clamp', label: 'Clamp face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    out.push(...holePorts('mount', [-40, 40], [-50, 50], 0, [0, -1, 0], 6, true))
    return out
  },
  electrical: {
    devices: (p) => {
      const seq = str(p, 'mode', 'h') === 'seq'
      const gear = seq ? '' : str(p, 'gear', 'N')
      const lever = seq ? str(p, 'seq', 'centre') : ''
      const out: DeviceModel[] = ['1', '2', '3', '4', '5', '6', 'r'].map((g) => ({
        type: 'switch' as const, a: `g${g}`, b: 'com', closed: gear.toLowerCase() === g, ron: 0.1, roff: 1e9,
      }))
      out.push({ type: 'switch', a: 'up', b: 'com', closed: lever === 'up', ron: 0.1, roff: 1e9 })
      out.push({ type: 'switch', a: 'down', b: 'com', closed: lever === 'down', ron: 0.1, roff: 1e9 })
      return out
    },
  },
  mass: () => 2100,
  readouts: (p) => [
    { label: 'Pattern', value: str(p, 'mode', 'h') === 'seq' ? 'Sequential' : 'H, six forward and reverse' },
    { label: 'Selected', value: str(p, 'mode', 'h') === 'seq' ? cap(str(p, 'seq', 'centre')) : str(p, 'gear', 'N') === 'N' ? 'Neutral, all open' : `Gear ${str(p, 'gear', 'N')}` },
  ],
}

/* ================================================================== */
/* Handbrake                                                           */
/* ================================================================== */

const handbrake: PartDef = {
  id: 'handbrake',
  name: 'Handbrake',
  category: 'peripheral',
  blurb: 'Pull lever with an analogue output',
  tags: ['handbrake', 'e-brake', 'lever', 'rally', 'drift', 'sim racing', 'sim rig'],
  doc: { price: 90, description: 'A hydraulic-style pull lever for rally and drift. The output is a divider whose wiper follows the lever.' },
  params: [{ key: 'pulled', label: 'Pulled', type: 'number', unit: '%', default: 0, min: 0, max: 100, step: 1, group: 'Control' }],
  solids: (p) => {
    const f = num(p, 'pulled', 0) / 100
    return [
      { kind: 'box', mat: 'alu-anod-black', size: [70, 50, 170], at: [0, 25, -10], bevel: 6 },
      { kind: 'cyl', mat: 'steel', r: 8, h: 80, rot: [0, 0, 90], at: [0, 50, -60], seg: 14 },
      {
        kind: 'group', mat: CHROME, at: [0, 50, -60], rot: [-(12 + 48 * f), 0, 0], children: [
          { kind: 'tube', mat: CHROME, r: 9, seg: 14, path: [[0, 0, 0], [0, 0, 270]] },
          { kind: 'cyl', mat: 'rubber', r: 16, h: 120, rot: [90, 0, 0], at: [0, 0, 205], seg: 20, chamfer: 3 },
          { kind: 'cyl', mat: { color: '#C4262C', rough: 0.4, density: 1.2 }, r: 10, h: 12, rot: [90, 0, 0], at: [0, 0, 271], seg: 18 },
        ],
      },
    ]
  },
  ports: () => [
    { id: 'vcc', label: 'Supply', kind: 'electrical', pos: [-10, 10, -96], dir: [0, 0, -1], role: 'power', imax: 0.05 },
    { id: 'out', label: 'Output', kind: 'electrical', pos: [0, 10, -96], dir: [0, 0, -1], role: 'analog', imax: 0.01 },
    { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [10, 10, -96], dir: [0, 0, -1], role: 'gnd', imax: 0.05 },
    ...holePorts('mount', [-22, 22], [-60, 40], 0, [0, -1, 0], 6, true),
  ],
  electrical: { devices: (p) => divider('vcc', 'out', 'gnd', num(p, 'pulled', 0) / 100), limits: { vmax: 5.5 } },
  mass: () => 1400,
  readouts: (p) => [
    { label: 'Pulled', value: `${num(p, 'pulled', 0)} %` },
    { label: 'Output at 5 V', value: `${((num(p, 'pulled', 0) / 100) * 5).toFixed(2)} V` },
  ],
}

/* ================================================================== */
/* Button box                                                          */
/* ================================================================== */

const buttonBox: PartDef = {
  id: 'button-box',
  name: 'Button box',
  category: 'peripheral',
  blurb: 'Guarded toggles, a start button and two dials',
  tags: ['button box', 'switch panel', 'ignition', 'toggle', 'sim racing', 'flight sim', 'cockpit'],
  doc: {
    price: 70,
    description:
      'A small enclosure with the controls a cockpit needs within reach: guarded toggles, a big start button, and two rotary dials. The toggles are real switches to a common.',
  },
  params: [
    { key: 't1', label: 'Ignition', type: 'bool', default: false, group: 'Control' },
    { key: 't2', label: 'Pit limiter', type: 'bool', default: false, group: 'Control' },
    { key: 't3', label: 'Lights', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const W = 230
    const D = 140
    const H = 64
    const out: Solid[] = [
      { kind: 'box', mat: 'abs-black', size: [W, H, D], at: [0, H / 2, 0], bevel: 6 },
      { kind: 'box', mat: CARBON, size: [W - 12, 3, D - 12], at: [0, H + 1, 0], bevel: 1 },
      {
        kind: 'silk', size: [W - 12, D - 12], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, H + 2.6, 0], px: 8, noCollide: true,
        items: [
          { t: 'text', at: [-70, 44], text: 'IGN', size: 7, bold: true },
          { t: 'text', at: [-30, 44], text: 'PIT', size: 7, bold: true },
          { t: 'text', at: [10, 44], text: 'LIGHTS', size: 7, bold: true },
          { t: 'text', at: [70, -48], text: 'START', size: 8, bold: true },
        ],
      },
    ]
    // Three guarded toggles along the back.
    ;(['t1', 't2', 't3'] as const).forEach((k, i) => {
      const x = -70 + i * 40
      const on = p[k] === true
      out.push({ kind: 'cyl', mat: 'steel', r: 7, h: 6, at: [x, H + 5, -20], seg: 16 })
      out.push({ kind: 'cyl', mat: CHROME, r: 2.5, h: 22, at: [x, H + 14, -20], rot: [on ? 22 : -22, 0, 0], seg: 10 })
      // The flip guard, raised when the switch is on.
      out.push({
        kind: 'group', mat: 'abs-black', at: [x, H + 4, -34], rot: [on ? -70 : 0, 0, 0], children: [
          { kind: 'box', mat: { color: '#C4262C', rough: 0.45, opacity: 0.9, density: 1.2 }, size: [24, 20, 34], at: [0, 10, 17], bevel: 2 },
        ],
      })
    })
    // Start button.
    out.push({ kind: 'cyl', mat: 'steel', r: 22, h: 6, at: [70, H + 5, 20], seg: 28 })
    out.push({ kind: 'cyl', mat: { color: '#C4262C', rough: 0.35, density: 1.2, emissive: '#FF2A18', emissiveIntensity: p.t1 === true ? 1.4 : 0 }, r: 17, h: 12, at: [70, H + 12, 20], seg: 28, chamfer: 2 })
    // Two dials.
    for (const x of [-70, -20]) {
      out.push({ kind: 'cyl', mat: 'alu-6063', r: 14, h: 18, at: [x, H + 12, 34], seg: 28, chamfer: 2 })
      out.push({ kind: 'box', mat: { color: '#E6E9ED', rough: 0.6, density: 0.01 }, size: [2, 1, 10], at: [x, H + 21.5, 28], noCollide: true })
    }
    // Four push buttons.
    ;['#2F6FE0', '#E0A81E', '#2BA84A', '#E6E9ED'].forEach((c, i) => {
      out.push({ kind: 'cyl', mat: { color: c, rough: 0.4, density: 1.2 }, r: 8, h: 8, at: [20 + (i % 2) * 26, H + 6, 20 + Math.floor(i / 2) * 26 - 26], seg: 18 })
    })
    return out
  },
  ports: () => [
    { id: 'com', label: 'Common', kind: 'electrical', pos: [-24, 30, -71], dir: [0, 0, -1], role: 'gnd', imax: 0.05 },
    { id: 't1', label: 'Ignition', kind: 'electrical', pos: [-12, 30, -71], dir: [0, 0, -1], role: 'io', imax: 0.05 },
    { id: 't2', label: 'Pit limiter', kind: 'electrical', pos: [0, 30, -71], dir: [0, 0, -1], role: 'io', imax: 0.05 },
    { id: 't3', label: 'Lights', kind: 'electrical', pos: [12, 30, -71], dir: [0, 0, -1], role: 'io', imax: 0.05 },
    { id: 'usb', label: 'USB', kind: 'electrical', pos: [30, 30, -71], dir: [0, 0, -1], role: 'io', imax: 0.5 },
  ],
  electrical: {
    devices: (p) => (['t1', 't2', 't3'] as const).map((k) => ({
      type: 'switch' as const, a: k, b: 'com', closed: p[k] === true, ron: 0.05, roff: 1e9,
    })),
  },
  mass: () => 700,
}

/* ================================================================== */
/* Flight stick                                                        */
/* ================================================================== */

const flightStick: PartDef = {
  id: 'flight-stick',
  name: 'Flight stick',
  category: 'peripheral',
  blurb: 'Two axes on a gimbal, a trigger and a hat',
  tags: ['joystick', 'flight stick', 'hotas', 'flight sim', 'gimbal', 'stick', 'axis'],
  doc: {
    price: 120,
    description: 'A stick on a two-axis gimbal. Each axis is a divider, centred at half the supply, and the trigger is a switch to ground.',
  },
  params: [
    { key: 'x', label: 'Roll', type: 'number', unit: '%', default: 0, min: -100, max: 100, step: 1, group: 'Control' },
    { key: 'y', label: 'Pitch', type: 'number', unit: '%', default: 0, min: -100, max: 100, step: 1, group: 'Control' },
    { key: 'trigger', label: 'Trigger held', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const x = num(p, 'x', 0) / 100
    const y = num(p, 'y', 0) / 100
    return [
      { kind: 'box', mat: 'abs-black', size: [160, 48, 170], at: [0, 24, 0], bevel: 14 },
      { kind: 'box', mat: 'alu-anod-black', size: [120, 3, 120], at: [0, 49, -8], bevel: 1 },
      { kind: 'lathe', mat: 'rubber', seg: 24, points: [[40, 50], [38, 56], [26, 66], [14, 74], [11, 76]] },
      ...['#C4262C', '#1A1C1E', '#1A1C1E'].map((c, i): Solid => ({
        kind: 'cyl', mat: { color: c, rough: 0.4, density: 1.2 }, r: 7, h: 5, at: [-40 + i * 40, 50, 66], seg: 16,
      })),
      {
        kind: 'group', mat: 'abs-black', at: [0, 70, -8], rot: [-y * 16, 0, -x * 16], children: [
          { kind: 'cyl', mat: 'steel', r: 9, h: 40, at: [0, 20, 0], seg: 16 },
          { kind: 'lathe', mat: { color: '#1E2024', rough: 0.55, density: 1.2 }, seg: 28, points: [[0, 36], [20, 38], [26, 70], [28, 112], [24, 150], [21, 176], [15, 192], [0, 197]] },
          { kind: 'box', mat: { color: '#101113', rough: 0.4, density: 1.2 }, size: [12, 30, 16], at: [0, 128, 26], rot: [p.trigger === true ? -24 : -12, 0, 0], bevel: 3 },
          { kind: 'cyl', mat: 'steel', r: 7, h: 9, at: [0, 196, 6], seg: 12 },
          { kind: 'cyl', mat: { color: '#C4262C', rough: 0.4, density: 1.2 }, r: 6, h: 8, rot: [0, 0, 90], at: [-24, 168, 6], seg: 14 },
        ],
      },
    ]
  },
  ports: () => [
    { id: 'vcc', label: 'Supply', kind: 'electrical', pos: [-24, 12, -86], dir: [0, 0, -1], role: 'power', imax: 0.05 },
    { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [-12, 12, -86], dir: [0, 0, -1], role: 'gnd', imax: 0.05 },
    { id: 'ax', label: 'Roll axis', kind: 'electrical', pos: [0, 12, -86], dir: [0, 0, -1], role: 'analog', imax: 0.01 },
    { id: 'ay', label: 'Pitch axis', kind: 'electrical', pos: [12, 12, -86], dir: [0, 0, -1], role: 'analog', imax: 0.01 },
    { id: 'trig', label: 'Trigger', kind: 'electrical', pos: [24, 12, -86], dir: [0, 0, -1], role: 'io', imax: 0.01 },
  ],
  electrical: {
    devices: (p) => [
      ...divider('vcc', 'ax', 'gnd', 0.5 + num(p, 'x', 0) / 200),
      ...divider('vcc', 'ay', 'gnd', 0.5 + num(p, 'y', 0) / 200),
      { type: 'switch', a: 'trig', b: 'gnd', closed: p.trigger === true, ron: 0.1, roff: 1e9 },
    ],
    limits: { vmax: 5.5 },
  },
  mass: () => 1300,
  readouts: (p) => [
    { label: 'Roll', value: `${(2.5 + num(p, 'x', 0) / 40).toFixed(2)} V at 5 V` },
    { label: 'Pitch', value: `${(2.5 + num(p, 'y', 0) / 40).toFixed(2)} V at 5 V` },
    { label: 'Trigger', value: p.trigger === true ? 'Closed to ground' : 'Open' },
  ],
}

/* ================================================================== */
/* Monitor                                                             */
/* ================================================================== */

const MONITORS: Record<string, { label: string; aspect: number; px: [number, number]; radius: number }> = {
  '24': { label: '24 in, 1080p', aspect: 16 / 9, px: [1920, 1080], radius: 1800 },
  '27': { label: '27 in, 1440p', aspect: 16 / 9, px: [2560, 1440], radius: 1800 },
  '32': { label: '32 in, 4K', aspect: 16 / 9, px: [3840, 2160], radius: 1500 },
  '34': { label: '34 in ultrawide', aspect: 21 / 9, px: [3440, 1440], radius: 1500 },
  '49': { label: '49 in super ultrawide', aspect: 32 / 9, px: [5120, 1440], radius: 1000 },
}

const monitor: PartDef = {
  id: 'monitor',
  name: 'Monitor',
  category: 'peripheral',
  blurb: 'Flat or curved, on a stand or a VESA mount',
  tags: ['monitor', 'screen', 'display', 'ultrawide', 'curved', 'vesa', 'sim rig', '4k', '1440p'],
  doc: {
    price: 320,
    description: 'A desktop monitor. The panel dimensions follow from the diagonal and the aspect ratio, so a triple-screen rig laid out with these is the width it really is.',
  },
  params: [
    { key: 'size', label: 'Panel', type: 'enum', default: '27', group: 'Monitor', options: Object.entries(MONITORS).map(([value, m]) => ({ value, label: m.label })) },
    { key: 'curved', label: 'Curved', type: 'bool', default: false, group: 'Monitor' },
    { key: 'mount', label: 'Mount', type: 'enum', default: 'stand', group: 'Monitor', options: [{ value: 'stand', label: 'Its own stand' }, { value: 'vesa', label: 'VESA, no stand' }] },
    { key: 'on', label: 'Switched on', type: 'bool', default: true, group: 'Monitor' },
  ],
  solids: (p) => {
    const m = MONITORS[str(p, 'size', '27')] ?? MONITORS['27']
    const diag = parseFloat(str(p, 'size', '27')) * 25.4
    const w = diag * (m.aspect / Math.sqrt(m.aspect * m.aspect + 1))
    const h = w / m.aspect
    const stand = str(p, 'mount', 'stand') === 'stand'
    const yc = stand ? 130 + h / 2 : h / 2 + 8
    const T = 16
    const glass = {
      color: '#06080B', rough: 0.08, clearcoat: 1, density: 2.5,
      emissive: '#24497A', emissiveIntensity: p.on === false ? 0 : 0.35,
    }
    const out: Solid[] = []

    if (p.curved === true) {
      const R = m.radius
      const N = Math.max(12, Math.round(w / 60))
      const span = w / R
      for (let i = 0; i < N; i++) {
        const a = -span / 2 + (span * (i + 0.5)) / N
        const nx = -Math.sin(a)
        const nz = Math.cos(a)
        const x = R * Math.sin(a)
        const z = R - R * Math.cos(a)
        const segW = (w / N) * 1.02
        out.push({ kind: 'box', mat: 'abs-black', size: [segW + (i === 0 || i === N - 1 ? 7 : 0), h + 14, T], at: [x, yc, z], rot: [0, -a / DEG, 0] })
        out.push({ kind: 'box', mat: glass, size: [segW, h, 1], at: [x + nx * (T / 2 + 0.6), yc, z + nz * (T / 2 + 0.6)], rot: [0, -a / DEG, 0], noCollide: true })
      }
    } else {
      out.push({ kind: 'box', mat: 'abs-black', size: [w + 14, h + 14, T], at: [0, yc, 0], bevel: 2 })
      out.push({ kind: 'box', mat: glass, size: [w, h, 1], at: [0, yc, T / 2 + 0.6], noCollide: true })
    }
    // Housing behind the panel, and the VESA plate on it.
    out.push({ kind: 'box', mat: 'abs-black', size: [w * 0.45, h * 0.5, 34], at: [0, yc, -T / 2 - 17], bevel: 8 })
    out.push({ kind: 'box', mat: 'steel', size: [118, 118, 4], at: [0, yc, -T / 2 - 36] })
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        out.push({ kind: 'cyl', mat: DARK, r: 2.4, h: 5, rot: [90, 0, 0], at: [sx * 50, yc + sy * 50, -T / 2 - 36.5], seg: 10, noCollide: true })
      }
    }
    if (stand) {
      out.push({ kind: 'box', mat: 'alu-anod-black', size: [60, yc - 12, 24], at: [0, 12 + (yc - 12) / 2, -T / 2 - 52], bevel: 4 })
      out.push({
        kind: 'extrude', mat: 'alu-anod-black',
        profile: { outline: [[-150, -60], [150, -60], [60, 70], [-60, 70]] as Vec2[] },
        depth: 12, bevel: 3, rot: [-90, 0, 0], at: [0, 6, -T / 2 - 52 + 10],
      })
    }
    return out
  },
  ports: (p) => {
    const m = MONITORS[str(p, 'size', '27')] ?? MONITORS['27']
    const diag = parseFloat(str(p, 'size', '27')) * 25.4
    const w = diag * (m.aspect / Math.sqrt(m.aspect * m.aspect + 1))
    const h = w / m.aspect
    const stand = str(p, 'mount', 'stand') === 'stand'
    const yc = stand ? 130 + h / 2 : h / 2 + 8
    const back = -16 / 2 - 38
    const out: Port[] = [
      { id: 'hdmi', label: 'HDMI in', kind: 'electrical', pos: [-40, yc - h * 0.2, back], dir: [0, 0, -1], role: 'io', imax: 0.05 },
      { id: 'dp', label: 'DisplayPort in', kind: 'electrical', pos: [-20, yc - h * 0.2, back], dir: [0, 0, -1], role: 'io', imax: 0.05 },
      { id: 'power', label: 'Power in', kind: 'electrical', pos: [30, yc - h * 0.2, back], dir: [0, 0, -1], role: 'power', imax: 3 },
      { id: 'vesa', label: 'VESA face', kind: 'mechanical', pos: [0, yc, back], dir: [0, 0, -1], mate: { type: 'face' } },
    ]
    let i = 0
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        out.push({
          id: `vesa${i++}`, label: 'M4 VESA thread', kind: 'mechanical', pos: [sx * 50, yc + sy * 50, back],
          dir: [0, 0, -1], mate: { type: 'thread', size: 4 }, groupId: 'vesa',
        })
      }
    }
    return out
  },
  mass: (p) => ({ '24': 3600, '27': 5200, '32': 7400, '34': 7800, '49': 14000 })[str(p, 'size', '27')] ?? 5200,
  price: (p) => ({ '24': 160, '27': 320, '32': 520, '34': 480, '49': 1000 })[str(p, 'size', '27')] ?? 320,
  readouts: (p) => {
    const m = MONITORS[str(p, 'size', '27')] ?? MONITORS['27']
    const inches = parseFloat(str(p, 'size', '27'))
    const diag = inches * 25.4
    const w = diag * (m.aspect / Math.sqrt(m.aspect * m.aspect + 1))
    const ppi = Math.hypot(m.px[0], m.px[1]) / inches
    return [
      { label: 'Resolution', value: `${m.px[0]} x ${m.px[1]}` },
      { label: 'Visible area', value: `${Math.round(w)} x ${Math.round(w / m.aspect)} mm` },
      { label: 'Pixel density', value: `${Math.round(ppi)} ppi` },
      { label: 'Three side by side', value: `${((w * 3 + 60) / 1000).toFixed(2)} m across` },
    ]
  },
}

/* ================================================================== */
/* Keyboard                                                            */
/* ================================================================== */

/** A key: width and height in units. A negative width is a gap. */
type Key = [number, number?]
const k = (w: number, h = 1): Key => [w, h]
const g = (w: number): Key => [-w]
const ones = (n: number): Key[] => Array.from({ length: n }, () => k(1))

const MAIN: Key[][] = [
  [k(1), g(1), ...ones(4), g(0.5), ...ones(4), g(0.5), ...ones(4)],
  [...ones(13), k(2)],
  [k(1.5), ...ones(12), k(1.5)],
  [k(1.75), ...ones(11), k(2.25)],
  [k(2.25), ...ones(10), k(2.75)],
  [k(1.25), k(1.25), k(1.25), k(6.25), k(1.25), k(1.25), k(1.25), k(1.25)],
]
const NAV: Key[][] = [ones(3), ones(3), ones(3), [], [g(1), k(1)], ones(3)]
const PAD: Key[][] = [[], ones(4), [...ones(3), k(1, 2)], ones(3), [...ones(3), k(1, 2)], [k(2), k(1)]]

const keyboard: PartDef = {
  id: 'keyboard',
  name: 'Keyboard',
  category: 'peripheral',
  blurb: 'Full size, tenkeyless or 60 %, every key laid out',
  tags: ['keyboard', 'mechanical keyboard', 'tkl', '60%', 'keycaps', 'rgb', 'peripheral', 'desk'],
  doc: { price: 110, description: 'A mechanical keyboard on the standard 19.05 mm key pitch, with the real layout for each size, so desk space planned with it is the space it takes.' },
  params: [
    { key: 'layout', label: 'Layout', type: 'enum', default: 'tkl', group: 'Keyboard', options: [{ value: 'full', label: 'Full size' }, { value: 'tkl', label: 'Tenkeyless' }, { value: '60', label: '60 %' }] },
    { key: 'caps', label: 'Keycaps', type: 'enum', default: 'dark', group: 'Keyboard', options: [{ value: 'dark', label: 'Dark grey' }, { value: 'light', label: 'Off white' }, { value: 'retro', label: 'Retro beige' }] },
    { key: 'rgb', label: 'Backlight', type: 'bool', default: true, group: 'Keyboard' },
  ],
  solids: (p) => {
    const U = 19.05
    const layout = str(p, 'layout', 'tkl')
    const hasF = layout !== '60'
    const rows = hasF ? 6 : 5
    const units = layout === 'full' ? 22.5 : layout === 'tkl' ? 18.5 : 15
    const depth = rows * U + (hasF ? U * 0.5 : 0)
    const W = units * U
    const palettes: Record<string, [string, string, string]> = {
      dark: ['#2B2E33', '#1B1D21', '#C4262C'],
      light: ['#E8E6E0', '#9EA3AA', '#2F6FE0'],
      retro: ['#D9CCB4', '#8C8475', '#C4262C'],
    }
    const [alpha, mod, esc] = palettes[str(p, 'caps', 'dark')] ?? palettes.dark
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#202328', metal: 0.7, rough: 0.45, density: 2.7 }, size: [W + 18, 22, depth + 18], at: [0, 11, 0], bevel: 5 },
    ]
    if (p.rgb !== false) {
      out.push({
        kind: 'box', mat: { color: '#101216', rough: 0.4, density: 0.01, emissive: '#6A4CFF', emissiveIntensity: 1.1 },
        size: [W, 0.6, depth], at: [0, 22.4, 0], noCollide: true,
      })
    }

    const place = (block: Key[][], x0: number, skipF: boolean) => {
      block.forEach((row, ri) => {
        if (skipF && ri === 0) return
        const r = skipF ? ri - 1 : ri
        const zTop = r * U + (hasF && r > 0 ? U * 0.5 : 0)
        let x = x0
        for (const [w, h = 1] of row) {
          if (w < 0) {
            x += -w
            continue
          }
          const cx = -W / 2 + (x + w / 2) * U
          const cz = -depth / 2 + zTop + (h * U) / 2
          const isMod = w !== 1 || r === 0 || x0 > 0
          const col = ri === 0 && x === 0 && x0 === 0 ? esc : isMod ? mod : alpha
          out.push({
            kind: 'box', mat: { color: col, rough: 0.7, density: 1.1, name: 'PBT keycap' },
            size: [w * U - 1.6, 8, h * U - 1.6], at: [cx, 28 + (r === 0 ? 1.5 : r >= 4 ? 0.8 : 0), cz], bevel: 1.2,
          })
          x += w
        }
      })
    }
    place(MAIN, 0, !hasF)
    if (layout !== '60') place(NAV, 15.25, false)
    if (layout === 'full') place(PAD, 18.5, false)
    return out
  },
  ports: (p) => {
    const U = 19.05
    const layout = str(p, 'layout', 'tkl')
    const rows = layout === '60' ? 5 : 6
    const depth = rows * U + (layout === '60' ? 0 : U * 0.5)
    return [
      { id: 'usb', label: 'USB-C', kind: 'electrical', pos: [0, 11, -depth / 2 - 10], dir: [0, 0, -1], role: 'io', imax: 0.5 },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => ({ full: 1250, tkl: 980, '60': 700 })[str(p, 'layout', 'tkl')] ?? 980,
  readouts: (p) => {
    const layout = str(p, 'layout', 'tkl')
    const units = layout === 'full' ? 22.5 : layout === 'tkl' ? 18.5 : 15
    return [
      { label: 'Keys', value: layout === 'full' ? '104' : layout === 'tkl' ? '87' : '61' },
      { label: 'Width', value: `${Math.round(units * 19.05 + 18)} mm` },
      { label: 'Pitch', value: '19.05 mm' },
    ]
  },
}

/* ================================================================== */
/* Mouse                                                               */
/* ================================================================== */

const mouse: PartDef = {
  id: 'mouse',
  name: 'Mouse',
  category: 'peripheral',
  blurb: 'Right-handed shape with a wheel and side buttons',
  tags: ['mouse', 'gaming mouse', 'peripheral', 'desk', 'pointer', 'usb'],
  doc: { price: 60, description: 'A right-handed gaming mouse. About 125 mm long, which is the size most hands settle on.' },
  params: [
    { key: 'color', label: 'Shell', type: 'enum', default: 'black', group: 'Mouse', options: [{ value: 'black', label: 'Black' }, { value: 'white', label: 'White' }] },
    { key: 'cable', label: 'Wired', type: 'bool', default: true, group: 'Mouse' },
  ],
  solids: (p) => {
    const shell = str(p, 'color', 'black') === 'white'
      ? { color: '#E9EAEC', rough: 0.5, density: 1.1 }
      : { color: '#17191C', rough: 0.55, density: 1.1 }
    const outline: Vec2[] = []
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * Math.PI * 2
      // Wider at the palm (+z) than at the buttons, as a hand is.
      const wide = 1 + 0.16 * Math.sin(t)
      outline.push([22 * Math.cos(t) * wide, -52 * Math.sin(t)])
    }
    const out: Solid[] = [
      { kind: 'extrude', mat: shell, profile: { outline }, depth: 16, bevel: 10, rot: [-90, 0, 0], at: [0, 18, 0] },
      { kind: 'box', mat: DARK, size: [1.2, 3, 46], at: [0, 36.2, -34], noCollide: true },
      { kind: 'cyl', mat: 'rubber', r: 9, h: 7, rot: [0, 0, 90], at: [0, 35, -36], seg: 20 },
      { kind: 'box', mat: { color: '#2A2D32', rough: 0.4, density: 1.1 }, size: [3, 8, 16], at: [-33, 22, -8], bevel: 1 },
      { kind: 'box', mat: { color: '#2A2D32', rough: 0.4, density: 1.1 }, size: [3, 8, 16], at: [-33, 22, 12], bevel: 1 },
      { kind: 'cyl', mat: { color: '#0E1013', rough: 0.3, density: 1, emissive: '#3C8CFF', emissiveIntensity: 1.2 }, r: 6, h: 1, at: [0, 36.4, 26], seg: 18, noCollide: true },
    ]
    if (p.cable !== false) {
      out.push({ kind: 'tube', mat: 'abs-black', r: 1.6, seg: 8, path: [[0, 14, -60], [0, 12, -90], [8, 4, -130], [16, 2, -180]] })
    }
    return out
  },
  ports: () => [
    { id: 'usb', label: 'USB', kind: 'electrical', pos: [16, 2, -180], dir: [0, 0, -1], role: 'io', imax: 0.1 },
    { id: 'base', label: 'Skates', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  mass: () => 80,
}

/* ================================================================== */
/* Headset                                                             */
/* ================================================================== */

const headset: PartDef = {
  id: 'headset',
  name: 'Headset',
  category: 'peripheral',
  blurb: 'Closed-back cups and a boom mic',
  tags: ['headset', 'headphones', 'microphone', 'audio', 'peripheral', 'gaming'],
  doc: { price: 90, description: 'Over-ear headphones with a boom microphone on the left cup.' },
  params: [
    { key: 'accent', label: 'Accent', type: 'enum', default: 'red', group: 'Headset', options: accentOptions },
    { key: 'mic', label: 'Boom mic', type: 'bool', default: true, group: 'Headset' },
  ],
  solids: (p) => {
    const accent = { color: ACCENTS[str(p, 'accent', 'red')] ?? ACCENTS.red, rough: 0.4, metal: 0.4, density: 2.7 }
    const band: Vec3[] = []
    for (let a = 0; a <= 180; a += 10) band.push([92 * Math.cos(a * DEG), 138 + 92 * Math.sin(a * DEG), 0])
    const pad: Vec3[] = band.map(([x, y, z]) => [x * 0.9, 138 + (y - 138) * 0.9, z])
    const out: Solid[] = [
      { kind: 'tube', mat: 'steel', r: 4, seg: 10, path: band },
      { kind: 'tube', mat: fabric('#1B1D21'), r: 9, seg: 12, path: pad.slice(3, -3) },
    ]
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'tube', mat: 'abs-black', r: 5, seg: 10, path: [[s * 92, 138, 0], [s * 100, 120, 0]] })
      out.push({ kind: 'cyl', mat: 'abs-black', r: 50, h: 32, rot: [0, 0, 90], at: [s * 104, 76, 0], seg: 36, chamfer: 5 })
      out.push({ kind: 'torus', mat: { color: '#141518', rough: 0.95, density: 0.2, name: 'Memory foam' }, r: 40, tube: 13, rot: [0, 90, 0], at: [s * 84, 76, 0], seg: 36 })
      out.push({ kind: 'torus', mat: accent, r: 47, tube: 2.4, rot: [0, 90, 0], at: [s * 121, 76, 0], seg: 36, noCollide: true })
    }
    if (p.mic !== false) {
      out.push({ kind: 'tube', mat: 'abs-black', r: 2.6, seg: 8, path: [[-118, 58, 22], [-112, 40, 70], [-78, 30, 112], [-40, 34, 128]] })
      out.push({ kind: 'sphere', mat: { color: '#202226', rough: 0.95, density: 0.1 }, r: 9, at: [-38, 34, 128], seg: 14 })
    }
    return out
  },
  ports: () => [
    { id: 'usb', label: 'USB', kind: 'electrical', pos: [-104, 26, 0], dir: [0, -1, 0], role: 'io', imax: 0.2 },
  ],
  mass: () => 320,
}

/* ================================================================== */
/* Desk                                                                */
/* ================================================================== */

const desk: PartDef = {
  id: 'desk',
  name: 'Desk',
  category: 'peripheral',
  blurb: 'A top on a steel frame, at a height you can set',
  tags: ['desk', 'table', 'standing desk', 'gaming desk', 'workbench', 'furniture'],
  doc: { price: 280, description: 'A desk top on a two-leg steel frame. Height adjusts, which turns it into a standing desk and back.' },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 1400, min: 900, max: 2000, step: 50, group: 'Desk' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 700, min: 500, max: 900, step: 25, group: 'Desk' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 740, min: 620, max: 1250, step: 10, group: 'Desk' },
    { key: 'top', label: 'Top', type: 'enum', default: 'oak', group: 'Desk', options: [{ value: 'oak', label: 'Oak' }, { value: 'walnut', label: 'Walnut' }, { value: 'abs-black', label: 'Black laminate' }] },
    { key: 'mat', label: 'Desk mat', type: 'bool', default: true, group: 'Desk' },
  ],
  solids: (p) => {
    const W = num(p, 'width', 1400)
    const D = num(p, 'depth', 700)
    const H = num(p, 'height', 740)
    const T = 25
    const frame = { color: '#1E2126', metal: 0.8, rough: 0.5, density: 7.85, name: 'Powder-coated steel' }
    const out: Solid[] = [
      { kind: 'extrude', mat: str(p, 'top', 'oak'), profile: { outline: roundRect(W, D, 12, 0, 0, 4) }, depth: T, bevel: 2, rot: [-90, 0, 0], at: [0, H - T / 2, 0] },
    ]
    for (const s of [-1, 1] as const) {
      const x = s * (W / 2 - 160)
      out.push({ kind: 'box', mat: frame, size: [70, H - T - 40, 50], at: [x, 40 + (H - T - 40) / 2, -D * 0.1], bevel: 3 })
      out.push({ kind: 'box', mat: frame, size: [70, 30, D - 60], at: [x, 15, -D * 0.1 + 20], bevel: 4 })
      out.push({ kind: 'box', mat: frame, size: [60, 30, D - 120], at: [x, H - T - 15, 0], bevel: 3 })
      for (const z of [-D / 2 + 60, D / 2 - 80]) out.push({ kind: 'cyl', mat: 'rubber', r: 14, h: 8, at: [x, 4, z], seg: 16 })
    }
    out.push({ kind: 'box', mat: frame, size: [W - 390, 50, 40], at: [0, H - T - 25, -D * 0.1], bevel: 3 })
    if (p.mat !== false) {
      out.push({ kind: 'box', mat: { color: '#141619', rough: 0.95, density: 1.2, name: 'Cloth desk mat' }, size: [900, 3, 400], at: [0, H + 1.5, D * 0.12], bevel: 1 })
    }
    return out
  },
  ports: (p) => [
    { id: 'top', label: 'Desk top', kind: 'mechanical', pos: [0, num(p, 'height', 740), 0], dir: [0, 1, 0], mate: { type: 'face' } },
    { id: 'base', label: 'Feet', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  mass: (p) => 18000 + (num(p, 'width', 1400) * num(p, 'depth', 700) * 25 * 0.7) / 1000,
  readouts: (p) => [
    { label: 'Top', value: `${num(p, 'width', 1400)} x ${num(p, 'depth', 700)} mm` },
    { label: 'Height', value: `${num(p, 'height', 740)} mm` },
    { label: 'Use', value: num(p, 'height', 740) > 950 ? 'Standing' : 'Sitting' },
  ],
}

registerParts([
  racingSeat, wheelBase, steeringWheel, pedals, shifter, handbrake, buttonBox, flightStick,
  monitor, keyboard, mouse, headset, desk,
])
