import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import type { Instance, Params, Vec3 } from '@/parts/kernel/types'
import { defaultParams, requirePart } from '@/parts/kernel/registry'
import { espGroundId, espRailIds } from '@/parts/catalog/esp'

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
  b.add('leadscrew-t8', [-W / 2 + 10, 44, 20], { length: 380, lead: '8', nut: true, nutAt: 58 }, [0, 90, 0], 'Y screw')

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
  b.add('leadscrew-t8', [zx, 170, gz - 70], { length: 180, lead: '8', nut: true, nutAt: 60 }, [0, 0, 90], 'Z screw')
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

/* ================================================================== */
/* LED matrix                                                          */
/* ================================================================== */

/**
 * Thirty LEDs on perfboard, driven in rows by a microcontroller.
 *
 * The densest thing in the catalog and the one that photographs best: six by
 * five on a three-hole pitch, each row's anodes chained and taken through a
 * resistor to a pin, each row's cathodes chained and returned to ground.
 * Sixty-five wires, which is why it is written rather than placed by hand.
 */
export function ledMatrix(): Doc {
  const b = new Builder('LED matrix')
  const P = 2.54
  const COLS = 6
  const ROWS = 5
  const DX = P * 3
  const DZ = P * 3
  const DECK = 1.75

  b.add('perfboard', [0, 0, 0], { cols: 24, rows: 18, mask: 'fr4-blue', layout: 'pads' }, [0, 0, 0], 'Perfboard')

  /* Behind the display rather than beside it: side by side the pair is 150 mm
     wide and neither reads. Turned around so the digital header faces the
     matrix, or every wire has to go the long way round the outside. */
  const mcu = b.add(
    'mcu-board',
    [0, 0, -64],
    { program: 'chase', interval: 0.05, mask: 'fr4-blue' },
    [0, 180, 0],
    'Controller',
  )

  const x0 = -((COLS - 1) / 2) * DX
  const z0 = -((ROWS - 1) / 2) * DZ
  const led: string[][] = []
  for (let r = 0; r < ROWS; r++) {
    led[r] = []
    for (let c = 0; c < COLS; c++) {
      /* Turned a quarter so the leads run across the strips rather than along
         one: dropped in unturned, both legs land in the same row of holes. */
      led[r][c] = b.add(
        'led-5mm',
        [x0 + c * DX, DECK, z0 + r * DZ],
        { color: 'red', diffused: true },
        [0, 90, 0],
        `LED ${r + 1}-${c + 1}`,
      )
    }
  }

  // One resistor per row, inboard of the edge: a 10.16 mm lead pitch needs
  // 5 mm of board either side of where it sits.
  const res: string[] = []
  for (let r = 0; r < ROWS; r++) {
    res[r] = b.add('resistor-axial', [26, DECK, z0 + r * DZ], { value: 150, watt: '0.25' }, [0, 0, 0], `R${r + 1}`)
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      b.wire([led[r][c], 'a'], [led[r][c + 1], 'a'], RED)
      b.wire([led[r][c], 'c'], [led[r][c + 1], 'c'], BLACK)
    }
    b.wire([led[r][COLS - 1], 'a'], [res[r], '1'], RED)
    b.wire([res[r], '2'], [mcu, `d${r + 2}`], BLUE)
    b.wire([led[r][0], 'c'], [mcu, 'gnd'], BLACK)
  }

  return b.doc
}

/* ================================================================== */
/* Scoreboard                                                          */
/* ================================================================== */

/**
 * A character panel, a contrast pot and a board to drive them.
 *
 * The wiring a 1602 actually needs, which is more than people expect: power,
 * a backlight, R/W tied down, a divider on V0 and four data lines. The pot
 * really sets the contrast — the module reads that pin — so turning it down
 * blanks the screen exactly as it does on a bench.
 */
export function scoreboard(): Doc {
  const b = new Builder('Scoreboard')
  const DECK = 1.75
  const AMBER = '#E8A33D'

  b.add('perfboard', [0, 0, 0], { cols: 40, rows: 26, mask: 'fr4-blue', layout: 'pads' }, [0, 0, 0], 'Perfboard')

  const lcd = b.add(
    'display-lcd-character',
    [-6, DECK, 8],
    { format: '1602', mask: 'fr4-blue', contrastSource: 'pin' },
    [0, 0, 0],
    'Character LCD',
  )

  /* Beside pins 1 to 3, not across the glass. The header is at the back left
     of the module, so a pot on the right has to run its three wires over the
     face of the panel to reach it. */
  const pot = b.add(
    'potentiometer',
    [-56, DECK, -6],
    { value: 10000, taper: 'lin', pos: 8, knob: true },
    [0, 0, 0],
    'Contrast',
  )

  const mcu = b.add(
    'mcu-board',
    [0, 0, -56],
    { program: 'lcd-text', text1: 'DRAFTRIG', text2: 'Scoreboard', mask: 'fr4-blue' },
    [0, 180, 0],
    'Controller',
  )

  b.wire([mcu, 'v5'], [lcd, 'vdd'], RED)
  b.wire([mcu, 'gnd'], [lcd, 'vss'], BLACK)
  b.wire([mcu, 'v5'], [lcd, 'a'], RED)
  b.wire([mcu, 'gnd2'], [lcd, 'k'], BLACK)
  // R/W to ground: this module is only ever written to.
  b.wire([mcu, 'gnd3'], [lcd, 'rw'], BLACK)

  // The contrast divider, taken off the module's own supply pins.
  b.wire([lcd, 'vdd'], [pot, 'b'], RED)
  b.wire([lcd, 'vss'], [pot, 'a'], BLACK)
  b.wire([pot, 'w'], [lcd, 'v0'], AMBER)

  b.wire([mcu, 'd12'], [lcd, 'rs'], GREEN)
  b.wire([mcu, 'd11'], [lcd, 'e'], GREEN)
  b.wire([mcu, 'd5'], [lcd, 'd4'], BLUE)
  b.wire([mcu, 'd4'], [lcd, 'd5'], BLUE)
  b.wire([mcu, 'd3'], [lcd, 'd6'], BLUE)
  b.wire([mcu, 'd2'], [lcd, 'd7'], BLUE)

  return b.doc
}

/* ================================================================== */
/* Shift register on a breadboard                                      */
/* ================================================================== */

/**
 * A 595 driving a bargraph, on a breadboard.
 *
 * Here because everything else in the set is a finished board, and a
 * breadboard with jumpers across it is what most of this actually looks like
 * on the way there. The register is solved rather than drawn: the board
 * clocks it, the outputs move, and the bar climbs.
 *
 * Breadboard coordinates are `a<col>_<row>` and `b<col>_<row>` — `a` is the
 * near bank, `b` the far one, five holes to a strip — with the power rails as
 * `pos-near-<n>` and friends.
 */
export function logicBench(): Doc {
  const b = new Builder('Shift register on a breadboard')

  const bb = b.add('breadboard', [0, 0, 0], {}, [0, 0, 0], 'Breadboard')

  /* The nano straddles the channel, which is the one thing a board this shape
     is made to do, so it goes across the gap rather than beside it. */
  const nano = b.add('arduino-nano', [-52, 9, 0], { program: 'chase', interval: 0.12 }, [0, 90, 0], 'Nano')

  const reg = b.add('shift-register-595', [6, 9, 0], {}, [0, 90, 0], 'Shift register')
  const bar = b.add('led-bargraph', [44, 9, -8], { color: 'red' }, [0, 0, 0], 'Bargraph')

  // One resistor per segment, because a bargraph is ten bare LEDs in a block.
  const res: string[] = []
  for (let i = 0; i < 8; i++) {
    res.push(b.add('resistor-axial', [28, 9, -8.9 + i * 2.54], { value: 330, watt: '0.25' }, [0, 0, 0], `R${i + 1}`))
  }

  /* The supply goes to the rails and everything else comes off them, each
     from the hole beside it. A rail is one node, so the index is free to
     choose — but choosing the far end of the board sends the jumper back
     across everything in between, which is how two of these first shipped
     passing straight through a part. */
  b.wire([nano, 'v5'], [bb, 'pos-near-7'], RED)
  b.wire([nano, 'gnd'], [bb, 'neg-near-7'], BLACK)
  b.wire([bb, 'pos-near-26'], [reg, 'vcc'], RED, 0.16)
  b.wire([bb, 'neg-far-26'], [reg, 'gnd'], BLACK, 0.16)
  b.wire([bb, 'pos-near-27'], [reg, 'mr'], RED, 0.16)
  b.wire([bb, 'neg-far-27'], [reg, 'oe'], BLACK, 0.16)

  // The three lines that actually drive it.
  b.wire([nano, 'd11'], [reg, 'ds'], BLUE, 0.16)
  b.wire([nano, 'd13'], [reg, 'shcp'], GREEN, 0.16)
  b.wire([nano, 'd10'], [reg, 'stcp'], YELLOW, 0.16)

  const q = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']
  for (let i = 0; i < 8; i++) {
    b.wire([reg, q[i]], [res[i], '1'], BLUE, 0.16)
    b.wire([res[i], '2'], [bar, `a${i + 1}`], RED, 0.16)
    b.wire([bar, `c${i + 1}`], [bb, `neg-far-${34 + i}`], BLACK, 0.16)
  }

  return b.doc
}

/* ================================================================== */
/* 555 audio oscillator                                                */
/* ================================================================== */

/**
 * A 555 astable into a speaker, with the pitch on a knob.
 *
 * The same chip as the blinker preset running four decades faster, which is
 * why both are here: one flashes an LED and one makes a tone, and the only
 * difference between them is the timing network. That network is solved, so
 * turning the pot really does move the frequency.
 */
export function soundBench(): Doc {
  const b = new Builder('555 audio oscillator')

  const bb = b.add('breadboard', [0, 0, 0], {}, [0, 0, 0], 'Breadboard')
  const ic = b.add('ne555', [-14, 9, 0], {}, [0, 90, 0], 'NE555')

  /* The pot sits in the field on the near side, not out at z = -24: that is
     past the far rail, so every jumper reaching that rail had to climb over
     the knob to get there. */
  const pot = b.add('potentiometer', [-50, 9, 10], { value: 100000 }, [0, 0, 0], 'Pitch')
  const r1 = b.add('resistor-axial', [-30, 9, -10], { value: 1000, watt: '0.25' }, [0, 0, 0], 'R1')
  const ct = b.add('capacitor-ceramic', [-2, 9, -12], { value: 1e-8 }, [0, 0, 0], 'Timing cap')
  const cc = b.add('capacitor-ceramic', [10, 9, -12], { value: 1e-8 }, [0, 0, 0], 'Control cap')
  const co = b.add('capacitor-electrolytic', [26, 9, 10], { value: 1e-5, vmax: 16 }, [0, 0, 0], 'Output cap')

  const spk = b.add('speaker-cone', [78, 0, 0], { diameter: 66, power: 3 }, [0, 0, 0], 'Speaker')
  const bat = b.add('battery-holder', [-10, 0, 66], { cell: '18650', count: 2 }, [0, 0, 0], 'Cells')

  // Supply onto the rails, chip across them.
  b.wire([bat, 'p'], [bb, 'pos-near-21'], RED)
  b.wire([bat, 'n'], [bb, 'neg-near-21'], BLACK)
  b.wire([bb, 'pos-near-20'], [ic, 'vcc'], RED, 0.16)
  b.wire([bb, 'neg-far-20'], [ic, 'gnd'], BLACK, 0.16)
  b.wire([bb, 'pos-near-22'], [ic, 'reset'], RED, 0.16)

  /* The astable proper: the pot and R1 charge the cap, the chip discharges
     it, and trigger tied to threshold is what makes it run on its own. */
  b.wire([bb, 'pos-near-8'], [pot, 'a'], RED, 0.16)
  b.wire([pot, 'w'], [ic, 'disch'], YELLOW, 0.16)
  b.wire([ic, 'disch'], [r1, '1'], YELLOW, 0.16)
  b.wire([r1, '2'], [ic, 'thresh'], GREEN, 0.16)
  b.wire([ic, 'thresh'], [ic, 'trig'], GREEN, 0.16)
  b.wire([ic, 'trig'], [ct, '1'], GREEN, 0.16)
  b.wire([ct, '2'], [bb, 'neg-far-23'], BLACK, 0.16)
  b.wire([ic, 'ctrl'], [cc, '1'], BLUE, 0.16)
  b.wire([cc, '2'], [bb, 'neg-far-27'], BLACK, 0.16)

  // Out through a coupling cap, so the cone sees no standing current.
  b.wire([ic, 'out'], [co, 'p'], BLUE, 0.16)
  b.wire([co, 'n'], [spk, 'p'], RED)
  b.wire([spk, 'n'], [bb, 'neg-far-48'], BLACK)

  return b.doc
}

/* ================================================================== */
/* ESP32 weather station                                               */
/* ================================================================== */

/**
 * An ESP32, a screen and two sensors on perfboard.
 *
 * A 3.3 V board rather than another Uno, because the set already had four of
 * those and because the ESP is what people reach for the moment a project
 * wants to be on a network. The panel runs over I2C, decoded, so what is on
 * the screen is what the sketch put there.
 */
export function espWeather(): Doc {
  const b = new Builder('ESP32 sensor node')

  // Green, because the devkit is black and vanished against a black board.
  b.add('perfboard', [0, 0, 0], { cols: 42, rows: 30, mask: 'fr4-green', layout: 'pads' }, [0, 0, 0], 'Perfboard')

  /*
   * The bar is driven by the sketch, not decorated.
   *
   * An OLED would have been the obvious readout and is the one thing this
   * board cannot do here: the panel decodes real I2C traffic off its two
   * pins, and bit-banging an SSD1306 through its init is a page of sketch
   * rather than a build. Six GPIOs and a bargraph say the same thing, and
   * every segment is lit by the solver reading the gas sensor.
   */
  const BARS = [25, 26, 27, 14, 12, 13]

  const esp = b.add(
    'esp-board',
    [-34, 1.75, 2],
    {
      board: 'devkitc-38',
      program: 'custom',
      code: `// Reads the gas sensor and shows it on the bar.
const BARS = [${BARS.join(', ')}]

function setup() {
  for (const p of BARS) pinMode(p, OUTPUT)
}

function* loop() {
  const raw = analogRead(34)
  const lit = Math.round((raw / 1023) * BARS.length)
  for (let i = 0; i < BARS.length; i++) {
    digitalWrite(BARS[i], i < lit ? HIGH : LOW)
  }
  yield delay(120)
}`,
    },
    [0, 0, 0],
    'ESP32',
  )

  const bar = b.add('led-bargraph', [40, 1.75, -26], { color: 'red', segments: 10 }, [0, 0, 0], 'Level')
  const dht = b.add('sensor-dht', [40, 1.75, 24], {}, [0, 0, 0], 'Temp and humidity')
  // Seventy per cent, so four of the six segments are lit in the picture; at
  // the default of forty it reads two and looks like a bar that is not working.
  const gas = b.add('sensor-gas-mq2', [-2, 1.75, -30], { reading: 70 }, [0, 0, 0], 'Gas')

  /* Asked for rather than written down.
     A port id on these boards is side plus index plus label, so it moves when
     the board does: the DevKitC calls its 3.3 V pin something a NodeMCU does
     not. Hard-coding one is how this build first shipped with three wires
     attached to a pin that did not exist, which is silent — the rail simply
     reads zero. */
  const espParams = b.doc.instances[esp].params
  const V33 = espRailIds(espParams).v33[0]
  const GND = espGroundId(espParams)

  // The two sensors, each on its own pin.
  b.wire([esp, V33], [dht, 'vcc'], RED, 0.16)
  b.wire([esp, GND], [dht, 'gnd'], BLACK, 0.16)
  b.wire([esp, 'io15'], [dht, 'data'], BLUE, 0.16)

  b.wire([esp, V33], [gas, 'vcc'], RED, 0.16)
  b.wire([esp, GND], [gas, 'gnd'], BLACK, 0.16)
  b.wire([esp, 'io34'], [gas, 'out'], GREEN, 0.16)

  // Six outputs, each through its own resistor into a segment.
  for (let i = 0; i < BARS.length; i++) {
    const r = b.add(
      'resistor-axial',
      [16, 1.75, -29 + i * 2.54],
      { value: 220, watt: '0.25' },
      [0, 0, 0],
      `R${i + 1}`,
    )
    b.wire([esp, `io${BARS[i]}`], [r, '1'], YELLOW, 0.16)
    b.wire([r, '2'], [bar, `a${i + 1}`], RED, 0.16)
    b.wire([bar, `c${i + 1}`], [esp, GND], BLACK, 0.16)
  }

  return b.doc
}

/* ================================================================== */
/* Brushless thrust rig                                                */
/* ================================================================== */

/**
 * A motor, a propeller and a load cell to find out what it pulls.
 *
 * The one build in the set with a spinning thing on it, and that is the
 * reason it is here: a page of circuit boards reads as one product, and this
 * says the same editor holds the frame as well as what is bolted to it.
 *
 * Extrusion convention is the one at the top of this file — authored along X,
 * seated at y = 0, and `post` stands one up.
 */
export function thrustRig(): Doc {
  const b = new Builder('Brushless thrust rig')

  const W = 260
  const H = 170

  // A base that stays put, and a mast to carry the motor.
  b.beamX(0, 0, -70, W)
  b.beamX(0, 0, 70, W)
  b.beamZ(-W / 2 + 10, 0, 0, 160)
  b.beamZ(W / 2 - 10, 0, 0, 160)
  b.post(-W / 2 + 10, 20, 0, H)
  b.post(W / 2 - 30, 20, 0, H)

  /* Stacked, because that is how these parts are authored: a beam is seated
     at y = 0 and a motor stands on its own base with the shaft on top. The
     first version hung the motor under the beam and left the propeller in
     mid-air beside it, nowhere near the shaft. */
  const TOP = 20 + H
  b.beamX(0, TOP, 0, W - 20)

  /* The cell carries the motor and the beam carries the cell, so what it
     weighs is thrust rather than the motor. */
  const cell = b.add('load-cell', [-20, TOP + 20, 0], { capacity: '5' }, [0, 0, 0], 'Load cell')
  const hx = b.add('amp-hx711', [66, TOP + 20, 46], {}, [0, 0, 0], 'HX711')

  const motor = b.add('motor-brushless', [0, TOP + 34, 0], { kv: 1000 }, [0, 0, 0], 'Motor')
  // The bore sits on the shaft, which is 38 mm above the motor's own base.
  b.add('propeller', [0, TOP + 72, 0], { dia: 10, pitch: 4.5, blades: '2', color: 'orange' }, [0, 0, 0], 'Propeller')

  /* The ESC rides up on the mast beside the motor, not down on the base.
     Three phase wires from the floor to the top have to climb past the cross
     beam the motor is standing on, and they clipped it; up here they are the
     short leads they are in life, and only the battery runs the height of the
     frame. */
  const esc = b.add('esc-brushless', [70, TOP + 22, 30], { amps: '40' }, [0, 90, 0], 'ESC')
  const uno = b.add('mcu-board', [-74, 22, 48], { program: 'pwm', duty: 62 }, [0, 0, 0], 'Controller')
  const pack = b.add('battery-holder', [92, 22, -44], { cell: '18650', count: 4 }, [0, 0, 0], 'Pack')

  // Three phases, and they are interchangeable: swap any two and it reverses.
  b.wire([esc, 'ma'], [motor, 'a'], '#C9CDD4', 0.6)
  b.wire([esc, 'mb'], [motor, 'b'], '#C9CDD4', 0.6)
  b.wire([esc, 'mc'], [motor, 'c'], '#C9CDD4', 0.6)

  b.wire([pack, 'p'], [esc, 'bp'], RED, 0.6)
  b.wire([pack, 'n'], [esc, 'bn'], BLACK, 0.6)

  // Throttle in, and the regulator inside the ESC runs the board.
  b.wire([uno, 'd5'], [esc, 'sig'], YELLOW, 0.16)
  b.wire([esc, 'becp'], [uno, 'v5'], RED, 0.16)
  b.wire([esc, 'becn'], [uno, 'gnd'], BLACK, 0.16)

  // A load cell is a bridge; the amplifier is what makes it readable.
  b.wire([cell, 'ep'], [hx, 'ep'], RED, 0.16)
  b.wire([cell, 'en'], [hx, 'en'], BLACK, 0.16)
  b.wire([cell, 'ap'], [hx, 'ap'], GREEN, 0.16)
  b.wire([cell, 'am'], [hx, 'am'], BLUE, 0.16)
  b.wire([hx, 'vcc'], [uno, 'v5'], RED, 0.16)
  b.wire([hx, 'gnd'], [uno, 'gnd'], BLACK, 0.16)
  b.wire([hx, 'dt'], [uno, 'd3'], GREEN, 0.16)
  b.wire([hx, 'sck'], [uno, 'd2'], YELLOW, 0.16)

  return b.doc
}

/* ================================================================== */
/* RFID door lock                                                      */
/* ================================================================== */

/**
 * A card reader, a keypad and the thing that actually moves the bolt.
 *
 * On a panel rather than lying on a bench, because that is where these end
 * up, and because it puts a reader and a solenoid in the set — two shapes
 * nothing else here has.
 */
export function rfidLock(): Doc {
  const b = new Builder('RFID door lock')

  /*
   * Laid out on the bench rather than mounted behind a face.
   *
   * It was a panel build first, and a panel is the wrong thing to photograph:
   * standing a 220 mm sheet up puts a white rectangle between the camera and
   * everything that makes it interesting. Flat, the reader, the keypad and
   * the bolt are all visible at once, which is the whole reason this build is
   * in the set.
   */
  const pad = b.add('keypad-matrix', [72, 0, 0], { layout: '4x4' }, [0, 0, 0], 'Keypad')
  const rfid = b.add('rfid-rc522', [-62, 0, -44], {}, [0, 0, 0], 'Card reader')
  const uno = b.add('mcu-board', [-60, 0, 52], { program: 'button' }, [0, 0, 0], 'Controller')
  const relay = b.add('relay-module', [18, 0, 62], {}, [0, 0, 0], 'Relay')
  const bolt = b.add('solenoid-linear', [18, 0, -62], { size: 'medium', voltage: '12' }, [0, 0, 0], 'Door bolt')
  /* Off to the corner, not in line behind the relay: the bolt's return runs
     the length of the build to get here, and straight back past the relay is
     the one path it cannot take. */
  const psu = b.add('battery-holder', [92, 0, 96], { cell: '18650', count: 3 }, [0, 0, 0], 'Supply')

  const ok = b.add('led-5mm', [70, 0, -62], { color: 'green', diffused: true }, [0, 90, 0], 'Unlocked')
  const rl = b.add('resistor-axial', [70, 0, -50], { value: 330, watt: '0.25' }, [0, 0, 0], 'R1')

  // The reader is SPI, so four lines, plus a reset it wants held high.
  b.wire([uno, 'd13'], [rfid, 'sck'], YELLOW, 0.16)
  b.wire([uno, 'd11'], [rfid, 'mosi'], BLUE, 0.16)
  b.wire([uno, 'd12'], [rfid, 'miso'], GREEN, 0.16)
  b.wire([uno, 'd10'], [rfid, 'sda'], '#C77DFF', 0.16)
  b.wire([uno, 'd9'], [rfid, 'rst'], '#FF9E4A', 0.16)
  b.wire([uno, 'v33'], [rfid, 'vcc'], RED, 0.16)
  b.wire([uno, 'gnd'], [rfid, 'gnd'], BLACK, 0.16)

  // Four rows, four columns, eight pins and no decoding anywhere.
  const rows = ['r1', 'r2', 'r3', 'r4']
  const cols = ['c1', 'c2', 'c3', 'c4']
  for (let i = 0; i < 4; i++) b.wire([uno, `d${i + 2}`], [pad, rows[i]], BLUE, 0.16)
  for (let i = 0; i < 4; i++) b.wire([uno, `a${i}`], [pad, cols[i]], GREEN, 0.16)

  // A board pin cannot pull a bolt, so it closes a relay that can.
  b.wire([uno, 'd6'], [relay, 'in'], YELLOW, 0.16)
  b.wire([uno, 'v5'], [relay, 'vcc'], RED, 0.16)
  b.wire([uno, 'gnd'], [relay, 'gnd'], BLACK, 0.16)
  b.wire([psu, 'p'], [relay, 'com'], RED, 0.33)
  b.wire([relay, 'no'], [bolt, 'a'], RED, 0.33)
  b.wire([bolt, 'b'], [psu, 'n'], BLACK, 0.33)

  b.wire([uno, 'd7'], [rl, '1'], GREEN, 0.16)
  b.wire([rl, '2'], [ok, 'a'], GREEN, 0.16)
  b.wire([ok, 'c'], [uno, 'gnd2'], BLACK, 0.16)

  return b.doc
}

/* ================================================================== */
/* Servo arm                                                           */
/* ================================================================== */

/**
 * Three servos on a driver, which is how a limb gets built.
 *
 * The driver is here rather than three pins on the board because that is the
 * real answer once there is more than a couple of them: one address on the
 * bus, its own supply for the motors, and the board left with two wires to
 * do. Servos are solved, so the horns sit where the sketch puts them.
 */
export function servoArm(): Doc {
  const b = new Builder('Servo arm')

  b.beamX(0, 0, 0, 180)
  b.beamX(0, 0, -60, 180)
  b.beamZ(-80, 0, -30, 80)
  b.beamZ(80, 0, -30, 80)

  b.add('bracket-l', [-50, 20, 4], {}, [0, 0, 0], 'Shoulder bracket')
  b.add('bracket-l', [0, 20, 4], {}, [0, 0, 0], 'Elbow bracket')
  b.add('bracket-l', [50, 20, 4], {}, [0, 0, 0], 'Wrist bracket')

  const s1 = b.add('servo-hobby', [-50, 44, 26], { size: 'mg996' }, [0, 0, 0], 'Shoulder')
  const s2 = b.add('servo-hobby', [0, 44, 26], { size: 'mg996' }, [0, 0, 0], 'Elbow')
  const s3 = b.add('servo-hobby', [50, 44, 26], { size: 'mg996' }, [0, 0, 0], 'Wrist')

  const drv = b.add('servo-driver-pca9685', [0, 20, -64], {}, [0, 0, 0], 'Servo driver')
  const uno = b.add('mcu-board', [-74, 20, -80], { program: 'pwm', duty: 50 }, [0, 90, 0], 'Controller')
  const psu = b.add('battery-holder', [82, 14, -80], { cell: '18650', count: 2 }, [0, 0, 0], 'Servo supply')

  // Two wires to the board, and the motors fed from their own pack.
  b.wire([uno, 'sda'], [drv, 'sda'], GREEN, 0.16)
  b.wire([uno, 'scl'], [drv, 'scl'], YELLOW, 0.16)
  b.wire([uno, 'v5'], [drv, 'vcc'], RED, 0.16)
  b.wire([uno, 'gnd'], [drv, 'gnd'], BLACK, 0.16)
  b.wire([psu, 'p'], [drv, 'vp'], RED, 0.33)
  b.wire([psu, 'n'], [drv, 'gterm'], BLACK, 0.33)

  const arms = [s1, s2, s3]
  for (let i = 0; i < arms.length; i++) {
    b.wire([drv, `pwm${i}`], [arms[i], 'sig'], YELLOW, 0.16)
    b.wire([drv, 'vterm'], [arms[i], 'vcc'], RED, 0.16)
    b.wire([drv, 'gterm'], [arms[i], 'gnd'], BLACK, 0.16)
  }

  return b.doc
}
