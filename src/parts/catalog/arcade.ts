import type { DeviceModel, PartDef, Params, Port, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'

/**
 * The hardware a cabinet is made of.
 *
 * A monitor, a ball-top stick and the buttons that go round it. None of this
 * existed, which meant the editor could lay out the electronics of an arcade
 * machine and not the machine — and the thing people actually build is the
 * machine.
 *
 * Electrically they are what they are: every button and every stick
 * direction is a plain momentary contact to a common return, because that is
 * how a control panel is wired and how the encoder on the other end expects
 * to read it. The monitor is a load with an HDMI socket, not a display the
 * simulator draws to; it takes power and says what it takes.
 */

const BLACK = { color: '#121418', rough: 0.86, density: 1.2 }
const BEZEL = { color: '#1A1D22', rough: 0.7, density: 1.2 }
const CHROME = { color: '#C8CDD4', metal: 1, rough: 0.28, density: 7.8 }
const SCREEN_OFF = { color: '#0B0D10', rough: 0.18, density: 2.4 }

/**
 * An enum's value read as a number.
 *
 * These options are sizes, so they look like numbers and are not: an enum
 * stores its option string. Reading one with `num` returns the fallback
 * every time, which made a 27" panel come out exactly the size of a 19" one
 * and said nothing about it.
 */
const pick = (p: Params, key: string, fallback: number): number => {
  const v = Number(str(p, key, String(fallback)))
  return Number.isFinite(v) ? v : fallback
}

/** Diagonal in inches to a 16:9 panel in millimetres. */
const panelSize = (inches: number): [number, number] => {
  const d = inches * 25.4
  const h = d / Math.sqrt(16 * 16 + 9 * 9)
  return [h * 16, h * 9]
}

const monitor: PartDef = {
  id: 'monitor-panel',
  name: 'Monitor',
  category: 'module',
  blurb: 'A 16:9 panel on a bezel, HDMI in and a barrel jack',
  tags: ['monitor', 'screen', 'display', 'lcd', 'panel', 'hdmi', 'arcade', 'tv', '1080p'],
  doc: {
    price: 70,
    description:
      'A bare panel and driver board of the sort sold for cabinets and kiosks, sized by its diagonal. It draws from a 12 V barrel jack and takes its picture over HDMI; the simulator treats it as a load of the stated current, not as a screen it renders to.',
  },
  params: [
    {
      key: 'diagonal', label: 'Diagonal', type: 'enum', default: '19', group: 'Panel',
      options: ['15', '17', '19', '22', '24', '27'].map((d) => ({ value: d, label: `${d}"` })),
    },
    { key: 'bezel', label: 'Bezel', type: 'number', default: 12, min: 4, max: 40, step: 1, unit: 'mm', group: 'Panel' },
    { key: 'on', label: 'Backlight on', type: 'bool', default: true, group: 'Panel' },
  ],
  solids: (p) => {
    const [w, h] = panelSize(pick(p, 'diagonal', 19))
    const b = num(p, 'bezel', 12)
    const on = bool(p, 'on', true)
    const lit = on
      ? { color: '#2A3340', rough: 0.16, density: 2.4, emissive: '#1E2A3A', emissiveIntensity: 0.35 }
      : SCREEN_OFF
    return [
      // Case, then the glass sitting proud of it.
      { kind: 'box', mat: BEZEL, size: [w + b * 2, h + b * 2, 16], at: [0, 0, -8], bevel: 1.5 },
      { kind: 'box', mat: lit, size: [w, h, 1.2], at: [0, 0, 0.6] },
      // Driver board and its two sockets, on the back.
      { kind: 'box', mat: { color: '#1F6F3A', rough: 0.72, density: 1.9 }, size: [86, 48, 1.6], at: [0, -h / 2 + 34, -17] },
      { kind: 'box', mat: CHROME, size: [15, 6, 11], at: [-26, -h / 2 + 30, -23] },
      { kind: 'box', mat: BLACK, size: [11, 11, 11], at: [2, -h / 2 + 30, -23] },
    ] satisfies Solid[]
  },
  ports: (p: Params): Port[] => {
    const [, h] = panelSize(pick(p, 'diagonal', 19))
    return [
      { id: 'hdmi', label: 'HDMI', kind: 'mechanical', pos: [-26, -h / 2 + 30, -29], dir: [0, 0, -1] },
      { id: 'v+', label: '12 V', kind: 'electrical', pos: [2, -h / 2 + 33, -29], dir: [0, 0, -1], role: 'passive' },
      { id: 'gnd', label: 'GND', kind: 'electrical', pos: [2, -h / 2 + 27, -29], dir: [0, 0, -1], role: 'passive' },
    ]
  },
  electrical: {
    // A resistive load drawing roughly what a panel this size does.
    devices: (p: Params): DeviceModel[] => {
      const amps = 0.07 * pick(p, 'diagonal', 19) ** 0.9
      return [{ type: 'resistor', a: 'v+', b: 'gnd', r: Math.max(1, 12 / amps) }]
    },
    limits: { vmax: 14 },
  },
  readouts: (p: Params) => {
    const [w, h] = panelSize(pick(p, 'diagonal', 19))
    const amps = 0.07 * pick(p, 'diagonal', 19) ** 0.9
    return [
      { label: 'Active area', value: `${w.toFixed(0)} x ${h.toFixed(0)} mm` },
      { label: 'Supply', value: `12 V, ${amps.toFixed(2)} A` },
      { label: 'Input', value: 'HDMI' },
    ]
  },
}

const arcadeButton: PartDef = {
  id: 'arcade-button',
  name: 'Arcade button',
  category: 'electromech',
  blurb: '30 mm snap-in button with a microswitch behind it',
  tags: ['arcade', 'button', 'cabinet', 'sanwa', 'microswitch', '30mm', 'control panel', 'player'],
  doc: {
    price: 2.4,
    description:
      'The standard 30 mm snap-in button. The plunger pushes a microswitch with a changeover contact; cabinets use the normally-open side to a common ground, so a press is a short to the return.',
  },
  params: [
    { key: 'capColor', label: 'Cap colour', type: 'color', default: '#D93025', group: 'Body' },
    { key: 'size', label: 'Size', type: 'enum', default: '30', group: 'Body', options: [{ value: '24', label: '24 mm' }, { value: '30', label: '30 mm' }] },
    { key: 'pressed', label: 'Pressed', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const d = pick(p, 'size', 30)
    const r = d / 2
    const down = bool(p, 'pressed', false)
    return [
      { kind: 'cyl', mat: BLACK, r: r + 1.5, h: 3, at: [0, -1.5, 0] },
      { kind: 'cyl', mat: BLACK, r: r - 1, h: 22, at: [0, -14, 0] },
      { kind: 'cyl', mat: { color: str(p, 'capColor', '#D93025'), rough: 0.3, density: 1.2 }, r, h: 6, at: [0, down ? 2 : 3.4, 0], tag: 'cap' },
      { kind: 'box', mat: { color: '#D8DCE2', rough: 0.6, density: 1.4 }, size: [20, 10, 6], at: [0, -28, 0] },
      { kind: 'box', mat: 'tin', size: [1.2, 5, 4], at: [-6, -33, 0] },
      { kind: 'box', mat: 'tin', size: [1.2, 5, 4], at: [6, -33, 0] },
    ] satisfies Solid[]
  },
  ports: (): Port[] => [
    { id: 'no', label: 'NO', kind: 'electrical', pos: [-6, -35, 0], dir: [0, -1, 0], role: 'passive', imax: 1 },
    { id: 'com', label: 'COM', kind: 'electrical', pos: [6, -35, 0], dir: [0, -1, 0], role: 'passive', imax: 1 },
  ],
  electrical: {
    devices: (p: Params): DeviceModel[] => [
      { type: 'switch', a: 'com', b: 'no', closed: bool(p, 'pressed', false), ron: 0.02, roff: 1e9 },
    ],
    limits: { imax: 1 },
  },
  readouts: (p: Params) => [
    { label: 'Cutout', value: `${pick(p, 'size', 30) - 2} mm` },
    { label: 'Contact', value: 'Momentary, normally open' },
  ],
}

const joystick: PartDef = {
  id: 'arcade-joystick',
  name: 'Arcade joystick',
  category: 'electromech',
  blurb: 'Ball-top stick on a mounting plate, four microswitches',
  tags: ['arcade', 'joystick', 'stick', 'cabinet', 'ball top', 'sanwa', 'four way', 'eight way', 'control panel'],
  doc: {
    price: 18,
    description:
      'A ball-top stick with one microswitch per direction. Each is a momentary contact to a common return, so the four read exactly like four buttons and a diagonal is two of them at once.',
  },
  params: [
    { key: 'ballColor', label: 'Ball colour', type: 'color', default: '#E8343C', group: 'Body' },
    { key: 'gate', label: 'Gate', type: 'enum', default: '8', group: 'Body', options: [{ value: '4', label: 'Four way' }, { value: '8', label: 'Eight way' }] },
    { key: 'lean', label: 'Lean', type: 'enum', default: 'centre', group: 'Control',
      options: ['centre', 'up', 'down', 'left', 'right'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  ],
  solids: (p) => {
    const lean = str(p, 'lean', 'centre')
    const tilt = 11
    const rx = lean === 'up' ? -tilt : lean === 'down' ? tilt : 0
    const rz = lean === 'left' ? tilt : lean === 'right' ? -tilt : 0
    return [
      { kind: 'box', mat: CHROME, size: [78, 3, 78], at: [0, -2, 0] },
      { kind: 'box', mat: BLACK, size: [50, 26, 50], at: [0, -17, 0], bevel: 1 },
      { kind: 'cyl', mat: CHROME, r: 3.5, h: 42, at: [0, 20, 0], rot: [rx, 0, rz] },
      { kind: 'sphere', mat: { color: str(p, 'ballColor', '#E8343C'), rough: 0.26, density: 1.2 },
        r: 17, at: [Math.sin((rz * Math.PI) / 180) * -40, 40, Math.sin((rx * Math.PI) / 180) * 40], tag: 'ball' },
      // Four microswitches, one to a side.
      ...([[-30, 0], [30, 0], [0, -30], [0, 30]] as const).map(
        ([x, z]): Solid => ({ kind: 'box', mat: { color: '#D8DCE2', rough: 0.6, density: 1.4 }, size: [18, 9, 6], at: [x, -26, z], rot: [0, x === 0 ? 90 : 0, 0] }),
      ),
    ] satisfies Solid[]
  },
  ports: (): Port[] => [
    { id: 'up', label: 'UP', kind: 'electrical', pos: [0, -32, -30], dir: [0, -1, 0], role: 'passive' },
    { id: 'down', label: 'DOWN', kind: 'electrical', pos: [0, -32, 30], dir: [0, -1, 0], role: 'passive' },
    { id: 'left', label: 'LEFT', kind: 'electrical', pos: [-30, -32, 0], dir: [0, -1, 0], role: 'passive' },
    { id: 'right', label: 'RIGHT', kind: 'electrical', pos: [30, -32, 0], dir: [0, -1, 0], role: 'passive' },
    { id: 'com', label: 'COM', kind: 'electrical', pos: [0, -32, 0], dir: [0, -1, 0], role: 'passive' },
  ],
  /*
   * Whichever way it is leaning is the contact that is closed. Only one
   * device can be returned, so this is the direction the stick is pushed —
   * the other three are open and contribute nothing to the netlist.
   */
  electrical: {
    /* One switch per direction, all returning to the common, which is how a
       stick is wired and why a diagonal is simply two of them closed. */
    devices: (p: Params): DeviceModel[] => {
      const lean = str(p, 'lean', 'centre')
      return (['up', 'down', 'left', 'right'] as const).map((d) => ({
        type: 'switch' as const, a: 'com', b: d, closed: lean === d, ron: 0.02, roff: 1e9,
      }))
    },
    limits: { imax: 1 },
  },
  readouts: (p: Params) => [
    { label: 'Gate', value: str(p, 'gate', '8') === '4' ? 'Four way' : 'Eight way' },
    { label: 'Contacts', value: 'Four, momentary to common' },
  ],
}

registerParts([monitor, arcadeButton, joystick])
