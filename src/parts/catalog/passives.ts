import type { PartDef, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng, engCompact, resistorBands } from '../kernel/units'
import { axialLeads, bool, num, pinPort, radialLeads, roundRect, str } from './_helpers'

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

    // A real axial resistor is a turned dog-bone: a straight barrel with a
    // rounded shoulder tapering down to where the lead leaves the end cap.
    const L = w.len
    const R = w.r
    const neck = R * 0.34
    const taper = Math.min(L * 0.17, R * 1.1)
    const half = L / 2
    const profile: [number, number][] = [
      [0, -half],
      [neck, -half],
      [neck * 1.5, -half + taper * 0.18],
      [R * 0.8, -half + taper * 0.55],
      [R, -half + taper],
      [R, half - taper],
      [R * 0.8, half - taper * 0.55],
      [neck * 1.5, half - taper * 0.18],
      [neck, half],
      [0, half],
    ]

    const out: Solid[] = [{ kind: 'lathe', mat, points: profile, rot: [0, 0, 90], at: [0, y, 0] }]

    // Bands are printed on the straight barrel, which is what constrains how
    // many will fit, same as the real part.
    const barrel = L - 2 * taper
    const bw = Math.min(L * 0.085, barrel / 6)
    const gap = bw * 1.85
    const valueBands = bands.slice(0, -1)
    const startX = -barrel / 2 + bw * 0.9
    valueBands.forEach((c, i) => {
      out.push({
        kind: 'cyl', mat: { color: c, rough: 0.42, clearcoat: 0.3 }, r: R * 1.008, h: bw,
        chamfer: bw * 0.2, rot: [0, 0, 90], at: [startX + i * gap, y, 0], noCollide: true,
      })
    })
    out.push({
      kind: 'cyl', mat: { color: bands[bands.length - 1], rough: 0.28, metal: 0.75 },
      r: R * 1.008, h: bw, chamfer: bw * 0.2, rot: [0, 0, 90],
      at: [barrel / 2 - bw * 0.9, y, 0], noCollide: true,
    })

    out.push(...axialLeads({ pitch: num(p, 'pitch', 10.16), bodyLen: L, bodyY: y, leadR: w.lead }))
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
  blurb: 'Radial aluminium can, polarised',
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
    const cy = h / 2 + 0.6
    const sleeveH = h - 1.4
    return [
      // Aluminium can, with the rolled-over top edge broken.
      { kind: 'cyl', mat: 'alu-6063', r: r * 0.985, h, chamfer: Math.min(0.5, r * 0.14), at: [0, cy, 0] },
      // Rubber bung at the base.
      { kind: 'cyl', mat: { color: '#1A1614', rough: 0.9, density: 1.3 }, r: r * 0.9, h: 1.2, at: [0, 0.8, 0] },
      // PVC sleeve over the can.
      { kind: 'cyl', mat: 'elcap-sleeve', r, h: sleeveH, at: [0, cy, 0] },
      // The negative stripe is a partial sleeve, not a second full cylinder, // coincident surfaces would z-fight and speckle the whole can.
      { kind: 'cyl', mat: { color: '#D3D8DF', rough: 0.55, density: 1.4 }, r: r * 1.006, h: sleeveH,
        phi: [200, 44], capped: false, at: [0, cy, 0], tag: 'stripe', noCollide: true },
      // Minus symbols down the stripe.
      { kind: 'box', mat: { color: '#2A3550', rough: 0.6, density: 0.01 }, size: [r * 0.5, sleeveH * 0.06, 0.3],
        at: [-r * 1.0, cy + sleeveH * 0.22, 0], rot: [0, 90, 0], noCollide: true },
      { kind: 'box', mat: { color: '#2A3550', rough: 0.6, density: 0.01 }, size: [r * 0.5, sleeveH * 0.06, 0.3],
        at: [-r * 1.0, cy - sleeveH * 0.18, 0], rot: [0, 90, 0], noCollide: true },
      // Pressure-relief score on the top.
      { kind: 'box', mat: { color: '#8E959E', rough: 0.55, density: 0.01 }, size: [r * 1.5, 0.12, 0.45], at: [0, h + 0.62, 0], noCollide: true },
      { kind: 'box', mat: { color: '#8E959E', rough: 0.55, density: 0.01 }, size: [0.45, 0.12, r * 1.5], at: [0, h + 0.62, 0], noCollide: true },
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
  blurb: 'Through-hole indicator that lights when current flows',
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
    const FR = 2.9 // flange radius
    const FLAT = 2.42 // the cathode-side flat, measured from the axis

    // Flange with its flat: the arc, closed by the chord that marks pin 1.
    const a0 = Math.acos(-FLAT / FR)
    const flange: [number, number][] = []
    const steps = 22
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (2 * Math.PI - 2 * a0)
      flange.push([FR * Math.cos(a), FR * Math.sin(a)])
    }

    // Body and dome above the flange.
    const pts: [number, number][] = [[0, 1.0], [R, 1.0], [R, 5.6]]
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2)
      pts.push([R * Math.cos(a), 5.6 + R * Math.sin(a)])
    }
    const leadLen = num(p, 'lead', 4.5)
    return [
      { kind: 'extrude', mat: lens, profile: { outline: flange }, depth: 1.0, rot: [-90, 0, 0], at: [0, 0.5, 0] },
      { kind: 'lathe', mat: lens, points: pts, tag: 'lens' },
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
        { value: '1N4148', label: '1N4148, signal, 100 V / 200 mA' },
        { value: '1N4001', label: '1N4001, rectifier, 50 V / 1 A' },
        { value: '1N4007', label: '1N4007, rectifier, 1000 V / 1 A' },
        { value: '1N5819', label: '1N5819, Schottky, 40 V / 1 A' },
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

/* ------------------------------------------------------------------ */
/* Film capacitor                                                      */
/* ------------------------------------------------------------------ */

const capFilm: PartDef = {
  id: 'capacitor-film',
  name: 'Film capacitor',
  category: 'passive',
  blurb: 'Boxed polyester, stable where a ceramic is not',
  tags: ['capacitor', 'film', 'polyester', 'mkt', 'wima', 'mylar', 'audio', 'timing', 'box'],
  doc: {
    manufacturer: 'WIMA',
    mpn: 'MKS2',
    price: 0.35,
    description:
      'A boxed film capacitor. It holds its value across temperature and voltage where a class 2 ceramic loses half of itself, which is why timing and audio stages use these and decoupling does not.',
  },
  params: [
    { key: 'value', label: 'Capacitance', type: 'number', unit: 'F', default: 100e-9, min: 1e-9, max: 10e-6, eng: true, group: 'Electrical' },
    { key: 'vmax', label: 'Voltage rating', type: 'enum', default: '63', group: 'Electrical', options: [
      { value: '63', label: '63 V' }, { value: '100', label: '100 V' }, { value: '250', label: '250 V' }, { value: '400', label: '400 V' },
    ] },
    { key: 'pitch', label: 'Lead pitch', type: 'enum', default: '5', group: 'Body', options: [
      { value: '5', label: '5 mm' }, { value: '7.5', label: '7.5 mm' }, { value: '10', label: '10 mm' },
    ] },
  ],
  solids: (p) => {
    const pitch = parseFloat(str(p, 'pitch', '5')) || 5
    // Bigger capacitance and higher voltage both mean more film to roll up.
    const scale = Math.cbrt(num(p, 'value', 100e-9) / 100e-9) * Math.cbrt(parseFloat(str(p, 'vmax', '63')) / 63)
    const w = pitch + 2.2
    const h = Math.min(Math.max(7 * scale, 5), 24)
    const t = Math.min(Math.max(3.2 * scale, 2.5), 11)
    return [
      {
        kind: 'box', mat: { color: '#D8562A', rough: 0.5, clearcoat: 0.25, density: 1.4, name: 'Polyester film' },
        size: [w, h, t], at: [0, 3 + h / 2, 0], bevel: 0.5,
      },
      ...radialLeads({ pitch, fromY: 3, leadR: 0.3 }),
    ]
  },
  ports: (p) => {
    const pitch = parseFloat(str(p, 'pitch', '5')) || 5
    return [
      { id: '1', label: 'A', kind: 'electrical', pos: [-pitch / 2, -3.4, 0], dir: [0, -1, 0], role: 'passive', solderable: true },
      { id: '2', label: 'B', kind: 'electrical', pos: [pitch / 2, -3.4, 0], dir: [0, -1, 0], role: 'passive', solderable: true },
    ]
  },
  electrical: {
    devices: (p) => [
      // Film capacitors have very little series resistance, which is half of
      // why they are used where a pulse of current has to come out quickly.
      { type: 'capacitor', c: num(p, 'value', 100e-9), a: '1', b: '2', esr: 0.02, vmax: parseFloat(str(p, 'vmax', '63')) },
    ],
    // The rating is a parameter, and limits here are one fixed object, so
    // state the highest option; the readout carries the configured number.
    limits: { vmax: 400 },
  },
  readouts: (p) => {
    const c = num(p, 'value', 100e-9)
    const v = parseFloat(str(p, 'vmax', '63'))
    return [
      { label: 'Capacitance', value: eng(c, 'F') },
      { label: 'Tolerance', value: '±5 %, and it stays there' },
      { label: 'Rating', value: `${v} V` },
      { label: 'Energy at rating', value: eng(0.5 * c * v * v, 'J') },
    ]
  },
}

/* ------------------------------------------------------------------ */
/* Trimmer potentiometer                                               */
/* ------------------------------------------------------------------ */

const trimpot: PartDef = {
  id: 'trimpot',
  name: 'Trimmer',
  category: 'passive',
  blurb: 'Set once with a screwdriver and left alone',
  tags: ['trimpot', 'trimmer', 'preset', 'potentiometer', 'adjust', '3296', 'calibration'],
  doc: {
    mpn: '3296W',
    price: 0.45,
    description:
      'A small preset. The multiturn type takes twenty five turns end to end, which is what makes setting a reference to three decimal places possible with a screwdriver.',
  },
  params: [
    { key: 'value', label: 'Resistance', type: 'number', unit: 'Ω', default: 10000, min: 100, max: 1e6, eng: true, group: 'Electrical' },
    { key: 'position', label: 'Wiper', type: 'number', unit: '%', default: 50, min: 0, max: 100, step: 1, group: 'Control' },
    {
      key: 'style', label: 'Style', type: 'enum', default: 'multiturn', group: 'Body',
      options: [{ value: 'multiturn', label: 'Multiturn, 25 turns' }, { value: 'single', label: 'Single turn' }],
    },
  ],
  solids: (p) => {
    const multi = str(p, 'style', 'multiturn') === 'multiturn'
    if (multi) {
      // The rectangular 3296 body with the adjuster screw at one end.
      return [
        { kind: 'box', mat: { color: '#1F4FA8', rough: 0.5, density: 1.6 }, size: [9.5, 5, 4.8], at: [0, 3.5, 0], bevel: 0.3 },
        { kind: 'box', mat: { color: '#E6E8EC', rough: 0.6, density: 1.4 }, size: [9.5, 0.6, 4.8], at: [0, 6.1, 0], noCollide: true },
        { kind: 'cyl', mat: { color: '#B8BCC2', rough: 0.35, metal: 1, density: 7.8 }, r: 1.5, h: 1.2, at: [3.4, 6.3, 0], seg: 14 },
        { kind: 'box', mat: { color: '#2A2E34', rough: 0.7, density: 0.01 }, size: [2.2, 0.4, 0.5], at: [3.4, 6.8, 0], noCollide: true },
        ...[-2.54, 0, 2.54].map((x): Solid => ({ kind: 'box', mat: 'tin', size: [0.45, 4.4, 0.35], at: [x, 0.8, 2.54] })),
      ]
    }
    return [
      { kind: 'cyl', mat: { color: '#1F4FA8', rough: 0.5, density: 1.6 }, r: 3.4, h: 3.6, at: [0, 1.8, 0], seg: 20 },
      { kind: 'cyl', mat: { color: '#E6E8EC', rough: 0.6, density: 1.4 }, r: 3.4, h: 0.5, at: [0, 3.85, 0], seg: 20, noCollide: true },
      { kind: 'box', mat: { color: '#2A2E34', rough: 0.7, density: 0.01 }, size: [3.6, 0.4, 0.8], at: [0, 4.1, 0], noCollide: true },
      ...[-2.54, 0, 2.54].map((x): Solid => ({ kind: 'box', mat: 'tin', size: [0.45, 4.4, 0.35], at: [x, -1.2, x === 0 ? -2.2 : 2.2] })),
    ]
  },
  ports: (p) => {
    const multi = str(p, 'style', 'multiturn') === 'multiturn'
    const z = (x: number): number => (multi ? 2.54 : x === 0 ? -2.2 : 2.2)
    return [
      { id: 'a', label: 'End A', kind: 'electrical', pos: [-2.54, multi ? -1.4 : -3.4, z(-2.54)], dir: [0, -1, 0], role: 'passive', solderable: true },
      { id: 'w', label: 'Wiper', kind: 'electrical', pos: [0, multi ? -1.4 : -3.4, z(0)], dir: [0, -1, 0], role: 'passive', solderable: true },
      { id: 'b', label: 'End B', kind: 'electrical', pos: [2.54, multi ? -1.4 : -3.4, z(2.54)], dir: [0, -1, 0], role: 'passive', solderable: true },
    ]
  },
  electrical: {
    devices: (p) => {
      const total = Math.max(num(p, 'value', 10000), 1)
      const frac = Math.min(Math.max(num(p, 'position', 50) / 100, 0), 1)
      // A wiper never quite reaches an end; leaving a little track either side
      // keeps the matrix out of trouble as well as being true.
      const lo = Math.max(total * frac, 0.5)
      return [
        { type: 'resistor', r: lo, a: 'a', b: 'w' },
        { type: 'resistor', r: Math.max(total - lo, 0.5), a: 'w', b: 'b' },
      ]
    },
  },
  readouts: (p) => {
    const total = num(p, 'value', 10000)
    const frac = num(p, 'position', 50) / 100
    return [
      { label: 'Track', value: eng(total, 'Ω') },
      { label: 'A to wiper', value: eng(total * frac, 'Ω') },
      { label: 'Wiper to B', value: eng(total * (1 - frac), 'Ω') },
      { label: 'Adjustment', value: str(p, 'style', 'multiturn') === 'multiturn' ? '25 turns end to end' : '270 degrees' },
    ]
  },
}

/* ------------------------------------------------------------------ */
/* Quartz crystal                                                      */
/* ------------------------------------------------------------------ */

const crystal: PartDef = {
  id: 'crystal-hc49',
  name: 'Quartz crystal',
  category: 'passive',
  blurb: 'A slice of quartz that decides how fast everything runs',
  tags: ['crystal', 'quartz', 'oscillator', 'hc-49', 'clock', 'timing', 'mhz', 'resonator'],
  doc: {
    mpn: 'HC-49/S',
    price: 0.25,
    description:
      'A resonator in a metal can. It is a very high Q tuned circuit rather than a component with a value, and it needs two small capacitors to ground to run at the frequency written on it.',
  },
  params: [
    {
      key: 'freq', label: 'Frequency', type: 'enum', default: '16', group: 'Electrical',
      options: ['4', '8', '11.0592', '12', '16', '20', '25'].map((f) => ({ value: f, label: `${f} MHz` })),
    },
    {
      key: 'package', label: 'Package', type: 'enum', default: 'hc49s', group: 'Body',
      options: [{ value: 'hc49s', label: 'HC-49/S, low profile' }, { value: 'hc49', label: 'HC-49, full height' }],
    },
    { key: 'loadCap', label: 'Load capacitance', type: 'number', unit: 'F', default: 18e-12, min: 6e-12, max: 33e-12, eng: true, group: 'Electrical' },
  ],
  solids: (p) => {
    const tall = str(p, 'package', 'hc49s') === 'hc49'
    const H = tall ? 13.5 : 3.7
    const W = 11.05
    const T = 4.65
    return [
      // The can is a flattened oval, so a stadium profile rather than a box.
      {
        kind: 'extrude', mat: { color: '#B8BEC6', rough: 0.34, metal: 1, density: 7.8 },
        profile: { outline: roundRect(W, H, Math.min(H, T) / 2 - 0.2, 0, 0, 5) },
        depth: T, rot: [0, 0, 0], at: [0, 2.5 + H / 2, 0],
      },
      // The crimped base the leads come out of.
      { kind: 'box', mat: { color: '#8A8F98', rough: 0.5, metal: 1, density: 7.8 }, size: [W, 0.8, T], at: [0, 2.5, 0] },
      ...radialLeads({ pitch: 4.88, fromY: 2.5, leadR: 0.25 }),
    ]
  },
  ports: () => [
    { id: '1', label: 'Pin 1', kind: 'electrical', pos: [-2.44, -3.4, 0], dir: [0, -1, 0], role: 'passive', solderable: true },
    { id: '2', label: 'Pin 2', kind: 'electrical', pos: [2.44, -3.4, 0], dir: [0, -1, 0], role: 'passive', solderable: true },
  ],
  electrical: {
    devices: (p) => {
      // The Butterworth-Van Dyke model: a very high Q series arm in parallel
      // with the holder capacitance. The numbers follow from the frequency,
      // a motional capacitance of a few femtofarads and a Q of eighty thousand.
      const f = (parseFloat(str(p, 'freq', '16')) || 16) * 1e6
      const c1 = 5e-15
      const l1 = 1 / (c1 * Math.pow(2 * Math.PI * f, 2))
      const r1 = (2 * Math.PI * f * l1) / 80000
      return [
        { type: 'capacitor', c: c1, a: '1', b: '#m1' },
        { type: 'inductor', l: l1, a: '#m1', b: '#m2', dcr: 0 },
        { type: 'resistor', r: r1, a: '#m2', b: '2' },
        { type: 'capacitor', c: 7e-12, a: '1', b: '2' },
      ]
    },
  },
  readouts: (p) => {
    const f = parseFloat(str(p, 'freq', '16')) || 16
    return [
      { label: 'Frequency', value: `${f} MHz` },
      { label: 'Tolerance', value: '±30 ppm, about ±' + (f * 30).toFixed(0) + ' Hz' },
      { label: 'Load capacitance', value: eng(num(p, 'loadCap', 18e-12), 'F') },
      { label: 'Needs', value: `Two ${eng(2 * (num(p, 'loadCap', 18e-12) - 5e-12), 'F')} caps to ground` },
    ]
  },
}

/* ------------------------------------------------------------------ */
/* Fuse                                                                */
/* ------------------------------------------------------------------ */

const fuse: PartDef = {
  id: 'fuse-glass',
  name: 'Fuse',
  category: 'passive',
  blurb: 'The cheapest thing in the circuit, there to be the first to fail',
  tags: ['fuse', 'protection', 'glass', '5x20', 'cartridge', 'overcurrent', 'safety'],
  doc: {
    mpn: '5x20 cartridge',
    price: 0.2,
    description:
      'A 5 by 20 mm cartridge fuse in clips. A fast one protects semiconductors; a slow one survives the inrush of a motor or a transformer. Choosing wrongly means either nuisance blowing or no protection at all.',
  },
  params: [
    {
      key: 'rating', label: 'Rating', type: 'enum', default: '1', group: 'Electrical',
      options: ['0.25', '0.5', '1', '2', '3', '5', '10'].map((a) => ({ value: a, label: `${a} A` })),
    },
    {
      key: 'speed', label: 'Speed', type: 'enum', default: 'fast', group: 'Electrical',
      options: [{ value: 'fast', label: 'Fast, F' }, { value: 'slow', label: 'Time delay, T' }],
    },
    { key: 'blown', label: 'Blown', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const blown = bool(p, 'blown', false)
    const L = 20
    const R = 2.5
    const out: Solid[] = [
      // Glass body between two end caps.
      {
        kind: 'cyl', mat: { color: blown ? '#8A7A6E' : '#E8F4F8', rough: 0.06, opacity: blown ? 0.55 : 0.3, transmission: blown ? 0.4 : 0.9, density: 2.5 },
        r: R, h: L - 8, rot: [0, 0, 90], at: [0, 4.5, 0], seg: 20,
      },
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'cyl', mat: { color: '#C8CCD2', rough: 0.3, metal: 1, density: 7.8 }, r: R, h: 4,
        rot: [0, 0, 90], at: [s * (L / 2 - 2), 4.5, 0] as Vec3, chamfer: 0.3,
      })),
      // The clips it sits in.
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'group', mat: 'tin', at: [s * (L / 2 - 2), 0, 0] as Vec3, children: [
          { kind: 'cyl', mat: 'tin', r: R + 0.5, h: 3, rot: [0, 0, 90], at: [0, 4.5, 0], phi: [200, 140] },
          { kind: 'box', mat: 'tin', size: [3, 5.5, 0.5], at: [0, 1.2, 0] },
          { kind: 'box', mat: 'tin', size: [0.6, 4, 0.6], at: [0, -2.5, 0] },
        ],
      })),
    ]
    // The element: a straight wire, or two stubs and a gap.
    if (blown) {
      out.push({ kind: 'cyl', mat: 'tin', r: 0.2, h: 4, rot: [0, 0, 90], at: [-5, 4.5, 0], noCollide: true })
      out.push({ kind: 'cyl', mat: { color: '#2A2018', rough: 0.9, density: 0.01 }, r: 0.35, h: 3, rot: [0, 0, 90], at: [5.5, 4.5, 0], noCollide: true })
    } else {
      out.push({ kind: 'cyl', mat: 'tin', r: 0.2, h: L - 8, rot: [0, 0, 90], at: [0, 4.5, 0], noCollide: true })
    }
    return out
  },
  ports: () => [
    { id: 'a', label: 'A', kind: 'electrical', pos: [-8, -4.5, 0], dir: [0, -1, 0], role: 'passive', imax: 10, solderable: true },
    { id: 'b', label: 'B', kind: 'electrical', pos: [8, -4.5, 0], dir: [0, -1, 0], role: 'passive', imax: 10, solderable: true },
  ],
  electrical: {
    devices: (p) => {
      const amps = parseFloat(str(p, 'rating', '1')) || 1
      if (bool(p, 'blown', false)) return [{ type: 'resistor', r: 1e9, a: 'a', b: 'b' }]
      // Cold resistance falls as the rating rises: a 1 A element is about
      // 60 milliohms, a 10 A one a few.
      return [{ type: 'resistor', r: Math.max(0.06 / amps, 0.002), a: 'a', b: 'b' }]
    },
    limits: { imax: 10 },
  },
  readouts: (p) => {
    const amps = parseFloat(str(p, 'rating', '1')) || 1
    const slow = str(p, 'speed', 'fast') === 'slow'
    return [
      { label: 'Rating', value: `${amps} A, ${slow ? 'time delay' : 'fast'}` },
      { label: 'State', value: bool(p, 'blown', false) ? 'Blown, open circuit' : 'Intact' },
      { label: 'Holds', value: `${(amps * 1.1).toFixed(2)} A indefinitely` },
      { label: 'Clears', value: slow ? `${(amps * 2).toFixed(1)} A in about a second` : `${(amps * 2).toFixed(1)} A in a few milliseconds` },
    ]
  },
}

/* ------------------------------------------------------------------ */
/* Ferrite bead                                                        */
/* ------------------------------------------------------------------ */

const ferriteBead: PartDef = {
  id: 'ferrite-bead',
  name: 'Ferrite bead',
  category: 'passive',
  blurb: 'A wire at DC and a resistor at radio frequency',
  tags: ['ferrite', 'bead', 'emi', 'filter', 'noise', 'choke', 'rf', 'decoupling'],
  doc: {
    price: 0.1,
    description:
      'A lossy ferrite sleeve over a wire. It does almost nothing below a megahertz and turns into tens of ohms above it, which is how it takes noise off a supply without dropping any voltage.',
  },
  params: [
    {
      key: 'impedance', label: 'Impedance at 100 MHz', type: 'enum', default: '600', group: 'Electrical',
      options: ['60', '120', '220', '600', '1000'].map((z) => ({ value: z, label: `${z} Ω` })),
    },
    { key: 'imax', label: 'Rated current', type: 'number', unit: 'A', default: 1, min: 0.1, max: 6, step: 0.1, group: 'Electrical' },
    { key: 'pitch', label: 'Lead pitch', type: 'number', unit: 'mm', default: 10.16, min: 5, max: 20, step: 2.54, group: 'Body' },
  ],
  solids: (p) => {
    const pitch = num(p, 'pitch', 10.16)
    return [
      {
        kind: 'cyl', mat: { color: '#2E3238', rough: 0.78, density: 4.8, name: 'Ferrite' },
        r: 1.7, h: 4.5, rot: [0, 0, 90], at: [0, 3.4, 0], seg: 16, chamfer: 0.3,
      },
      ...axialLeads({ pitch, bodyLen: 4.5, bodyY: 3.4, leadR: 0.3 }),
    ]
  },
  ports: (p) => {
    const pitch = num(p, 'pitch', 10.16)
    return [
      { id: '1', label: 'A', kind: 'electrical', pos: [-pitch / 2, -3.4, 0], dir: [0, -1, 0], role: 'passive', imax: num(p, 'imax', 1), solderable: true },
      { id: '2', label: 'B', kind: 'electrical', pos: [pitch / 2, -3.4, 0], dir: [0, -1, 0], role: 'passive', imax: num(p, 'imax', 1), solderable: true },
    ]
  },
  electrical: {
    devices: (p) => {
      const z = parseFloat(str(p, 'impedance', '600')) || 600
      // Above resonance a bead is mostly loss, so the useful model is a small
      // inductance in series with the DC resistance of the wire through it.
      // L chosen so the reactance reaches the rated impedance near 100 MHz.
      const l = z / (2 * Math.PI * 100e6)
      return [
        { type: 'resistor', r: 0.05, a: '1', b: '#m' },
        { type: 'inductor', l, a: '#m', b: '2', dcr: 0 },
      ]
    },
  },
  readouts: (p) => {
    const z = parseFloat(str(p, 'impedance', '600')) || 600
    return [
      { label: 'At 100 MHz', value: `${z} Ω` },
      { label: 'At DC', value: '50 mΩ, a piece of wire' },
      { label: 'Rated current', value: `${num(p, 'imax', 1)} A` },
      { label: 'Equivalent', value: eng(z / (2 * Math.PI * 100e6), 'H') },
    ]
  },
}

registerParts([
  resistorAxial, capCeramic, capElectrolytic, capFilm, led5mm, diode, inductor,
  trimpot, crystal, fuse, ferriteBead,
])
