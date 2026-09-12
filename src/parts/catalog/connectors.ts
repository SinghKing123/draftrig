import type { PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Connectors.
 *
 * A connector is two things at once: a shape that decides whether a plug goes
 * in, and a set of contacts that are the same net on both sides of it. Both
 * are modelled. Contacts that mate share a `groupId`, so the solver sees one
 * node where the metal is continuous, and a connector left unplugged is an
 * open circuit rather than a piece of scenery.
 */

const P = 2.54
const SHELL = { color: '#1B1E22', rough: 0.6, density: 1.14, name: 'Nylon shell' }
const SHELL_WHITE = { color: '#E8EAEC', rough: 0.55, density: 1.14, name: 'Nylon shell, natural' }

/* ================================================================== */
/* Female header                                                       */
/* ================================================================== */

const femaleHeader: PartDef = {
  id: 'header-female',
  name: 'Female header',
  category: 'connector',
  blurb: '2.54 mm socket strip, the other half of a pin header',
  tags: ['header', 'socket', 'female', 'connector', '2.54', 'strip', 'receptacle', 'dupont'],
  doc: { description: 'Socket strip on 0.1 in pitch. What a shield plugs into, and what stops a module being soldered down for good.', price: 0.15 },
  params: [
    { key: 'pins', label: 'Pins', type: 'number', default: 8, min: 1, max: 40, step: 1, group: 'Body' },
    { key: 'rows', label: 'Rows', type: 'number', default: 1, min: 1, max: 2, step: 1, group: 'Body' },
    { key: 'tall', label: 'Stacking height', type: 'bool', default: false, group: 'Body', help: 'The 11 mm bodies used on stackable shields.' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'pins', 8))
    const rows = Math.round(num(p, 'rows', 1))
    const h = p.tall === true ? 11 : 8.5
    const x0 = -((n - 1) / 2) * P
    const z0 = -((rows - 1) / 2) * P
    const out: Solid[] = [
      { kind: 'box', mat: SHELL, size: [n * P, h, rows * P], at: [0, h / 2, 0], bevel: 0.2 },
    ]
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < rows; r++) {
        const x = x0 + i * P
        const z = z0 + r * P
        // The square mouth of each socket, and the contact down in the bore.
        out.push({ kind: 'box', mat: { color: '#0A0C0E', rough: 0.95, density: 0.01 }, size: [1.5, 2.4, 1.5], at: [x, h - 1.2, z], noCollide: true })
        out.push({ kind: 'cyl', mat: 'gold', r: 0.6, h: 3.4, at: [x, h - 4, z], seg: 8, noCollide: true })
        out.push({ kind: 'box', mat: 'tin', size: [0.64, 3.4 + (p.tall === true ? 0 : 0), 0.64], at: [x, -1.7, z] })
      }
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'pins', 8))
    const rows = Math.round(num(p, 'rows', 1))
    const h = p.tall === true ? 11 : 8.5
    const x0 = -((n - 1) / 2) * P
    const z0 = -((rows - 1) / 2) * P
    const out: Port[] = []
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < rows; r++) {
        const x = x0 + i * P
        const z = z0 + r * P
        const g = `s-${i}-${r}`
        out.push({ id: `s${i}_${r}`, label: `${i + 1}${rows > 1 ? String.fromCharCode(65 + r) : ''}`, kind: 'electrical', pos: [x, h - 1, z], dir: [0, 1, 0], role: 'io', imax: 3, groupId: g })
        out.push({ id: `t${i}_${r}`, label: `tail ${i + 1}`, kind: 'electrical', pos: [x, -3.4, z], dir: [0, -1, 0], role: 'io', imax: 3, groupId: g, solderable: true })
      }
    }
    return out
  },
  readouts: (p) => [
    { label: 'Ways', value: `${Math.round(num(p, 'pins', 8))} x ${Math.round(num(p, 'rows', 1))}` },
    { label: 'Pitch', value: '2.54 mm' },
    { label: 'Rating', value: '3 A per contact' },
  ],
}

/* ================================================================== */
/* JST-XH                                                              */
/* ================================================================== */

const jstXh: PartDef = {
  id: 'connector-jst-xh',
  name: 'JST-XH connector',
  category: 'connector',
  blurb: '2.5 mm keyed housing, cannot go in backwards',
  tags: ['jst', 'xh', 'connector', 'keyed', 'polarised', 'battery', 'balance', 'plug', 'housing'],
  doc: {
    manufacturer: 'JST',
    mpn: 'B2B-XH-A',
    price: 0.25,
    description:
      'The 2.5 mm pitch housing on almost every hobby battery and fan lead. Keyed, so it only goes in one way, which is the entire reason to use one over a header.',
  },
  params: [
    { key: 'ways', label: 'Ways', type: 'number', default: 2, min: 2, max: 10, step: 1, group: 'Body' },
    {
      key: 'orient', label: 'Orientation', type: 'enum', default: 'vertical', group: 'Body',
      options: [{ value: 'vertical', label: 'Vertical' }, { value: 'right-angle', label: 'Right angle' }],
    },
    { key: 'mated', label: 'Plug fitted', type: 'bool', default: false, group: 'Body' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'ways', 2))
    const pitch = 2.5
    const w = n * pitch + 1.5
    const h = 5.75
    const d = 5.75
    const angled = str(p, 'orient', 'vertical') === 'right-angle'
    const x0 = -((n - 1) / 2) * pitch
    const out: Solid[] = []

    // The shroud is a three-walled box: open on the latch side, which is what
    // makes the connector keyed in the first place.
    out.push({ kind: 'box', mat: SHELL_WHITE, size: [w, h, 0.9], at: [0, h / 2, -d / 2 + 0.45] })
    out.push({ kind: 'box', mat: SHELL_WHITE, size: [w, h * 0.55, 0.9], at: [0, h * 0.275, d / 2 - 0.45] })
    for (const s of [-1, 1] as const) {
      out.push({ kind: 'box', mat: SHELL_WHITE, size: [0.9, h, d], at: [s * (w / 2 - 0.45), h / 2, 0] })
    }
    out.push({ kind: 'box', mat: SHELL_WHITE, size: [w, 1, d], at: [0, 0.5, 0], bevel: 0.2 })

    for (let i = 0; i < n; i++) {
      const x = x0 + i * pitch
      out.push({ kind: 'box', mat: 'tin', size: [0.64, h - 1.4, 0.64], at: [x, h / 2 + 0.7, 0] })
      if (angled) {
        out.push({ kind: 'tube', mat: 'tin', r: 0.32, seg: 6, path: [[x, 1, 0], [x, 1, d / 2 + 2], [x, -3, d / 2 + 2]] })
      } else {
        out.push({ kind: 'box', mat: 'tin', size: [0.64, 4.5, 0.64], at: [x, -2.25, 0] })
      }
    }

    if (p.mated === true) {
      // Mating housing, sat down inside the shroud with its latch proud.
      out.push({ kind: 'box', mat: SHELL_WHITE, size: [w - 2, 6.5, d - 2], at: [0, h - 1 + 3.25, 0], bevel: 0.3 })
      out.push({ kind: 'box', mat: SHELL_WHITE, size: [w * 0.4, 3.4, 0.9], at: [0, h + 3, -d / 2 + 1.4], rot: [10, 0, 0] })
      for (let i = 0; i < n; i++) {
        out.push({
          kind: 'tube', mat: { color: i === 0 ? '#C4262C' : '#1A1C1E', rough: 0.6, density: 1.4 }, r: 0.7, seg: 6,
          path: [[x0 + i * pitch, h + 5.5, 0], [x0 + i * pitch, h + 9, 0], [x0 + i * pitch + 3, h + 12, 4]],
        })
      }
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'ways', 2))
    const pitch = 2.5
    const h = 5.75
    const d = 5.75
    const angled = str(p, 'orient', 'vertical') === 'right-angle'
    const x0 = -((n - 1) / 2) * pitch
    const out: Port[] = []
    for (let i = 0; i < n; i++) {
      const x = x0 + i * pitch
      const g = `w${i}`
      out.push({
        id: `p${i + 1}`, label: `Way ${i + 1}`, kind: 'electrical',
        pos: [x, h - 0.5, 0], dir: [0, 1, 0], role: 'passive', imax: 3, groupId: g,
      })
      out.push({
        id: `t${i + 1}`, label: `Tail ${i + 1}`, kind: 'electrical',
        pos: angled ? [x, -2.5, d / 2 + 2] : [x, -4, 0], dir: [0, -1, 0],
        role: 'passive', imax: 3, groupId: g, solderable: true,
      })
    }
    return out
  },
  readouts: (p) => [
    { label: 'Pitch', value: '2.5 mm' },
    { label: 'Ways', value: String(Math.round(num(p, 'ways', 2))) },
    { label: 'Rating', value: '3 A, 250 V' },
    { label: 'Wire', value: '22 to 28 AWG' },
  ],
}

/* ================================================================== */
/* DC barrel jack                                                      */
/* ================================================================== */

const barrelJack: PartDef = {
  id: 'jack-barrel-dc',
  name: 'DC barrel jack',
  category: 'connector',
  blurb: '5.5 / 2.1 mm, with the switched contact real ones have',
  tags: ['barrel', 'jack', 'dc', 'power', 'socket', '5.5', '2.1', 'adapter', 'connector'],
  doc: {
    mpn: 'PJ-102A',
    price: 0.35,
    description:
      'The 5.5 mm outside, 2.1 mm inside jack on almost every wall adapter. The third contact is the internal switch that disconnects a battery when a plug is inserted.',
  },
  params: [
    {
      key: 'polarity', label: 'Polarity', type: 'enum', default: 'centre-positive', group: 'Electrical',
      help: 'Centre positive is the usual convention. Guitar pedals are the famous exception.',
      options: [{ value: 'centre-positive', label: 'Centre positive' }, { value: 'centre-negative', label: 'Centre negative' }],
    },
    { key: 'plugged', label: 'Plug inserted', type: 'bool', default: false, group: 'Electrical', help: 'Inserting a plug opens the switch contact.' },
    {
      key: 'mount', label: 'Mounting', type: 'enum', default: 'pcb', group: 'Body',
      options: [{ value: 'pcb', label: 'PCB, right angle' }, { value: 'panel', label: 'Panel, threaded' }],
    },
  ],
  solids: (p) => {
    const panel = str(p, 'mount', 'pcb') === 'panel'
    const out: Solid[] = []
    const bodyH = 11
    if (panel) {
      out.push({ kind: 'cyl', mat: SHELL, r: 5.5, h: 18, rot: [90, 0, 0], at: [0, bodyH / 2, 0] })
      // Threaded nose and its nut.
      out.push({ kind: 'cyl', mat: SHELL, r: 4, h: 7, rot: [90, 0, 0], at: [0, bodyH / 2, 12] })
      out.push({ kind: 'cyl', mat: 'nickel', r: 5.2, h: 2.4, seg: 6, rot: [90, 0, 0], at: [0, bodyH / 2, 11] })
    } else {
      out.push({ kind: 'box', mat: SHELL, size: [9, bodyH, 14], at: [0, bodyH / 2, -1], bevel: 0.5 })
      out.push({ kind: 'cyl', mat: SHELL, r: 4, h: 4, rot: [90, 0, 0], at: [0, bodyH / 2, 8] })
    }
    // The bore and the centre pin down it.
    out.push({
      kind: 'cyl', mat: { color: '#08090B', rough: 0.95, density: 0.01 }, r: 2.75, h: 9,
      rot: [90, 0, 0], at: [0, bodyH / 2, panel ? 11 : 6.5], noCollide: true,
    })
    out.push({ kind: 'cyl', mat: 'brass', r: 1.0, h: 8, rot: [90, 0, 0], at: [0, bodyH / 2, panel ? 10 : 5.5], noCollide: true })

    if (p.plugged === true) {
      out.push({ kind: 'cyl', mat: 'nickel', r: 2.7, h: 12, rot: [90, 0, 0], at: [0, bodyH / 2, panel ? 16 : 11] })
      out.push({ kind: 'cyl', mat: SHELL, r: 5, h: 16, chamfer: 1.2, rot: [90, 0, 0], at: [0, bodyH / 2, panel ? 28 : 23] })
      out.push({
        kind: 'tube', mat: { color: '#1A1C1E', rough: 0.6, density: 1.4 }, r: 1.6, seg: 8,
        path: [[0, bodyH / 2, panel ? 36 : 31], [0, bodyH / 2, panel ? 48 : 43], [0, bodyH / 2 - 4, panel ? 56 : 51]],
      })
    }

    // Solder tags.
    for (const x of [-3.2, 0, 3.2]) {
      out.push({ kind: 'box', mat: 'tin', size: [1.4, 4.5, 0.7], at: [x, -2.25, -5] })
    }
    return out
  },
  ports: () => [
    { id: 'tip', label: 'Centre pin', kind: 'electrical', pos: [-3.2, -4, -5], dir: [0, -1, 0], role: 'power', imax: 5, solderable: true },
    { id: 'sleeve', label: 'Barrel', kind: 'electrical', pos: [0, -4, -5], dir: [0, -1, 0], role: 'gnd', imax: 5, solderable: true },
    { id: 'sw', label: 'Switch', kind: 'electrical', pos: [3.2, -4, -5], dir: [0, -1, 0], role: 'passive', imax: 2, solderable: true },
    { id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: {
    // With no plug in, the switch contact is shorted to the sleeve. That is
    // how a device on a barrel jack knows to fall back to its battery.
    devices: (p) => [
      { type: 'switch', a: 'sw', b: 'sleeve', closed: p.plugged !== true, ron: 0.02, roff: 1e9 },
    ],
    limits: { imax: 5, vmax: 24 },
  },
  readouts: (p) => [
    { label: 'Barrel', value: '5.5 mm outside, 2.1 mm pin' },
    { label: 'Polarity', value: str(p, 'polarity', 'centre-positive') === 'centre-positive' ? 'Centre positive' : 'Centre negative' },
    { label: 'Switch', value: p.plugged === true ? 'Open, plug inserted' : 'Closed to sleeve' },
    { label: 'Rating', value: '5 A, 24 V' },
  ],
}

/* ================================================================== */
/* XT60                                                                */
/* ================================================================== */

const xt60: PartDef = {
  id: 'connector-xt60',
  name: 'XT60 connector',
  category: 'connector',
  blurb: '60 A battery connector, keyed and unmistakable',
  tags: ['xt60', 'battery', 'connector', 'lipo', 'high current', 'power', 'rc', 'keyed'],
  doc: {
    manufacturer: 'Amass',
    mpn: 'XT60',
    price: 0.9,
    description:
      'The yellow nylon battery connector. Rated 60 A continuous, and shaped so the two halves physically cannot be mated the wrong way round.',
  },
  params: [
    {
      key: 'gender', label: 'Half', type: 'enum', default: 'female', group: 'Body',
      help: 'The battery carries the female half, so a loose pack has no exposed metal.',
      options: [{ value: 'female', label: 'Female (battery side)' }, { value: 'male', label: 'Male (device side)' }],
    },
    { key: 'leads', label: 'Leads fitted', type: 'bool', default: true, group: 'Body' },
  ],
  solids: (p) => {
    const male = str(p, 'gender', 'female') === 'male'
    const body = { color: '#E0B200', rough: 0.5, density: 1.4, name: 'Nylon 66, yellow' }
    const W = 15.8
    const H = 8.1
    const D = 16.2
    const out: Solid[] = []

    // The signature outline: a rectangle with two corners cut away, which is
    // the whole keying mechanism.
    const key: [number, number][] = [
      [-W / 2, -H / 2], [W / 2 - 3, -H / 2], [W / 2, -H / 2 + 3],
      [W / 2, H / 2], [-W / 2 + 3, H / 2], [-W / 2, H / 2 - 3],
    ]
    out.push({ kind: 'extrude', mat: body, profile: { outline: key }, depth: D, bevel: 0.4, rot: [0, 0, 0], at: [0, H / 2 + 0.5, 0] })

    // Two bullet contacts on 7.2 mm centres.
    for (const s of [-1, 1] as const) {
      const x = s * 3.6
      if (male) {
        out.push({ kind: 'cyl', mat: 'gold', r: 1.75, h: 8, chamfer: 0.5, rot: [90, 0, 0], at: [x, H / 2 + 0.5, D / 2 + 3] })
      } else {
        out.push({
          kind: 'cyl', mat: { color: '#0A0C0E', rough: 0.95, density: 0.01 }, r: 2.1, h: 9,
          rot: [90, 0, 0], at: [x, H / 2 + 0.5, D / 2 - 3.5], noCollide: true,
        })
        out.push({ kind: 'cyl', mat: 'gold', r: 1.9, h: 6, rot: [90, 0, 0], at: [x, H / 2 + 0.5, D / 2 - 5], noCollide: true })
      }
      if (p.leads !== false) {
        out.push({
          kind: 'tube', r: 1.6, seg: 8,
          mat: { color: s > 0 ? '#C4262C' : '#1A1C1E', rough: 0.8, density: 1.2, name: 'Silicone' },
          path: [[x, H / 2 + 0.5, -D / 2], [x, H / 2 + 0.5, -D / 2 - 14], [x * 2, H / 2 - 1, -D / 2 - 26]],
        })
      }
    }
    return out
  },
  ports: (p) => {
    const H = 8.1
    const D = 16.2
    const leads = p.leads !== false
    const z = leads ? -D / 2 - 26 : -D / 2
    return [
      { id: 'p', label: 'Positive (+)', kind: 'electrical', pos: [leads ? 7.2 : 3.6, H / 2 + 0.5, z], dir: [0, 0, -1], role: 'power', imax: 60 },
      { id: 'n', label: 'Negative (−)', kind: 'electrical', pos: [leads ? -7.2 : -3.6, H / 2 + 0.5, z], dir: [0, 0, -1], role: 'gnd', imax: 60 },
    ]
  },
  electrical: { devices: () => [], limits: { imax: 60, vmax: 500 } },
  readouts: () => [
    { label: 'Continuous', value: '60 A' },
    { label: 'Burst', value: '180 A for 10 s' },
    { label: 'Contact resistance', value: 'Under 1 mΩ' },
    { label: 'Wire', value: 'Up to 10 AWG' },
  ],
}

/* ================================================================== */
/* Binding post                                                        */
/* ================================================================== */

const bindingPost: PartDef = {
  id: 'binding-post',
  name: 'Binding post',
  category: 'connector',
  blurb: 'Banana socket that also takes bare wire',
  tags: ['banana', 'binding post', 'terminal', 'bench', '4mm', 'connector', 'panel'],
  doc: {
    price: 1.1,
    description:
      'Panel terminal with a 4 mm banana socket down the middle and a captive nut for bare wire or a spade. On 19 mm centres, so a double pair takes a standard bridging plug.',
  },
  params: [
    { key: 'color', label: 'Colour', type: 'enum', default: 'red', group: 'Body', options: [
      { value: 'red', label: 'Red' }, { value: 'black', label: 'Black' }, { value: 'green', label: 'Green (earth)' },
    ] },
    { key: 'panel', label: 'Panel thickness', type: 'number', unit: 'mm', default: 3, min: 1, max: 12, step: 0.5, group: 'Body' },
  ],
  solids: (p) => {
    const shades: Record<string, string> = { red: '#C4262C', black: '#1A1C1E', green: '#1F9E4B' }
    const c = shades[str(p, 'color', 'red')] ?? shades.red
    const t = num(p, 'panel', 3)
    const mat = { color: c, rough: 0.45, density: 1.3 }
    return [
      // Knurled cap, shoulder, threaded shank through the panel, and the tag.
      { kind: 'cyl', mat, r: 6, h: 9, chamfer: 0.8, at: [0, t + 9.5, 0], seg: 20 },
      { kind: 'cyl', mat, r: 7.5, h: 5, chamfer: 0.6, at: [0, t + 2.5, 0], seg: 20 },
      { kind: 'cyl', mat: 'brass', r: 3, h: t + 8, at: [0, t / 2 - 1, 0] },
      { kind: 'cyl', mat: { color: '#08090B', rough: 0.95, density: 0.01 }, r: 2.1, h: 12, at: [0, t + 11, 0], seg: 14, noCollide: true },
      { kind: 'cyl', mat: 'nickel', r: 5, h: 2.5, seg: 6, at: [0, -2.5, 0] },
      { kind: 'box', mat: 'brass', size: [4, 0.8, 8], at: [0, -4.5, 3] },
    ]
  },
  ports: (p) => {
    const t = num(p, 'panel', 3)
    return [
      { id: 'top', label: 'Socket', kind: 'electrical', pos: [0, t + 18, 0], dir: [0, 1, 0], role: 'passive', imax: 15, groupId: 'post' },
      { id: 'tag', label: 'Solder tag', kind: 'electrical', pos: [0, -4.5, 6], dir: [0, 0, 1], role: 'passive', imax: 15, groupId: 'post', solderable: true },
      { id: 'panel', label: 'Panel hole', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'hole', size: 6.2 } },
    ]
  },
  readouts: () => [
    { label: 'Socket', value: '4 mm banana' },
    { label: 'Rating', value: '15 A, 1000 V' },
    { label: 'Panel hole', value: '6 mm' },
    { label: 'Spacing', value: '19 mm standard centres' },
  ],
}

/* ================================================================== */
/* Boxed IDC header                                                    */
/* ================================================================== */

const idcHeader: PartDef = {
  id: 'header-idc',
  name: 'IDC box header',
  category: 'connector',
  blurb: 'Shrouded and polarised, for ribbon cable',
  tags: ['idc', 'header', 'box', 'shrouded', 'ribbon', 'connector', 'isp', 'jtag', 'keyed'],
  doc: {
    mpn: 'DC3-10P',
    price: 0.3,
    description:
      'Boxed header on 2.54 mm pitch with a notch in the shroud. Everything programming-related uses one because the key is the only thing stopping a reversed cable.',
  },
  params: [
    { key: 'ways', label: 'Ways', type: 'number', default: 10, min: 6, max: 40, step: 2, group: 'Body' },
    { key: 'keyed', label: 'Notched shroud', type: 'bool', default: true, group: 'Body' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'ways', 10))
    const half = n / 2
    const w = half * P + 5.5
    const d = 8.9
    const h = 9.2
    const x0 = -((half - 1) / 2) * P
    const out: Solid[] = [
      // Shroud walls.
      { kind: 'box', mat: SHELL, size: [w, 1.5, d], at: [0, 0.75, 0], bevel: 0.3 },
      { kind: 'box', mat: SHELL, size: [w, h, 1.6], at: [0, h / 2, -d / 2 + 0.8] },
      { kind: 'box', mat: SHELL, size: [w, h, 1.6], at: [0, h / 2, d / 2 - 0.8] },
      { kind: 'box', mat: SHELL, size: [1.6, h, d], at: [-w / 2 + 0.8, h / 2, 0] },
      { kind: 'box', mat: SHELL, size: [1.6, h, d], at: [w / 2 - 0.8, h / 2, 0] },
    ]
    if (p.keyed !== false) {
      // The notch: a gap in the near wall, filled either side of centre.
      out.push({ kind: 'box', mat: SHELL, size: [w, h, 1.0], at: [0, h / 2, -d / 2 + 0.3], noCollide: true })
      out.push({ kind: 'box', mat: { color: '#0A0C0E', rough: 0.95, density: 0.01 }, size: [4.4, h - 1.4, 1.2], at: [0, h / 2 + 0.8, -d / 2 + 0.2], noCollide: true })
    }
    for (let i = 0; i < half; i++) {
      for (const s of [-1, 1] as const) {
        const x = x0 + i * P
        out.push({ kind: 'box', mat: 'gold', size: [0.64, h - 1.2, 0.64], at: [x, h / 2 + 1.6, s * 1.27] })
        out.push({ kind: 'box', mat: 'tin', size: [0.64, 4.5, 0.64], at: [x, -2.25, s * 1.27] })
      }
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'ways', 10))
    const half = n / 2
    const h = 9.2
    const x0 = -((half - 1) / 2) * P
    const out: Port[] = []
    // IDC numbering snakes across the cable: 1 and 2 are opposite each other.
    for (let i = 0; i < half; i++) {
      for (const [k, s] of ([[0, -1], [1, 1]] as const)) {
        const pin = i * 2 + k + 1
        const g = `p${pin}`
        out.push({ id: `p${pin}`, label: `Pin ${pin}`, kind: 'electrical', pos: [x0 + i * P, h - 0.5, s * 1.27], dir: [0, 1, 0], role: 'io', imax: 1, groupId: g })
        out.push({ id: `t${pin}`, label: `Tail ${pin}`, kind: 'electrical', pos: [x0 + i * P, -4, s * 1.27], dir: [0, -1, 0], role: 'io', imax: 1, groupId: g, solderable: true })
      }
    }
    return out
  },
  readouts: (p) => [
    { label: 'Ways', value: `${Math.round(num(p, 'ways', 10))} way, 2 rows` },
    { label: 'Pitch', value: '2.54 mm' },
    { label: 'Cable', value: '1.27 mm ribbon' },
  ],
}

/* ================================================================== */
/* USB-C breakout                                                      */
/* ================================================================== */

const usbCBreakout: PartDef = {
  id: 'usb-c-breakout',
  name: 'USB-C breakout',
  category: 'connector',
  blurb: 'USB-C socket with the resistors that make it deliver 5 V',
  tags: ['usb', 'usb-c', 'type-c', 'breakout', 'connector', 'power', '5v', 'charging'],
  doc: {
    price: 1.2,
    description:
      'A USB-C receptacle on a small board with the two 5.1 k CC pull-downs fitted. Without those a modern charger supplies nothing at all, which is the classic reason a home-made USB-C input stays dead.',
  },
  params: [
    { key: 'ccResistors', label: 'CC pull-downs fitted', type: 'bool', default: true, group: 'Electrical', help: 'Two 5.1 k to ground. A source with no load advertised on CC will not turn its output on.' },
    { key: 'mask', label: 'Board colour', type: 'enum', default: 'fr4-black', group: 'Body', options: [
      { value: 'fr4-black', label: 'Black' }, { value: 'fr4-green', label: 'Green' }, { value: 'fr4-blue', label: 'Blue' },
    ] },
  ],
  solids: (p) => {
    const W = 16
    const D = 14
    const T = 1.2
    const out: Solid[] = [
      {
        kind: 'extrude', mat: str(p, 'mask', 'fr4-black'),
        profile: { outline: roundRect(W, D, 1, 0, 0, 3), holes: [circle(1.1, -W / 2 + 2.4, D / 2 - 2.4, 10), circle(1.1, W / 2 - 2.4, D / 2 - 2.4, 10)] },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
      // The receptacle: a flat oval shell with the tongue inside it.
      { kind: 'cyl', mat: 'nickel', r: 1.3, h: 8.35, rot: [0, 0, 90], at: [-3.7, T + 1.3, -D / 2 + 3.5], seg: 12 },
      { kind: 'cyl', mat: 'nickel', r: 1.3, h: 8.35, rot: [0, 0, 90], at: [3.7, T + 1.3, -D / 2 + 3.5], seg: 12 },
      { kind: 'box', mat: 'nickel', size: [7.4, 2.6, 8.35], at: [0, T + 1.3, -D / 2 + 3.5] },
      { kind: 'box', mat: { color: '#0A0C0E', rough: 0.9, density: 1.3 }, size: [6.8, 0.7, 3], at: [0, T + 1.3, -D / 2 - 0.2], noCollide: true },
      // Silk: pad names down the free edge, which is the whole point of a breakout.
      {
        kind: 'silk', size: [W, D], mat: 'silkscreen', rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 26, noCollide: true,
        items: [
          { t: 'pads', at: [-P * 1.5, D / 2 - 2.2], n: 4, pitch: P, r: 0.85 },
          { t: 'text', at: [-P * 1.5, D / 2 - 4.6], text: 'G', size: 1.6, bold: true },
          { t: 'text', at: [-P * 0.5, D / 2 - 4.6], text: 'V', size: 1.6, bold: true },
          { t: 'text', at: [P * 0.5, D / 2 - 4.6], text: 'D-', size: 1.4 },
          { t: 'text', at: [P * 1.5, D / 2 - 4.6], text: 'D+', size: 1.4 },
          { t: 'text', at: [0, 0.4], text: 'USB-C', size: 1.8, bold: true },
        ],
      },
    ]
    if (p.ccResistors !== false) {
      // Two 0603 chips under the socket, which is where they really sit.
      for (const x of [-2.2, 2.2]) {
        out.push({ kind: 'box', mat: { color: '#1B1E22', rough: 0.6, density: 3 }, size: [1.6, 0.45, 0.8], at: [x, T + 0.22, 1.5], noCollide: true })
      }
    }
    return out
  },
  ports: () => {
    const D = 14
    const out: Port[] = (['gnd', 'vbus', 'dm', 'dp'] as const).map((id, i) => ({
      id,
      label: ({ gnd: 'GND', vbus: 'VBUS (5 V)', dm: 'D−', dp: 'D+' } as const)[id],
      kind: 'electrical' as const,
      pos: [-P * 1.5 + i * P, -1.2, D / 2 - 2.2] as Vec3,
      dir: [0, -1, 0] as Vec3,
      role: (id === 'gnd' ? 'gnd' : id === 'vbus' ? 'power' : 'io') as 'gnd' | 'power' | 'io',
      imax: id === 'vbus' ? 3 : 0.5,
      solderable: true,
    }))
    out.push({ id: 'mount0', label: 'M2 mount', kind: 'mechanical', pos: [-5.6, 1.2, D / 2 - 2.4], dir: [0, 1, 0], mate: { type: 'hole', size: 2.2 }, groupId: 'mounts' })
    out.push({ id: 'mount1', label: 'M2 mount', kind: 'mechanical', pos: [5.6, 1.2, D / 2 - 2.4], dir: [0, 1, 0], mate: { type: 'hole', size: 2.2 }, groupId: 'mounts' })
    return out
  },
  electrical: {
    // The board is passive. The CC resistors are not on any pin brought out,
    // so all they can do here is say whether a source would turn on; the data
    // lines carry the usual 22 ohm series resistance of a short stub.
    devices: (p) => (p.ccResistors !== false ? [{ type: 'resistor' as const, r: 2550, a: 'gnd', b: '#cc' }] : []),
    limits: { imax: 3, vmax: 20 },
  },
  readouts: (p) => [
    { label: 'Connector', value: 'USB Type-C receptacle' },
    { label: 'CC pull-downs', value: p.ccResistors !== false ? '2 x 5.1 k fitted' : 'Not fitted' },
    { label: 'Advertised', value: p.ccResistors !== false ? '5 V at up to 3 A' : 'Nothing, source stays off' },
  ],
}

/* ================================================================== */
/* Crimp terminals                                                     */
/* ================================================================== */

const CRIMPS: Record<string, { label: string; stud: number; w: number }> = {
  'ring-m3': { label: 'Ring, M3', stud: 3.2, w: 7 },
  'ring-m4': { label: 'Ring, M4', stud: 4.3, w: 8.5 },
  'ring-m5': { label: 'Ring, M5', stud: 5.3, w: 10 },
  'fork-m4': { label: 'Fork, M4', stud: 4.3, w: 8.5 },
  'spade-6.3': { label: 'Spade, 6.3 mm', stud: 0, w: 6.3 },
}

const crimpTerminal: PartDef = {
  id: 'terminal-crimp',
  name: 'Crimp terminal',
  category: 'connector',
  blurb: 'Ring, fork or spade on the end of a wire',
  tags: ['crimp', 'ring', 'terminal', 'lug', 'spade', 'fork', 'connector', 'wire', 'ground'],
  doc: { price: 0.07, description: 'Insulated crimp terminals. The only proper way to put a wire under a screw, and the reason a ground stud stays tight.' },
  params: [
    { key: 'style', label: 'Style', type: 'enum', default: 'ring-m4', group: 'Body', options: Object.entries(CRIMPS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'color', label: 'Insulation', type: 'enum', default: 'red', group: 'Body', options: [
      { value: 'red', label: 'Red, 22 to 16 AWG' }, { value: 'blue', label: 'Blue, 16 to 14 AWG' }, { value: 'yellow', label: 'Yellow, 12 to 10 AWG' },
    ] },
  ],
  solids: (p) => {
    const c = CRIMPS[str(p, 'style', 'ring-m4')] ?? CRIMPS['ring-m4']
    const shades: Record<string, string> = { red: '#C4262C', blue: '#1F5FCC', yellow: '#D8A814' }
    const sleeve = { color: shades[str(p, 'color', 'red')] ?? shades.red, rough: 0.55, density: 1.4 }
    const style = str(p, 'style', 'ring-m4')
    const T = 0.8
    const out: Solid[] = [
      // Insulated barrel, then the transition and the tongue.
      { kind: 'cyl', mat: sleeve, r: 2.4, h: 8, rot: [0, 0, 90], at: [-6, T / 2 + 1, 0] },
      { kind: 'box', mat: 'tin', size: [4, T, c.w * 0.7], at: [0, T / 2 + 1, 0] },
    ]
    if (style.startsWith('ring')) {
      out.push({
        kind: 'extrude', mat: 'tin',
        profile: { outline: circle(c.w / 2, 0, 0, 20), holes: [circle(c.stud / 2, 0, 0, 14)] },
        depth: T, rot: [-90, 0, 0], at: [c.w / 2 + 1.5, T / 2 + 1, 0],
      })
    } else if (style.startsWith('fork')) {
      const half = c.w / 2
      out.push({
        kind: 'extrude', mat: 'tin',
        profile: {
          outline: [
            [-half, -half], [half, -half], [half, -c.stud / 2], [0, -c.stud / 2],
            [0, c.stud / 2], [half, c.stud / 2], [half, half], [-half, half],
          ],
        },
        depth: T, rot: [-90, 0, 0], at: [half + 1.5, T / 2 + 1, 0],
      })
    } else {
      out.push({ kind: 'box', mat: 'tin', size: [8, T, c.w], at: [5, T / 2 + 1, 0], bevel: 0.2 })
    }
    return out
  },
  ports: (p) => {
    const c = CRIMPS[str(p, 'style', 'ring-m4')] ?? CRIMPS['ring-m4']
    const style = str(p, 'style', 'ring-m4')
    const out: Port[] = [
      { id: 'wire', label: 'Wire barrel', kind: 'electrical', pos: [-10, 1.4, 0], dir: [-1, 0, 0], role: 'passive', imax: 20, groupId: 'lug' },
      { id: 'stud', label: style === 'spade-6.3' ? 'Spade' : 'Stud hole', kind: 'electrical', pos: [style === 'spade-6.3' ? 8 : c.w / 2 + 1.5, 1.4, 0], dir: [0, 1, 0], role: 'passive', imax: 20, groupId: 'lug' },
    ]
    if (c.stud > 0) {
      out.push({
        id: 'bolt', label: `Bolt hole`, kind: 'mechanical',
        pos: [c.w / 2 + 1.5, 1.8, 0], dir: [0, 1, 0], mate: { type: 'hole', size: c.stud },
      })
    }
    return out
  },
  readouts: (p) => {
    const c = CRIMPS[str(p, 'style', 'ring-m4')] ?? CRIMPS['ring-m4']
    const wire: Record<string, string> = { red: '22 to 16 AWG', blue: '16 to 14 AWG', yellow: '12 to 10 AWG' }
    return [
      { label: 'Style', value: c.label },
      { label: 'Wire range', value: wire[str(p, 'color', 'red')] ?? wire.red },
      { label: 'Rating', value: '20 A' },
    ]
  },
}

registerParts([femaleHeader, jstXh, barrelJack, xt60, bindingPost, idcHeader, usbCBreakout, crimpTerminal])
