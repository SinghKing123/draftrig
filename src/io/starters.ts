import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import type { Instance, Params, Vec3 } from '@/parts/kernel/types'
import { defaultParams, requirePart } from '@/parts/kernel/registry'
import {
  benchClock,
  cncRouter,
  controlPanel,
  eightBit,
  espWeather,
  ledMatrix,
  logicBench,
  rfidLock,
  rover,
  scoreboard,
  servoArm,
  soundBench,
  thrustRig,
} from './builds'
import { lab10Buzzer, lab9Blinker } from './labs'

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

/**
 * A 2020 frame, the mechanical half of the tool, in one click.
 *
 * Exported but not listed: see the note on STARTERS. It is kept whole so it
 * can go back in the moment the mechanical side is worth showing.
 */
export function frameCube(): Doc {
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

/** Motor, switch and supply. Exported but not listed; see STARTERS. */
export function motorRig(): Doc {
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

  /*
   * Soldered onto a board rather than spread across the bench.
   *
   * The same circuit laid out as loose parts on a table, joined by wires a
   * hand-span long, photographs as a pile of components that happen to be near
   * each other. On a board it reads as a thing somebody made. Deck height is
   * the perfboard's top face, which is where a through-hole part seats.
   */
  const DECK = 1.75
  b.add('perfboard', [0, 0, 0], { cols: 28, rows: 20, mask: 'fr4-blue' }, [0, 0, 0], 'Perfboard')

  const ic = b.add('ne555', [2, DECK, -2], {}, [0, 0, 0], 'Timer')
  const r1 = b.add('resistor-axial', [-18, DECK, -14], { value: R1 }, [0, 90, 0], 'R1 charge')
  const r2 = b.add('resistor-axial', [-18, DECK, -2], { value: R2 }, [0, 90, 0], 'R2 discharge')
  const cap = b.add('capacitor-electrolytic', [-18, DECK, 12], { value: C, vmax: 25 }, [0, 0, 0], 'Timing cap')
  const rled = b.add('resistor-axial', [20, DECK, -14], { value: 470 }, [0, 90, 0], 'LED resistor')
  const led = b.add('led-5mm', [22, DECK, 4], { color: 'red' }, [0, 0, 0], 'Indicator')
  const jack = b.add('jack-barrel-dc', [-24, DECK, 14], { plugged: true }, [0, 0, 0], 'Power in')

  /*
   * The thing that plugs into the jack.
   *
   * A barrel jack is a connector, not a supply — its electrical model is the
   * switch contact and nothing else — so this circuit had no source in it at
   * all. It compiled, it solved, and every node sat at 0 V: press Run and the
   * lamp never lit, which is not an obvious symptom of a missing power supply.
   * Nine volts is what a 555 astable expects and what the barrel jack on a
   * bench like this would be fed.
   */
  const psu = b.add('bench-supply', [-132, 0, 30], { voltage: 9, ilimit: 1 }, [0, 0, 0], 'Supply')
  const gnd = b.add('ground', [-54, 0, 44], {}, [0, 0, 0], 'Ground')

  const RED = '#E34B4B'
  const BLACK = '#1C1F24'
  const YELLOW = '#E3A64B'
  const GREEN = '#3DD68C'

  b.wire([psu, 'p'], [jack, 'tip'], RED)
  b.wire([psu, 'n'], [jack, 'sleeve'], BLACK)
  b.wire([gnd, 'gnd'], [jack, 'sleeve'], GREEN)

  b.wire([jack, 'tip'], [ic, 'vcc'], RED)
  b.wire([jack, 'tip'], [ic, 'reset'], RED)
  b.wire([jack, 'sleeve'], [ic, 'gnd'], BLACK)

  // Charge through R1 into DISCH, then on through R2 to the timing cap.
  b.wire([jack, 'tip'], [r1, '1'], RED)
  b.wire([r1, '2'], [ic, 'disch'], YELLOW)
  b.wire([ic, 'disch'], [r2, '1'], YELLOW)
  b.wire([r2, '2'], [ic, 'thresh'], YELLOW)
  b.wire([ic, 'thresh'], [ic, 'trig'], '#A78BFA')
  b.wire([ic, 'thresh'], [cap, 'p'], YELLOW)
  b.wire([cap, 'n'], [jack, 'sleeve'], BLACK)

  // Output stage.
  b.wire([ic, 'out'], [rled, '1'], '#4C8DFF')
  b.wire([rled, '2'], [led, 'a'], '#4C8DFF')
  b.wire([led, 'c'], [jack, 'sleeve'], BLACK)

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
 * The same idea on four wires instead of eleven.
 *
 * Two of them are power and two are the bus. Nothing about the picture is
 * faked: the sketch clocks bytes out on A4 and A5 and the panel decodes them,
 * which is why it takes a moment to fill the first time.
 */
function oledText(): Doc {
  const b = new DocBuilder('Text on an OLED')
  const mcu = b.add('mcu-board', [0, 0, 40], { program: 'oled-clock', text1: 'DRAFTRIG' }, [0, 0, 0], 'Controller')
  const oled = b.add('display-oled', [6, 0, -34], { size: '128x64' }, [0, 0, 0], 'OLED')

  b.wire([mcu, 'v5'], [oled, 'vcc'], '#E34B4B')
  b.wire([mcu, 'gnd'], [oled, 'gnd'], '#1C1F24')
  b.wire([mcu, 'a4'], [oled, 'sda'], '#4C8DFF')
  b.wire([mcu, 'a5'], [oled, 'scl'], '#F2C14E')

  return b.doc
}


export interface Starter {
  id: string
  title: string
  blurb: string
  /**
   * Words somebody would type looking for this, beyond the ones already in
   * the title. Searching a list of eleven by title alone means knowing what
   * we decided to call it: "arduino" finds nothing, because the part is a
   * Microcontroller board and the preset is Microcontroller blink.
   */
  tags: string[]
  /** Electronics or fabrication. The two halves of the catalog, and of this. */
  kind: 'circuit' | 'build'
  build: () => Doc
}

/*
 * Order decides what the front page and the dashboard show first, so the
 * dense boards lead. The plywood decks and the bench supply are further down:
 * a sheet of wood and a grey box are the two things in the catalog that
 * photograph worst, and leading with them made the whole set look like the
 * back room of a hardware shop.
 *
 * Machines as well as circuits.
 *
 * These were held back for a while on the grounds that each is really a
 * demonstration of a motor and motion is not simulated. That was the wrong
 * call about what they are for: the editor lays out structure — extrusion,
 * rails, bearings, panels, fasteners — and a gantry is a layout problem
 * whether or not its axes move. Withholding them left the catalog looking
 * like it did circuits and nothing else.
 *
 * What is still true is that nothing here turns, so the blurbs say frame,
 * deck and assembly rather than anything about running. A starter is a
 * promise about what the editor does.
 */
export const STARTERS: Starter[] = [
  {
    id: 'eight-bit',
    title: 'Eight-bit machine',
    blurb: 'Four breadboards, a clock, six chained registers and thirty-two lamps',
    kind: 'circuit',
    tags: ['logic', '595', 'shift register', 'breadboard', 'computer', 'register', '555', 'clock', 'ttl', 'lamps', 'bus', 'dense'],
    build: eightBit,
  },
  {
    id: 'matrix',
    title: 'LED matrix',
    blurb: 'Thirty LEDs in five rows, chased from a microcontroller',
    kind: 'circuit',
    tags: ['led', 'matrix', 'display', 'arduino', 'chase', 'perfboard', 'rows', 'dense'],
    build: ledMatrix,
  },
  {
    id: 'scoreboard',
    title: 'Scoreboard',
    blurb: 'A 1602 panel, a contrast pot and the wiring it really needs',
    kind: 'circuit',
    tags: ['lcd', '1602', 'display', 'arduino', 'potentiometer', 'contrast', 'perfboard'],
    build: scoreboard,
  },
  {
    id: 'logic-bench',
    title: 'Shift register on a breadboard',
    blurb: 'Eight outputs from three pins, and a bar that climbs',
    kind: 'circuit',
    tags: ['breadboard', '595', 'shift register', 'logic', 'bargraph', 'nano', 'jumpers', 'digital'],
    build: logicBench,
  },
  {
    id: 'esp-weather',
    title: 'ESP32 sensor node',
    blurb: 'A 3.3 V board reading two sensors and driving a bar',
    kind: 'circuit',
    tags: ['esp32', 'esp', 'wifi', 'oled', 'i2c', 'sensor', 'temperature', 'humidity', 'gas', 'perfboard'],
    build: espWeather,
  },
  {
    id: 'rfid-lock',
    title: 'RFID door lock',
    blurb: 'A card reader, a keypad and the solenoid that moves the bolt',
    kind: 'build',
    tags: ['rfid', 'rc522', 'keypad', 'relay', 'solenoid', 'lock', 'door', 'access', 'spi', 'panel'],
    build: rfidLock,
  },
  {
    id: 'sound-bench',
    title: '555 audio oscillator',
    blurb: 'The same chip as the blinker, four decades faster, into a speaker',
    kind: 'circuit',
    tags: ['555', 'ne555', 'audio', 'tone', 'oscillator', 'speaker', 'breadboard', 'potentiometer', 'analogue'],
    build: soundBench,
  },
  {
    id: 'lab9-blinker',
    title: 'Blinking light, 555',
    blurb: 'The astable every lab sheet starts with: 1k, 10k, 100uF and a lamp',
    kind: 'circuit',
    tags: ['555', 'ne555', 'astable', 'blink', 'led', 'breadboard', 'lab', '9v', 'timer', 'oscillator'],
    build: lab9Blinker,
  },
  {
    id: 'lab10-buzzer',
    title: 'What the buzz, 555',
    blurb: 'The same chip four decades faster, into a speaker, pitch on a knob',
    kind: 'circuit',
    tags: ['555', 'ne555', 'astable', 'buzzer', 'speaker', 'tone', 'audio', 'potentiometer', 'breadboard', 'lab', '9v'],
    build: lab10Buzzer,
  },
  { id: 'led', title: 'LED on a breadboard', blurb: 'Supply, resistor and LED, see the current arrive', kind: 'circuit', tags: ["led","breadboard","resistor","ohms law","first","beginner","current"], build: ledCircuit },
  { id: 'blink555', title: '555 blinker', blurb: 'The classic astable, flashing at one hertz', kind: 'circuit', tags: ["555","ne555","timer","astable","oscillator","blink","flash","capacitor"], build: blinker555 },
  { id: 'mcu', title: 'Microcontroller blink', blurb: 'A board running a sketch, driving a real LED', kind: 'circuit', tags: ["arduino","uno","microcontroller","sketch","code","blink","firmware"], build: mcuBlink },
  { id: 'lcd', title: 'Text on an LCD', blurb: 'A board bit-banging a 16x2 panel over its real bus', kind: 'circuit', tags: ["lcd","1602","hd44780","display","text","arduino","screen","bus"], build: lcdText },
  { id: 'oled', title: 'OLED over I2C', blurb: 'Four wires, a decoded bus and a panel that fills in', kind: 'circuit', tags: ["oled","i2c","ssd1306","display","screen","arduino","bus"], build: oledText },
  {
    id: 'bench-clock',
    title: 'Bench clock, on perfboard',
    blurb: 'A finished board: display, clock, sensor, buttons and the parts you only find you need once you build it',
    kind: 'circuit',
    tags: ["clock","rtc","perfboard","sensor","buttons","alarm","project","finished"],
    build: benchClock,
  },
  { id: 'cnc-router', title: 'CNC router frame', blurb: 'Extrusion gantry, linear rails and leadscrews, laid out to size', kind: 'build', tags: ["cnc","router","gantry","extrusion","rail","leadscrew","stepper","frame","machine","2020"], build: cncRouter },
  { id: 'rover', title: 'Four-wheel rover', blurb: 'Deck, gearmotors, wheels and the electronics riding on top', kind: 'build', tags: ["rover","robot","wheels","chassis","motor","deck","drive","four wheel"], build: rover },
  { id: 'thrust-rig', title: 'Thrust test rig', blurb: 'A motor on a load cell, braced against a plywood deck', kind: 'build', tags: ["thrust","rig","test","load cell","brushless","motor","esc","bench","measurement"], build: thrustRig },
  { id: 'servo-arm', title: 'Servo arm', blurb: 'Two jointed links, brackets and horns, on a weighted base', kind: 'build', tags: ["servo","arm","joint","linkage","bracket","horn","robot","mechanism"], build: servoArm },
  { id: 'panel', title: 'Control panel', blurb: 'Everything a hand touches, on one aluminium face', kind: 'build', tags: ["panel","enclosure","switches","aluminium","front","controls","knobs"], build: controlPanel },
]
