import type { DeviceModel, ParamSpec, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { bool, circle, num, roundRect, str } from './_helpers'

/**
 * Switches, motors and the other things that move.
 *
 * The rule followed throughout: the position of the moving part is a parameter,
 * and everything electrical follows from it. A switch that is drawn thrown is
 * thrown in the solver too, and a rotary encoder set to one detent puts out the
 * quadrature code for that detent rather than a plausible-looking one.
 */

const P = 2.54

/* ================================================================== */
/* Rotary encoder                                                      */
/* ================================================================== */

/**
 * Quadrature contact state at a given detent.
 *
 * The two contacts are offset by a quarter cycle, which is what lets a reader
 * tell which way the shaft turned. On a detented encoder both contacts are
 * open at rest, so the sequence runs through the four states between clicks.
 */
function quadrature(detent: number): [boolean, boolean] {
  const phase = ((Math.round(detent) % 4) + 4) % 4
  return [phase === 1 || phase === 2, phase === 2 || phase === 3]
}

const rotaryEncoder: PartDef = {
  id: 'encoder-rotary',
  name: 'Rotary encoder',
  category: 'electromech',
  blurb: 'Detented quadrature output, with a push switch in the shaft',
  tags: ['encoder', 'rotary', 'quadrature', 'knob', 'ec11', 'dial', 'switch', 'menu'],
  doc: {
    manufacturer: 'Alps',
    mpn: 'EC11',
    price: 0.7,
    description:
      'The 20-detent encoder behind almost every menu knob. Two contacts a quarter cycle apart tell a reader direction as well as movement; a third pin is the push switch under the shaft.',
  },
  params: [
    { key: 'detent', label: 'Detent', type: 'number', default: 0, min: 0, max: 19, step: 1, group: 'Control', help: 'Which click the shaft is resting on. The A and B contacts follow.' },
    { key: 'pressed', label: 'Shaft pressed', type: 'bool', default: false, group: 'Control' },
    { key: 'knob', label: 'Knob fitted', type: 'bool', default: true, group: 'Body' },
    { key: 'knobColor', label: 'Knob colour', type: 'color', default: '#1A1D22', group: 'Body', showIf: (p) => p.knob !== false },
  ],
  solids: (p) => {
    const pressed = bool(p, 'pressed', false)
    const drop = pressed ? 0.4 : 0
    const out: Solid[] = [
      // Plated body can, with the mounting bush and threaded boss on top.
      { kind: 'box', mat: 'nickel', size: [12.4, 6.4, 13.2], at: [0, 3.2, 0], bevel: 0.4 },
      { kind: 'cyl', mat: 'nickel', r: 3.5, h: 5, at: [0, 8.5, 0] },
      { kind: 'cyl', mat: 'nickel', r: 2.9, h: 8, at: [0, 12, 0] },
      // D-shaft: a cylinder with a flat milled down one side.
      {
        kind: 'cyl', mat: 'nickel', r: 3, h: 15 - drop, at: [0, 18.5 - drop / 2, 0],
        phi: [-100, 320],
      },
      // Anti-rotation lug beside the bush, which is why the panel hole is not round.
      { kind: 'box', mat: 'nickel', size: [1.6, 2.2, 1.6], at: [0, 7.2, -4.6] },
    ]
    if (p.knob !== false) {
      const c = str(p, 'knobColor', '#1A1D22')
      out.push({ kind: 'cyl', mat: { color: c, rough: 0.48, density: 1.2 }, r: 8, h: 16, chamfer: 1.4, at: [0, 24 - drop, 0], seg: 28 })
      out.push({ kind: 'box', mat: { color: '#E6EAF0', rough: 0.6, density: 0.01 }, size: [1.2, 16, 8], at: [0, 24 - drop, -6], noCollide: true })
    }
    // Three pins on the encoder side, two on the switch side.
    for (const x of [-2.5, 0, 2.5]) out.push({ kind: 'box', mat: 'tin', size: [0.6, 4, 0.35], at: [x, -2, 6.9] })
    for (const x of [-2.5, 2.5]) out.push({ kind: 'box', mat: 'tin', size: [0.6, 4, 0.35], at: [x, -2, -6.9] })
    return out
  },
  ports: () => [
    { id: 'a', label: 'A', kind: 'electrical', pos: [-2.5, -4, 6.9], dir: [0, -1, 0], role: 'io', imax: 0.01, solderable: true },
    { id: 'c', label: 'C (common)', kind: 'electrical', pos: [0, -4, 6.9], dir: [0, -1, 0], role: 'passive', imax: 0.01, solderable: true },
    { id: 'b', label: 'B', kind: 'electrical', pos: [2.5, -4, 6.9], dir: [0, -1, 0], role: 'io', imax: 0.01, solderable: true },
    { id: 'sw1', label: 'Switch', kind: 'electrical', pos: [-2.5, -4, -6.9], dir: [0, -1, 0], role: 'passive', imax: 0.05, solderable: true },
    { id: 'sw2', label: 'Switch', kind: 'electrical', pos: [2.5, -4, -6.9], dir: [0, -1, 0], role: 'passive', imax: 0.05, solderable: true },
  ],
  electrical: {
    devices: (p) => {
      const [a, b] = quadrature(num(p, 'detent', 0))
      return [
        { type: 'switch', a: 'a', b: 'c', closed: a, ron: 2, roff: 1e9 },
        { type: 'switch', a: 'b', b: 'c', closed: b, ron: 2, roff: 1e9 },
        { type: 'switch', a: 'sw1', b: 'sw2', closed: bool(p, 'pressed', false), ron: 0.1, roff: 1e9 },
      ]
    },
  },
  readouts: (p) => {
    const [a, b] = quadrature(num(p, 'detent', 0))
    return [
      { label: 'Detents', value: '20 per turn' },
      { label: 'A contact', value: a ? 'Closed' : 'Open' },
      { label: 'B contact', value: b ? 'Closed' : 'Open' },
      { label: 'Push switch', value: bool(p, 'pressed', false) ? 'Closed' : 'Open' },
    ]
  },
}

/* ================================================================== */
/* DIP switch                                                          */
/* ================================================================== */

const DIP_MAX = 8

/** One bool per switch, hidden past the configured way count. */
const dipParams = (): ParamSpec[] =>
  Array.from({ length: DIP_MAX }, (_, i) => ({
    key: `s${i + 1}`,
    label: `Switch ${i + 1}`,
    type: 'bool' as const,
    default: false,
    group: 'Control',
    showIf: (p: Record<string, unknown>) => (typeof p.ways === 'number' ? p.ways : 8) > i,
  }))

const dipSwitch: PartDef = {
  id: 'switch-dip',
  name: 'DIP switch',
  category: 'electromech',
  blurb: 'A block of tiny slide switches you set once',
  tags: ['dip switch', 'switch', 'address', 'config', 'slide', 'sip', 'jumper'],
  doc: {
    price: 0.4,
    description:
      'A row of independent SPST switches in a DIP package. What you set an address or a mode with when there is no firmware to ask.',
  },
  params: [
    { key: 'ways', label: 'Ways', type: 'number', default: 4, min: 2, max: DIP_MAX, step: 1, group: 'Body' },
    ...dipParams(),
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'ways', 4))
    const w = n * P + 1.4
    const d = 9.8
    const h = 4.6
    const x0 = -((n - 1) / 2) * P
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#C4262C', rough: 0.55, density: 1.5 }, size: [w, h, d], at: [0, h / 2, 0], bevel: 0.3 },
      // Recessed channel the actuators sit in.
      { kind: 'box', mat: { color: '#7A1518', rough: 0.8, density: 0.01 }, size: [w - 1.6, 0.8, 5.4], at: [0, h - 0.2, 0], noCollide: true },
    ]
    for (let i = 0; i < n; i++) {
      const x = x0 + i * P
      const on = bool(p, `s${i + 1}`, false)
      // Actuator, at one end of its travel or the other.
      out.push({
        kind: 'box', mat: { color: '#F2F4F6', rough: 0.5, density: 1.4 },
        size: [1.5, 1.4, 2.4], at: [x, h - 0.3, on ? -1.4 : 1.4],
      })
      for (const s of [-1, 1] as const) {
        out.push({ kind: 'box', mat: 'tin', size: [0.5, 4.2, 0.3], at: [x, -2.1, (s * 7.62) / 2] })
      }
    }
    // "ON" legend along the closed side, as every one of these carries.
    out.push({
      kind: 'silk', size: [w, d], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, h + 0.02, 0], px: 30, noCollide: true,
      items: [
        { t: 'text', at: [-w / 2 + 2.2, -d / 2 + 1.6], text: 'ON', size: 1.6, bold: true },
        ...Array.from({ length: n }, (_, i) => ({ t: 'text' as const, at: [x0 + i * P, d / 2 - 1.4] as [number, number], text: String(i + 1), size: 1.5 })),
      ],
    })
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'ways', 4))
    const x0 = -((n - 1) / 2) * P
    const out: Port[] = []
    for (let i = 0; i < n; i++) {
      for (const [k, s] of ([['a', -1], ['b', 1]] as const)) {
        out.push({
          id: `${k}${i + 1}`, label: `${i + 1}${k.toUpperCase()}`, kind: 'electrical',
          pos: [x0 + i * P, -4.2, (s * 7.62) / 2], dir: [0, -1, 0], role: 'passive', imax: 0.1, solderable: true,
        })
      }
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const n = Math.round(num(p, 'ways', 4))
      const out: DeviceModel[] = []
      for (let i = 1; i <= n; i++) {
        out.push({ type: 'switch', a: `a${i}`, b: `b${i}`, closed: bool(p, `s${i}`, false), ron: 0.05, roff: 1e9 })
      }
      return out
    },
  },
  readouts: (p) => {
    const n = Math.round(num(p, 'ways', 4))
    let word = 0
    for (let i = 0; i < n; i++) if (bool(p, `s${i + 1}`, false)) word |= 1 << i
    return [
      { label: 'Ways', value: String(n) },
      { label: 'Setting', value: Array.from({ length: n }, (_, i) => (bool(p, `s${i + 1}`, false) ? '1' : '0')).join('') },
      { label: 'As a number', value: `${word} (0x${word.toString(16).toUpperCase()})` },
    ]
  },
}

/* ================================================================== */
/* Slide switch                                                        */
/* ================================================================== */

const slideSwitch: PartDef = {
  id: 'switch-slide',
  name: 'Slide switch',
  category: 'electromech',
  blurb: 'SPDT, stays where you put it',
  tags: ['slide', 'switch', 'spdt', 'power', 'selector', 'ss12d00'],
  doc: {
    mpn: 'SS12D00',
    price: 0.15,
    description: 'Miniature SPDT slide switch. The common pin goes to one side or the other and stays there, which is what a power switch has to do.',
  },
  params: [
    {
      key: 'position', label: 'Position', type: 'enum', default: 'a', group: 'Control',
      options: [{ value: 'a', label: 'Toward pin 1' }, { value: 'b', label: 'Toward pin 3' }],
    },
  ],
  solids: (p) => {
    const toA = str(p, 'position', 'a') === 'a'
    const W = 11.6
    const H = 4
    const D = 6.7
    return [
      { kind: 'box', mat: { color: '#E8EAEC', rough: 0.55, density: 1.5 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 0.3 },
      // Metal cover over the top with the slot the actuator runs in.
      { kind: 'box', mat: 'nickel', size: [W + 0.6, 1.2, D + 0.6], at: [0, H + 0.2, 0] },
      { kind: 'box', mat: { color: '#0A0C0E', rough: 0.9, density: 0.01 }, size: [7, 0.4, 2], at: [0, H + 0.85, 0], noCollide: true },
      { kind: 'box', mat: { color: '#1B1E22', rough: 0.5, density: 1.2 }, size: [2.4, 3.2, 1.6], at: [toA ? -2 : 2, H + 2.2, 0] },
      // Three pins, plus the two ground tabs that hold it to a board.
      ...[-P, 0, P].map((x): Solid => ({ kind: 'box', mat: 'tin', size: [0.5, 4, 0.9], at: [x, -2, 0] })),
      ...([-1, 1] as const).map((s): Solid => ({ kind: 'box', mat: 'nickel', size: [1.2, 3, 0.5], at: [s * 4.8, -1.5, D / 2] })),
    ]
  },
  ports: () => [
    { id: 'p1', label: 'Pin 1', kind: 'electrical', pos: [-P, -4, 0], dir: [0, -1, 0], role: 'passive', imax: 0.3, solderable: true },
    { id: 'com', label: 'Common', kind: 'electrical', pos: [0, -4, 0], dir: [0, -1, 0], role: 'passive', imax: 0.3, solderable: true },
    { id: 'p3', label: 'Pin 3', kind: 'electrical', pos: [P, -4, 0], dir: [0, -1, 0], role: 'passive', imax: 0.3, solderable: true },
  ],
  electrical: {
    devices: (p) => {
      const toA = str(p, 'position', 'a') === 'a'
      return [
        { type: 'switch', a: 'com', b: 'p1', closed: toA, ron: 0.05, roff: 1e9 },
        { type: 'switch', a: 'com', b: 'p3', closed: !toA, ron: 0.05, roff: 1e9 },
      ]
    },
    limits: { imax: 0.3, vmax: 50 },
  },
  readouts: (p) => [
    { label: 'Contacts', value: 'SPDT' },
    { label: 'Common joined to', value: str(p, 'position', 'a') === 'a' ? 'Pin 1' : 'Pin 3' },
    { label: 'Rating', value: '300 mA, 50 V' },
  ],
}

/* ================================================================== */
/* Stepper motor                                                       */
/* ================================================================== */

const STEPPERS: Record<string, { label: string; body: number; len: number; shaft: number; holes: number; r: number; l: number; hold: number; mass: number }> = {
  '17-40': { label: 'NEMA 17, 40 mm, 0.4 Nm', body: 42.3, len: 40, shaft: 5, holes: 31, r: 2.0, l: 0.004, hold: 0.4, mass: 280 },
  '17-48': { label: 'NEMA 17, 48 mm, 0.55 Nm', body: 42.3, len: 48, shaft: 5, holes: 31, r: 1.5, l: 0.0034, hold: 0.55, mass: 350 },
  '23-56': { label: 'NEMA 23, 56 mm, 1.26 Nm', body: 56.4, len: 56, shaft: 6.35, holes: 47.14, r: 1.1, l: 0.0028, hold: 1.26, mass: 700 },
  '14-34': { label: 'NEMA 14, 34 mm, 0.14 Nm', body: 35.2, len: 34, shaft: 5, holes: 26, r: 3.2, l: 0.0055, hold: 0.14, mass: 160 },
}

const stepperMotor: PartDef = {
  id: 'motor-stepper',
  name: 'Stepper motor',
  category: 'motion',
  blurb: 'Two coils, 200 steps a turn, holds its position',
  tags: ['stepper', 'motor', 'nema', 'nema17', '3d printer', 'cnc', 'bipolar', 'motion'],
  doc: {
    manufacturer: 'Generic',
    mpn: '17HS4401',
    price: 12,
    description:
      'Bipolar stepper with two independent coils. It moves 1.8 degrees per step and holds where it stops, which is why nothing on a printer needs an encoder.',
  },
  params: [
    { key: 'model', label: 'Frame', type: 'enum', default: '17-48', group: 'Motor', options: Object.entries(STEPPERS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'shaftLen', label: 'Shaft length', type: 'number', unit: 'mm', default: 24, min: 10, max: 60, step: 1, group: 'Motor' },
    { key: 'flat', label: 'Flat on shaft', type: 'bool', default: true, group: 'Motor' },
    { key: 'angle', label: 'Shaft angle', type: 'number', unit: '°', default: 0, min: 0, max: 360, step: 1.8, group: 'Control' },
  ],
  solids: (p) => {
    const s = STEPPERS[str(p, 'model', '17-48')] ?? STEPPERS['17-48']
    const b = s.body
    const L = s.len
    const shaftLen = num(p, 'shaftLen', 24)
    const out: Solid[] = []

    // The stack: two aluminium end caps with the laminated steel body between.
    const corner = 5
    const capProfile = { outline: roundRect(b, b, corner, 0, 0, 4) }
    out.push({ kind: 'extrude', mat: 'alu-anod-black', profile: capProfile, depth: 8, rot: [0, 90, 0], at: [L / 2 - 4, b / 2, 0] })
    out.push({ kind: 'extrude', mat: 'alu-anod-black', profile: capProfile, depth: 8, rot: [0, 90, 0], at: [-L / 2 + 4, b / 2, 0] })
    // The lamination stack is slightly smaller than the caps and is bare steel.
    out.push({
      kind: 'extrude', mat: { color: '#4A4E55', rough: 0.55, metal: 1, density: 7.6 },
      profile: { outline: roundRect(b - 1.4, b - 1.4, corner, 0, 0, 4) },
      depth: L - 16, rot: [0, 90, 0], at: [0, b / 2, 0],
    })
    // Visible lamination lines: a few thin rings, which is what these look like.
    for (let i = 0; i < 5; i++) {
      out.push({
        kind: 'extrude', mat: { color: '#2E3136', rough: 0.8, density: 0.01 },
        profile: { outline: roundRect(b - 1.0, b - 1.0, corner, 0, 0, 4) },
        depth: 0.35, rot: [0, 90, 0], at: [-(L - 18) / 2 + (i * (L - 18)) / 4, b / 2, 0], noCollide: true,
      })
    }
    // Front boss and shaft.
    out.push({ kind: 'cyl', mat: 'alu-6063', r: 11, h: 2, rot: [0, 0, 90], at: [L / 2 + 1, b / 2, 0] })
    out.push({
      kind: 'cyl', mat: 'steel', r: s.shaft / 2, h: shaftLen, rot: [0, 0, 90],
      at: [L / 2 + 2 + shaftLen / 2, b / 2, 0],
      phi: p.flat !== false ? [-70, 320] : undefined,
    })
    // Flying leads, four of them in the usual colours.
    const colors = ['#1A1C1E', '#1F9E4B', '#C4262C', '#1F5FCC']
    colors.forEach((c, i) => {
      const z = -3 + i * 2
      out.push({
        kind: 'tube', mat: { color: c, rough: 0.6, density: 1.4 }, r: 0.8, seg: 6,
        path: [[-L / 2 - 1, b / 2 + 6, z], [-L / 2 - 12, b / 2 + 4, z * 1.6], [-L / 2 - 24, 2, z * 2.4]],
      })
    })
    return out
  },
  ports: (p) => {
    const s = STEPPERS[str(p, 'model', '17-48')] ?? STEPPERS['17-48']
    const b = s.body
    const L = s.len
    const shaftLen = num(p, 'shaftLen', 24)
    const out: Port[] = ([
      ['a1', 'Coil A, black', -3],
      ['a2', 'Coil A, green', -1],
      ['b1', 'Coil B, red', 1],
      ['b2', 'Coil B, blue', 3],
    ] as const).map(([id, label, z]) => ({
      id, label, kind: 'electrical' as const,
      pos: [-L / 2 - 24, 2, z * 2.4] as Vec3, dir: [-1, 0, 0] as Vec3, role: 'passive' as const, imax: 2,
    }))
    // Four M3 holes on the standard bolt circle, plus the shaft.
    let i = 0
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push({
          id: `mount${i++}`, label: 'M3 mount', kind: 'mechanical',
          pos: [L / 2, b / 2 + (sy * s.holes) / 2, (sz * s.holes) / 2], dir: [1, 0, 0],
          mate: { type: 'thread', size: 3, depth: 4.5 }, groupId: 'mounts',
        })
      }
    }
    out.push({
      id: 'shaft', label: `${s.shaft} mm shaft`, kind: 'mechanical',
      pos: [L / 2 + 2 + shaftLen, b / 2, 0], dir: [1, 0, 0], mate: { type: 'stud', size: s.shaft },
    })
    return out
  },
  electrical: {
    devices: (p) => {
      const s = STEPPERS[str(p, 'model', '17-48')] ?? STEPPERS['17-48']
      // Each coil is its winding resistance in series with its inductance. That
      // is enough to show why a stepper needs a current-chopping driver: at
      // 12 V into 1.5 ohms the steady current would be 8 A.
      return [
        { type: 'resistor', r: s.r, a: 'a1', b: '#am' },
        { type: 'inductor', l: s.l, a: '#am', b: 'a2', dcr: 0 },
        { type: 'resistor', r: s.r, a: 'b1', b: '#bm' },
        { type: 'inductor', l: s.l, a: '#bm', b: 'b2', dcr: 0 },
      ]
    },
    limits: { imax: 2 },
  },
  mass: (p) => (STEPPERS[str(p, 'model', '17-48')] ?? STEPPERS['17-48']).mass,
  price: (p) => ({ '17-40': 10, '17-48': 12, '23-56': 22, '14-34': 11 })[str(p, 'model', '17-48')] ?? 12,
  readouts: (p) => {
    const s = STEPPERS[str(p, 'model', '17-48')] ?? STEPPERS['17-48']
    return [
      { label: 'Step angle', value: '1.8°, 200 per turn' },
      { label: 'Holding torque', value: `${s.hold} Nm` },
      { label: 'Coil', value: `${s.r} Ω, ${eng(s.l, 'H')}` },
      { label: 'Rated current', value: `${(Math.sqrt(3 / s.r)).toFixed(1)} A per phase` },
    ]
  },
}

/* ================================================================== */
/* Solenoid                                                            */
/* ================================================================== */

const solenoid: PartDef = {
  id: 'solenoid-linear',
  name: 'Solenoid',
  category: 'electromech',
  blurb: 'Pulls a plunger in, draws a lot doing it',
  tags: ['solenoid', 'actuator', 'linear', 'lock', 'plunger', 'coil', 'electromagnet'],
  doc: {
    price: 4.5,
    description:
      'Open-frame push-pull solenoid. Rated for a duty cycle rather than continuous use, because the coil turns almost all of its input into heat.',
  },
  params: [
    {
      key: 'size', label: 'Frame', type: 'enum', default: 'medium', group: 'Actuator',
      options: [{ value: 'small', label: 'Small, 5 N' }, { value: 'medium', label: 'Medium, 10 N' }, { value: 'large', label: 'Large, 25 N' }],
    },
    { key: 'voltage', label: 'Coil voltage', type: 'enum', default: '12', group: 'Electrical', options: [
      { value: '5', label: '5 V' }, { value: '12', label: '12 V' }, { value: '24', label: '24 V' },
    ] },
    { key: 'energised', label: 'Energised', type: 'bool', default: false, group: 'Control', help: 'Only changes where the plunger is drawn. The coil is modelled either way.' },
  ],
  solids: (p) => {
    const sizes: Record<string, { w: number; h: number; d: number; pl: number }> = {
      small: { w: 20, h: 16, d: 16, pl: 4 },
      medium: { w: 30, h: 24, d: 24, pl: 6 },
      large: { w: 42, h: 34, d: 34, pl: 8 },
    }
    const s = sizes[str(p, 'size', 'medium')] ?? sizes.medium
    const stroke = bool(p, 'energised', false) ? 0 : s.pl * 1.5
    return [
      // Steel frame, the coil bobbin inside it, and the plunger through both.
      { kind: 'box', mat: 'steel', size: [s.w, s.h, s.d], at: [0, s.h / 2, 0], bevel: 0.6 },
      { kind: 'cyl', mat: { color: '#8A6A3A', rough: 0.6, metal: 0.8, density: 6 }, r: s.h * 0.36, h: s.w * 0.62, rot: [0, 0, 90], at: [0, s.h / 2, 0] },
      { kind: 'cyl', mat: 'steel', r: s.pl / 2, h: s.w * 0.8 + stroke, rot: [0, 0, 90], at: [stroke / 2, s.h / 2, 0], chamfer: 0.5 },
      // Mounting feet.
      ...([-1, 1] as const).map((sz): Solid => ({
        kind: 'extrude', mat: 'steel',
        profile: { outline: [[-s.w / 2, 0], [s.w / 2, 0], [s.w / 2, 5], [-s.w / 2, 5]], holes: [circle(1.7, -s.w / 4, 2.5, 10), circle(1.7, s.w / 4, 2.5, 10)] },
        depth: 1.5, rot: [-90, 0, 0], at: [0, 0.75, sz * (s.d / 2 + 2.5)] as Vec3,
      })),
      // Coil leads.
      ...([-1, 1] as const).map((sz): Solid => ({
        kind: 'tube', mat: { color: sz > 0 ? '#C4262C' : '#1A1C1E', rough: 0.6, density: 1.4 }, r: 0.8, seg: 6,
        path: [[-s.w / 2, s.h * 0.7, sz * 3], [-s.w / 2 - 12, s.h * 0.6, sz * 5], [-s.w / 2 - 22, 2, sz * 7]] as Vec3[],
      })),
    ]
  },
  ports: (p) => {
    const sizes: Record<string, { w: number; h: number }> = { small: { w: 20, h: 16 }, medium: { w: 30, h: 24 }, large: { w: 42, h: 34 } }
    const s = sizes[str(p, 'size', 'medium')] ?? sizes.medium
    return [
      { id: 'a', label: 'Coil +', kind: 'electrical', pos: [-s.w / 2 - 22, 2, 7], dir: [-1, 0, 0], role: 'power', imax: 3 },
      { id: 'b', label: 'Coil −', kind: 'electrical', pos: [-s.w / 2 - 22, 2, -7], dir: [-1, 0, 0], role: 'gnd', imax: 3 },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      const v = parseFloat(str(p, 'voltage', '12'))
      const watts = { small: 4, medium: 8, large: 15 }[str(p, 'size', 'medium')] ?? 8
      const r = (v * v) / watts
      return [
        { type: 'resistor', r, a: 'a', b: '#mid' },
        { type: 'inductor', l: 0.03, a: '#mid', b: 'b', dcr: 0 },
      ]
    },
  },
  readouts: (p) => {
    const v = parseFloat(str(p, 'voltage', '12'))
    const watts = { small: 4, medium: 8, large: 15 }[str(p, 'size', 'medium')] ?? 8
    return [
      { label: 'Coil', value: `${v} V, ${((v * v) / watts).toFixed(0)} Ω` },
      { label: 'Current', value: eng(v / ((v * v) / watts), 'A') },
      { label: 'Power', value: `${watts} W, all of it heat` },
      { label: 'Duty', value: '25 %, or it cooks' },
    ]
  },
}

/* ================================================================== */
/* Speaker                                                             */
/* ================================================================== */

const speaker: PartDef = {
  id: 'speaker-cone',
  name: 'Speaker',
  category: 'electromech',
  blurb: '8 ohm cone, a coil and a resistance to the amplifier',
  tags: ['speaker', 'audio', 'sound', 'driver', 'cone', '8 ohm', 'loudspeaker'],
  doc: {
    price: 1.8,
    description:
      'Small full-range driver. Looks like 8 ohms in series with a few hundred microhenries to whatever is driving it, which is why an amplifier that is happy into a resistor can still misbehave into this.',
  },
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', unit: 'mm', default: 50, min: 20, max: 120, step: 5, group: 'Driver' },
    { key: 'impedance', label: 'Impedance', type: 'enum', default: '8', group: 'Electrical', options: [
      { value: '4', label: '4 Ω' }, { value: '8', label: '8 Ω' }, { value: '16', label: '16 Ω' }, { value: '32', label: '32 Ω' },
    ] },
    { key: 'power', label: 'Power handling', type: 'number', unit: 'W', default: 2, min: 0.25, max: 50, step: 0.25, group: 'Electrical' },
  ],
  solids: (p) => {
    const d = num(p, 'diameter', 50)
    const r = d / 2
    const depth = d * 0.36
    return [
      // Stamped steel basket: a ring with mounting ears, seen from the front.
      {
        kind: 'extrude', mat: 'steel',
        profile: { outline: circle(r, 0, 0, 32), holes: [circle(r - 2.2, 0, 0, 32)] },
        depth: 2, rot: [-90, 0, 0], at: [0, depth - 1, 0],
      },
      // The cone, as a lathe from the surround down to the dust cap.
      {
        kind: 'lathe', mat: { color: '#2A2622', rough: 0.85, density: 0.7 }, seg: 32,
        points: [
          [r - 2, depth],
          [r - 3.5, depth - 1.4],
          [r * 0.28, depth * 0.32],
          [r * 0.26, depth * 0.3],
          [r * 0.22, depth * 0.28],
        ],
      },
      { kind: 'sphere', mat: { color: '#3A342E', rough: 0.8, density: 0.7 }, r: r * 0.28, at: [0, depth * 0.3, 0], seg: 20 },
      // Magnet assembly at the back.
      { kind: 'cyl', mat: { color: '#33383F', rough: 0.5, metal: 0.9, density: 5 }, r: r * 0.52, h: depth * 0.45, at: [0, depth * 0.22, 0] },
      { kind: 'cyl', mat: 'steel', r: r * 0.54, h: 2, at: [0, 1, 0] },
      // Solder tabs on the basket rim.
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'box', mat: 'tin', size: [4, 0.6, 3], at: [s * (r - 4), depth - 0.4, -r * 0.62] as Vec3,
      })),
    ]
  },
  ports: (p) => {
    const r = num(p, 'diameter', 50) / 2
    const depth = num(p, 'diameter', 50) * 0.36
    return [
      { id: 'p', label: 'Positive (+)', kind: 'electrical', pos: [r - 4, depth, -r * 0.62], dir: [0, 1, 0], role: 'passive', imax: 3, solderable: true },
      { id: 'n', label: 'Negative (−)', kind: 'electrical', pos: [-(r - 4), depth, -r * 0.62], dir: [0, 1, 0], role: 'passive', imax: 3, solderable: true },
      { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    devices: (p) => {
      const z = parseFloat(str(p, 'impedance', '8'))
      // DC resistance runs about 0.8 of the nominal impedance.
      return [
        { type: 'resistor', r: z * 0.8, a: 'p', b: '#vc' },
        { type: 'inductor', l: 0.00035, a: '#vc', b: 'n', dcr: 0 },
      ]
    },
  },
  readouts: (p) => {
    const z = parseFloat(str(p, 'impedance', '8'))
    const w = num(p, 'power', 2)
    return [
      { label: 'Impedance', value: `${z} Ω nominal` },
      { label: 'DC resistance', value: `${(z * 0.8).toFixed(1)} Ω` },
      { label: 'Power', value: `${w} W` },
      { label: 'At full power', value: `${Math.sqrt(w * z).toFixed(1)} V, ${eng(Math.sqrt(w / z), 'A')}` },
    ]
  },
}

/* ================================================================== */
/* Matrix keypad                                                       */
/* ================================================================== */

const KEYPAD_LAYOUT = [
  ['1', '2', '3', 'A'],
  ['4', '5', '6', 'B'],
  ['7', '8', '9', 'C'],
  ['*', '0', '#', 'D'],
]

const keypad: PartDef = {
  id: 'keypad-matrix',
  name: 'Matrix keypad',
  category: 'electromech',
  blurb: 'Sixteen keys on eight pins, scanned row by row',
  tags: ['keypad', 'matrix', 'keys', 'membrane', '4x4', 'input', 'entry'],
  doc: {
    price: 1.6,
    description:
      'Membrane keypad wired as a matrix: a key joins one row to one column. That is why it takes eight pins rather than sixteen, and why two keys at once can look like a third.',
  },
  params: [
    {
      key: 'layout', label: 'Layout', type: 'enum', default: '4x4', group: 'Keypad',
      options: [{ value: '4x4', label: '4 x 4, 16 keys' }, { value: '4x3', label: '4 x 3, 12 keys' }],
    },
    {
      key: 'pressed', label: 'Key held', type: 'enum', default: 'none', group: 'Control',
      options: [{ value: 'none', label: 'None' }, ...KEYPAD_LAYOUT.flat().map((k) => ({ value: k, label: k }))],
    },
  ],
  solids: (p) => {
    const cols = str(p, 'layout', '4x4') === '4x3' ? 3 : 4
    const W = cols * 17 + 6
    const D = 4 * 17 + 12
    const held = str(p, 'pressed', 'none')
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#0E1013', rough: 0.7, density: 1.3 }, size: [W, 1, D], at: [0, 0.5, 0], bevel: 0.4 },
    ]
    const items: { t: 'text'; at: [number, number]; text: string; size: number; bold?: boolean }[] = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * 17
        const z = (r - 1.5) * 17
        const down = held === KEYPAD_LAYOUT[r][c]
        out.push({
          kind: 'extrude', mat: { color: down ? '#1C2028' : '#23272E', rough: 0.65, density: 1.3 },
          profile: { outline: roundRect(14.5, 14.5, 2.5, 0, 0, 4) },
          depth: down ? 0.5 : 0.9, rot: [-90, 0, 0], at: [x, 1 + (down ? 0.25 : 0.45), z],
        })
        items.push({ t: 'text', at: [x, -z], text: KEYPAD_LAYOUT[r][c], size: 6, bold: true })
      }
    }
    out.push({ kind: 'silk', size: [W, D], items, mat: 'silkscreen', rot: [-90, 0, 0], at: [0, 2.1, 0], px: 14, noCollide: true })
    // The ribbon tail and its header.
    const pins = cols + 4
    out.push({ kind: 'box', mat: { color: '#C8A45A', rough: 0.6, density: 1.4 }, size: [pins * P + 2, 0.4, 20], at: [0, 0.8, D / 2 + 10] })
    for (let i = 0; i < pins; i++) {
      out.push({ kind: 'box', mat: 'tin', size: [0.64, 8, 0.64], at: [(i - (pins - 1) / 2) * P, -2, D / 2 + 19] })
    }
    return out
  },
  ports: (p) => {
    const cols = str(p, 'layout', '4x4') === '4x3' ? 3 : 4
    const D = 4 * 17 + 12
    const pins = cols + 4
    const out: Port[] = []
    for (let r = 0; r < 4; r++) {
      out.push({
        id: `r${r + 1}`, label: `Row ${r + 1}`, kind: 'electrical',
        pos: [(r - (pins - 1) / 2) * P, -6, D / 2 + 19], dir: [0, -1, 0], role: 'io', imax: 0.02,
      })
    }
    for (let c = 0; c < cols; c++) {
      out.push({
        id: `c${c + 1}`, label: `Column ${c + 1}`, kind: 'electrical',
        pos: [(4 + c - (pins - 1) / 2) * P, -6, D / 2 + 19], dir: [0, -1, 0], role: 'io', imax: 0.02,
      })
    }
    out.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const cols = str(p, 'layout', '4x4') === '4x3' ? 3 : 4
      const held = str(p, 'pressed', 'none')
      const out: DeviceModel[] = []
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < cols; c++) {
          out.push({
            type: 'switch', a: `r${r + 1}`, b: `c${c + 1}`,
            closed: held === KEYPAD_LAYOUT[r][c], ron: 100, roff: 1e9,
          })
        }
      }
      return out
    },
  },
  readouts: (p) => {
    const cols = str(p, 'layout', '4x4') === '4x3' ? 3 : 4
    return [
      { label: 'Keys', value: `${cols * 4}` },
      { label: 'Pins', value: `${cols + 4}, 4 rows and ${cols} columns` },
      { label: 'Held', value: str(p, 'pressed', 'none') === 'none' ? 'Nothing' : str(p, 'pressed', 'none') },
      { label: 'Contact resistance', value: '100 Ω, as membranes go' },
    ]
  },
}

registerParts([rotaryEncoder, dipSwitch, slideSwitch, stepperMotor, solenoid, speaker, keypad])
