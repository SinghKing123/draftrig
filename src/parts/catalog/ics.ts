import type { DeviceModel, PartDef } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { eng } from '../kernel/units'
import { GATE_FAMILY } from '../kernel/deviceData'
import { dipPorts, dipSolids, num, str } from './_helpers'

/* ================================================================== */
/* 555 timer                                                           */
/* ================================================================== */

/** Pin order for a DIP-8 555. */
const P555 = ['gnd', 'trig', 'out', 'reset', 'ctrl', 'thresh', 'disch', 'vcc']

const ne555: PartDef = {
  id: 'ne555',
  name: '555 timer',
  category: 'ic',
  blurb: 'Astable, monostable, or a one-shot',
  tags: ['555', 'ne555', 'timer', 'oscillator', 'astable', 'monostable', 'ic', 'blink'],
  doc: {
    manufacturer: 'Texas Instruments',
    mpn: 'NE555P',
    price: 0.35,
    description:
      'The classic timer. Two comparators against 1/3 and 2/3 of the supply drive a flip-flop, an output stage and a discharge transistor. The internal divider is modelled as real resistors, so loading pin 5 shifts the thresholds exactly as it does in hardware.',
  },
  params: [
    { key: 'variant', label: 'Variant', type: 'enum', default: 'bipolar', group: 'Electrical', options: [
      { value: 'bipolar', label: 'NE555, bipolar' },
      { value: 'cmos', label: 'TLC555, CMOS' },
    ] },
  ],
  solids: (p) => dipSolids(8, { bodyColor: str(p, 'variant', 'bipolar') === 'cmos' ? { color: '#22262C', rough: 0.45, density: 1.9 } : 'epoxy-black' }),
  ports: () => dipPorts(8, P555),
  electrical: {
    devices: () => {
      // The 5k-5k-5k divider is real: it loads the supply and sets the
      // thresholds, and CTRL can be pulled around by external components.
      const R = 5000
      return [
        { type: 'resistor', r: R, a: 'vcc', b: 'ctrl' },
        { type: 'resistor', r: R, a: 'ctrl', b: '#mid' },
        { type: 'resistor', r: R, a: '#mid', b: 'gnd' },
        { type: 'behavioral', evalId: 'ne555', ref: 'gnd', pins: ['vcc', 'trig', 'thresh', 'reset', 'ctrl', 'out', 'disch'] },
      ]
    },
    limits: { vmax: 16, imax: 0.2 },
  },
  readouts: (p) => [
    { label: 'Supply range', value: str(p, 'variant', 'bipolar') === 'cmos' ? '2 to 15 V' : '4.5 to 16 V' },
    { label: 'Output current', value: str(p, 'variant', 'bipolar') === 'cmos' ? '±10 mA' : '±200 mA' },
    { label: 'Astable f', value: 'f = 1.44 / ((R1 + 2·R2)·C)' },
  ],
}

/* ================================================================== */
/* Logic gates                                                         */
/* ================================================================== */

/**
 * A logic IC exposes one modelled gate on the first pins and leaves the rest of
 * the package available for layout. Modelling every gate in the package would
 * quadruple the node count for no benefit in a sandbox.
 */
const logicGate: PartDef = {
  id: 'logic-gate-dip',
  name: 'Logic gate',
  category: 'ic',
  blurb: '74HC logic in a DIP-14 package',
  tags: ['logic', 'gate', 'nand', 'nor', 'and', 'or', 'xor', 'inverter', '74hc', 'ttl', 'cmos'],
  doc: { manufacturer: 'Nexperia', price: 0.28, description: 'High-speed CMOS logic in a DIP-14.' },
  params: [
    { key: 'type', label: 'Device', type: 'enum', default: '7400', group: 'Electrical',
      options: Object.entries(GATE_FAMILY).map(([value, v]) => ({ value, label: v.label })) },
  ],
  solids: () => dipSolids(14),
  ports: (p) => {
    const g = GATE_FAMILY[str(p, 'type', '7400')] ?? GATE_FAMILY['7400']
    // 74xx pinout: pin 7 is GND, pin 14 is VCC. Gate A occupies pins 1-3.
    const names = Array.from({ length: 14 }, (_, i) => String(i + 1))
    names[0] = 'i0'
    names[1] = g.inputs > 1 ? 'i1' : '2'
    names[2] = 'y'
    names[6] = 'gnd'
    names[13] = 'vcc'
    return dipPorts(14, names)
  },
  electrical: {
    devices: (p) => {
      const g = GATE_FAMILY[str(p, 'type', '7400')] ?? GATE_FAMILY['7400']
      const pins = ['vcc', 'i0', 'y']
      if (g.inputs > 1) pins.splice(2, 0, 'i1')
      return [{ type: 'behavioral', evalId: 'logic-gate', ref: 'gnd', pins }]
    },
    limits: { vmax: 6 },
  },
  readouts: (p) => {
    const g = GATE_FAMILY[str(p, 'type', '7400')] ?? GATE_FAMILY['7400']
    return [
      { label: 'Function', value: g.fn.toUpperCase() },
      { label: 'Inputs', value: String(g.inputs) },
      { label: 'Propagation delay', value: eng(g.tpd, 's') },
      { label: 'Modelled gate', value: 'A (pins 1 to 3)' },
    ]
  },
}

/* ================================================================== */
/* Op-amp                                                              */
/* ================================================================== */

const OPAMPS: Record<string, { label: string; gain: number; rails: string; gbw: number }> = {
  LM358: { label: 'LM358, dual, single supply', gain: 1e5, rails: '3 to 32 V', gbw: 1e6 },
  TL072: { label: 'TL072, dual JFET, low noise', gain: 2e5, rails: '±3 to ±18 V', gbw: 3e6 },
  LM741: { label: 'LM741, the original', gain: 2e5, rails: '±5 to ±18 V', gbw: 1e6 },
}

const opampDip: PartDef = {
  id: 'opamp-dip',
  name: 'Op-amp',
  category: 'ic',
  blurb: 'Dual op-amp, one channel modelled',
  tags: ['opamp', 'op-amp', 'amplifier', 'lm358', 'tl072', '741', 'comparator', 'analog'],
  doc: { price: 0.4, description: 'General-purpose operational amplifier. Channel A is modelled with finite gain and rail saturation.' },
  params: [
    { key: 'model', label: 'Device', type: 'enum', default: 'LM358', group: 'Electrical',
      options: Object.entries(OPAMPS).map(([value, v]) => ({ value, label: v.label })) },
  ],
  solids: () => dipSolids(8),
  ports: () => {
    // LM358 pinout: 1 OUTA, 2 INA-, 3 INA+, 4 GND/V-, 5 INB+, 6 INB-, 7 OUTB, 8 V+
    return dipPorts(8, ['outa', 'ina-', 'ina+', 'vee', 'inb+', 'inb-', 'outb', 'vcc'])
  },
  electrical: {
    devices: (p) => {
      const m = OPAMPS[str(p, 'model', 'LM358')] ?? OPAMPS.LM358
      return [
        { type: 'opamp', inp: 'ina+', inn: 'ina-', out: 'outa', gain: m.gain },
        // Input bias resistance so an unconnected input does not float wild.
        { type: 'resistor', r: 1e9, a: 'ina+', b: 'vee' },
        { type: 'resistor', r: 1e9, a: 'ina-', b: 'vee' },
      ] satisfies DeviceModel[]
    },
  },
  readouts: (p) => {
    const m = OPAMPS[str(p, 'model', 'LM358')] ?? OPAMPS.LM358
    return [
      { label: 'Open-loop gain', value: eng(m.gain) },
      { label: 'Gain-bandwidth', value: eng(m.gbw, 'Hz') },
      { label: 'Supply', value: m.rails },
    ]
  },
}

/* ================================================================== */
/* Shift register                                                      */
/* ================================================================== */

const shift595: PartDef = {
  id: 'shift-register-595',
  name: 'Shift register',
  category: 'ic',
  blurb: '74HC595, three pins in, eight out',
  tags: ['595', '74hc595', 'shift register', 'serial', 'expander', 'ic'],
  doc: {
    manufacturer: 'Nexperia', mpn: '74HC595N', price: 0.45,
    description: '8-bit serial-in, parallel-out shift register with an output latch. Chain them to drive as many outputs as you like from three microcontroller pins.',
  },
  params: [],
  solids: () => dipSolids(16),
  ports: () =>
    dipPorts(16, [
      'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'gnd',
      'q7s', 'mr', 'shcp', 'stcp', 'oe', 'ds', 'q0', 'vcc',
    ]),
  electrical: {
    devices: () => [
      {
        type: 'behavioral', evalId: 'shift-register-595', ref: 'gnd',
        pins: ['vcc', 'ds', 'shcp', 'stcp', 'oe', 'mr', 'q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q7s'],
      },
    ],
    limits: { vmax: 6, imax: 0.07 },
  },
  readouts: () => [
    { label: 'Outputs', value: '8' },
    { label: 'Per-pin current', value: '35 mA max' },
    { label: 'Cascade', value: 'Q7S → next DS' },
  ],
}

/* ================================================================== */
/* Generic DIP placeholder                                             */
/* ================================================================== */

const dipGeneric: PartDef = {
  id: 'ic-dip',
  name: 'DIP package',
  category: 'ic',
  blurb: 'Blank chip of any pin count, for checking fit',
  tags: ['dip', 'ic', 'chip', 'package', 'footprint', 'placeholder'],
  doc: { description: 'A generic dual in-line package with no electrical model. Use it to reserve space and check fit while a part is still on order.' },
  params: [
    { key: 'pins', label: 'Pins', type: 'number', default: 8, min: 4, max: 40, step: 2, group: 'Package' },
    { key: 'wide', label: 'Wide body (0.6 in)', type: 'bool', default: false, group: 'Package' },
    { key: 'label', label: 'Marking', type: 'text', default: '', group: 'Package' },
  ],
  solids: (p) => dipSolids(Math.round(num(p, 'pins', 8)), { rowSpacing: p.wide === true ? 15.24 : 7.62 }),
  ports: (p) => dipPorts(Math.round(num(p, 'pins', 8)), [], { rowSpacing: p.wide === true ? 15.24 : 7.62 }),
  readouts: (p) => [
    { label: 'Package', value: `DIP-${Math.round(num(p, 'pins', 8))}` },
    { label: 'Row spacing', value: p.wide === true ? '15.24 mm' : '7.62 mm' },
  ],
}

registerParts([ne555, logicGate, opampDip, shift595, dipGeneric])
