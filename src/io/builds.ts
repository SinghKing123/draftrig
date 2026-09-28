import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import type { Instance, Params, Vec3 } from '@/parts/kernel/types'
import { defaultParams, requirePart } from '@/parts/kernel/registry'

/**
 * The larger builds.
 *
 * These are machines rather than circuits: a motion rig, a router, a rover, a
 * control panel. They exist to be opened and pulled apart, and they are also
 * what the site shows, so the pictures on the front page are photographs of
 * something the editor will actually hand you rather than renders made
 * somewhere else.
 *
 * Extrusion convention, because every one of these depends on it: a beam is
 * authored lying along X with its seating face at y = 0. Rotating [0, 90, 0]
 * lays it along Z. Standing one up is [0, 0, 90], which puts its origin at the
 * bottom of the post and needs half a profile of offset in X.
 */

class Builder {
  readonly doc: Doc = emptyDoc()
  private n = 0

  constructor(name: string) {
    this.doc.name = name
  }

  add(defId: string, pos: Vec3, params: Params = {}, rot: Vec3 = [0, 0, 0], name?: string): string {
    const def = requirePart(defId)
    const id = `b${this.n++}`
    const inst: Instance = {
      id,
      defId,
      name: name ?? def.name,
      params: { ...defaultParams(def), ...params },
      pos,
      rot,
    }
    this.doc.instances[id] = inst
    this.doc.order.push(id)
    return id
  }

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

  /** A beam lying along X, centred on `x`. */
  beamX(x: number, y: number, z: number, len: number, size = '2020', finish = 'alu-anod-black'): string {
    return this.add('extrusion-tslot', [x, y, z], { size, length: len, finish })
  }

  /** A beam lying along Z. */
  beamZ(x: number, y: number, z: number, len: number, size = '2020', finish = 'alu-anod-black'): string {
    return this.add('extrusion-tslot', [x, y, z], { size, length: len, finish }, [0, 90, 0])
  }

  /** A post standing up from `y`. `x` is the centre of the post. */
  post(x: number, y: number, z: number, len: number, size = '2020', finish = 'alu-anod-black'): string {
    const half = size === '4040' ? 20 : size === '2040' ? 10 : 10
    return this.add('extrusion-tslot', [x + half, y + len / 2, z], { size, length: len, finish }, [0, 0, 90])
  }
}

const BLACK = '#1C1F24'
const RED = '#E34B4B'
const BLUE = '#4C8DFF'
const GREEN = '#3DD68C'
const YELLOW = '#F2C14E'


/* ================================================================== */
/* CNC router                                                          */
/* ================================================================== */

/** A three-axis router: fixed bed, moving gantry, screw on Z. */
export function cncRouter(): Doc {
  const b = new Builder('CNC router')
  const W = 520
  const D = 460
  const H = 420

  // Base rectangle and four posts.
  b.beamX(0, 0, -D / 2 + 10, W)
  b.beamX(0, 0, D / 2 - 10, W)
  b.beamZ(-W / 2 + 10, 0, 0, D - 40)
  b.beamZ(W / 2 - 10, 0, 0, D - 40)
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) b.post(sx * (W / 2 - 10) - 10, 20, sz * (D / 2 - 10), H)
  }
  // Top rails, so it is a box rather than a table.
  b.beamX(0, H + 20, -D / 2 + 10, W)
  b.beamX(0, H + 20, D / 2 - 10, W)

  // Bed.
  b.add('panel-sheet', [0, 40, 0], { material: 'mdf', width: W - 60, depth: D - 60, thickness: 18 }, [0, 0, 0], 'Spoilboard')

  /* --- Y axis: a rail on each long base rail, carrying the gantry. */
  for (const sx of [-1, 1] as const) {
    b.add('rail-linear', [sx * (W / 2 - 10), 20, 0], { size: 'MGN12', length: 400, carriage: 58 }, [0, 90, 0], 'Y rail')
  }
  b.add('motor-stepper', [-W / 2 - 20, 22, D / 2 - 40], { model: '17-48', shaftLen: 22 }, [0, 90, 0], 'Y motor')
  b.add('leadscrew-t8', [-W / 2 + 10, 44, 20], { length: 380, lead: 8, nut: true, nutAt: 58 }, [0, 90, 0], 'Y screw')

  /* --- Gantry: two uprights and a beam, with the X rail on its face. */
  const gz = 40
  for (const sx of [-1, 1] as const) b.post(sx * (W / 2 - 10) - 10, 32, gz, 260)
  b.beamX(0, 292, gz, W - 40)
  b.add('rail-linear', [0, 312, gz - 22], { size: 'MGN12', length: 420, carriage: 62 }, [0, 0, 0], 'X rail')
  b.add('motor-stepper', [W / 2 - 40, 302, gz - 60], { model: '17-48', shaftLen: 22 }, [0, 0, 0], 'X motor')
  b.add('belt-gt2', [0, 286, gz - 40], { length: 420, width: 6, form: 'open' }, [0, 0, 0], 'X belt')
  b.add('pulley-gt2', [W / 2 - 80, 296, gz - 40], { teeth: 20, bore: 5 }, [0, 0, 0], 'X pulley')

  /* --- Z axis on the X carriage: screw, motor and the spindle. */
  const zx = 40
  b.add('panel-sheet', [zx, 250, gz - 46], { material: 'alu-5052', width: 90, depth: 130, thickness: 6, corner: 6 }, [90, 0, 0], 'Z plate')
  b.add('motor-stepper', [zx - 24, 356, gz - 70], { model: '17-40', shaftLen: 20 }, [0, 0, -90], 'Z motor')
  b.add('shaft-coupler', [zx, 322, gz - 70], { boreA: 5, boreB: 8, style: 'flexible' }, [0, 0, 90], 'Z coupler')
  b.add('leadscrew-t8', [zx, 170, gz - 70], { length: 180, lead: 8, nut: true, nutAt: 60 }, [0, 0, 90], 'Z screw')
  b.add('rail-linear', [zx - 40, 160, gz - 70], { size: 'MGN9', length: 180, carriage: 60 }, [0, 0, 90], 'Z rail')
  b.add('motor-dc', [zx, 150, gz - 110], { vnom: 24, rpm: 12000, rwind: 1.2, shaft: 6 }, [0, 0, 90], 'Spindle')

  /* --- Electronics, on the right-hand side. */
  const enc = b.add('panel-sheet', [W / 2 + 96, 0, 60], { material: 'alu-5052', width: 190, depth: 240, thickness: 3, corner: 6 }, [90, 0, 0], 'Control box')
  const mcu = b.add('mcu-board', [W / 2 + 90, 20, -60], { program: 'off' }, [0, 0, 0], 'Controller')
  void enc
  const dx = b.add('stepper-driver', [W / 2 + 95, 32, 60], { heatsink: true }, [0, 0, 0], 'X driver')
  const dy = b.add('stepper-driver', [W / 2 + 95, 32, 100], { heatsink: true }, [0, 0, 0], 'Y driver')
  const dz = b.add('stepper-driver', [W / 2 + 95, 32, 140], { heatsink: true }, [0, 0, 0], 'Z driver')
  const lcd = b.add('display-lcd-character', [W / 2 + 96, 150, 130], { format: '2004' }, [-90, 0, 0], 'Panel')
  const psu = b.add('bench-supply', [W / 2 + 120, 0, -200], { voltage: 24, ilimit: 6 }, [0, 0, 0], 'Supply')

  for (const [d, step, dir] of [[dx, 'd2', 'd3'], [dy, 'd4', 'd5'], [dz, 'd6', 'd7']] as const) {
    b.wire([psu, 'p'], [d, 'vmot'], RED, 0.52)
    b.wire([psu, 'n'], [d, 'gndm'], BLACK, 0.52)
    b.wire([mcu, 'v5'], [d, 'vdd'], RED)
    b.wire([mcu, 'gnd'], [d, 'gnd'], BLACK)
    b.wire([mcu, step], [d, 'step'], BLUE)
    b.wire([mcu, dir], [d, 'dir'], GREEN)
  }
  b.wire([mcu, 'v5'], [lcd, 'vdd'], RED)
  b.wire([mcu, 'gnd2'], [lcd, 'vss'], BLACK)
  b.wire([mcu, 'd12'], [lcd, 'rs'], YELLOW)
  b.wire([mcu, 'd11'], [lcd, 'e'], YELLOW)

  return b.doc
}

/* ================================================================== */
/* Rover                                                               */
/* ================================================================== */

/** Four driven wheels, a sensor at the front and a battery under the deck. */
export function rover(): Doc {
  const b = new Builder('Four-wheel rover')
  const W = 230
  const D = 170
  const deckY = 42

  const deck = b.add('panel-sheet', [0, deckY, 0], { material: 'acrylic-clear', width: W, depth: D, thickness: 4, corner: 12, holes: true, holeDia: 3.4, inset: 12 }, [0, 0, 0], 'Deck')
  void deck

  // Four motors hanging off the deck edges, each with a wheel on it.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.add('motor-dc', [sx * (W / 2 - 6), 22, sz * (D / 2 - 18)], { vnom: 6, rpm: 220, rwind: 6, shaft: 5 }, [0, 0, sx > 0 ? 90 : -90], 'Gearmotor')
      b.add('wheel', [sx * (W / 2 + 34), 0, sz * (D / 2 - 18)], { diameter: 65, width: 26, bore: 5, hub: 'd-shaft' }, [0, 0, 90], 'Wheel')
    }
  }

  // Electronics on top.
  const mcu = b.add('mcu-board', [-22, deckY + 4, 4], { program: 'off' }, [0, 90, 0], 'Controller')
  const drv = b.add('motor-driver', [58, deckY + 4, -34], {}, [0, 0, 0], 'Motor driver')
  const batt = b.add('battery-holder', [0, 0, 0], { cell: '18650', count: 2 }, [0, 90, 0], 'Battery')
  const sonar = b.add('sensor-ultrasonic', [0, deckY + 4, -D / 2 - 4], {}, [-90, 0, 0], 'Range finder')
  const oled = b.add('display-oled', [52, deckY + 4, 46], { size: '128x64' }, [0, 0, 0], 'Display')

  b.wire([batt, 'p'], [drv, 'vm'], RED, 0.52)
  b.wire([batt, 'n'], [drv, 'gnd'], BLACK, 0.52)
  b.wire([mcu, 'v5'], [drv, 'vcc'], RED)
  b.wire([mcu, 'v5'], [oled, 'vcc'], RED)
  b.wire([mcu, 'gnd'], [oled, 'gnd'], BLACK)
  b.wire([mcu, 'a4'], [oled, 'sda'], BLUE)
  b.wire([mcu, 'a5'], [oled, 'scl'], YELLOW)
  b.wire([mcu, 'v5'], [sonar, 'vcc'], RED)
  b.wire([mcu, 'gnd2'], [sonar, 'gnd'], BLACK)
  b.wire([mcu, 'd9'], [sonar, 'trig'], GREEN)
  b.wire([mcu, 'd10'], [sonar, 'echo'], GREEN)
  b.wire([mcu, 'd5'], [drv, 'in1'], BLUE)
  b.wire([mcu, 'd6'], [drv, 'in2'], BLUE)

  return b.doc
}

/* ================================================================== */
/* Control panel                                                       */
/* ================================================================== */

/** A front panel with everything a human touches on it. */
export function controlPanel(): Doc {
  const b = new Builder('Control panel')
  const W = 320
  const H = 220

  // The panel itself, standing up, on two feet.
  b.add('panel-sheet', [0, H / 2 + 20, 0], { material: 'abs-black', width: W, depth: H, thickness: 4, corner: 8 }, [90, 0, 0], 'Front panel')
  for (const sx of [-1, 1] as const) {
    b.add('extrusion-tslot', [sx * (W / 2 - 20), 0, -30], { size: '2020', length: 90, finish: 'alu-anod-black' }, [0, 90, 0], 'Foot')
  }

  // Everything stands proud of the +z face. Mounting them on the far side and
  // photographing from behind mirrors every legend on them, which is how the
  // keypad ended up counting backwards.
  const z = 4
  const lcd = b.add('display-lcd-character', [-58, 178, z], { format: '2004', mask: 'fr4-black' }, [90, 0, 0], 'Readout')
  const keypad = b.add('keypad-matrix', [86, 120, z], { layout: '4x3' }, [90, 0, 0], 'Keypad')
  const enc = b.add('encoder-rotary', [-118, 96, z], { knob: true, knobColor: '#1A1D22' }, [90, 0, 0], 'Set')
  const bar = b.add('led-bargraph', [-50, 96, z], { color: 'tricolor', segments: 10 }, [90, 0, 0], 'Level')
  const rocker = b.add('switch-rocker', [-118, 48, z], {}, [90, 0, 0], 'Power')
  const buzz = b.add('buzzer-piezo', [-50, 48, z], {}, [90, 0, 0], 'Alarm')
  const posts = ([['red', -12], ['black', 14], ['green', 40]] as const).map(([color, x]) =>
    b.add('binding-post', [x, 48, z], { color, panel: 4 }, [90, 0, 0], 'Terminal'),
  )
  void posts

  // The controller behind the panel.
  const mcu = b.add('mcu-board', [-40, 4, -95], { program: 'lcd-clock', text1: 'DRAFTRIG' }, [0, 0, 0], 'Controller')

  b.wire([mcu, 'v5'], [lcd, 'vdd'], RED)
  b.wire([mcu, 'gnd'], [lcd, 'vss'], BLACK)
  b.wire([mcu, 'v5'], [lcd, 'a'], RED)
  b.wire([mcu, 'gnd2'], [lcd, 'k'], BLACK)
  b.wire([mcu, 'gnd3'], [lcd, 'rw'], BLACK)
  b.wire([mcu, 'd12'], [lcd, 'rs'], GREEN)
  b.wire([mcu, 'd11'], [lcd, 'e'], GREEN)
  b.wire([mcu, 'd5'], [lcd, 'd4'], BLUE)
  b.wire([mcu, 'd4'], [lcd, 'd5'], BLUE)
  b.wire([mcu, 'd3'], [lcd, 'd6'], BLUE)
  b.wire([mcu, 'd2'], [lcd, 'd7'], BLUE)
  b.wire([mcu, 'a0'], [enc, 'a'], YELLOW)
  b.wire([mcu, 'a1'], [enc, 'b'], YELLOW)
  b.wire([mcu, 'd6'], [buzz, 'p'], RED)
  b.wire([mcu, 'd7'], [keypad, 'r1'], GREEN)
  b.wire([mcu, 'd8'], [keypad, 'c1'], GREEN)
  b.wire([mcu, 'd9'], [bar, 'a1'], RED)
  b.wire([mcu, 'd10'], [rocker, 'a'], BLACK)

  return b.doc
}

/* ================================================================== */
/* Bench clock, on perfboard                                           */
/* ================================================================== */

/**
 * A finished circuit rather than a demonstration of one.
 *
 * Every other electronics example is three parts proving one idea. This is the
 * thing those ideas turn into: a board with a job, soldered onto perfboard,
 * with the parts you only find out you need once you build it for real — the
 * trimmer that makes the display legible, the pull-ups on the buttons, the
 * bulk capacitor next to the jack, the resistor in series with the backlight.
 *
 * Laid out the way it would be laid out on the bench. The display faces you at
 * the front edge, the board sits behind it where the wiring is short, the two
 * buttons are where a thumb reaches, and the clock and the sensor sit off to
 * the side on the bus that feeds them.
 */
export function benchClock(): Doc {
  const b = new Builder('Bench clock and thermometer')

  // Perfboard top surface, which is where every through-hole part seats.
  const DECK = 1.75

  /*
   * Placed against real footprints, not by eye. The board is 73 mm across its
   * own outline and the display is 80, so a layout that looks roomy in the
   * abstract puts the power jack underneath the microcontroller. Three bands,
   * back to front: the board and the bus parts at the back, the things a hand
   * touches through the middle, the display along the front edge.
   */
  b.add('perfboard', [0, 0, 0], { cols: 52, rows: 50, mask: 'fr4-blue', layout: 'pads' }, [0, 0, 0], 'Perfboard')

  const mcu = b.add('mcu-board', [-24, DECK, -36], {
    program: 'lcd-clock',
    text1: 'DRAFTRIG',
    text2: '22.4C   45%',
  }, [0, 0, 0], 'Controller')

  const lcd = b.add('display-lcd-character', [0, DECK, 46], { format: '1602', mask: 'fr4-blue' }, [0, 0, 0], 'Display')

  const rtc = b.add('rtc-ds3231', [45, DECK, -46], { battery: true }, [0, 0, 0], 'Real time clock')
  const dht = b.add('sensor-dht', [52, DECK, -12], { model: 'dht22', tempC: 22.4, humidity: 45 }, [0, 0, 0], 'Temperature')
  const decoup = b.add('capacitor-ceramic', [30, DECK, -16], { value: 1e-7 }, [0, 0, 0], 'Decoupling')

  const pot = b.add('trimpot', [-52, DECK, 6], { value: 10000, position: 62 }, [0, 0, 0], 'Contrast')
  const setBtn = b.add('pushbutton-tactile', [-32, DECK, 10], { capColor: '#2F6FE0' }, [0, 0, 0], 'Set')
  const modeBtn = b.add('pushbutton-tactile', [-18, DECK, 10], { capColor: '#E8EBEF' }, [0, 0, 0], 'Mode')
  const pullSet = b.add('resistor-axial', [-32, DECK, -2], { value: 10000 }, [0, 90, 0], 'Pull-up, set')
  const pullMode = b.add('resistor-axial', [-18, DECK, -2], { value: 10000 }, [0, 90, 0], 'Pull-up, mode')

  const led = b.add('led-5mm', [2, DECK, 10], { color: 'green' }, [0, 0, 0], 'Heartbeat')
  const ledR = b.add('resistor-axial', [2, DECK, -2], { value: 330 }, [0, 90, 0], 'LED resistor')
  const blR = b.add('resistor-axial', [18, DECK, -2], { value: 100 }, [0, 90, 0], 'Backlight resistor')
  const buzz = b.add('buzzer-piezo', [34, DECK, 8], { vnom: 5 }, [0, 0, 0], 'Alarm')

  const jack = b.add('jack-barrel-dc', [-58, DECK, 22], { polarity: 'centre-positive', plugged: true }, [0, 0, 0], 'Power in')
  const bulk = b.add('capacitor-electrolytic', [-44, DECK, 22], { value: 1e-4, vmax: 25 }, [0, 0, 0], 'Bulk')

  /* --- power ------------------------------------------------------- */

  b.wire([jack, 'tip'], [mcu, 'vin'], RED)
  b.wire([jack, 'sleeve'], [mcu, 'gnd'], BLACK)
  b.wire([jack, 'tip'], [bulk, 'p'], RED)
  b.wire([jack, 'sleeve'], [bulk, 'n'], BLACK)

  // One 5 V rail and one return, fanned out to everything that needs them.
  b.wire([mcu, 'v5'], [lcd, 'vdd'], RED)
  b.wire([mcu, 'gnd2'], [lcd, 'vss'], BLACK)
  b.wire([mcu, 'v5'], [rtc, 'vcc'], RED)
  b.wire([mcu, 'gnd3'], [rtc, 'gnd'], BLACK)
  b.wire([mcu, 'v5'], [dht, 'vcc'], RED)
  b.wire([mcu, 'gnd2'], [dht, 'gnd'], BLACK)
  b.wire([mcu, 'v5'], [decoup, '1'], RED)
  b.wire([mcu, 'gnd3'], [decoup, '2'], BLACK)

  /* --- display ----------------------------------------------------- */

  // Contrast: the trimmer is a divider across the rail and its wiper drives
  // V0. Leave this out and the panel is either blank or a row of black boxes,
  // which is the single most common reason a first LCD build looks dead.
  b.wire([mcu, 'v5'], [pot, 'a'], RED)
  b.wire([mcu, 'gnd2'], [pot, 'b'], BLACK)
  b.wire([pot, 'w'], [lcd, 'v0'], YELLOW)

  // Backlight through a series resistor, not straight onto the rail.
  b.wire([mcu, 'v5'], [blR, '1'], RED)
  b.wire([blR, '2'], [lcd, 'a'], RED)
  b.wire([lcd, 'k'], [mcu, 'gnd3'], BLACK)

  // R/W tied low: this sketch writes and never reads back.
  b.wire([mcu, 'gnd2'], [lcd, 'rw'], BLACK)
  b.wire([mcu, 'd12'], [lcd, 'rs'], GREEN)
  b.wire([mcu, 'd11'], [lcd, 'e'], GREEN)
  b.wire([mcu, 'd5'], [lcd, 'd4'], BLUE)
  b.wire([mcu, 'd4'], [lcd, 'd5'], BLUE)
  b.wire([mcu, 'd3'], [lcd, 'd6'], BLUE)
  b.wire([mcu, 'd2'], [lcd, 'd7'], BLUE)

  /* --- bus and inputs ---------------------------------------------- */

  b.wire([mcu, 'sda'], [rtc, 'sda'], YELLOW)
  b.wire([mcu, 'scl'], [rtc, 'scl'], YELLOW)
  b.wire([mcu, 'd7'], [dht, 'data'], YELLOW)

  // Buttons to ground, with a pull-up each so the pin has a level when the
  // button is open rather than floating and reading as noise.
  b.wire([mcu, 'd8'], [setBtn, 'a1'], GREEN)
  b.wire([setBtn, 'b1'], [mcu, 'gnd3'], BLACK)
  b.wire([mcu, 'v5'], [pullSet, '1'], RED)
  b.wire([pullSet, '2'], [mcu, 'd8'], GREEN)

  b.wire([mcu, 'd9'], [modeBtn, 'a1'], GREEN)
  b.wire([modeBtn, 'b1'], [mcu, 'gnd2'], BLACK)
  b.wire([mcu, 'v5'], [pullMode, '1'], RED)
  b.wire([pullMode, '2'], [mcu, 'd9'], GREEN)

  /* --- outputs ------------------------------------------------------ */

  b.wire([mcu, 'd13'], [ledR, '1'], GREEN)
  b.wire([ledR, '2'], [led, 'a'], GREEN)
  b.wire([led, 'c'], [mcu, 'gnd3'], BLACK)

  b.wire([mcu, 'd10'], [buzz, 'p'], GREEN)
  b.wire([buzz, 'n'], [mcu, 'gnd2'], BLACK)

  return b.doc
}
