import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import type { Instance, Params, Vec3 } from '@/parts/kernel/types'
import { defaultParams, requirePart } from '@/parts/kernel/registry'

/**
 * Starter builds. These are ordinary documents constructed in code, which
 * doubles as a readable specification of what a well-formed project looks like.
 */

class DocBuilder {
  readonly doc: Doc = emptyDoc()
  private n = 0

  constructor(name: string) {
    this.doc.name = name
  }

  add(defId: string, pos: Vec3, params: Params = {}, rot: Vec3 = [0, 0, 0], name?: string): string {
    const def = requirePart(defId)
    const id = `s${this.n++}`
    const inst: Instance = {
      id,
      defId,
      name: name ?? `${def.name} ${this.n}`,
      params: { ...defaultParams(def), ...params },
      pos,
      rot,
    }
    this.doc.instances[id] = inst
    this.doc.order.push(id)
    return id
  }

  /**
   * @param gauge Conductor cross-section, mm^2. The default is 24 AWG hook-up
   *              wire; a PSU cable is several heavier conductors in one plug,
   *              so those pass their own.
   */
  wire(a: [string, string], b: [string, string], color = '#E34B4B', gauge = 0.205): void {
    const id = `w${this.n++}`
    this.doc.connections[id] = {
      id,
      kind: 'wire',
      a: { instanceId: a[0], portId: a[1] },
      b: { instanceId: b[0], portId: b[1] },
      color,
      gauge,
    }
    this.doc.connectionOrder.push(id)
  }
}

/* ------------------------------------------------------------------ */

/** The first circuit anyone builds: supply, resistor, LED. */
function ledCircuit(): Doc {
  const b = new DocBuilder('Blinking start, LED and resistor')

  const bb = b.add('breadboard', [0, 0, 0], { size: '830' }, [0, 0, 0], 'Breadboard')
  const bat = b.add('battery-holder', [-190, 0, 90], { cell: 'aa', count: 3 }, [0, 0, 0], 'Battery pack')
  const res = b.add('resistor-axial', [-25.4, 9, 9.5], { value: 220, watt: '0.25', pitch: 10.16 }, [0, 90, 0], 'Series resistor')
  const led = b.add('led-5mm', [0, 9, 9.5], { color: 'red' }, [0, 0, 0], 'Indicator')
  const gnd = b.add('ground', [60, 9, 22.9], {}, [0, 0, 0], 'Ground')

  // Battery to the rails.
  b.wire([bat, 'p'], [bb, 'pos-near-4'], '#E34B4B')
  b.wire([bat, 'n'], [bb, 'neg-near-4'], '#1C1F24')
  // Rail to resistor, resistor to LED, LED back to the negative rail.
  b.wire([bb, 'pos-near-14'], [res, '1'], '#E34B4B')
  b.wire([res, '2'], [led, 'a'], '#E3A64B')
  b.wire([led, 'c'], [bb, 'neg-near-20'], '#1C1F24')
  b.wire([gnd, 'gnd'], [bb, 'neg-near-24'], '#3DD68C')

  return b.doc
}

/** A 2020 frame, the mechanical half of the tool, in one click. */
function frameCube(): Doc {
  const b = new DocBuilder('2020 frame, 300 mm cube')
  const L = 300
  const params = { size: '2020', length: L, finish: 'alu-anod-black' }

  // Base square.
  b.add('extrusion-tslot', [0, 0, -140], params, [0, 0, 0], 'Base front')
  b.add('extrusion-tslot', [0, 0, 140], params, [0, 0, 0], 'Base back')
  b.add('extrusion-tslot', [-140, 0, 0], params, [0, 90, 0], 'Base left')
  b.add('extrusion-tslot', [140, 0, 0], params, [0, 90, 0], 'Base right')

  // Uprights. A beam is authored lying down with its origin on the seating
  // face, so standing one up needs a half-profile offset in X and half its
  // length in Y.
  for (const [x, z] of [[-140, -140], [140, -140], [-140, 140], [140, 140]] as const) {
    b.add('extrusion-tslot', [x + 10, L / 2, z], params, [0, 0, 90], `Upright ${x},${z}`)
  }

  // Top square.
  b.add('extrusion-tslot', [0, 300, -140], params, [0, 0, 0], 'Top front')
  b.add('extrusion-tslot', [0, 300, 140], params, [0, 0, 0], 'Top back')
  b.add('extrusion-tslot', [-140, 300, 0], params, [0, 90, 0], 'Top left')
  b.add('extrusion-tslot', [140, 300, 0], params, [0, 90, 0], 'Top right')

  // Deck.
  b.add('panel-sheet', [0, 20, 0], { material: 'plywood', width: 260, depth: 260, thickness: 12, corner: 6 }, [0, 0, 0], 'Deck')

  for (const [x, z] of [[-140, -140], [140, -140], [-140, 140], [140, 140]] as const) {
    b.add('bracket-corner-2020', [x, 20, z], { size: '20' }, [0, 0, 0], 'Corner bracket')
  }

  return b.doc
}

/** Motor, switch and supply, the smallest thing that moves. */
function motorRig(): Doc {
  const b = new DocBuilder('Motor test rig')
  const psu = b.add('bench-supply', [-190, 0, 0], { voltage: 6, ilimit: 2 }, [0, 0, 0], 'Bench supply')
  const sw = b.add('switch-toggle', [-20, 12, 40], { poles: 'spst', on: false }, [0, 0, 0], 'Power switch')
  const motor = b.add('motor-dc', [90, 0, 0], { vnom: 6, rpm: 9000, rwind: 3.2 }, [0, 0, 0], 'Drive motor')
  const gnd = b.add('ground', [-20, 0, -50], {}, [0, 0, 0], 'Ground')

  b.wire([psu, 'p'], [sw, 'com'], '#E34B4B')
  b.wire([sw, 'no'], [motor, 'p'], '#E34B4B')
  b.wire([motor, 'n'], [psu, 'n'], '#1C1F24')
  b.wire([psu, 'n'], [gnd, 'gnd'], '#3DD68C')

  b.add('panel-sheet', [0, 0, 0], { material: 'plywood', width: 300, depth: 200, thickness: 12 }, [0, 0, 0], 'Base plate')
  return b.doc
}

/** The 555 astable everyone builds first, at a visible one hertz. */
function blinker555(): Doc {
  const b = new DocBuilder('555 blinker, one hertz')

  // f = 1.44 / ((R1 + 2*R2) * C). 10k, 68k and 10uF lands just under 1 Hz.
  const R1 = 10_000
  const R2 = 68_000
  const C = 10e-6

  const psu = b.add('bench-supply', [-210, 0, 0], { voltage: 9, ilimit: 0.5 }, [0, 0, 0], 'Supply')
  const ic = b.add('ne555', [0, 0, 0], {}, [0, 0, 0], 'Timer')
  const r1 = b.add('resistor-axial', [-60, 0, -40], { value: R1 }, [0, 0, 0], 'R1 charge')
  const r2 = b.add('resistor-axial', [-60, 0, 40], { value: R2 }, [0, 0, 0], 'R2 discharge')
  const cap = b.add('capacitor-electrolytic', [-20, 0, 70], { value: C, vmax: 25 }, [0, 0, 0], 'Timing cap')
  const rled = b.add('resistor-axial', [70, 0, -30], { value: 470 }, [0, 0, 0], 'LED resistor')
  const led = b.add('led-5mm', [120, 0, -30], { color: 'red' }, [0, 0, 0], 'Indicator')
  const gnd = b.add('ground', [0, 0, 110], {}, [0, 0, 0], 'Ground')

  const RED = '#E34B4B'
  const BLACK = '#1C1F24'
  const YELLOW = '#E3A64B'

  b.wire([psu, 'p'], [ic, 'vcc'], RED)
  b.wire([psu, 'p'], [ic, 'reset'], RED)
  b.wire([psu, 'n'], [ic, 'gnd'], BLACK)
  b.wire([psu, 'n'], [gnd, 'gnd'], '#3DD68C')

  // Charge through R1 into DISCH, then on through R2 to the timing cap.
  b.wire([psu, 'p'], [r1, '1'], RED)
  b.wire([r1, '2'], [ic, 'disch'], YELLOW)
  b.wire([ic, 'disch'], [r2, '1'], YELLOW)
  b.wire([r2, '2'], [ic, 'thresh'], YELLOW)
  b.wire([ic, 'thresh'], [ic, 'trig'], '#A78BFA')
  b.wire([ic, 'thresh'], [cap, 'p'], YELLOW)
  b.wire([cap, 'n'], [psu, 'n'], BLACK)

  // Output stage.
  b.wire([ic, 'out'], [rled, '1'], '#4C8DFF')
  b.wire([rled, '2'], [led, 'a'], '#4C8DFF')
  b.wire([led, 'c'], [psu, 'n'], BLACK)

  return b.doc
}

/** A microcontroller board blinking its on-board pin. */
function mcuBlink(): Doc {
  const b = new DocBuilder('Microcontroller blink')
  const mcu = b.add('mcu-board', [0, 0, 0], { program: 'blink', interval: 0.4, power: 'usb' }, [0, 0, 0], 'Controller')
  const res = b.add('resistor-axial', [110, 0, -30], { value: 330 }, [0, 0, 0], 'Series resistor')
  const led = b.add('led-5mm', [160, 0, -30], { color: 'green' }, [0, 0, 0], 'Indicator')
  const gnd = b.add('ground', [60, 0, 60], {}, [0, 0, 0], 'Ground')

  b.wire([mcu, 'd13'], [res, '1'], '#4C8DFF')
  b.wire([res, '2'], [led, 'a'], '#4C8DFF')
  b.wire([led, 'c'], [mcu, 'gnd'], '#1C1F24')
  b.wire([mcu, 'gnd'], [gnd, 'gnd'], '#3DD68C')

  return b.doc
}

/**
 * A board driving a character LCD over its real four-bit bus.
 *
 * Eleven wires, which is what this actually takes: power and ground, the
 * backlight pair, R/W tied low because the sketch only ever writes, RS and E,
 * and four data lines. Pull any one of them out and the panel tells you.
 */
function lcdText(): Doc {
  const b = new DocBuilder('Text on a character LCD')
  const mcu = b.add('mcu-board', [0, 0, 40], { program: 'lcd-clock', text1: 'DRAFTRIG' }, [0, 0, 0], 'Controller')
  const lcd = b.add('display-lcd-character', [4, 0, -46], { format: '1602' }, [0, 0, 0], 'Character LCD')

  const RED = '#E34B4B'
  const BLACK = '#1C1F24'
  const BLUE = '#4C8DFF'
  const GREEN = '#3DD68C'

  b.wire([mcu, 'v5'], [lcd, 'vdd'], RED)
  b.wire([mcu, 'gnd'], [lcd, 'vss'], BLACK)
  b.wire([mcu, 'v5'], [lcd, 'a'], RED)
  b.wire([mcu, 'gnd2'], [lcd, 'k'], BLACK)
  // R/W low: this sketch writes and never reads back.
  b.wire([mcu, 'gnd3'], [lcd, 'rw'], BLACK)
  b.wire([mcu, 'd12'], [lcd, 'rs'], GREEN)
  b.wire([mcu, 'd11'], [lcd, 'e'], GREEN)
  b.wire([mcu, 'd5'], [lcd, 'd4'], BLUE)
  b.wire([mcu, 'd4'], [lcd, 'd5'], BLUE)
  b.wire([mcu, 'd3'], [lcd, 'd6'], BLUE)
  b.wire([mcu, 'd2'], [lcd, 'd7'], BLUE)

  return b.doc
}

/**
 * A desktop, assembled.
 *
 * Every part is seated where it actually goes: the chip in the socket, the
 * sticks in the slots the manual asks for, the card in the top x16. Pull any of
 * it out and put something else in, and the checks will tell you whether the
 * something else fits.
 *
 * Positions are worked out from the board's own port coordinates rather than
 * eyeballed, so this stays assembled if the board's layout ever changes.
 */
function desktopPc(): Doc {
  const b = new DocBuilder('Desktop PC, open build')

  const W = 305
  const D = 244
  const T = 1.6
  const sockX = -W / 2 + 86
  const sockZ = -D / 2 + 62
  const dimmX = sockX + 62

  const mb = b.add('motherboard', [0, 0, 0], { form: 'atx', socket: 'AM5' }, [0, 0, 0], 'Motherboard')
  const cpu = b.add('cpu', [sockX, T + 3.4, sockZ], { socket: 'AM5', cores: 8, tdp: 105 }, [0, 0, 0], 'Processor')
  const cooler = b.add('cpu-cooler', [sockX, T + 6.9, sockZ], { height: 158, fans: 1, watts: 220 }, [0, 0, 0], 'CPU cooler')

  // Slots A2 and B2, which is the pair every manual asks for first.
  const ram1 = b.add('ram-dimm', [dimmX, T + 7.4, -D / 2 + 34 + 9.2], { standard: 'DDR5', capacity: '16' }, [0, 0, 0], 'Memory A2')
  const ram2 = b.add('ram-dimm', [dimmX, T + 7.4, -D / 2 + 34 + 27.6], { standard: 'DDR5', capacity: '16' }, [0, 0, 0], 'Memory B2')

  const gpuLen = 304
  // Positioned so its edge connector lands in the top x16 slot.
  const gpu = b.add('graphics-card', [-W / 2 + 92 + gpuLen / 2 - 60, T + 8.4 + 7, D / 2 - 60], { length: gpuLen, slots: 3, tdp: 285 }, [0, 0, 0], 'Graphics card')
  const ssd = b.add('ssd-m2', [W / 2 - 74 + 2, T + 3, D / 2 - 44], { size: '2280', capacity: '2' }, [0, 0, 0], 'Boot drive')
  const psu = b.add('power-supply', [-30, 0, 250], { watts: 750, efficiency: 'gold' }, [0, 180, 0], 'Power supply')

  const YELLOW = '#C8A227'
  const BLACK = '#1C1F24'
  const RED = '#E34B4B'

  /*
   * A PSU connector is several conductors in one plug, not one wire, so the
   * gauges here are the bundle rather than a single strand: three 18 AWG for a
   * feed, and the card's return is six of them because it has two connectors.
   * Both of the card's connectors get fed, which is what stops one modelled
   * wire carrying the whole seventeen amps a 285 W card asks for.
   */
  const FEED = 2.5
  const RETURN = 5
  b.wire([psu, 'atx24'], [mb, 'atx24'], YELLOW, FEED)
  b.wire([psu, 'eps'], [mb, 'eps'], YELLOW, FEED)
  b.wire([psu, 'gnd'], [mb, 'gnd'], BLACK, FEED)
  b.wire([psu, 'pcie1'], [gpu, 'pwr0'], RED, FEED)
  b.wire([psu, 'pcie2'], [gpu, 'pwr1'], RED, FEED)
  b.wire([psu, 'gnd'], [gpu, 'gnd'], BLACK, RETURN)

  void cpu
  void cooler
  void ram1
  void ram2
  void ssd
  return b.doc
}

/**
 * The same parts in a case that cannot take them, so the checks have something
 * to say the moment it opens.
 */
function smallFormPc(): Doc {
  const b = new DocBuilder('Small form factor, and what it costs you')

  const W = 170
  const D = 170
  const T = 1.6
  const sockX = -W / 2 + 62
  const sockZ = -D / 2 + 62
  const dimmX = sockX + 62

  const mb = b.add('motherboard', [0, 0, 0], { form: 'itx', socket: 'AM5' }, [0, 0, 0], 'Motherboard')
  b.add('cpu', [sockX, T + 3.4, sockZ], { socket: 'AM5', cores: 8, tdp: 105 }, [0, 0, 0], 'Processor')
  b.add('cpu-cooler', [sockX, T + 6.9, sockZ], { height: 158, fans: 1, watts: 220 }, [0, 0, 0], 'CPU cooler')
  b.add('ram-dimm', [dimmX, T + 7.4, -D / 2 + 34], { standard: 'DDR5', capacity: '16' }, [0, 0, 0], 'Memory A1')
  b.add('ram-dimm', [dimmX, T + 7.4, -D / 2 + 43.2], { standard: 'DDR5', capacity: '16' }, [0, 0, 0], 'Memory A2')
  const gpu = b.add('graphics-card', [-W / 2 + 92 + 304 / 2 - 60, T + 8.4 + 7, D / 2 - 60], { length: 304, slots: 3, tdp: 285 }, [0, 0, 0], 'Graphics card')
  const psu = b.add('power-supply', [-30, 0, 220], { form: 'sfx', watts: 450 }, [0, 180, 0], 'Power supply')
  b.add('pc-case', [320, 0, 0], { size: 'itx' }, [0, 0, 0], 'Case')

  const FEED = 2.5
  b.wire([psu, 'atx24'], [mb, 'atx24'], '#C8A227', FEED)
  b.wire([psu, 'gnd'], [mb, 'gnd'], '#1C1F24', FEED)
  b.wire([psu, 'pcie1'], [gpu, 'pwr0'], '#E34B4B', FEED)
  b.wire([psu, 'pcie2'], [gpu, 'pwr1'], '#E34B4B', FEED)
  b.wire([psu, 'gnd'], [gpu, 'gnd'], '#1C1F24', 5)

  return b.doc
}

export interface Starter {
  id: string
  title: string
  blurb: string
  build: () => Doc
}

export const STARTERS: Starter[] = [
  { id: 'led', title: 'LED on a breadboard', blurb: 'Supply, resistor and LED, see the current arrive', build: ledCircuit },
  { id: 'blink555', title: '555 blinker', blurb: 'The classic astable, flashing at one hertz', build: blinker555 },
  { id: 'mcu', title: 'Microcontroller blink', blurb: 'A board running a sketch, driving a real LED', build: mcuBlink },
  { id: 'lcd', title: 'Text on an LCD', blurb: 'A board bit-banging a 16x2 panel over its real bus', build: lcdText },
  { id: 'frame', title: '2020 frame cube', blurb: 'A 300 mm extrusion frame with a plywood deck', build: frameCube },
  { id: 'motor', title: 'Motor test rig', blurb: 'Bench supply through a switch into a DC motor', build: motorRig },
  { id: 'pc', title: 'Desktop PC', blurb: 'A whole machine, assembled. Take it apart', build: desktopPc },
  { id: 'pc-sff', title: 'Small form factor PC', blurb: 'The same parts in a case that will not take them', build: smallFormPc },
]
