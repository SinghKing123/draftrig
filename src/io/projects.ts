import type { Doc } from '@/state/doc'
import type { Vec3 } from '@/parts/kernel/types'
import { BLACK, BLUE, Builder, GREEN, ORANGE, RED, WHITE, YELLOW } from './builds'

/**
 * Projects, as opposed to machines or circuits.
 *
 * `builds.ts` has the big frames and `starters.ts` the teaching circuits.
 * These are the things in between: a flying machine, a pot that waters
 * itself, a box of keys. They are here because the front page kept showing
 * the same nine builds and they were all either furniture or a breadboard —
 * what was missing was the thing somebody would actually set out to make on
 * a weekend, which is a project with an output rather than a demonstration
 * of a part.
 *
 * Same conventions as builds.ts: real parts at real sizes, wiring that would
 * work, and nothing placed where a wire has to pass through it.
 */

/**
 * A quadcopter, laid out to size.
 *
 * Four arms on the diagonal, a motor and a propeller on each, the controller
 * between two plates. The arm length is the sum that decides an airframe
 * before anything else does: at a hundred and forty from the middle the
 * motors are a hundred and ninety-eight apart, and a six-inch propeller is a
 * hundred and fifty-two across, so the discs clear with room to spare.
 */
export function quadcopter(): Doc {
  const b = new Builder('Quadcopter')

  /*
   * Sized to the parts, not the other way round.
   *
   * The catalog is at real dimensions: a twenty-amp speed controller is a
   * hundred and seventy millimetres with its leads, and a three-cell pack is
   * two hundred and ten. On a six-inch airframe they were longer than the
   * machine. Ten-inch propellers and a quarter-metre arm is the size at
   * which these particular parts are the parts somebody would have chosen.
   */
  const R = 250
  const ARM = 260
  const PLATE = 180
  const T = 3
  const TUBE = 20
  const STACK = 30

  const deck = T / 2
  const armTop = deck + TUBE
  const plate2 = armTop + STACK + T / 2

  b.add('panel-sheet', [0, 0, 0], { material: 'abs-black', width: PLATE, depth: PLATE, thickness: T, corner: 8 }, [0, 0, 0], 'Bottom plate')

  /*
   * Arms on the axes, not the diagonals.
   *
   * Both layouts fly, and the diagonal one is the commoner, but a tube at
   * 45 degrees has an axis-aligned bounding box the size of its whole
   * quadrant — and four of those cover everything inside the propeller
   * circle at arm height. Nothing on screen says so, the tube is 20 mm, but
   * it leaves no clear line from the pack underneath to the stack on top.
   * On the axes each arm's box is the arm, and the diagonals between them
   * are where the loom goes.
   *
   * Rotating about Y by t sends a part's own X axis to (cos t, 0, -sin t),
   * and each arm is centred half its length along its own heading.
   */
  const arms = [0, 90, 180, 270]
  const dir = (t: number): [number, number] => [
    Math.cos((t * Math.PI) / 180),
    -Math.sin((t * Math.PI) / 180),
  ]

  const motor: string[] = []
  const esc: string[] = []
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = dir(arms[i])
    b.add(
      'tube-square',
      [dx * (ARM / 2), deck, dz * (ARM / 2)],
      { size: TUBE, wall: 1.5, length: ARM, material: 'alu-anod-black' },
      [0, arms[i], 0],
      `Arm ${i + 1}`,
    )

    motor.push(
      b.add('motor-brushless', [dx * R, armTop, dz * R], { size: '2212', kv: 920 }, [0, 0, 0], `Motor ${i + 1}`),
    )
    // The bore sits on the shaft, 38 mm above the motor's own base.
    b.add(
      'propeller',
      [dx * R, armTop + 38, dz * R],
      { dia: 10, pitch: 4.5, blades: '2', color: i < 2 ? 'orange' : 'black' },
      [0, 0, 0],
      `Prop ${i + 1}`,
    )

  }

  /* The top plate stands off the arms rather than resting on them, which is
     what gives every lead up here room to reach the middle without grazing
     an arm on the way in. The pillars go on the axes, between the arms. */
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    b.add('standoff-hex', [sx * 62, armTop, sz * 62], { thread: 'M3', length: STACK, ends: 'mf', material: 'nylon-black' }, [0, 0, 0], 'Pillar')
  }
  b.add('panel-sheet', [0, plate2, 0], { material: 'abs-black', width: 150, depth: 150, thickness: T, corner: 8 }, [0, 0, 0], 'Top plate')

  /*
   * The controllers stack on the top plate rather than riding their arms.
   *
   * On the arms their battery leads reached back to the middle at the exact
   * height of the arms, and there is no way in to that point that does not
   * go through one. Up here every lead starts above the structure, which is
   * also where a four-in-one sits on a real airframe.
   */
  const escY = plate2 + T / 2
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = dir(arms[i])
    esc.push(
      b.add('esc-brushless', [dx * 46, escY, dz * 46], { amps: '20' }, [0, arms[i], 0], `ESC ${i + 1}`),
    )
  }

  const fcY = plate2 + T / 2
  const nano = b.add('arduino-nano', [0, fcY, 16], {}, [0, 0, 0], 'Flight controller')
  const imu = b.add('sensor-imu', [-38, fcY, -20], {}, [0, 0, 0], 'IMU')
  const radio = b.add('radio-nrf24l01', [38, fcY, -22], {}, [0, 90, 0], 'Radio')
  // Slung under on the diagonal, between two arms rather than along one.
  const pack = b.add('battery-lipo', [0, -T / 2 - 26, 0], { cells: '3', capacity: '1300', crate: '50' }, [0, 45, 0], 'Pack')

  /*
   * In once and passed along the four controllers, which is what a
   * distribution board is when it is drawn rather than etched.
   *
   * Over the top rather than across. The arms sit on the diagonals, so the
   * X and Z axes between them are clear and a lead can come up the back
   * without crossing anything; the ring between controllers goes over the
   * middle, well above the arm tops. Run straight, these went through the
   * arms they were trying to reach along.
   */
  /* A controller's battery leads come out of the end away from its motor,
     which puts them back over the opposite arm — so every power wire is
     dropped onto its terminal from directly overhead rather than flown in
     from the side, where it would graze the arm on the way. */
  const over = (i: number): Vec3 => {
    const [dx, dz] = dir(arms[i])
    return [-dx * 40, escY + 26, -dz * 40]
  }
  const MID: Vec3 = [0, escY + 32, 0]

  /* Up the diagonal the pack lies on, which is between arms the whole way,
     and never doubling back: a route that goes outward before it comes in
     makes the spline swing wide at the turn. */
  const UP: Vec3[] = [[-86, 28, 86], [-44, 78, 44], MID]
  b.wireVia([pack, 'p'], [esc[0], 'bp'], [...UP, over(0)], RED, 0.8)
  b.wireVia([pack, 'n'], [esc[0], 'bn'], [...UP, over(0)], BLACK, 0.8)
  for (let i = 1; i < 4; i++) {
    b.wireVia([esc[i - 1], 'bp'], [esc[i], 'bp'], [over(i - 1), MID, over(i)], RED, 0.6)
    b.wireVia([esc[i - 1], 'bn'], [esc[i], 'bn'], [over(i - 1), MID, over(i)], BLACK, 0.6)
  }

  // Three phases each, and swapping any two reverses that motor.
  for (let i = 0; i < 4; i++) {
    b.wire([esc[i], 'ma'], [motor[i], 'a'], WHITE, 0.5)
    b.wire([esc[i], 'mb'], [motor[i], 'b'], WHITE, 0.5)
    b.wire([esc[i], 'mc'], [motor[i], 'c'], WHITE, 0.5)
  }

  // Four throttles out, and one of the controllers' regulators runs the board.
  const sig = ['d3', 'd5', 'd6', 'd9'] as const
  for (let i = 0; i < 4; i++) b.wire([esc[i], 'sig'], [nano, sig[i]], YELLOW, 0.14)
  b.wire([esc[0], 'becp'], [nano, 'v5'], RED, 0.2)
  b.wire([esc[0], 'becn'], [nano, 'gnd'], BLACK, 0.2)

  // Attitude over two wires, the radio link over five.
  b.wire([imu, 'vcc'], [nano, 'v5'], RED, 0.14)
  b.wire([imu, 'gnd'], [nano, 'gnd'], BLACK, 0.14)
  b.wire([imu, 'scl'], [nano, 'a5'], BLUE, 0.14)
  b.wire([imu, 'sda'], [nano, 'a4'], GREEN, 0.14)

  b.wire([radio, 'vcc'], [nano, 'v3'], RED, 0.14)
  b.wire([radio, 'gnd'], [nano, 'gnd'], BLACK, 0.14)
  b.wire([radio, 'ce'], [nano, 'd7'], ORANGE, 0.14)
  b.wire([radio, 'csn'], [nano, 'd8'], ORANGE, 0.14)
  b.wire([radio, 'sck'], [nano, 'd13'], WHITE, 0.14)
  b.wire([radio, 'mosi'], [nano, 'd11'], WHITE, 0.14)
  b.wire([radio, 'miso'], [nano, 'd12'], WHITE, 0.14)

  return b.doc
}

/**
 * A pot that waters itself.
 *
 * A probe in the soil, a board that reads it, a relay and a small pump. The
 * smallest useful thing with an actuator on the end of it, and the shape of
 * nearly every first automation anybody builds.
 */
export function plantWatering(): Doc {
  const b = new Builder('Plant watering controller')

  const W = 190
  const D = 140
  const T = 9
  const top = T / 2

  b.add('panel-sheet', [0, 0, 0], { material: 'plywood', width: W, depth: D, thickness: T, corner: 5 }, [0, 0, 0], 'Base')

  const esp = b.add('esp-board', [-48, top, 14], {}, [0, 0, 0], 'ESP32')
  /* The board's rails are named for the pins they come out on, not for what
     they carry: five volts in is vin, the regulator's output is v33r14 and
     the ground is gndl13. */
  const V5 = 'vin'
  const V33 = 'v33r14'
  const GND = 'gndl13'
  const relay = b.add('relay-module', [38, top, -36], {}, [0, 0, 0], 'Relay')
  const pump = b.add('motor-dc', [56, top + 10, 36], {}, [0, 90, 0], 'Pump')
  const oled = b.add('display-oled', [-6, top, -44], {}, [0, 0, 0], 'Display')
  const soil = b.add('sensor-soil', [-78, top, -40], {}, [0, 0, 0], 'Soil probe')
  /* A socket on the board rather than a brick beside it: the adapter part
     is a real adapter, which is seventy millimetres of case and a third of
     a metre of lead, and all of that lay across the bench behind a board
     half its length. */
  const usb = b.add('usb-c-breakout', [80, top, 48], {}, [0, 0, 0], 'USB-C in')
  // Air as well as soil: it is the pair of readings that decides watering.
  const dht = b.add('sensor-dht', [26, top, 42], {}, [0, 0, 0], 'Air sensor')


  b.wire([usb, 'vbus'], [esp, V5], RED, 0.4)
  b.wire([usb, 'gnd'], [esp, GND], BLACK, 0.4)

  b.wire([soil, 'vcc'], [esp, V33], RED, 0.14)
  b.wire([soil, 'gnd'], [esp, GND], BLACK, 0.14)
  b.wire([soil, 'out'], [esp, 'io34'], GREEN, 0.14)

  b.wire([oled, 'vcc'], [esp, V33], RED, 0.14)
  b.wire([oled, 'gnd'], [esp, GND], BLACK, 0.14)
  b.wire([oled, 'scl'], [esp, 'io22'], BLUE, 0.14)
  b.wire([oled, 'sda'], [esp, 'io21'], YELLOW, 0.14)

  b.wire([relay, 'vcc'], [esp, V5], RED, 0.16)
  b.wire([relay, 'gnd'], [esp, GND], BLACK, 0.16)
  b.wire([relay, 'in'], [esp, 'io26'], YELLOW, 0.16)

  b.wire([dht, 'vcc'], [esp, V33], RED, 0.14)
  b.wire([dht, 'gnd'], [esp, GND], BLACK, 0.14)
  b.wire([dht, 'data'], [esp, 'io27'], GREEN, 0.14)

  // Switched on the high side, and the pump returns straight to the supply.
  b.wire([usb, 'vbus'], [relay, 'com'], RED, 0.4)
  b.wire([relay, 'no'], [pump, 'p'], RED, 0.4)
  b.wire([pump, 'n'], [usb, 'gnd'], BLACK, 0.4)

  return b.doc
}
