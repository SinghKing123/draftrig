import type { PartDef, Port, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { num, str } from './_helpers'

const P = 2.54

/* ================================================================== */
/* Solderless breadboard                                               */
/* ================================================================== */

const BB_SIZES: Record<string, { cols: number; rails: boolean; label: string }> = {
  '830': { cols: 63, rails: true, label: 'Full, 830 points' },
  '400': { cols: 30, rails: true, label: 'Half, 400 points' },
  '170': { cols: 17, rails: false, label: 'Mini, 170 points' },
}

/** Row centres in Z for the two five-hole terminal banks. */
const TERM_Z = [3.81, 6.35, 8.89, 11.43, 13.97]
const RAIL_Z = [20.32, 22.86]

const breadboard: PartDef = {
  id: 'breadboard',
  name: 'Breadboard',
  category: 'prototyping',
  blurb: 'Solderless. Columns of five are joined under the plastic',
  tags: ['breadboard', 'protoboard', 'solderless', 'prototype', 'bb830'],
  doc: {
    description:
      'Solderless breadboard. Each five-hole column on one side of the centre channel is a single node; the long rails run the full length.',
    price: 4.5,
  },
  params: [
    {
      key: 'size', label: 'Size', type: 'enum', default: '830', group: 'Board',
      options: Object.entries(BB_SIZES).map(([value, v]) => ({ value, label: v.label })),
    },
    {
      key: 'color', label: 'Colour', type: 'enum', default: 'abs-white', group: 'Board',
      options: [
        { value: 'abs-white', label: 'White' },
        { value: 'abs-black', label: 'Black' },
        { value: 'abs-blue', label: 'Blue' },
      ],
    },
    { key: 'splitRails', label: 'Split power rails', type: 'bool', default: false, group: 'Board', help: 'Break each rail into two independent halves, as on many real boards.' },
  ],
  solids: (p) => {
    const cfg = BB_SIZES[str(p, 'size', '830')] ?? BB_SIZES['830']
    const mat = str(p, 'color', 'abs-white')
    const w = (cfg.cols + 2) * P
    const d = cfg.rails ? 54.5 : 2 * (TERM_Z[4] + P) + 4
    const h = 9.0
    const out: Solid[] = [
      { kind: 'box', mat, size: [w, h, d], at: [0, h / 2, 0], bevel: 0.8 },
      // Centre channel.
      { kind: 'box', mat: { color: '#0C0D0F', rough: 0.9, density: 0.001 }, size: [w - 3, 1.2, 6.4], at: [0, h - 0.4, 0], noCollide: true },
    ]

    const holeMat = { color: '#101215', rough: 0.85, density: 0.001 }
    const hole = (x: number, z: number): Solid => ({
      kind: 'box', mat: holeMat, size: [1.35, 1.6, 1.35], at: [x, h - 0.55, z], noCollide: true,
    })

    const x0 = -((cfg.cols - 1) / 2) * P
    for (let c = 0; c < cfg.cols; c++) {
      const x = x0 + c * P
      for (const z of TERM_Z) { out.push(hole(x, z), hole(x, -z)) }
    }

    if (cfg.rails) {
      const railCols = Math.floor((cfg.cols - 3) / 6) * 5
      const railXs = railPositions(railCols, cfg.cols)
      for (const x of railXs) for (const z of RAIL_Z) { out.push(hole(x, z), hole(x, -z)) }
      // Rail stripes.
      const stripeW = w - 6
      for (const [z, col] of [[RAIL_Z[1] + 1.9, '#C0272D'], [RAIL_Z[0] - 1.9, '#2C5CC5']] as const) {
        out.push({ kind: 'box', mat: { color: col, rough: 0.6, density: 0.001 }, size: [stripeW, 0.2, 0.55], at: [0, h + 0.02, z], noCollide: true })
        out.push({ kind: 'box', mat: { color: col, rough: 0.6, density: 0.001 }, size: [stripeW, 0.2, 0.55], at: [0, h + 0.02, -z], noCollide: true })
      }
    }
    return out
  },
  ports: (p) => {
    const cfg = BB_SIZES[str(p, 'size', '830')] ?? BB_SIZES['830']
    const split = p.splitRails === true
    const ports: Port[] = []
    const y = 9.0
    const x0 = -((cfg.cols - 1) / 2) * P
    const rowName = 'ABCDE'

    for (let c = 0; c < cfg.cols; c++) {
      const x = x0 + c * P
      TERM_Z.forEach((z, r) => {
        // Near bank (positive Z) is rows A-E, far bank is F-J.
        ports.push({
          id: `a${c}_${r}`, label: `${rowName[r]}${c + 1}`, kind: 'electrical',
          pos: [x, y, z], dir: [0, 1, 0], role: 'passive', groupId: `col-a-${c}`,
        })
        ports.push({
          id: `b${c}_${r}`, label: `${'FGHIJ'[r]}${c + 1}`, kind: 'electrical',
          pos: [x, y, -z], dir: [0, 1, 0], role: 'passive', groupId: `col-b-${c}`,
        })
      })
    }

    if (cfg.rails) {
      const railCols = Math.floor((cfg.cols - 3) / 6) * 5
      const railXs = railPositions(railCols, cfg.cols)
      railXs.forEach((x, i) => {
        const half = split ? (i < railXs.length / 2 ? '1' : '2') : ''
        const banks: [number, string, string][] = [
          [RAIL_Z[1], 'pos-near', '+'],
          [RAIL_Z[0], 'neg-near', '−'],
          [-RAIL_Z[1], 'pos-far', '+'],
          [-RAIL_Z[0], 'neg-far', '−'],
        ]
        for (const [z, net, label] of banks) {
          ports.push({
            id: `${net}-${i}`, label: `${label} rail`, kind: 'electrical',
            pos: [x, y, z], dir: [0, 1, 0],
            role: label === '+' ? 'power' : 'gnd',
            groupId: `${net}${half}`,
          })
        }
      })
    }

    ports.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return ports
  },
  readouts: (p) => {
    const cfg = BB_SIZES[str(p, 'size', '830')] ?? BB_SIZES['830']
    const railCols = cfg.rails ? Math.floor((cfg.cols - 3) / 6) * 5 : 0
    return [
      { label: 'Tie points', value: String(cfg.cols * 10 + railCols * 4) },
      { label: 'Columns', value: String(cfg.cols) },
      { label: 'Independent nets', value: String(cfg.cols * 2 + (cfg.rails ? (p.splitRails ? 8 : 4) : 0)) },
    ]
  },
}

/** Rail holes come in groups of five with a gap between groups. */
function railPositions(count: number, cols: number): number[] {
  if (count <= 0) return []
  const xs: number[] = []
  const groups = count / 5
  const span = (cols - 2) * P
  const groupSpan = span / groups
  const start = -span / 2 + groupSpan / 2
  for (let g = 0; g < groups; g++) {
    const cx = start + g * groupSpan
    for (let i = 0; i < 5; i++) xs.push(cx + (i - 2) * P)
  }
  return xs
}

/* ================================================================== */
/* Perfboard                                                           */
/* ================================================================== */

const perfboard: PartDef = {
  id: 'perfboard',
  name: 'Perfboard',
  category: 'prototyping',
  blurb: 'Drilled FR-4 for soldered prototypes',
  tags: ['perfboard', 'protoboard', 'stripboard', 'veroboard', 'fr4', 'solder'],
  doc: { description: 'Through-hole prototyping board on a 2.54 mm grid. Choose isolated pads or continuous strips.', price: 1.8 },
  params: [
    { key: 'cols', label: 'Columns', type: 'number', default: 24, min: 4, max: 60, step: 1, group: 'Board' },
    { key: 'rows', label: 'Rows', type: 'number', default: 18, min: 4, max: 60, step: 1, group: 'Board' },
    { key: 'layout', label: 'Copper', type: 'enum', default: 'pads', group: 'Board', options: [{ value: 'pads', label: 'Isolated pads' }, { value: 'strips', label: 'Continuous strips' }] },
    { key: 'mask', label: 'Solder mask', type: 'enum', default: 'fr4-green', group: 'Board', options: [{ value: 'fr4-green', label: 'Green' }, { value: 'fr4-blue', label: 'Blue' }, { value: 'fr4-black', label: 'Black' }, { value: 'fr4-red', label: 'Red' }] },
  ],
  solids: (p) => {
    const cols = Math.round(num(p, 'cols', 24))
    const rows = Math.round(num(p, 'rows', 18))
    const w = (cols + 1) * P
    const d = (rows + 1) * P
    const t = 1.6
    const strips = str(p, 'layout', 'pads') === 'strips'
    const out: Solid[] = [{ kind: 'box', mat: str(p, 'mask', 'fr4-green'), size: [w, t, d], at: [0, t / 2, 0] }]
    const x0 = -((cols - 1) / 2) * P
    const z0 = -((rows - 1) / 2) * P
    if (strips) {
      for (let r = 0; r < rows; r++) {
        out.push({ kind: 'box', mat: 'tin', size: [(cols - 1) * P + 1.8, 0.08, 1.8], at: [0, t + 0.04, z0 + r * P], noCollide: true })
      }
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = x0 + c * P
        const z = z0 + r * P
        if (!strips) out.push({ kind: 'cyl', mat: 'tin', r: 0.9, h: 0.1, at: [x, t + 0.05, z], seg: 10, noCollide: true })
        out.push({ kind: 'cyl', mat: { color: '#0B0C0E', rough: 0.9, density: 0.001 }, r: 0.5, h: t + 0.3, at: [x, t / 2, z], seg: 8, noCollide: true })
      }
    }
    return out
  },
  ports: (p) => {
    const cols = Math.round(num(p, 'cols', 24))
    const rows = Math.round(num(p, 'rows', 18))
    const strips = str(p, 'layout', 'pads') === 'strips'
    const x0 = -((cols - 1) / 2) * P
    const z0 = -((rows - 1) / 2) * P
    const ports: Port[] = []
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ports.push({
          id: `p${c}_${r}`, label: `${c + 1}:${r + 1}`, kind: 'electrical',
          pos: [x0 + c * P, 1.6, z0 + r * P], dir: [0, 1, 0], role: 'passive',
          groupId: strips ? `strip-${r}` : undefined,
        })
      }
    }
    ports.push({ id: 'base', label: 'Underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return ports
  },
}

/* ================================================================== */
/* Pin header                                                          */
/* ================================================================== */

const pinHeader: PartDef = {
  id: 'header-pin',
  name: 'Pin header',
  category: 'connector',
  blurb: '2.54 mm male header, any pin count',
  tags: ['header', 'pin', 'connector', '2.54', 'dupont'],
  doc: { description: 'Standard 0.1 in male pin header.', price: 0.1 },
  params: [
    { key: 'pins', label: 'Pins', type: 'number', default: 8, min: 1, max: 40, step: 1, group: 'Body' },
    { key: 'rows', label: 'Rows', type: 'number', default: 1, min: 1, max: 2, step: 1, group: 'Body' },
    { key: 'angled', label: 'Right angle', type: 'bool', default: false, group: 'Body' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'pins', 8))
    const rows = Math.round(num(p, 'rows', 1))
    const out: Solid[] = []
    const x0 = -((n - 1) / 2) * P
    const z0 = -((rows - 1) / 2) * P
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < rows; r++) {
        const x = x0 + i * P
        const z = z0 + r * P
        out.push({ kind: 'box', mat: 'abs-black', size: [P - 0.05, 2.5, P - 0.05], at: [x, 1.25, z], bevel: 0.2 })
        out.push({ kind: 'box', mat: 'gold', size: [0.64, 11.5, 0.64], at: [x, 2.9, z] })
      }
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'pins', 8))
    const rows = Math.round(num(p, 'rows', 1))
    const x0 = -((n - 1) / 2) * P
    const z0 = -((rows - 1) / 2) * P
    const ports: Port[] = []
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < rows; r++) {
        ports.push({ id: `p${i}_${r}`, label: `${i + 1}${rows > 1 ? String.fromCharCode(65 + r) : ''}`, kind: 'electrical', pos: [x0 + i * P, 8.5, z0 + r * P], dir: [0, 1, 0], role: 'io', imax: 3, groupId: `pin-${i}-${r}` })
        ports.push({ id: `t${i}_${r}`, label: `tail ${i + 1}`, kind: 'electrical', pos: [x0 + i * P, -2.5, z0 + r * P], dir: [0, -1, 0], role: 'io', imax: 3, groupId: `pin-${i}-${r}` })
      }
    }
    return ports
  },
}

registerParts([breadboard, perfboard, pinHeader])
