import type { DeviceModel, PartDef, Port, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, REGION_PARAM, amps, mainsPorts, screen, volts } from './setup'
import { BLACK_PLASTIC } from './setup2'
import { usbLoad, usbPorts } from './peripherals'

/**
 * The instruments on the bench, as opposed to the thing being built.
 *
 * These are in the catalogue for a reason that is almost the opposite of
 * everything else in it: an instrument is not part of the circuit, and the
 * whole art of using one is knowing how much it nevertheless changes what it
 * is measuring.
 *
 *   A multimeter on a current range is a resistor in series with your
 *   circuit. On the 200 mA range that shunt drops about 200 mV at full
 *   scale, which is burden voltage, and it is why a 3.3 V rail measured in
 *   series reads low and sometimes stops working altogether.
 *
 *   A scope probe is 1 MΩ and about 15 pF, and in x1 position it is 1 MΩ and
 *   100 pF — enough to shift an oscillator you were trying to measure.
 *
 * So each of these declares what it loads the circuit with, and the readouts
 * say what that costs. They also take real bench space, which is the other
 * thing nobody plans for: a scope is 400 mm deep with its leads on.
 *
 * Conventions are `setup.ts`: mains as l/n/e, loads in watts, `vbus`/`gnd`
 * for USB from `peripherals.ts`.
 */

const BENCH_CASE = { color: '#D5D2CB', rough: 0.6, density: 1.5 }

/* ================================================================== */
/* Measurement                                                         */
/* ================================================================== */

const oscilloscope: PartDef = {
  id: 'oscilloscope',
  name: 'Oscilloscope',
  category: 'instrument',
  blurb: 'Bandwidth, channels, and a probe that loads the node',
  tags: ['oscilloscope', 'scope', 'dso', 'bandwidth', 'probe', 'measurement', 'bench', 'test', 'instrument', 'rigol'],
  doc: {
    price: 480,
    description:
      'The instrument whose specification is most often misread. Bandwidth is the frequency at which the scope already shows a sine wave 3 dB low — about 70% of its real amplitude — so a 100 MHz scope is not a 100 MHz instrument, it is a 30 MHz one if you want the amplitude to be right.\n\nFor edges, what matters is rise time, and the rule is 0.35 over the bandwidth: a 100 MHz scope cannot resolve an edge faster than 3.5 ns, and the edge it draws for anything faster is its own.\n\nSample rate sets the other limit. Nyquist says twice the bandwidth; a usable reconstruction wants four or five times.',
  },
  params: [
    REGION_PARAM,
    { key: 'bandwidth', label: 'Bandwidth', type: 'enum', default: '100', group: 'Scope', options: ['50', '70', '100', '200', '350', '500'].map((v) => ({ value: v, label: `${v} MHz` })) },
    { key: 'channels', label: 'Channels', type: 'enum', default: '4', group: 'Scope', options: ['2', '4'].map((v) => ({ value: v, label: `${v} channel` })) },
    { key: 'rate', label: 'Sample rate', type: 'enum', default: '1', group: 'Scope', options: [{ value: '0.5', label: '500 MSa/s' }, { value: '1', label: '1 GSa/s' }, { value: '2', label: '2 GSa/s' }, { value: '5', label: '5 GSa/s' }] },
    { key: 'memory', label: 'Memory depth', type: 'enum', default: '24', group: 'Scope', options: [{ value: '8', label: '8 Mpts' }, { value: '24', label: '24 Mpts' }, { value: '100', label: '100 Mpts' }] },
    { key: 'probe', label: 'Probe', type: 'enum', default: 'x10', group: 'Probe', options: [{ value: 'x1', label: '×1, 1 MΩ and 100 pF' }, { value: 'x10', label: '×10, 10 MΩ and 15 pF' }] },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const bw = parseInt(str(p, 'bandwidth', '100'), 10) || 100
    const ch = parseInt(str(p, 'channels', '4'), 10) || 4
    const w = bw >= 350 ? 440 : 360
    const h = bw >= 350 ? 230 : 180
    const d = 130
    const on = bool(p, 'on', true)
    const out: Solid[] = [
      { kind: 'box', mat: BENCH_CASE, size: [w, h, d], at: [0, h / 2, 0], bevel: 6 },
      { kind: 'box', mat: DARK, size: [w * 0.58, h * 0.72, 4], at: [-w * 0.17, h * 0.55, d / 2 + 1] },
      { kind: 'box', mat: screen(on, '#2E6E4A'), size: [w * 0.55, h * 0.68, 2], at: [-w * 0.17, h * 0.55, d / 2 + 3] },
      // The vertical controls: one knob pair a channel, and the big one.
      { kind: 'cyl', mat: { color: '#2A2C30', rough: 0.5, density: 1.3 }, r: 22, h: 18, seg: 24, rot: [90, 0, 0], at: [w * 0.3, h * 0.66, d / 2] },
    ]
    for (let i = 0; i < ch; i++) {
      out.push({
        kind: 'cyl', mat: { color: '#1C1E22', rough: 0.5, density: 1.3 }, r: 11, h: 14, seg: 18, rot: [90, 0, 0],
        at: [-w / 2 + 50 + i * 54, h * 0.14, d / 2],
      })
      out.push({
        kind: 'cyl', mat: ALU, r: 9, h: 12, seg: 18, rot: [90, 0, 0],
        at: [-w / 2 + 50 + i * 54, h * 0.14 - 2, d / 2 + 6], noCollide: true,
      })
    }
    // Feet, and the handle that makes the depth 400 mm with leads on.
    for (const sx of [-1, 1] as const) out.push({ kind: 'box', mat: BLACK_PLASTIC, size: [40, 14, 30], at: [sx * (w / 2 - 40), 7, -d / 2 + 20] })
    return out
  },
  ports: (p) => {
    const bw = parseInt(str(p, 'bandwidth', '100'), 10) || 100
    const ch = parseInt(str(p, 'channels', '4'), 10) || 4
    const w = bw >= 350 ? 440 : 360
    const h = bw >= 350 ? 230 : 180
    const d = 130
    const out: Port[] = [...mainsPorts([0, 40, -d / 2], [0, 0, -1], '', [11, 0, 0])]
    for (let i = 0; i < ch; i++) {
      out.push({
        id: `ch${i + 1}`, label: `Channel ${i + 1}`, kind: 'electrical',
        pos: [-w / 2 + 50 + i * 54, h * 0.14, d / 2 + 12], dir: [0, 0, 1], role: 'analog', imax: 0.01, solderable: false,
      })
      out.push({
        id: `gnd${i + 1}`, label: `Channel ${i + 1} ground clip`, kind: 'electrical',
        pos: [-w / 2 + 50 + i * 54, h * 0.14 - 22, d / 2 + 12], dir: [0, 0, 1], role: 'gnd', imax: 0.01, solderable: false,
      })
    }
    out.push({ id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    /*
     * The probe, which is the only part of a scope that touches the circuit.
     * A ×10 probe is 9 MΩ in the tip working against the 1 MΩ input, so the
     * node sees 10 MΩ and 15 pF; in ×1 the resistor is gone and the cable
     * capacitance is not, which is the 100 pF that stops oscillators.
     */
    devices: (p) => {
      const ch = parseInt(str(p, 'channels', '4'), 10) || 4
      const x10 = str(p, 'probe', 'x10') === 'x10'
      const out: DeviceModel[] = []
      for (let i = 1; i <= ch; i++) {
        out.push({ type: 'resistor', a: `ch${i}`, b: `gnd${i}`, r: x10 ? 10e6 : 1e6 })
        out.push({ type: 'capacitor', c: x10 ? 15e-12 : 100e-12, a: `ch${i}`, b: `gnd${i}` })
      }
      return out
    },
    limits: { vmax: 300 },
  },
  mass: (p) => ((parseInt(str(p, 'bandwidth', '100'), 10) || 100) >= 350 ? 4600 : 3200),
  price: (p) => {
    const bw = parseInt(str(p, 'bandwidth', '100'), 10) || 100
    const ch = parseInt(str(p, 'channels', '4'), 10) || 4
    return Math.round(180 + bw * 1.9 + (ch === 4 ? 160 : 0))
  },
  readouts: (p) => {
    const bw = parseInt(str(p, 'bandwidth', '100'), 10) || 100
    const rate = parseFloat(str(p, 'rate', '1')) || 1
    const mem = parseInt(str(p, 'memory', '24'), 10) || 24
    const x10 = str(p, 'probe', 'x10') === 'x10'
    const rise = 0.35 / bw * 1000
    // Longest capture at full rate: memory over sample rate.
    const window = (mem * 1e6) / (rate * 1e9) * 1000
    return [
      { label: 'Flat to', value: `about ${Math.round(bw * 0.3)} MHz; ${bw} MHz is the −3 dB point` },
      { label: 'Fastest edge', value: `${rise.toFixed(2)} ns, from 0.35 ÷ bandwidth` },
      { label: 'Oversampling', value: `${(rate * 1000 / bw).toFixed(1)}× at ${bw} MHz${rate * 1000 / bw < 4 ? ', thin for edges' : ''}` },
      { label: 'Longest capture', value: `${window < 1 ? `${(window * 1000).toFixed(0)} µs` : `${window.toFixed(2)} ms`} at full rate` },
      { label: 'Probe loads the node with', value: x10 ? '10 MΩ and 15 pF' : '1 MΩ and 100 pF' },
      { label: 'Bench space', value: `${bw >= 350 ? 440 : 360} mm wide, 400 mm deep with the leads` },
    ]
  },
}

const multimeter: PartDef = {
  id: 'multimeter-handheld',
  name: 'Multimeter',
  category: 'instrument',
  blurb: 'A resistor in series, or ten megohms in parallel',
  tags: ['multimeter', 'dmm', 'meter', 'voltmeter', 'ammeter', 'burden voltage', 'test', 'measurement', 'fluke', 'instrument'],
  doc: {
    price: 120,
    description:
      'Two instruments in one case, and they load a circuit in opposite ways.\n\nAs a voltmeter it is 10 MΩ across the node, which is invisible in almost everything and is not invisible on a high-impedance divider — a 1 MΩ pair measured with a 10 MΩ meter reads 5% low, and that is the meter, not the circuit.\n\nAs an ammeter it is a shunt in series with your circuit, and the volt drop across it is burden voltage: typically 200 mV at full scale on the milliamp range, 1.8 V on the microamp range of a cheap meter. Measuring the sleep current of a 3 V device through that is why the device will not boot while you measure it.',
  },
  params: [
    { key: 'counts', label: 'Resolution', type: 'enum', default: '6000', group: 'Meter', options: ['2000', '6000', '20000', '50000'].map((v) => ({ value: v, label: `${v} counts` })) },
    {
      key: 'mode', label: 'Range', type: 'enum', default: 'vdc', group: 'Control',
      options: [
        { value: 'vdc', label: 'Volts DC' },
        { value: 'vac', label: 'Volts AC' },
        { value: 'ma', label: 'Milliamps' },
        { value: 'ua', label: 'Microamps' },
        { value: 'a', label: 'Amps, 10 A jack' },
        { value: 'ohm', label: 'Ohms' },
        { value: 'diode', label: 'Diode and continuity' },
      ],
    },
    { key: 'trueRms', label: 'True RMS', type: 'bool', default: true, group: 'Meter' },
    { key: 'cat', label: 'Safety rating', type: 'enum', default: 'cat3', group: 'Meter', options: [{ value: 'cat2', label: 'CAT II 600 V' }, { value: 'cat3', label: 'CAT III 600 V' }, { value: 'cat4', label: 'CAT IV 600 V' }] },
  ],
  solids: () => {
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#2A2C30', rough: 0.6, density: 1.3 }, size: [86, 182, 42], at: [0, 91, 21], bevel: 8 },
      { kind: 'box', mat: { color: '#D9541E', rough: 0.75, density: 1.1 }, size: [96, 170, 30], at: [0, 91, 14], bevel: 10, noCollide: true },
      { kind: 'box', mat: screen(true, '#3A5E4A'), size: [66, 44, 2], at: [0, 146, 43] },
      { kind: 'cyl', mat: { color: '#1C1E22', rough: 0.5, density: 1.3 }, r: 24, h: 10, seg: 28, rot: [90, 0, 0], at: [0, 92, 42] },
      { kind: 'box', mat: ALU, size: [4, 18, 3], at: [0, 108, 47], noCollide: true },
    ]
    // The three jacks, in the order every meter puts them.
    for (const [i, c] of [['#1C1E22'], ['#1C1E22'], ['#D9541E']].entries()) {
      out.push({ kind: 'cyl', mat: { color: String(c), rough: 0.5, density: 1.3 }, r: 7, h: 8, seg: 16, rot: [90, 0, 0], at: [-26 + i * 26, 34, 42] })
    }
    return out
  },
  ports: () => [
    { id: 'com', label: 'COM', kind: 'electrical', pos: [-26, 34, 48], dir: [0, 0, 1], role: 'gnd', imax: 10, solderable: false },
    { id: 'probe', label: 'V · Ω · mA', kind: 'electrical', pos: [0, 34, 48], dir: [0, 0, 1], role: 'passive', imax: 0.5, solderable: false },
    { id: 'amps', label: '10 A', kind: 'electrical', pos: [26, 34, 48], dir: [0, 0, 1], role: 'passive', imax: 10, solderable: false },
    { id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: {
    /*
     * What the meter is, on each range. The shunt values are the ones that
     * produce the burden voltages a real meter quotes: 1 ohm on the milliamp
     * range, 100 ohm on microamps — which is where a cheap meter's 1.8 V of
     * burden at full scale comes from — and 10 milliohm on the 10 A jack.
     */
    devices: (p) => {
      const mode = str(p, 'mode', 'vdc')
      switch (mode) {
        case 'ma':
          return [{ type: 'resistor', a: 'probe', b: 'com', r: 1 }]
        case 'ua':
          return [{ type: 'resistor', a: 'probe', b: 'com', r: 100 }]
        case 'a':
          return [{ type: 'resistor', a: 'amps', b: 'com', r: 0.01 }]
        case 'ohm':
        case 'diode':
          // Ohms drives a known current out of the probe and reads the volts
          // it develops; 1 mA is the usual figure on the low ranges.
          return [{ type: 'isource', i: 0.001, a: 'probe', b: 'com' }]
        default:
          return [{ type: 'resistor', a: 'probe', b: 'com', r: 10e6 }]
      }
    },
    limits: { vmax: 600, imax: 10 },
  },
  mass: () => 420,
  price: (p) => {
    const counts = parseInt(str(p, 'counts', '6000'), 10) || 6000
    const cat = str(p, 'cat', 'cat3')
    return Math.round(30 + counts * 0.009 + (cat === 'cat4' ? 180 : cat === 'cat3' ? 60 : 0) + (bool(p, 'trueRms', true) ? 40 : 0))
  },
  readouts: (p) => {
    const counts = parseInt(str(p, 'counts', '6000'), 10) || 6000
    const mode = str(p, 'mode', 'vdc')
    const burden =
      mode === 'ma' ? '200 mV at 200 mA' : mode === 'ua' ? '200 mV at 2 mA, and 1.8 V at full scale' : mode === 'a' ? '100 mV at 10 A' : null
    return [
      { label: 'Resolution', value: `${counts} counts, ${(1 / counts * 100).toFixed(3)}% of range` },
      { label: 'On a 3.3 V reading', value: `${(3.3 / counts).toFixed(4)} V a count` },
      {
        label: 'Loads the circuit with',
        value:
          mode === 'ma' ? '1 Ω in series' : mode === 'ua' ? '100 Ω in series' : mode === 'a' ? '10 mΩ in series' : mode === 'ohm' || mode === 'diode' ? '1 mA out of the probe' : '10 MΩ across the node',
      },
      ...(burden ? [{ label: 'Burden voltage', value: burden }] : []),
      ...(mode === 'vdc' || mode === 'vac' ? [{ label: 'Error on a 1 MΩ divider', value: '−4.8%, which is the meter' }] : []),
      { label: 'Rated', value: `${str(p, 'cat', 'cat3') === 'cat4' ? 'CAT IV' : str(p, 'cat', 'cat3') === 'cat3' ? 'CAT III' : 'CAT II'} 600 V${bool(p, 'trueRms', true) ? ', true RMS' : ', average responding'}` },
    ]
  },
}

const logicAnalyser: PartDef = {
  id: 'logic-analyser',
  name: 'Logic analyser',
  category: 'instrument',
  blurb: 'Eight channels of digital, and a rate that has to beat the bus',
  tags: ['logic analyser', 'analyzer', 'saleae', 'i2c', 'spi', 'uart', 'protocol', 'debug', 'test', 'instrument'],
  doc: {
    price: 140,
    description:
      'The right instrument for a bus, and the wrong one for a waveform: it records whether a line is high or low and nothing in between. What it needs is rate — at least four samples a bit, so a 400 kHz I²C bus wants 1.6 MSa/s and 24 is comfortable, while a 20 MHz SPI link wants 80 MSa/s and most cheap units cannot do it.\n\nIt loads each line with about 1 MΩ and 10 pF, which is enough to matter on a bus already struggling with its pull-ups.',
  },
  params: [
    { key: 'channels', label: 'Channels', type: 'enum', default: '8', group: 'Analyser', options: ['4', '8', '16'].map((v) => ({ value: v, label: `${v} channel` })) },
    { key: 'rate', label: 'Sample rate', type: 'enum', default: '24', group: 'Analyser', options: [{ value: '8', label: '8 MSa/s' }, { value: '24', label: '24 MSa/s' }, { value: '100', label: '100 MSa/s' }, { value: '500', label: '500 MSa/s' }] },
    {
      key: 'bus', label: 'Watching', type: 'enum', default: 'i2c400', group: 'Control',
      options: [
        { value: 'uart115', label: 'UART, 115200 baud' },
        { value: 'i2c100', label: 'I²C, 100 kHz' },
        { value: 'i2c400', label: 'I²C, 400 kHz' },
        { value: 'spi8', label: 'SPI, 8 MHz' },
        { value: 'spi20', label: 'SPI, 20 MHz' },
      ],
    },
  ],
  solids: (p) => {
    const ch = parseInt(str(p, 'channels', '8'), 10) || 8
    const w = 46 + ch * 3
    const out: Solid[] = [
      { kind: 'box', mat: ALU, size: [w, 12, 46], at: [0, 6, 0], bevel: 3 },
      { kind: 'box', mat: DARK, size: [9, 4, 3], at: [0, 6, -24] },
    ]
    for (let i = 0; i < ch + 1; i++) {
      out.push({ kind: 'box', mat: { color: '#1C1E22', rough: 0.5, density: 1.2 }, size: [2, 6, 2], at: [-w / 2 + 6 + i * ((w - 12) / ch), 13, 18] })
    }
    return out
  },
  ports: (p) => {
    const ch = parseInt(str(p, 'channels', '8'), 10) || 8
    const w = 46 + ch * 3
    const out: Port[] = [...usbPorts([0, 6, -26], [0, 0, -1], 0.3)]
    for (let i = 0; i < ch; i++) {
      out.push({
        id: `d${i}`, label: `D${i}`, kind: 'electrical',
        pos: [-w / 2 + 6 + i * ((w - 12) / ch), 16, 18], dir: [0, 1, 0], role: 'io', imax: 0.001, solderable: false,
      })
    }
    out.push({ id: 'gndclip', label: 'Ground', kind: 'electrical', pos: [w / 2 - 6, 16, 18], dir: [0, 1, 0], role: 'gnd', imax: 0.001, solderable: false })
    out.push({ id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: usbLoad(
    () => 0.4,
    (p) => {
      const ch = parseInt(str(p, 'channels', '8'), 10) || 8
      // Each input is a buffer with a 1 MΩ bias and 10 pF of pin and lead.
      const out: DeviceModel[] = []
      for (let i = 0; i < ch; i++) {
        out.push({ type: 'resistor', a: `d${i}`, b: 'gndclip', r: 1e6 })
        out.push({ type: 'capacitor', c: 10e-12, a: `d${i}`, b: 'gndclip' })
      }
      return out
    },
  ),
  mass: () => 65,
  price: (p) => {
    const rate = parseInt(str(p, 'rate', '24'), 10) || 24
    const ch = parseInt(str(p, 'channels', '8'), 10) || 8
    return Math.round(20 + rate * 0.9 + ch * 4)
  },
  readouts: (p) => {
    const rate = parseInt(str(p, 'rate', '24'), 10) || 24
    const bus = str(p, 'bus', 'i2c400')
    const busHz: Record<string, number> = { uart115: 0.1152, i2c100: 0.1, i2c400: 0.4, spi8: 8, spi20: 20 }
    const f = busHz[bus] ?? 0.4
    const over = rate / f
    return [
      { label: 'Rate', value: `${rate} MSa/s across all channels` },
      { label: 'Bus', value: `${f < 1 ? `${(f * 1000).toFixed(0)} kHz` : `${f} MHz`}` },
      { label: 'Samples a bit', value: `${over.toFixed(0)}×` },
      { label: 'Verdict', value: over >= 10 ? 'Comfortable' : over >= 4 ? 'Workable, edges will jitter by a sample' : 'Too slow for this bus' },
      { label: 'Loads each line', value: '1 MΩ and 10 pF' },
    ]
  },
}

const functionGenerator: PartDef = {
  id: 'function-generator',
  name: 'Function generator',
  category: 'instrument',
  blurb: 'A real source, with fifty ohms behind it',
  tags: ['function generator', 'signal generator', 'awg', 'arbitrary', 'sine', 'square', 'sweep', 'bench', 'instrument', 'test'],
  doc: {
    price: 260,
    description:
      'A source you can put in the circuit, which makes it the one instrument here that drives rather than listens. Its output impedance is 50 ohm and that is not a detail: into a 50 ohm load it delivers half of what the display says, and into a high impedance it delivers all of it, so the same setting means two different amplitudes depending on what it is connected to.',
  },
  params: [
    REGION_PARAM,
    { key: 'shape', label: 'Waveform', type: 'enum', default: 'sine', group: 'Output', options: [{ value: 'sine', label: 'Sine' }, { value: 'square', label: 'Square' }, { value: 'tri', label: 'Triangle' }, { value: 'pulse', label: 'Pulse' }] },
    { key: 'freq', label: 'Frequency', type: 'number', unit: 'Hz', default: 1000, min: 0.1, max: 25e6, step: 10, eng: true, group: 'Output' },
    { key: 'amp', label: 'Amplitude', type: 'number', unit: 'V', default: 3, min: 0.01, max: 10, step: 0.1, group: 'Output', help: 'Peak to peak, into a high impedance.' },
    { key: 'offset', label: 'Offset', type: 'number', unit: 'V', default: 0, min: -5, max: 5, step: 0.1, group: 'Output' },
    { key: 'duty', label: 'Duty', type: 'number', unit: '%', default: 50, min: 1, max: 99, step: 1, group: 'Output' },
    { key: 'on', label: 'Output on', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const on = bool(p, 'on', true)
    const out: Solid[] = [
      { kind: 'box', mat: BENCH_CASE, size: [320, 120, 110], at: [0, 60, 0], bevel: 5 },
      { kind: 'box', mat: DARK, size: [150, 72, 4], at: [-70, 70, 56] },
      { kind: 'box', mat: screen(on, '#2E6E4A'), size: [142, 64, 2], at: [-70, 70, 58] },
      { kind: 'cyl', mat: { color: '#2A2C30', rough: 0.5, density: 1.3 }, r: 20, h: 16, seg: 24, rot: [90, 0, 0], at: [100, 76, 55] },
    ]
    for (let i = 0; i < 2; i++) {
      // BNC outputs.
      out.push({ kind: 'cyl', mat: ALU, r: 8, h: 12, seg: 18, rot: [90, 0, 0], at: [60 + i * 46, 26, 56] })
      out.push({ kind: 'cyl', mat: { color: '#D8D5CE', rough: 0.4, density: 1.2 }, r: 2.4, h: 14, seg: 12, rot: [90, 0, 0], at: [60 + i * 46, 26, 58], noCollide: true })
    }
    return out
  },
  ports: () => [
    ...mainsPorts([0, 40, -56], [0, 0, -1], '', [11, 0, 0]),
    { id: 'out1', label: 'Output 1', kind: 'electrical', pos: [60, 26, 64], dir: [0, 0, 1], role: 'power', imax: 0.2, solderable: false },
    { id: 'out1gnd', label: 'Output 1 shell', kind: 'electrical', pos: [60, 12, 64], dir: [0, 0, 1], role: 'gnd', imax: 0.2, solderable: false },
    { id: 'out2', label: 'Output 2', kind: 'electrical', pos: [106, 26, 64], dir: [0, 0, 1], role: 'power', imax: 0.2, solderable: false },
    { id: 'out2gnd', label: 'Output 2 shell', kind: 'electrical', pos: [106, 12, 64], dir: [0, 0, 1], role: 'gnd', imax: 0.2, solderable: false },
    { id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: {
    devices: (p) => {
      const on = bool(p, 'on', true)
      const shape = str(p, 'shape', 'sine') as 'sine' | 'square' | 'tri' | 'pulse'
      const amp = num(p, 'amp', 3) / 2
      const out: DeviceModel[] = [
        {
          type: 'vsource',
          v: num(p, 'offset', 0),
          a: 'out1',
          b: 'out1gnd',
          // 50 ohm source impedance, which is the whole reason the amplitude
          // you set is not always the amplitude you get.
          rint: on ? 50 : 1e7,
          wave: on ? { shape, amp, freq: num(p, 'freq', 1000), offset: num(p, 'offset', 0), duty: num(p, 'duty', 50) / 100 } : undefined,
        },
        { type: 'resistor', a: 'out2', b: 'out2gnd', r: 1e7 },
      ]
      const v = volts(p)
      out.push({ type: 'resistor', a: 'l', b: 'n', r: (v * v) / 22 })
      out.push({ type: 'resistor', a: 'e', b: 'n', r: 2e6 })
      return out
    },
    supplies: ['out1'],
    limits: { vmax: 400 },
  },
  mass: () => 2400,
  price: () => 260,
  readouts: (p) => {
    const amp = num(p, 'amp', 3)
    const f = num(p, 'freq', 1000)
    return [
      { label: 'Into high impedance', value: `${amp.toFixed(2)} V peak to peak` },
      { label: 'Into 50 Ω', value: `${(amp / 2).toFixed(2)} V peak to peak, because of the source impedance` },
      { label: 'Period', value: f >= 1e6 ? `${(1e9 / f).toFixed(1)} ns` : f >= 1000 ? `${(1e6 / f).toFixed(1)} µs` : `${(1000 / f).toFixed(2)} ms` },
      { label: 'Offset', value: `${num(p, 'offset', 0).toFixed(2)} V` },
    ]
  },
}

const energyMeter: PartDef = {
  id: 'meter-energy-plug',
  name: 'Plug-in energy meter',
  category: 'instrument',
  blurb: 'In series with the wall, reading what a thing really costs',
  tags: ['energy meter', 'power meter', 'watt meter', 'plug in', 'kwh', 'standby', 'mains', 'measurement', 'instrument'],
  doc: {
    price: 20,
    description:
      'Between the socket and the appliance, which is what makes it the honest answer to every argument about standby power. It reads watts now and kilowatt hours since it was reset, and the second number is the one that settles things: a games console left in rest mode is 1.5 W, which is 13 kWh a year, and a desk full of idle supplies is twenty times that.\n\nIts own shunt is 10 milliohm, so it takes about a fiftieth of a watt to do the measuring.',
  },
  params: [
    REGION_PARAM,
    { key: 'measuring', label: 'Load connected', type: 'number', unit: 'W', default: 120, min: 0, max: 3000, step: 1, group: 'Control' },
    { key: 'tariff', label: 'Tariff', type: 'number', unit: '', default: 0.27, min: 0.05, max: 1.2, step: 0.01, group: 'Cost', help: 'Currency per kilowatt hour, whatever your currency is.' },
    { key: 'hours', label: 'Hours a day', type: 'number', unit: 'h', default: 8, min: 0, max: 24, step: 0.5, group: 'Cost' },
  ],
  solids: () => [
    { kind: 'box', mat: { color: '#EFEDE8', rough: 0.5, density: 1.4 }, size: [86, 130, 56], at: [0, 65, 28], bevel: 5 },
    { kind: 'box', mat: DARK, size: [58, 30, 3], at: [0, 92, 57] },
    { kind: 'box', mat: screen(true, '#3A5E4A'), size: [52, 24, 2], at: [0, 92, 58] },
    // The socket on the front, and the pins on the back.
    { kind: 'box', mat: { color: '#DAD8D3', rough: 0.55, density: 1.4 }, size: [60, 60, 6], at: [0, 40, 57] },
    { kind: 'box', mat: DARK, size: [14, 4, 8], at: [0, 54, 57], noCollide: true },
    { kind: 'box', mat: DARK, size: [4, 14, 8], at: [-16, 34, 57], noCollide: true },
    { kind: 'box', mat: DARK, size: [4, 14, 8], at: [16, 34, 57], noCollide: true },
    { kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [7, 4, 18], at: [0, 76, -9] },
    { kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [4, 7, 18], at: [-11, 60, -9] },
    { kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [4, 7, 18], at: [11, 60, -9] },
  ],
  ports: () => [
    ...mainsPorts([0, 60, -18], [0, 0, -1], '', [11, 0, 0]),
    { id: 'outl', label: 'Live out', kind: 'electrical', pos: [-11, 40, 62], dir: [0, 0, 1], role: 'power', imax: 13, solderable: false },
    { id: 'outn', label: 'Neutral out', kind: 'electrical', pos: [11, 40, 62], dir: [0, 0, 1], role: 'passive', imax: 13, solderable: false },
    { id: 'oute', label: 'Earth out', kind: 'electrical', pos: [0, 54, 62], dir: [0, 0, 1], role: 'gnd', imax: 13, solderable: false },
  ],
  electrical: {
    /*
     * A pass-through with a shunt in the live leg and the meter's own supply
     * across the incoming pair. The shunt is 10 milliohm, which at 13 A is
     * 130 mV and 1.7 W — so it is a real series element, not a wire, which
     * is exactly the point of having it in a tool that solves circuits.
     */
    devices: (p) => {
      const v = volts(p)
      return [
        { type: 'resistor', a: 'l', b: 'outl', r: 0.01 },
        { type: 'short', a: 'n', b: 'outn' },
        { type: 'short', a: 'e', b: 'oute' },
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / 0.6 },
      ]
    },
    supplies: ['outl'],
    limits: { vmax: 400, imax: 13 },
  },
  mass: () => 180,
  price: () => 20,
  readouts: (p) => {
    const w = num(p, 'measuring', 120)
    const hours = num(p, 'hours', 8)
    const tariff = num(p, 'tariff', 0.27)
    const kwhYear = (w / 1000) * hours * 365
    const standbyYear = (w / 1000) * 24 * 365
    return [
      { label: 'Reading', value: `${w.toFixed(0)} W, ${amps(p, w)}` },
      { label: 'At this duty', value: `${kwhYear.toFixed(0)} kWh a year, ${(kwhYear * tariff).toFixed(0)} a year` },
      { label: 'If it never went off', value: `${standbyYear.toFixed(0)} kWh, ${(standbyYear * tariff).toFixed(0)}` },
      { label: 'Own burden', value: '10 mΩ shunt, 0.6 W for the meter itself' },
    ]
  },
}

const benchPsuProgrammable: PartDef = {
  id: 'psu-bench-programmable',
  name: 'Programmable bench supply',
  category: 'instrument',
  blurb: 'Volts, a current limit, and the limit is the feature',
  tags: ['bench supply', 'psu', 'power supply', 'programmable', 'current limit', 'cc', 'cv', 'lab', 'instrument', 'test'],
  doc: {
    price: 210,
    description:
      'The current limit is why this belongs on a bench rather than a plug-top supply being used instead. Set it to 100 mA and a shorted prototype sits there at 0.3 V doing nothing instead of burning a track off; the supply drops out of constant voltage into constant current and stays there.\n\nThe other thing it has that a brick does not is a readback you can believe, and a sense pair so the reading is taken at the board rather than at the terminals, which on 2 metres of thin lead at 3 A is a difference of a third of a volt.',
  },
  params: [
    REGION_PARAM,
    { key: 'vmax', label: 'Maximum volts', type: 'enum', default: '30', group: 'Supply', options: ['15', '30', '60'].map((v) => ({ value: v, label: `${v} V` })) },
    { key: 'imaxRating', label: 'Maximum amps', type: 'enum', default: '5', group: 'Supply', options: ['3', '5', '10'].map((v) => ({ value: v, label: `${v} A` })) },
    { key: 'channels', label: 'Channels', type: 'enum', default: '1', group: 'Supply', options: ['1', '2', '3'].map((v) => ({ value: v, label: `${v} channel` })) },
    { key: 'vset', label: 'Set volts', type: 'number', unit: 'V', default: 5, min: 0, max: 60, step: 0.1, group: 'Control' },
    { key: 'ilimit', label: 'Current limit', type: 'number', unit: 'A', default: 0.5, min: 0.001, max: 10, step: 0.01, group: 'Control' },
    { key: 'on', label: 'Output on', type: 'bool', default: true, group: 'Control' },
    { key: 'sense', label: 'Remote sense', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const ch = parseInt(str(p, 'channels', '1'), 10) || 1
    const w = 200 + (ch - 1) * 70
    const on = bool(p, 'on', true)
    const out: Solid[] = [
      { kind: 'box', mat: BENCH_CASE, size: [w, 150, 290], at: [0, 75, 0], bevel: 5 },
      { kind: 'cyl', mat: { color: '#2A2C30', rough: 0.5, density: 1.3 }, r: 22, h: 16, seg: 24, rot: [90, 0, 0], at: [w / 2 - 36, 48, 146] },
    ]
    for (let i = 0; i < ch; i++) {
      const x = -w / 2 + 50 + i * 70
      out.push({ kind: 'box', mat: DARK, size: [58, 40, 4], at: [x, 112, 146] })
      out.push({ kind: 'box', mat: screen(on, '#A33E24'), size: [52, 34, 2], at: [x, 112, 148] })
      // Binding posts, red over black, as everything has.
      out.push({ kind: 'cyl', mat: { color: '#B4342C', rough: 0.45, density: 1.4 }, r: 7, h: 16, seg: 16, rot: [90, 0, 0], at: [x - 14, 44, 150] })
      out.push({ kind: 'cyl', mat: { color: '#1A1B1E', rough: 0.45, density: 1.4 }, r: 7, h: 16, seg: 16, rot: [90, 0, 0], at: [x + 14, 44, 150] })
    }
    // The fan, because a linear supply at 150 W has to put the heat somewhere.
    out.push({ kind: 'cyl', mat: DARK, r: 36, h: 20, seg: 24, rot: [90, 0, 0], at: [0, 75, -142] })
    return out
  },
  ports: (p) => {
    const ch = parseInt(str(p, 'channels', '1'), 10) || 1
    const w = 200 + (ch - 1) * 70
    const out: Port[] = [...mainsPorts([-w / 2 + 40, 30, -146], [0, 0, -1], '', [11, 0, 0])]
    for (let i = 0; i < ch; i++) {
      const x = -w / 2 + 50 + i * 70
      out.push({ id: `pos${i + 1}`, label: `Channel ${i + 1} +`, kind: 'electrical', pos: [x - 14, 44, 160], dir: [0, 0, 1], role: 'power', imax: 10, solderable: false })
      out.push({ id: `neg${i + 1}`, label: `Channel ${i + 1} −`, kind: 'electrical', pos: [x + 14, 44, 160], dir: [0, 0, 1], role: 'gnd', imax: 10, solderable: false })
    }
    out.push({ id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const ch = parseInt(str(p, 'channels', '1'), 10) || 1
      const on = bool(p, 'on', true)
      const vset = Math.min(num(p, 'vset', 5), parseInt(str(p, 'vmax', '30'), 10) || 30)
      const v = volts(p)
      const out: DeviceModel[] = []
      for (let i = 1; i <= ch; i++) {
        /*
         * Constant voltage with the current limit expressed as source
         * impedance, which is as close as a DC solve gets to a fold-back:
         * at the limit the drop across rint equals the set voltage, so
         * asking for more current pulls the output down instead of
         * delivering it.
         */
        const ilim = Math.max(0.001, num(p, 'ilimit', 0.5))
        out.push({ type: 'vsource', v: on ? vset : 0, a: `pos${i}`, b: `neg${i}`, rint: on ? Math.max(0.002, vset / (ilim * 60)) : 1e7 })
      }
      // A linear supply dissipates the difference; 60% efficient is generous.
      const outW = on ? vset * num(p, 'ilimit', 0.5) : 0
      out.push({ type: 'resistor', a: 'l', b: 'n', r: (v * v) / Math.max(6, outW / 0.6 + 8) })
      out.push({ type: 'resistor', a: 'e', b: 'n', r: 2e6 })
      return out
    },
    supplies: Array.from({ length: 3 }, (_, i) => `pos${i + 1}`),
    limits: { vmax: 400 },
  },
  mass: (p) => 3200 + ((parseInt(str(p, 'channels', '1'), 10) || 1) - 1) * 900,
  price: (p) => {
    const vmax = parseInt(str(p, 'vmax', '30'), 10) || 30
    const imax = parseInt(str(p, 'imaxRating', '5'), 10) || 5
    const ch = parseInt(str(p, 'channels', '1'), 10) || 1
    return Math.round(90 + vmax * 2.2 + imax * 12 + (ch - 1) * 110)
  },
  readouts: (p) => {
    const vset = num(p, 'vset', 5)
    const ilim = num(p, 'ilimit', 0.5)
    const vmaxR = parseInt(str(p, 'vmax', '30'), 10) || 30
    const imaxR = parseInt(str(p, 'imaxRating', '5'), 10) || 5
    const outW = vset * ilim
    return [
      { label: 'Set to', value: `${vset.toFixed(2)} V, limit ${ilim < 1 ? `${(ilim * 1000).toFixed(0)} mA` : `${ilim.toFixed(2)} A`}` },
      { label: 'At the limit', value: `${outW.toFixed(1)} W out, ${(outW / 0.6 + 8).toFixed(0)} W from the wall` },
      { label: 'Into a short', value: `${(ilim * 1000).toFixed(0)} mA at near zero volts, and it will sit there` },
      { label: 'Rating', value: `${vmaxR} V, ${imaxR} A, ${vmaxR * imaxR} VA a channel` },
      { label: 'Lead drop', value: bool(p, 'sense', false) ? 'Corrected by remote sense' : `${(ilim * 0.1).toFixed(2)} V over 2 m of 0.5 mm² lead` },
    ]
  },
}

registerParts([oscilloscope, multimeter, logicAnalyser, functionGenerator, energyMeter, benchPsuProgrammable])
