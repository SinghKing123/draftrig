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
/* Motion simulator                                                    */
/* ================================================================== */

/**
 * A two-actuator motion rig: seat, wheel, pedals, screen.
 *
 * The kind of thing that looks obvious in a photograph and turns out to have
 * eleven decisions in it. The actuators are leadscrews on NEMA 23s, which is
 * what decides whether it can lift a person at all.
 */
export function motionSim(): Doc {
  const b = new Builder('Motion simulator')
  const W = 700 // across
  const D = 1000 // front to back, with the front at +z
  const P = '4040'

  /* --- Base rectangle. */
  b.beamX(0, 0, -D / 2 + 20, W, P)
  b.beamX(0, 0, D / 2 - 20, W, P)
  b.beamZ(-W / 2 + 20, 0, 0, D - 80, P)
  b.beamZ(W / 2 - 20, 0, 0, D - 80, P)

  /* --- Seat, at the back, up on four posts. */
  const seatZ = -D / 2 + 260
  for (const sx of [-1, 1] as const) {
    b.post(sx * (W / 2 - 40) - 20, 40, seatZ - 170, 300, P)
    b.post(sx * (W / 2 - 40) - 20, 40, seatZ + 170, 220, P)
  }
  b.beamZ(-W / 2 + 20, 260, seatZ, 380, P)
  b.beamZ(W / 2 - 20, 260, seatZ, 380, P)
  b.add('panel-sheet', [0, 300, seatZ + 30], { material: 'plywood', width: W - 100, depth: 420, thickness: 18, corner: 30 }, [0, 0, 0], 'Seat pan')
  b.add('panel-sheet', [0, 480, seatZ - 200], { material: 'plywood', width: W - 140, depth: 420, thickness: 18, corner: 30 }, [-76, 0, 0], 'Seat back')

  /* --- Actuators: a screw and a guide at each back corner, driving the pan. */
  for (const sx of [-1, 1] as const) {
    const x = sx * (W / 2 - 60)
    const z = -D / 2 + 90
    b.add('motor-stepper', [x - 26, 500, z], { model: '23-56', shaftLen: 24 }, [0, 0, -90], 'Actuator motor')
    b.add('shaft-coupler', [x, 452, z], { boreA: 6.35, boreB: 8, style: 'rigid' }, [0, 0, 90], 'Coupler')
    b.add('leadscrew-t8', [x, 220, z], { length: 430, lead: 8, nut: true, nutAt: 35 }, [0, 0, 90], 'Actuator screw')
    b.add('rail-linear', [x - 56, 40, z], { size: 'MGN15', length: 400, carriage: 40 }, [0, 0, 90], 'Guide')
  }

  /* --- Front deck, wheel column and pedals. */
  const frontZ = D / 2 - 180
  for (const sx of [-1, 1] as const) b.post(sx * (W / 2 - 40) - 20, 40, frontZ, 260, P)
  b.beamX(0, 300, frontZ, W - 80, P)
  b.add('panel-sheet', [0, 340, frontZ], { material: 'alu-5052', width: 420, depth: 180, thickness: 5, corner: 10 }, [0, 0, 0], 'Wheel deck')

  b.add('extrusion-tslot', [0, 370, frontZ + 10], { size: '2040', length: 160, finish: 'alu-anod-black' }, [54, 90, 0], 'Column')
  b.add('wheel', [0, 455, frontZ + 90], { diameter: 260, width: 34, bore: 12, hub: 'round' }, [0, 90, 0], 'Steering wheel')
  b.add('encoder-rotary', [0, 455, frontZ + 60], { knob: false }, [0, 0, 0], 'Steering sensor')

  // Pedals on a plate down between the front posts.
  b.add('panel-sheet', [0, 60, D / 2 - 90], { material: 'alu-5052', width: 340, depth: 220, thickness: 5, corner: 10 }, [0, 0, 0], 'Pedal plate')
  for (const x of [-90, 10]) {
    b.add('panel-sheet', [x, 115, D / 2 - 100], { material: 'alu-5052', width: 80, depth: 180, thickness: 5, corner: 8 }, [-58, 0, 0], 'Pedal')
  }

  /* --- Screen, on two posts right at the front. */
  for (const sx of [-1, 1] as const) b.post(sx * 220 - 10, 0, D / 2 + 40, 620, '2040')
  b.add('panel-sheet', [0, 840, D / 2 + 46], { material: 'abs-black', width: 660, depth: 400, thickness: 10, corner: 8 }, [90, 0, 0], 'Screen')

  /* --- Control box, on the right-hand base rail. */
  b.add('panel-sheet', [W / 2 - 130, 40, 180], { material: 'alu-5052', width: 230, depth: 260, thickness: 3 }, [0, 0, 0], 'Electronics deck')
  const mcu = b.add('mcu-board', [W / 2 - 170, 43, 180], { program: 'off' }, [0, 90, 0], 'Controller')
  const drvA = b.add('stepper-driver', [W / 2 - 85, 43, 240], { model: 'tmc2209', heatsink: true }, [0, 0, 0], 'Driver, left')
  const drvB = b.add('stepper-driver', [W / 2 - 85, 43, 180], { model: 'tmc2209', heatsink: true }, [0, 0, 0], 'Driver, right')
  const psu = b.add('bench-supply', [W / 2 - 120, 43, 80], { voltage: 24, ilimit: 8 }, [0, 180, 0], 'Supply')

  b.wire([psu, 'p'], [drvA, 'vmot'], RED, 0.82)
  b.wire([psu, 'p'], [drvB, 'vmot'], RED, 0.82)
  b.wire([psu, 'n'], [drvA, 'gndm'], BLACK, 0.82)
  b.wire([psu, 'n'], [drvB, 'gndm'], BLACK, 0.82)
  b.wire([mcu, 'v5'], [drvA, 'vdd'], RED)
  b.wire([mcu, 'v5'], [drvB, 'vdd'], RED)
  b.wire([mcu, 'gnd'], [drvA, 'gnd'], BLACK)
  b.wire([mcu, 'gnd2'], [drvB, 'gnd'], BLACK)
  b.wire([mcu, 'd2'], [drvA, 'step'], BLUE)
  b.wire([mcu, 'd3'], [drvA, 'dir'], GREEN)
  b.wire([mcu, 'd4'], [drvB, 'step'], BLUE)
  b.wire([mcu, 'd5'], [drvB, 'dir'], GREEN)

  return b.doc
}

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
