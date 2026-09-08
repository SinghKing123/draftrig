import type { PartDef, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng, engCompact, resistorBands } from '../kernel/units'
import { axialLeads, num, pinPort, radialLeads, str } from './_helpers'

/* ------------------------------------------------------------------ */
/* Resistor, axial through-hole                                        */
/* ------------------------------------------------------------------ */

const RES_WATT: Record<string, { len: number; r: number; lead: number }> = {
  '0.125': { len: 3.2, r: 0.95, lead: 0.24 },
  '0.25': { len: 6.3, r: 1.15, lead: 0.28 },
  '0.5': { len: 9.0, r: 1.9, lead: 0.32 },
  '1': { len: 11.5, r: 2.4, lead: 0.4 },
  '2': { len: 15.5, r: 3.0, lead: 0.4 },
}

const resistorAxial: PartDef = {
  id: 'resistor-axial',
  name: 'Resistor',
  category: 'passive',
  blurb: 'Axial metal-film, colour-coded from its value',
  tags: ['resistor', 'r', 'ohm', 'passive', 'through-hole'],
  doc: { description: 'Generic axial metal-film resistor. Bands are generated from the value and tolerance.', price: 0.02 },
  params: [
    { key: 'value', label: 'Resistance', type: 'number', unit: 'Ω', default: 220, min: 0.1, max: 1e9, eng: true, group: 'Electrical' },
    {
      key: 'tolerance', label: 'Tolerance', type: 'enum', default: '5', group: 'Electrical',
      options: [
        { value: '1', label: '±1 % (brown)' },
        { value: '2', label: '±2 % (red)' },
        { value: '5', label: '±5 % (gold)' },
        { value: '10', label: '±10 % (silver)' },
      ],
    },
    {
      key: 'watt', label: 'Power rating', type: 'enum', default: '0.25', group: 'Electrical',
      options: [
        { value: '0.125', label: '1/8 W' },
        { value: '0.25', label: '1/4 W' },
        { value: '0.5', label: '1/2 W' },
        { value: '1', label: '1 W' },
        { value: '2', label: '2 W' },
      ],
    },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 10.16, min: 5, max: 40, step: 2.54, group: 'Body' },
    { key: 'standoff', label: 'Body height', type: 'number', unit: 'mm', default: 3.2, min: 0, max: 20, step: 0.5, group: 'Body' },
    {
      key: 'bodyColor', label: 'Body', type: 'enum', default: 'resistor-beige', group: 'Body',
      options: [
        { value: 'resistor-beige', label: 'Carbon film (beige)' },
        { value: 'resistor-blue', label: 'Metal film (blue)' },
      ],
    },
  ],
  solids: (p) => {
    const w = RES_WATT[str(p, 'watt', '0.25')] ?? RES_WATT['0.25']
    const y = num(p, 'standoff', 3.2)
    const mat = str(p, 'bodyColor', 'resistor-beige')
    const tol = parseInt(str(p, 'tolerance', '5'), 10)
    const bands = resistorBands(num(p, 'value', 220), tol)

    const out: Solid[] = [
      // Body: shoulders + barrel gives the classic dog-bone silhouette.
      { kind: 'cyl', mat, r: w.r, h: w.len * 0.82, rot: [0, 0, 90], at: [0, y, 0] },
      { kind: 'cyl', mat, r: w.r * 0.72, h: w.len, rot: [0, 0, 90], at: [0, y, 0] },
    ]

    // Bands sit toward one end; the tolerance band is set apart at the other.
    const bodyHalf = (w.len * 0.82) / 2
    const bw = w.len * 0.088
    const gap = bw * 1.75
    const valueBands = bands.slice(0, -1)
    const startX = -bodyHalf + bw * 1.4
    valueBands.forEach((c, i) => {
      out.push({
        kind: 'cyl', mat: { color: c, rough: 0.42 }, r: w.r * 1.02, h: bw,
        rot: [0, 0, 90], at: [startX + i * gap, y, 0], noCollide: true,
      })
    })
    out.push({
      kind: 'cyl', mat: { color: bands[bands.length - 1], rough: 0.3, metal: 0.7 },
      r: w.r * 1.02, h: bw, rot: [0, 0, 90], at: [bodyHalf - bw * 1.4, y, 0], noCollide: true,
    })

    out.push(...axialLeads({ pitch: num(p, 'pitch', 10.16), bodyLen: w.len, bodyY: y, leadR: w.lead }))
    return out
  },
  ports: (p) => {
    const h = num(p, 'pitch', 10.16) / 2
    return [pinPort('1', 'A', -h), pinPort('2', 'B', h)]
  },
  electrical: {
    devices: (p) => [{ type: 'resistor', r: num(p, 'value', 220), a: '1', b: '2', power: parseFloat(str(p, 'watt', '0.25')) }],
    limits: { pmax: 0.25 },
  },
  readouts: (p) => [
    { label: 'Value', value: eng(num(p, 'value', 220), 'Ω') },
    { label: 'Marking', value: engCompact(num(p, 'value', 220)) },
    { label: 'Max current', value: eng(Math.sqrt(parseFloat(str(p, 'watt', '0.25')) / num(p, 'value', 220)), 'A') },
  ],
}

/* ------------------------------------------------------------------ */
/* Ceramic capacitor, disc                                             */
/* ------------------------------------------------------------------ */

const capCeramic: PartDef = {
  id: 'capacitor-ceramic',
  name: 'Ceramic capacitor',
  category: 'passive',
  blurb: 'Disc ceramic, non-polarised',
  tags: ['capacitor', 'c', 'ceramic', 'decoupling', 'passive'],
  doc: { description: 'Multilayer / disc ceramic capacitor. Non-polarised, low ESR, ideal for decoupling.', price: 0.05 },
  params: [
    { key: 'value', label: 'Capacitance', type: 'number', unit: 'F', default: 100e-9, min: 1e-12, max: 1e-3, eng: true, group: 'Electrical' },
    { key: 'vmax', label: 'Voltage rating', type: 'number', unit: 'V', default: 50, min: 6.3, max: 1000, group: 'Electrical' },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 5.08, min: 2.54, max: 10, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const c = num(p, 'value', 100e-9)
    // Disc grows with stored charge; roughly matches real part sizing.
    const r = Math.min(5.5, Math.max(1.9, 2.0 + Math.log10(c / 1e-12) * 0.55))
    const t = Math.max(1.1, r * 0.42)
    const y = 4.5 + r * 0.4
    return [
      { kind: 'cyl', mat: 'ceramic-tan', r, h: t, rot: [90, 0, 0], at: [0, y, 0] },
      { kind: 'cyl', mat: 'ceramic-tan', r: r * 0.55, h: t * 1.15, rot: [90, 0, 0], at: [0, y, 0] },
      ...radialLeads({ pitch: num(p, 'pitch', 5.08), fromY: y }),
    ]
  },
  ports: (p) => {
    const h = num(p, 'pitch', 5.08) / 2
    return [pinPort('1', 'A', -h), pinPort('2', 'B', h)]
  },
  electrical: {
    devices: (p) => [{ type: 'capacitor', c: num(p, 'value', 100e-9), a: '1', b: '2', esr: 0.05, vmax: num(p, 'vmax', 50) }],
  },
  readouts: (p) => [
    { label: 'Value', value: eng(num(p, 'value', 100e-9), 'F') },
    { label: 'Marking', value: String(Math.round(num(p, 'value', 100e-9) * 1e12)).slice(0, 2) + String(Math.max(0, Math.floor(Math.log10(num(p, 'value', 100e-9) * 1e12)) - 1)) },
  ],
}

/* ------------------------------------------------------------------ */
/* Electrolytic capacitor, radial can                                  */
/* ------------------------------------------------------------------ */

const capElectrolytic: PartDef = {
  id: 'capacitor-electrolytic',
  name: 'Electrolytic capacitor',
  category: 'passive',
  blurb: 'Radial aluminium can — polarised',
  tags: ['capacitor', 'electrolytic', 'polarised', 'bulk', 'passive'],
  doc: { description: 'Aluminium electrolytic. Polarised: the striped side is the negative terminal.', price: 0.15 },
  params: [
    { key: 'value', label: 'Capacitance', type: 'number', unit: 'F', default: 100e-6, min: 1e-7, max: 1, eng: true, group: 'Electrical' },
    { key: 'vmax', label: 'Voltage rating', type: 'number', unit: 'V', default: 25, min: 4, max: 450, group: 'Electrical' },
    { key: 'esr', label: 'ESR', type: 'number', unit: 'Ω', default: 0.2, min: 0.001, max: 20, step: 0.01, group: 'Electrical' },
  ],
  solids: (p) => {
    const c = num(p, 'value', 100e-6)
    const v = num(p, 'vmax', 25)
    // CV product drives can size, same as the real world.
    const cv = c * v
    const d = Math.min(18, Math.max(4, 4 + Math.pow(cv, 0.33) * 42))
    const h = d * 1.6
    const r = d / 2
    const pitch = d <= 5 ? 2.0 : d <= 8 ? 3.5 : 5.0
    return [
      { kind: 'cyl', mat: 'alu-6063', r: r * 0.98, h, at: [0, h / 2 + 0.6, 0] },
      { kind: 'cyl', mat: 'elcap-sleeve', r, h: h - 1.2, at: [0, h / 2 + 0.6, 0] },
      // Negative stripe.
      { kind: 'cyl', mat: { color: '#C9CFD8', rough: 0.5 }, r: r * 1.004, h: h - 1.2,
        at: [0, h / 2 + 0.6, 0], seg: 24, tag: 'stripe', noCollide: true },
      { kind: 'cyl', mat: 'elcap-sleeve', r: r * 1.006, h: h - 1.2, at: [0, h / 2 + 0.6, 0], seg: 24,
        rot: [0, 0, 0], noCollide: true },
      // Score lines on the top vent.
      { kind: 'box', mat: { color: '#9AA0A8', rough: 0.5 }, size: [r * 1.6, 0.15, 0.5], at: [0, h + 0.62, 0], noCollide: true },
      { kind: 'box', mat: { color: '#9AA0A8', rough: 0.5 }, size: [0.5, 0.15, r * 1.6], at: [0, h + 0.62, 0], noCollide: true },
      ...radialLeads({ pitch, fromY: 0.6 }),
    ]
  },
  ports: (p) => {
    const c = num(p, 'value', 100e-6)
    const v = num(p, 'vmax', 25)
    const d = Math.min(18, Math.max(4, 4 + Math.pow(c * v, 0.33) * 42))
    const pitch = d <= 5 ? 2.0 : d <= 8 ? 3.5 : 5.0
    return [
      pinPort('p', '+', -pitch / 2, 0, { role: 'passive' }),
      pinPort('n', '−', pitch / 2, 0, { role: 'passive' }),
    ]
  },
  electrical: {
    devices: (p) => [
      { type: 'capacitor', c: num(p, 'value', 100e-6), a: 'p', b: 'n', esr: num(p, 'esr', 0.2), vmax: num(p, 'vmax', 25), polarized: true },
    ],
  },
  readouts: (p) => [
    { label: 'Value', value: eng(num(p, 'value', 100e-6), 'F') },
    { label: 'Rating', value: `${num(p, 'vmax', 25)} V` },
    { label: 'Ripple ESR', value: eng(num(p, 'esr', 0.2), 'Ω') },
  ],
}

/* ------------------------------------------------------------------ */
/* LED, 5 mm through-hole                                              */
/* ------------------------------------------------------------------ */

export const LED_COLORS: Record<string, { label: string; body: string; emit: string; vf: number; nm: number }> = {
  red: { label: 'Red', body: '#B31217', emit: '#FF3A20', vf: 1.9, nm: 630 },
  green: { label: 'Green', body: '#0E7A34', emit: '#3BFF78', vf: 2.1, nm: 525 },
  yellow: { label: 'Yellow', body: '#B58B0E', emit: '#FFD23A', vf: 2.05, nm: 590 },
  blue: { label: 'Blue', body: '#0F3D9E', emit: '#4C9BFF', vf: 3.1, nm: 470 },
  white: { label: 'White', body: '#DCE6EC', emit: '#FFF4E0', vf: 3.2, nm: 0 },
  ir: { label: 'Infrared', body: '#2A2438', emit: '#6B3AA0', vf: 1.4, nm: 940 },
}

const led5mm: PartDef = {
  id: 'led-5mm',
  name: 'LED, 5 mm',
  category: 'display',
  blurb: 'Through-hole indicator — lights when current flows',
  tags: ['led', 'light', 'indicator', 'diode', 'through-hole'],
  doc: { description: 'Standard 5 mm through-hole LED. The long lead is the anode. Needs a series resistor.', price: 0.08 },
  params: [
    {
      key: 'color', label: 'Colour', type: 'enum', default: 'red', group: 'Optical',
      options: Object.entries(LED_COLORS).map(([value, v]) => ({ value, label: v.label })),
    },
    { key: 'diffused', label: 'Diffused lens', type: 'bool', default: true, group: 'Optical' },
    { key: 'if', label: 'Nominal current', type: 'number', unit: 'A', default: 0.02, min: 0.001, max: 0.1, eng: true, group: 'Electrical' },
    { key: 'lead', label: 'Lead length', type: 'number', unit: 'mm', default: 4.5, min: 2, max: 30, step: 0.5, group: 'Body' },
  ],
  solids: (p) => {
    const c = LED_COLORS[str(p, 'color', 'red')] ?? LED_COLORS.red
    const diffused = p.diffused !== false
    const lens = {
      color: c.body,
      rough: diffused ? 0.42 : 0.06,
      opacity: diffused ? 0.94 : 0.55,
      transmission: diffused ? 0.15 : 0.75,
      emissive: c.emit,
      emissiveIntensity: 0,
      clearcoat: 1,
      density: 1.2,
    }
    const R = 2.5
    const pts: [number, number][] = [
      [0, 0], [2.9, 0], [2.9, 1.0], [R, 1.0], [R, 5.6],
    ]
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2)
      pts.push([R * Math.cos(a), 5.6 + R * Math.sin(a)])
    }
    const leadLen = num(p, 'lead', 4.5)
    return [
      { kind: 'lathe', mat: lens, points: pts, seg: 28, tag: 'lens' },
      // Internal cup + post, visible through the epoxy.
      { kind: 'cyl', mat: 'steel', r: 1.15, h: 1.0, r2: 0.85, at: [0, 3.2, 0], tag: 'cup', noCollide: true },
      { kind: 'box', mat: 'steel', size: [0.55, 3.4, 0.55], at: [-1.0, 2.0, 0], noCollide: true },
      { kind: 'box', mat: 'steel', size: [0.55, 4.0, 0.55], at: [1.0, 2.4, 0], noCollide: true },
      // Anode (long) and cathode (short) leads.
      { kind: 'box', mat: 'tin', size: [0.5, leadLen + 0.3, 0.5], at: [1.27, -(leadLen - 0.3) / 2, 0] },
      { kind: 'box', mat: 'tin', size: [0.5, leadLen - 0.9, 0.5], at: [-1.27, -(leadLen - 1.5) / 2, 0] },
    ]
  },
  ports: () => [
    { id: 'a', label: 'Anode (+)', kind: 'electrical', pos: [1.27, -2.2, 0], dir: [0, -1, 0], role: 'passive', imax: 0.03 },
    { id: 'c', label: 'Cathode (−)', kind: 'electrical', pos: [-1.27, -2.2, 0], dir: [0, -1, 0], role: 'passive', imax: 0.03 },
  ],
  electrical: {
    devices: (p) => {
      const c = LED_COLORS[str(p, 'color', 'red')] ?? LED_COLORS.red
      return [{ type: 'diode', a: 'a', c: 'c', vf: c.vf, n: 2.2, rs: 8, luminous: true }]
    },
    limits: { imax: 0.03 },
  },
  readouts: (p) => {
    const c = LED_COLORS[str(p, 'color', 'red')] ?? LED_COLORS.red
    const vf = c.vf
    return [
      { label: 'Forward voltage', value: `${vf.toFixed(2)} V` },
      { label: 'Nominal current', value: eng(num(p, 'if', 0.02), 'A') },
      { label: 'R for 5 V', value: eng(Math.round((5 - vf) / num(p, 'if', 0.02)), 'Ω') },
      { label: 'R for 12 V', value: eng(Math.round((12 - vf) / num(p, 'if', 0.02)), 'Ω') },
    ]
  },
}

/* ------------------------------------------------------------------ */
/* Small-signal diode, DO-35                                           */
/* ------------------------------------------------------------------ */

const diode: PartDef = {
  id: 'diode-do35',
  name: 'Diode',
  category: 'semiconductor',
  blurb: 'Glass-body signal or rectifier diode',
  tags: ['diode', 'rectifier', '1n4148', '1n4007', 'semiconductor'],
  doc: { manufacturer: 'Generic', mpn: '1N4148', description: 'Small-signal switching diode in a DO-35 glass package.', price: 0.03 },
  params: [
    {
      key: 'model', label: 'Model', type: 'enum', default: '1N4148', group: 'Electrical',
      options: [
        { value: '1N4148', label: '1N4148 — signal, 100 V / 200 mA' },
        { value: '1N4001', label: '1N4001 — rectifier, 50 V / 1 A' },
        { value: '1N4007', label: '1N4007 — rectifier, 1000 V / 1 A' },
        { value: '1N5819', label: '1N5819 — Schottky, 40 V / 1 A' },
      ],
    },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 10.16, min: 5, max: 30, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const m = str(p, 'model', '1N4148')
    const big = m.startsWith('1N400') || m.startsWith('1N58')
    const len = big ? 5.2 : 3.6
    const r = big ? 1.35 : 0.95
    const y = 3.0
    const glass = big ? { color: '#1A1C20', rough: 0.5, density: 2.5 } : { color: '#E3EDF2', rough: 0.08, opacity: 0.45, transmission: 0.85, density: 2.5 }
    return [
      { kind: 'cyl', mat: glass, r, h: len, rot: [0, 0, 90], at: [0, y, 0] },
      { kind: 'cyl', mat: { color: big ? '#D8DCE2' : '#1A1C20', rough: 0.45 }, r: r * 1.02, h: len * 0.16,
        rot: [0, 0, 90], at: [-len * 0.33, y, 0], noCollide: true },
      ...axialLeads({ pitch: num(p, 'pitch', 10.16), bodyLen: len, bodyY: y, leadR: big ? 0.4 : 0.27 }),
    ]
  },
  ports: (p) => {
    const h = num(p, 'pitch', 10.16) / 2
    return [pinPort('a', 'Anode', h), pinPort('c', 'Cathode', -h)]
  },
  electrical: {
    devices: (p) => {
      const m = str(p, 'model', '1N4148')
      const schottky = m.startsWith('1N58')
      return [{ type: 'diode', a: 'a', c: 'c', vf: schottky ? 0.33 : 0.7, n: schottky ? 1.05 : 1.8, rs: schottky ? 0.05 : 0.1 }]
    },
  },
}

/* ------------------------------------------------------------------ */
/* Inductor, axial                                                     */
/* ------------------------------------------------------------------ */

const inductor: PartDef = {
  id: 'inductor-axial',
  name: 'Inductor',
  category: 'passive',
  blurb: 'Axial ferrite-core choke',
  tags: ['inductor', 'l', 'choke', 'coil', 'passive'],
  doc: { price: 0.2 },
  params: [
    { key: 'value', label: 'Inductance', type: 'number', unit: 'H', default: 100e-6, min: 1e-9, max: 10, eng: true, group: 'Electrical' },
    { key: 'dcr', label: 'DC resistance', type: 'number', unit: 'Ω', default: 0.35, min: 0.001, max: 100, step: 0.01, group: 'Electrical' },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 10.16, min: 5, max: 30, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const y = 3.4
    const len = 7.0
    const out: Solid[] = [{ kind: 'cyl', mat: { color: '#3A3F47', rough: 0.6, density: 4.8 }, r: 1.7, h: len, rot: [0, 0, 90], at: [0, y, 0] }]
    // Visible winding.
    for (let i = 0; i < 12; i++) {
      out.push({ kind: 'torus', mat: 'copper', r: 1.85, tube: 0.22, rot: [0, 0, 90],
        at: [-len / 2 + 0.6 + i * ((len - 1.2) / 11), y, 0], noCollide: true })
    }
    out.push(...axialLeads({ pitch: num(p, 'pitch', 10.16), bodyLen: len, bodyY: y, leadR: 0.3 }))
    return out
  },
  ports: (p) => {
    const h = num(p, 'pitch', 10.16) / 2
    return [pinPort('1', 'A', -h), pinPort('2', 'B', h)]
  },
  electrical: {
    devices: (p) => [{ type: 'inductor', l: num(p, 'value', 100e-6), a: '1', b: '2', dcr: num(p, 'dcr', 0.35) }],
  },
  readouts: (p) => [{ label: 'Value', value: eng(num(p, 'value', 100e-6), 'H') }],
}

registerParts([resistorAxial, capCeramic, capElectrolytic, led5mm, diode, inductor])
