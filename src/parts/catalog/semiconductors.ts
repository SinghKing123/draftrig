import type { DeviceModel, PartDef, Port, Solid, Vec2, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { REGULATORS } from '../kernel/deviceData'
import { axialLeads, circle, dipPorts, dipSolids, num, pinPort, str } from './_helpers'

/* ------------------------------------------------------------------ */
/* Package builders                                                    */
/* ------------------------------------------------------------------ */

/** The flat-fronted half cylinder of a TO-92. */
function to92Outline(r: number, flat: number): Vec2[] {
  const a0 = Math.acos(-flat / r)
  const pts: Vec2[] = []
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * (2 * Math.PI - 2 * a0)
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return pts
}

/** TO-92 body plus three formed leads on a 2.54 mm pitch. */
function to92(standoff: number, mat: string): Solid[] {
  const H = 4.6
  const out: Solid[] = [
    {
      kind: 'extrude',
      mat,
      profile: { outline: to92Outline(2.35, 1.55) },
      depth: H,
      bevel: 0.25,
      rot: [-90, 0, 0],
      at: [0, standoff + H / 2, 0],
    },
  ]
  for (const x of [-2.54, 0, 2.54]) {
    out.push({
      kind: 'tube',
      mat: 'tin',
      r: 0.23,
      path: [
        [x * 0.5, standoff + 0.4, 0.2],
        [x, standoff - 1.2, 0.2],
        [x, -3.4, 0.2],
      ],
    })
  }
  return out
}

/** TO-220 body, heatsink tab with its mounting hole, and three leads. */
function to220(standoff: number, bodyMat: string): Solid[] {
  const W = 10.2
  const BODY_H = 9.2
  const T = 4.6
  const TAB_H = 6.4
  const out: Solid[] = [
    { kind: 'box', mat: bodyMat, size: [W, BODY_H, T], at: [0, standoff + BODY_H / 2, 0], bevel: 0.3 },
    // Metal tab, with the M3 clearance hole that bolts it to a heatsink.
    {
      kind: 'extrude',
      mat: 'steel',
      profile: {
        outline: [
          [-W / 2, 0],
          [W / 2, 0],
          [W / 2, TAB_H],
          [-W / 2, TAB_H],
        ],
        holes: [circle(1.85, 0, TAB_H - 3.0, 14)],
      },
      depth: 1.35,
      rot: [0, 0, 0],
      at: [0, standoff + BODY_H, 0],
    },
    // The tab is continuous with the metal behind the moulding.
    { kind: 'box', mat: 'steel', size: [W, BODY_H * 0.75, 1.35], at: [0, standoff + BODY_H * 0.62, -T / 2 + 0.68] },
  ]
  for (const x of [-2.54, 0, 2.54]) {
    out.push({ kind: 'box', mat: 'tin', size: [0.8, standoff + 3.6, 0.5], at: [x, (standoff - 3.6) / 2, 0.4] })
  }
  return out
}

/* ================================================================== */
/* Bipolar transistor                                                  */
/* ================================================================== */

const BJTS: Record<string, { label: string; pnp: boolean; bf: number; ic: number; vce: number; order: string }> = {
  '2N3904': { label: '2N3904, NPN, 200 mA', pnp: false, bf: 200, ic: 0.2, vce: 40, order: 'ebc' },
  '2N3906': { label: '2N3906, PNP, 200 mA', pnp: true, bf: 180, ic: 0.2, vce: 40, order: 'ebc' },
  BC547: { label: 'BC547, NPN, 100 mA', pnp: false, bf: 290, ic: 0.1, vce: 45, order: 'cbe' },
  BC557: { label: 'BC557, PNP, 100 mA', pnp: true, bf: 240, ic: 0.1, vce: 45, order: 'cbe' },
  '2N2222': { label: '2N2222, NPN, 800 mA', pnp: false, bf: 150, ic: 0.8, vce: 40, order: 'ebc' },
}

const transistor: PartDef = {
  id: 'transistor-to92',
  name: 'Transistor',
  category: 'semiconductor',
  blurb: 'Small-signal BJT in TO-92',
  tags: ['transistor', 'bjt', 'npn', 'pnp', '2n3904', 'bc547', '2n2222', 'switch', 'amplifier'],
  doc: { price: 0.06, description: 'Small-signal bipolar transistor. Watch the pinout, it differs between the 2N and BC families.' },
  params: [
    {
      key: 'model', label: 'Device', type: 'enum', default: '2N3904', group: 'Electrical',
      options: Object.entries(BJTS).map(([value, v]) => ({ value, label: v.label })),
    },
  ],
  solids: () => to92(3.6, 'epoxy-black'),
  ports: (p) => {
    const m = BJTS[str(p, 'model', '2N3904')] ?? BJTS['2N3904']
    const names = m.order.split('') as ('e' | 'b' | 'c')[]
    const label: Record<string, string> = { e: 'Emitter', b: 'Base', c: 'Collector' }
    return names.map((n, i) => pinPort(n, label[n], (i - 1) * 2.54, 0.2, { role: 'io', imax: 0.8 }))
  },
  electrical: {
    devices: (p) => {
      const m = BJTS[str(p, 'model', '2N3904')] ?? BJTS['2N3904']
      return [{ type: 'bjt', c: 'c', b: 'b', e: 'e', pnp: m.pnp, bf: m.bf, is: 1e-14 }]
    },
    limits: { imax: 0.8, pmax: 0.625 },
  },
  readouts: (p) => {
    const m = BJTS[str(p, 'model', '2N3904')] ?? BJTS['2N3904']
    return [
      { label: 'Type', value: m.pnp ? 'PNP' : 'NPN' },
      { label: 'hFE (typical)', value: String(m.bf) },
      { label: 'Max collector current', value: eng(m.ic, 'A') },
      { label: 'Max V(CE)', value: `${m.vce} V` },
      { label: 'Pinout (flat facing you)', value: m.order.toUpperCase().split('').join(' · ') },
    ]
  },
}

/* ================================================================== */
/* Power MOSFET                                                        */
/* ================================================================== */

const FETS: Record<string, { label: string; p: boolean; vth: number; kp: number; rds: number; id: number; vds: number }> = {
  IRLZ44N: { label: 'IRLZ44N, logic level, 47 A', p: false, vth: 1.6, kp: 22, rds: 0.022, id: 47, vds: 55 },
  IRF540N: { label: 'IRF540N, 33 A', p: false, vth: 3.5, kp: 18, rds: 0.044, id: 33, vds: 100 },
  IRF9540N: { label: 'IRF9540N, P-channel, 23 A', p: true, vth: 3.5, kp: 9, rds: 0.117, id: 23, vds: 100 },
  '2N7000': { label: '2N7000, small signal, 200 mA', p: false, vth: 2.1, kp: 0.35, rds: 1.8, id: 0.2, vds: 60 },
}

const mosfet: PartDef = {
  id: 'mosfet',
  name: 'MOSFET',
  category: 'semiconductor',
  blurb: 'Power switch, logic level or standard gate drive',
  tags: ['mosfet', 'fet', 'transistor', 'irlz44n', 'irf540', 'switch', 'power', 'pwm'],
  doc: { price: 0.9, description: 'Enhancement-mode power MOSFET. A logic-level part turns fully on from a 5 V gate; a standard one does not.' },
  params: [
    {
      key: 'model', label: 'Device', type: 'enum', default: 'IRLZ44N', group: 'Electrical',
      options: Object.entries(FETS).map(([value, v]) => ({ value, label: v.label })),
    },
  ],
  solids: (p) => (str(p, 'model', 'IRLZ44N') === '2N7000' ? to92(3.6, 'epoxy-black') : to220(3.4, 'epoxy-black')),
  ports: (p) => {
    const small = str(p, 'model', 'IRLZ44N') === '2N7000'
    const y = small ? 0.2 : 0.4
    // Both packages are gate, drain, source left to right.
    return [
      pinPort('g', 'Gate', -2.54, y, { role: 'io' }),
      pinPort('d', 'Drain', 0, y, { role: 'power', imax: small ? 0.2 : 40 }),
      pinPort('s', 'Source', 2.54, y, { role: 'power', imax: small ? 0.2 : 40 }),
    ]
  },
  electrical: {
    devices: (p) => {
      const m = FETS[str(p, 'model', 'IRLZ44N')] ?? FETS.IRLZ44N
      return [
        { type: 'mosfet', d: 'd', g: 'g', s: 's', p: m.p, vth: m.vth, k: m.kp, rds: m.rds },
        // Gate charge has to go somewhere; without it a floating gate is undefined.
        { type: 'capacitor', c: 1.7e-9, a: 'g', b: 's' },
        // Intrinsic body diode, which is why an H-bridge survives an inductive load.
        { type: 'diode', a: m.p ? 'd' : 's', c: m.p ? 's' : 'd', vf: 0.9, n: 1.6 },
      ]
    },
    limits: { imax: 47, vmax: 100 },
  },
  readouts: (p) => {
    const m = FETS[str(p, 'model', 'IRLZ44N')] ?? FETS.IRLZ44N
    return [
      { label: 'Channel', value: m.p ? 'P-channel' : 'N-channel' },
      { label: 'Gate threshold', value: `${m.vth.toFixed(1)} V` },
      { label: 'On resistance', value: eng(m.rds, 'Ω') },
      { label: 'Max drain current', value: eng(m.id, 'A') },
      { label: 'Logic level', value: m.vth < 2.5 ? 'Yes, full on at 5 V' : 'No, needs 10 V gate drive' },
    ]
  },
}

/* ================================================================== */
/* Linear regulator                                                    */
/* ================================================================== */

const regulator: PartDef = {
  id: 'regulator-linear',
  name: 'Linear regulator',
  category: 'power',
  blurb: 'Fixed or adjustable. Burns the difference as heat',
  tags: ['regulator', '7805', 'lm317', 'ldo', 'linear', 'voltage', 'power', '3.3v', '5v'],
  doc: { price: 0.45, description: 'Three-terminal linear regulator. Everything above the output voltage is dissipated in the package, so check the thermals.' },
  params: [
    {
      key: 'model', label: 'Device', type: 'enum', default: '7805', group: 'Electrical',
      options: Object.entries(REGULATORS).map(([value, v]) => ({ value, label: v.label })),
    },
    { key: 'vadj', label: 'Set voltage', type: 'number', unit: 'V', default: 5, min: 1.25, max: 30, step: 0.1, group: 'Electrical', showIf: (p) => p.model === 'LM317' },
  ],
  solids: () => to220(3.4, 'epoxy-black'),
  ports: (p) => {
    const adj = str(p, 'model', '7805') === 'LM317'
    // 78xx is IN-GND-OUT; the LM317 is ADJ-OUT-IN.
    return adj
      ? [
          pinPort('gnd', 'Adjust', -2.54, 0.4, { role: 'io' }),
          pinPort('out', 'Output', 0, 0.4, { role: 'power', imax: 1.5 }),
          pinPort('in', 'Input', 2.54, 0.4, { role: 'power', imax: 1.5 }),
        ]
      : [
          pinPort('in', 'Input', -2.54, 0.4, { role: 'power', imax: 1.5 }),
          pinPort('gnd', 'Ground', 0, 0.4, { role: 'gnd' }),
          pinPort('out', 'Output', 2.54, 0.4, { role: 'power', imax: 1.5 }),
        ]
  },
  electrical: {
    devices: (p) => {
      const m = REGULATORS[str(p, 'model', '7805')] ?? REGULATORS['7805']
      const vout = str(p, 'model', '7805') === 'LM317' ? num(p, 'vadj', 5) : m.vout
      return [
        { type: 'behavioral', evalId: 'regulator-linear', ref: 'gnd', pins: ['in', 'out'] },
        // Quiescent current, which is why a 78xx warms up with no load at all.
        { type: 'resistor', r: Math.max(vout, 1) / 0.005, a: 'in', b: 'gnd' },
      ]
    },
    limits: { imax: 1.5, vmax: 35 },
  },
  readouts: (p) => {
    const m = REGULATORS[str(p, 'model', '7805')] ?? REGULATORS['7805']
    const vout = str(p, 'model', '7805') === 'LM317' ? num(p, 'vadj', 5) : m.vout
    return [
      { label: 'Output', value: `${vout.toFixed(2)} V` },
      { label: 'Max current', value: eng(m.imax, 'A') },
      { label: 'Dropout', value: `${m.dropout} V` },
      { label: 'Minimum input', value: `${(vout + m.dropout).toFixed(1)} V` },
      { label: 'Heat at 12 V in, 500 mA', value: `${Math.max(0, (12 - vout) * 0.5).toFixed(1)} W` },
    ]
  },
}

/* ================================================================== */
/* Zener diode                                                         */
/* ================================================================== */

const zener: PartDef = {
  id: 'diode-zener',
  name: 'Zener diode',
  category: 'semiconductor',
  blurb: 'Clamps in reverse, a voltage reference',
  tags: ['zener', 'diode', 'reference', 'clamp', 'regulator', 'protection'],
  doc: { manufacturer: 'Generic', mpn: 'BZX55C', price: 0.05, description: 'Reverse breakdown is the point: bias it backwards through a resistor and it holds its rated voltage.' },
  params: [
    { key: 'vz', label: 'Zener voltage', type: 'number', unit: 'V', default: 5.1, min: 2.4, max: 75, step: 0.1, group: 'Electrical' },
    { key: 'pz', label: 'Power rating', type: 'enum', default: '0.5', group: 'Electrical', options: [
      { value: '0.5', label: '500 mW' }, { value: '1', label: '1 W' }, { value: '5', label: '5 W' },
    ] },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 10.16, min: 5, max: 30, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const big = str(p, 'pz', '0.5') !== '0.5'
    const len = big ? 5.2 : 3.6
    const r = big ? 1.35 : 0.95
    const y = 3.0
    return [
      { kind: 'cyl', mat: { color: '#1C1E22', rough: 0.42, density: 2.5 }, r, h: len, chamfer: r * 0.25, rot: [0, 0, 90], at: [0, y, 0] },
      { kind: 'cyl', mat: { color: '#D8DCE2', rough: 0.5, density: 2.5 }, r: r * 1.02, h: len * 0.16,
        rot: [0, 0, 90], at: [-len * 0.33, y, 0], noCollide: true },
      ...axialLeads({ pitch: num(p, 'pitch', 10.16), bodyLen: len, bodyY: y, leadR: big ? 0.4 : 0.27 }),
    ]
  },
  ports: (p) => {
    const h = num(p, 'pitch', 10.16) / 2
    return [pinPort('a', 'Anode', h), pinPort('c', 'Cathode (banded)', -h)]
  },
  electrical: {
    devices: (p) => [{ type: 'diode', a: 'a', c: 'c', vf: 0.7, n: 1.6, bv: num(p, 'vz', 5.1) }],
  },
  readouts: (p) => {
    const vz = num(p, 'vz', 5.1)
    const pz = parseFloat(str(p, 'pz', '0.5'))
    return [
      { label: 'Zener voltage', value: `${vz.toFixed(1)} V` },
      { label: 'Max current', value: eng(pz / vz, 'A') },
      { label: 'Test current', value: '5 mA' },
    ]
  },
}

/* ================================================================== */
/* Bridge rectifier                                                    */
/* ================================================================== */

const bridge: PartDef = {
  id: 'bridge-rectifier',
  name: 'Bridge rectifier',
  category: 'semiconductor',
  blurb: 'Four diodes, AC in, DC out',
  tags: ['bridge', 'rectifier', 'diode', 'ac', 'dc', 'power supply', 'w04'],
  doc: { mpn: 'W04M', price: 0.4, description: 'Full-wave bridge in one package. Both AC terminals swap roles each half cycle, so the output is always the same polarity.' },
  params: [
    { key: 'imax', label: 'Current rating', type: 'number', unit: 'A', default: 1.5, min: 0.5, max: 35, step: 0.5, group: 'Electrical' },
    { key: 'vmax', label: 'Reverse voltage', type: 'number', unit: 'V', default: 400, min: 50, max: 1000, step: 50, group: 'Electrical' },
  ],
  solids: (p) => {
    const s = Math.min(22, 8 + num(p, 'imax', 1.5) * 1.2)
    const h = s * 0.45
    return [
      { kind: 'box', mat: 'epoxy-black', size: [s, h, s], at: [0, 3.2 + h / 2, 0], bevel: 0.6 },
      // The chamfered corner marks the + terminal.
      { kind: 'box', mat: { color: '#3A3F46', rough: 0.6, density: 1.9 }, size: [s * 0.34, h * 1.02, s * 0.34],
        at: [-s / 2 + s * 0.1, 3.2 + h / 2, -s / 2 + s * 0.1], rot: [0, 45, 0], noCollide: true },
      ...[-3.81, -1.27, 1.27, 3.81].map((x, i) => ({
        kind: 'box' as const, mat: 'tin', size: [0.7, 6.8, 0.5] as [number, number, number],
        at: [x, -0.2, i % 2 === 0 ? 0 : 0] as [number, number, number],
      })),
    ]
  },
  ports: () => [
    pinPort('ac1', 'AC ~', -3.81, 0, { role: 'power', imax: 35 }),
    pinPort('p', 'DC +', -1.27, 0, { role: 'power', imax: 35 }),
    pinPort('n', 'DC −', 1.27, 0, { role: 'gnd', imax: 35 }),
    pinPort('ac2', 'AC ~', 3.81, 0, { role: 'power', imax: 35 }),
  ],
  electrical: {
    devices: () => [
      { type: 'diode', a: 'ac1', c: 'p', vf: 0.8, n: 1.7 },
      { type: 'diode', a: 'ac2', c: 'p', vf: 0.8, n: 1.7 },
      { type: 'diode', a: 'n', c: 'ac1', vf: 0.8, n: 1.7 },
      { type: 'diode', a: 'n', c: 'ac2', vf: 0.8, n: 1.7 },
    ],
  },
  readouts: (p) => [
    { label: 'Rating', value: `${num(p, 'imax', 1.5)} A / ${num(p, 'vmax', 400)} V` },
    { label: 'Forward drop', value: '1.6 V (two diodes)' },
  ],
}

/* ================================================================== */
/* Schottky diode                                                      */
/* ================================================================== */

const SCHOTTKYS: Record<string, { label: string; vf: number; imax: number; vr: number; leak: number }> = {
  '1N5817': { label: '1N5817, 1 A, 20 V', vf: 0.32, imax: 1, vr: 20, leak: 1e-5 },
  '1N5819': { label: '1N5819, 1 A, 40 V', vf: 0.38, imax: 1, vr: 40, leak: 1e-5 },
  '1N5822': { label: '1N5822, 3 A, 40 V', vf: 0.42, imax: 3, vr: 40, leak: 2e-5 },
  SB560: { label: 'SB560, 5 A, 60 V', vf: 0.55, imax: 5, vr: 60, leak: 3e-5 },
  BAT85: { label: 'BAT85, 200 mA, 30 V', vf: 0.28, imax: 0.2, vr: 30, leak: 2e-7 },
}

const schottky: PartDef = {
  id: 'diode-schottky',
  name: 'Schottky diode',
  category: 'semiconductor',
  blurb: 'Drops a third of a volt and recovers instantly',
  tags: ['schottky', 'diode', '1n5819', 'rectifier', 'reverse polarity', 'boost', 'freewheel', 'low drop'],
  doc: {
    manufacturer: 'ON Semiconductor',
    mpn: '1N5819',
    price: 0.12,
    description:
      'A metal to silicon junction rather than a PN one. That buys a forward drop of about a third of a volt and no reverse recovery time at all, which is why every switching converter has one, and costs leakage that a plain diode does not have.',
  },
  params: [
    { key: 'model', label: 'Device', type: 'enum', default: '1N5819', group: 'Electrical', options: Object.entries(SCHOTTKYS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 12.7, min: 7.62, max: 30, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const s = SCHOTTKYS[str(p, 'model', '1N5819')] ?? SCHOTTKYS['1N5819']
    // Bigger current means a bigger package: DO-35 up to DO-201.
    const big = s.imax >= 3
    const small = s.imax <= 0.2
    const len = small ? 4 : big ? 9.5 : 5.2
    const r = small ? 1 : big ? 2.7 : 1.35
    const body = small
      ? { color: '#DCE4E8', rough: 0.1, opacity: 0.5, transmission: 0.7, density: 2.5 }
      : { color: '#1A1D21', rough: 0.42, clearcoat: 0.3, density: 2.2 }
    return [
      { kind: 'cyl', mat: body, r, h: len, rot: [0, 0, 90], at: [0, r + 1.6, 0], seg: 18, chamfer: 0.2 },
      // Cathode band, at the negative end.
      {
        kind: 'cyl', mat: { color: '#E8EAEC', rough: 0.55, density: 0.01 }, r: r + 0.03, h: len * 0.18,
        rot: [0, 0, 90], at: [len * 0.32, r + 1.6, 0], seg: 18, noCollide: true,
      },
      ...axialLeads({ pitch: num(p, 'pitch', 12.7), bodyLen: len, bodyY: r + 1.6, leadR: big ? 0.5 : 0.28 }),
    ]
  },
  ports: (p) => {
    const pitch = num(p, 'pitch', 12.7)
    return [
      { id: 'a', label: 'Anode', kind: 'electrical', pos: [-pitch / 2, -3.4, 0], dir: [0, -1, 0], role: 'passive', solderable: true },
      { id: 'c', label: 'Cathode (band)', kind: 'electrical', pos: [pitch / 2, -3.4, 0], dir: [0, -1, 0], role: 'passive', solderable: true },
    ]
  },
  electrical: {
    devices: (p) => {
      const s = SCHOTTKYS[str(p, 'model', '1N5819')] ?? SCHOTTKYS['1N5819']
      // A Schottky has a much larger saturation current and a lower ideality
      // factor than a PN diode, which is what produces the low forward drop.
      return [{ type: 'diode', a: 'a', c: 'c', is: s.leak, n: 1.05, vf: s.vf, rs: 0.05 / s.imax }]
    },
    limits: { vmax: 60, imax: 5 },
  },
  readouts: (p) => {
    const s = SCHOTTKYS[str(p, 'model', '1N5819')] ?? SCHOTTKYS['1N5819']
    return [
      { label: 'Forward drop', value: `${s.vf.toFixed(2)} V at ${s.imax} A` },
      { label: 'Reverse voltage', value: `${s.vr} V` },
      { label: 'Loss at rating', value: `${(s.vf * s.imax).toFixed(2)} W` },
      { label: 'Reverse recovery', value: 'None, this is a majority carrier device' },
    ]
  },
}

/* ================================================================== */
/* RGB LED                                                             */
/* ================================================================== */

const rgbLed: PartDef = {
  id: 'led-rgb',
  name: 'RGB LED',
  category: 'display',
  blurb: 'Three dice in one lens, sharing a pin',
  tags: ['rgb', 'led', 'colour', 'color', 'tricolour', 'common anode', 'common cathode', 'indicator'],
  doc: {
    price: 0.2,
    description:
      'Three LEDs behind one lens. They share one pin, so the common type decides which way the drive has to go, and the three need different resistors because red runs at about two volts where green and blue need three.',
  },
  params: [
    {
      key: 'common', label: 'Common pin', type: 'enum', default: 'cathode', group: 'Electrical',
      options: [{ value: 'cathode', label: 'Common cathode' }, { value: 'anode', label: 'Common anode' }],
    },
    { key: 'diffused', label: 'Diffused lens', type: 'bool', default: true, group: 'Optical', help: 'A clear lens shows three separate dice. A diffused one mixes them.' },
    { key: 'lead', label: 'Lead length', type: 'number', unit: 'mm', default: 5, min: 2, max: 30, step: 0.5, group: 'Body' },
  ],
  solids: (p) => {
    const diffused = p.diffused !== false
    const lens = {
      color: diffused ? '#E4E9EC' : '#DCEAF0',
      rough: diffused ? 0.45 : 0.06,
      opacity: diffused ? 0.92 : 0.5,
      transmission: diffused ? 0.2 : 0.8,
      clearcoat: 1,
      density: 1.2,
    }
    const R = 2.5
    const pts: [number, number][] = [[0, 1.0], [R, 1.0], [R, 5.6]]
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2)
      pts.push([R * Math.cos(a), 5.6 + R * Math.sin(a)])
    }
    const leadLen = num(p, 'lead', 5)
    const out: Solid[] = [
      { kind: 'cyl', mat: lens, r: 2.9, h: 1.0, at: [0, 0.5, 0], seg: 22 },
      { kind: 'lathe', mat: lens, points: pts, tag: 'lens' },
    ]
    // Three dice on their own cups, visible through the epoxy.
    const tint = ['#B31217', '#0E7A34', '#14357A']
    tint.forEach((c, i) => {
      const x = (i - 1) * 1.1
      out.push({ kind: 'cyl', mat: { color: c, rough: 0.4, density: 5 }, r: 0.6, h: 0.35, at: [x, 3.2, 0], seg: 10, noCollide: true })
    })
    out.push({ kind: 'cyl', mat: 'steel', r: 1.5, h: 0.9, r2: 1.2, at: [0, 3.0, 0], tag: 'cup', noCollide: true })
    // Four leads. The common one is the long one, second from an end.
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 1.27
      const long = i === 1
      out.push({
        kind: 'box', mat: 'tin', size: [0.5, leadLen + (long ? 1.2 : 0), 0.5],
        at: [x, -(leadLen + (long ? 1.2 : 0)) / 2 + 0.4, 0],
      })
    }
    return out
  },
  ports: (p) => {
    const anode = str(p, 'common', 'cathode') === 'anode'
    const names: [string, string][] = [
      ['r', 'Red'],
      ['com', anode ? 'Common anode (+)' : 'Common cathode (−)'],
      ['g', 'Green'],
      ['b', 'Blue'],
    ]
    return names.map(([id, label], i) => ({
      id, label, kind: 'electrical' as const,
      pos: [(i - 1.5) * 1.27, -2.4, 0] as Vec3, dir: [0, -1, 0] as Vec3,
      role: 'passive' as const, imax: 0.02, solderable: true,
    }))
  },
  electrical: {
    devices: (p) => {
      const anode = str(p, 'common', 'cathode') === 'anode'
      const dice: [string, number][] = [['r', 1.95], ['g', 3.1], ['b', 3.2]]
      return dice.map(([pin, vf]) =>
        anode
          ? { type: 'diode' as const, a: 'com', c: pin, vf, n: 2.2, rs: 12, luminous: true }
          : { type: 'diode' as const, a: pin, c: 'com', vf, n: 2.2, rs: 12, luminous: true },
      )
    },
    limits: { imax: 0.02 },
  },
  readouts: (p) => [
    { label: 'Common', value: str(p, 'common', 'cathode') === 'anode' ? 'Anode, drive the colours low' : 'Cathode, drive the colours high' },
    { label: 'Forward voltage', value: '1.95 V red, 3.1 V green, 3.2 V blue' },
    { label: 'R for 5 V', value: '150 Ω red, 100 Ω green and blue' },
    { label: 'Peak current', value: '20 mA per die, 60 mA total' },
  ],
}

/* ================================================================== */
/* Optocoupler                                                         */
/* ================================================================== */

const OPTOS: Record<string, { label: string; pins: number; ctr: number; viso: number; vf: number }> = {
  PC817: { label: 'PC817, transistor, DIP-4', pins: 4, ctr: 1.0, viso: 5000, vf: 1.2 },
  '4N35': { label: '4N35, transistor, DIP-6', pins: 6, ctr: 1.0, viso: 5300, vf: 1.25 },
  '6N137': { label: '6N137, logic output, DIP-8', pins: 8, ctr: 3.0, viso: 3750, vf: 1.4 },
}

const optocoupler: PartDef = {
  id: 'optocoupler',
  name: 'Optocoupler',
  category: 'semiconductor',
  blurb: 'An LED shining at a transistor, with nothing else between them',
  tags: ['optocoupler', 'optoisolator', 'pc817', '4n35', 'isolation', 'isolator', 'mains', 'level shift'],
  doc: {
    manufacturer: 'Sharp',
    mpn: 'PC817',
    price: 0.25,
    description:
      'An LED facing a phototransistor inside one package. The only thing crossing between the two sides is light, so several thousand volts can sit between them. The output is a transistor, so it needs a load resistor to do anything.',
  },
  params: [
    { key: 'model', label: 'Device', type: 'enum', default: 'PC817', group: 'Electrical', options: Object.entries(OPTOS).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'ctr', label: 'Current transfer ratio', type: 'number', unit: '%', default: 100, min: 20, max: 400, step: 10, group: 'Electrical', help: 'How much collector current one milliamp through the LED produces. It varies enormously part to part and falls with age.' },
  ],
  solids: (p) => {
    const o = OPTOS[str(p, 'model', 'PC817')] ?? OPTOS.PC817
    return dipSolids(o.pins, { rowSpacing: 7.62, bodyColor: { color: '#1A1C20', rough: 0.55, clearcoat: 0.15, density: 1.9 } })
  },
  ports: (p) => {
    const o = OPTOS[str(p, 'model', 'PC817')] ?? OPTOS.PC817
    // Pin 1 is the LED anode on every one of these.
    const names =
      o.pins === 4 ? ['a', 'c', 'e', 'col']
      : o.pins === 6 ? ['a', 'c', 'nc', 'e', 'col', 'base']
      : ['nc', 'a', 'c', 'nc2', 'gnd', 'col', 'e', 'vcc']
    return dipPorts(o.pins, names, { rowSpacing: 7.62 })
  },
  electrical: {
    devices: (p) => {
      const o = OPTOS[str(p, 'model', 'PC817')] ?? OPTOS.PC817
      const ctr = Math.max(num(p, 'ctr', 100), 1) / 100
      const out: DeviceModel[] = [
        { type: 'diode', a: 'a', c: 'c', vf: o.vf, n: 1.9, rs: 4 },
      ]
      // The output side is a transistor whose base current is the light. A
      // gain of ctr times the LED current is exactly what the datasheet's
      // current transfer ratio means, so the base is driven from the LED path.
      out.push({ type: 'bjt', c: 'col', b: '#opt', e: 'e', bf: 220 * ctr })
      // Light coupling: a small current mirror from the LED string into the
      // base node, modelled as a large resistance so the base sits where the
      // LED current puts it.
      out.push({ type: 'resistor', r: 220000, a: 'c', b: '#opt' })
      out.push({ type: 'resistor', r: 2.2e6, a: '#opt', b: 'e' })
      return out
    },
    limits: { vmax: 70, imax: 0.05 },
  },
  readouts: (p) => {
    const o = OPTOS[str(p, 'model', 'PC817')] ?? OPTOS.PC817
    const ctr = num(p, 'ctr', 100)
    return [
      { label: 'Isolation', value: `${o.viso} V rms` },
      { label: 'Transfer ratio', value: `${ctr} %` },
      { label: 'LED', value: `${o.vf.toFixed(2)} V, 10 to 20 mA` },
      { label: 'Output at 10 mA in', value: `${((ctr / 100) * 10).toFixed(0)} mA available` },
    ]
  },
}

/* ================================================================== */
/* Darlington transistor                                               */
/* ================================================================== */

const darlington: PartDef = {
  id: 'transistor-darlington',
  name: 'Darlington transistor',
  category: 'semiconductor',
  blurb: 'Two transistors in one package, enormous gain, a volt of drop',
  tags: ['darlington', 'tip120', 'transistor', 'power', 'to-220', 'relay', 'solenoid', 'motor', 'driver'],
  doc: {
    manufacturer: 'ON Semiconductor',
    mpn: 'TIP120',
    price: 0.6,
    description:
      'Two transistors stacked so the first drives the second. Gain of a thousand, so a logic pin can switch five amps, at the cost of about a volt across it when it is on, which at five amps is five watts of heat and the reason these need a heatsink.',
  },
  params: [
    {
      key: 'model', label: 'Device', type: 'enum', default: 'TIP120', group: 'Electrical',
      options: [
        { value: 'TIP120', label: 'TIP120, NPN, 5 A, 60 V' },
        { value: 'TIP122', label: 'TIP122, NPN, 5 A, 100 V' },
        { value: 'TIP125', label: 'TIP125, PNP, 5 A, 60 V' },
        { value: 'BD679', label: 'BD679, NPN, 4 A, 80 V' },
      ],
    },
    { key: 'heatsink', label: 'Heatsink fitted', type: 'bool', default: false, group: 'Thermal' },
  ],
  solids: (p) => {
    const out = to220(3.4, 'epoxy-black')
    if (p.heatsink === true) {
      // A small clip-on finned sink, as these are usually given.
      out.push({ kind: 'box', mat: 'alu-anod-black', size: [12, 20, 2], at: [0, 15, -4] })
      for (let i = 0; i < 5; i++) {
        out.push({ kind: 'box', mat: 'alu-anod-black', size: [1.6, 20, 12], at: [-4.8 + i * 2.4, 15, -10] })
      }
    }
    return out
  },
  ports: (p) => {
    const pnp = str(p, 'model', 'TIP120').startsWith('TIP125')
    const out: Port[] = [
      { id: 'b', label: 'Base', kind: 'electrical', pos: [-2.54, -3.6, 0.4], dir: [0, -1, 0], role: 'io', imax: 0.12, solderable: true },
      { id: 'c', label: pnp ? 'Collector (tab)' : 'Collector (tab)', kind: 'electrical', pos: [0, -3.6, 0.4], dir: [0, -1, 0], role: 'passive', imax: 5, solderable: true },
      { id: 'e', label: 'Emitter', kind: 'electrical', pos: [2.54, -3.6, 0.4], dir: [0, -1, 0], role: 'passive', imax: 5, solderable: true },
    ]
    out.push({
      id: 'tab', label: 'M3 mounting hole', kind: 'mechanical',
      pos: [0, 3.4 + 9.2 + 3.4, 0], dir: [0, 0, -1], mate: { type: 'hole', size: 3.5 },
    })
    return out
  },
  electrical: {
    devices: (p) => {
      const pnp = str(p, 'model', 'TIP120') === 'TIP125'
      // A darlington is modelled as one device with the pair's gain and the
      // two base-emitter drops that give it its unusually high saturation.
      return [{ type: 'bjt', c: 'c', b: 'b', e: 'e', pnp, bf: 1000, is: 3e-13 }]
    },
    limits: { imax: 5, vmax: 100, pmax: 65 },
  },
  readouts: (p) => {
    const model = str(p, 'model', 'TIP120')
    const sink = p.heatsink === true
    return [
      { label: 'Gain', value: '1000 minimum' },
      { label: 'Saturation', value: 'About 1.0 V at 3 A' },
      { label: 'Heat at 3 A', value: '3 W' },
      { label: 'Without a sink', value: sink ? `Sink fitted, ${model} good to about 25 W` : 'Derate to 2 W, the tab is the only path' },
    ]
  },
}

registerParts([
  transistor, mosfet, regulator, zener, bridge,
  schottky, rgbLed, optocoupler, darlington,
])
