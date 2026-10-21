import type { Doc } from '@/state/doc'
import type { Vec3 } from '@/parts/kernel/types'
import { BLACK, BLUE, Builder, GREEN, ORANGE, RED, WHITE, YELLOW } from './builds'

/**
 * Finished devices, in enclosures.
 *
 * `builds.ts` has the frames and `projects.ts` the things somebody sets out
 * to make on a weekend. These are a step further on: a box with a lid, a
 * front panel, fasteners, and a readout on the outside of it that is driven
 * by the board on the inside. The difference matters for what the site is
 * saying — a flying machine is impressive and still obviously a bench
 * exercise, whereas a cased instrument with a screen on it is a product, and
 * a product is what most people are actually trying to arrive at.
 *
 * Both of these are built in the order they would really be built, because
 * the reel shoots them part by part in exactly that order: base, posts,
 * everything that has to go in before the walls do, then the walls, then the
 * lid. The last thing to land in both is the cap, which is also the moment
 * the screen is the only thing left to look at.
 *
 * Enclosure conventions, so the arithmetic below reads:
 *
 *   A sheet is authored lying flat, origin at the centre of its underside,
 *   so a base at y = 0 has its inside face at y = t.
 *
 *   Rotating a sheet [90, 0, 0] stands it up facing +z: its thickness runs
 *   +z from the origin and its depth becomes height, centred on the origin.
 *   So a front panel whose outside face is at z = D/2 is placed at D/2 - t,
 *   and anything mounted on it also goes at D/2 - t with the same rotation.
 *
 *   Rotating [0, 0, 90] stands it up facing -x: thickness runs -x, width
 *   becomes height. A right-hand wall flush at W/2 is placed at W/2; a
 *   left-hand one flush at -W/2 is placed at -W/2 + t.
 *
 *   A square tube is authored along X with its underside at y = 0, so a
 *   corner post is [0, 0, 90] and occupies the profile's width in -x from
 *   wherever it is placed.
 */

/* ================================================================== */
/* Desk terminal                                                       */
/* ================================================================== */

/**
 * A small computer in a box, with a screen on the front of it.
 *
 * Sixteen characters by two, a knob, two buttons and a switch: the interface
 * a bench instrument has had since before anybody reading this was born, and
 * still the one that suits a device meant to do one thing. The display is
 * driven over the four-bit bus from the board on the shelf inside, which
 * means the text on it in a picture of this build is text the solver put
 * there rather than a texture.
 *
 * Built around the display rather than around the box. A 1602 panel is 75 by
 * 31 on its mounting holes, a knob wants 30 clear either side of it, and a
 * hand wants the switches below the screen rather than beside it — which
 * gives a front panel about 184 across and 134 tall, and the enclosure is
 * whatever wraps that. Sized the other way round, from a round number for
 * the case, the panel comes out either crowded or mostly empty.
 */
export function deskTerminal(): Doc {
  const b = new Builder('Desk terminal')

  const W = 190
  const D = 130
  const T = 3
  /* A 20 mm foot stands 9 mm proud, and that is what the case sits on. */
  const FOOT = 20
  const FLOOR = FOOT * 0.45
  /** Inside the base: where everything on the floor of the case sits. */
  const IN = FLOOR + T
  const HW = 134
  const TOP = IN + HW
  /**
   * Where a part mounted through the front panel is placed.
   *
   * The outside face, not the inside one. A panel part is authored lying on
   * a surface with its leads below it, so placing it on the inner face
   * buries the whole module in the 3 mm of the panel and leaves a
   * millimetre and a half of bezel showing: the first cut of this had a
   * display on the front that could not be seen from the front.
   */
  const FACE = D / 2
  const POST = 12

  /* --- The shell, in build order. Base first, feet under it, then the four
     posts that everything else is screwed to. */
  b.add('panel-sheet', [0, FLOOR, 0], { material: 'alu-5052', width: W, depth: D, thickness: T, corner: 4 }, [0, 0, 0], 'Base')
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.add('rubber-foot', [sx * (W / 2 - 20), 0, sz * (D / 2 - 18)], { dia: FOOT }, [0, 0, 0], 'Foot')
    }
  }

  /* Posts in the corners, tapped both ends. They are what makes this a case
     rather than five sheets leaning on each other: the base screws up into
     them, the cap screws down into them, and the walls are captured between.
     A square tube is authored along X with its underside at y = 0, so
     standing one up is [0, 0, 90] and it occupies its own width in -x from
     wherever it is placed. */
  const postX = [-(W / 2 - T) + POST, W / 2 - T]
  const postZ = [-(D / 2 - T - POST / 2), D / 2 - T - POST / 2]
  for (const px of postX) {
    for (const pz of postZ) {
      b.add('tube-square', [px, IN + HW / 2, pz], { size: POST, wall: 1.5, length: HW, material: 'alu-anod-black' }, [0, 0, 90], 'Corner post')
    }
  }
  for (const px of postX) {
    for (const pz of postZ) {
      b.add('screw-bhcs', [px - POST / 2, FLOOR, pz], { thread: 'M3', length: 10, finish: 'stainless-304' }, [0, 0, 0], 'Base screw')
    }
  }

  /* --- Back wall, and the two sockets through it. The wall goes on before
     the gear does because both of these are mounted in it. A part mounted
     through the back faces -z, which is [-90, 0, 0]: its own up axis becomes
     -z, so the barrel pokes out through the wall and the terminals stay
     inside. */
  b.add('panel-sheet', [0, IN + HW / 2, -D / 2], { material: 'abs-black', width: W - T * 2, depth: HW }, [90, 0, 0], 'Back wall')
  const jack = b.add('jack-barrel-dc', [60, IN + 30, -D / 2 + T], { mount: 'panel', plugged: true }, [-90, 0, 0], 'DC inlet')
  const usb = b.add('usb-c-breakout', [-60, IN + 26, -D / 2 + T], { mask: 'fr4-black' }, [-90, 0, 0], 'USB-C, for flashing')

  /* --- The floor of the case: everything between the inlet and the 5 V rail,
     plus the modules that are nobody's business but the board's. */
  const tb = b.add('terminal-block', [-55, IN, -50], { ways: 4, pitch: '5.08' }, [0, 0, 0], 'Rail block')
  const fuse = b.add('fuse-glass', [-25, IN, -50], { rating: '1', speed: 'slow' }, [0, 0, 0], 'Fuse')
  const buck = b.add('buck-converter', [20, IN, -46], { vout: 9, imax: 2 }, [0, 0, 0], 'Buck converter')
  const cap = b.add('capacitor-electrolytic', [-50, IN, -22], { value: 0.00047, vmax: 25 }, [0, 0, 0], 'Bulk capacitor')
  const rtc = b.add('rtc-ds3231', [68, IN, -12], { battery: true }, [0, 0, 0], 'Clock')
  const buzz = b.add('buzzer-piezo', [-62, IN, 8], {}, [0, 0, 0], 'Buzzer')
  const dht = b.add('sensor-dht', [70, IN, 26], { model: 'dht22' }, [0, 0, 0], 'Air sensor')

  /* --- The shelf, and the board on it. The board goes up here rather than on
     the floor for one reason: the display is 100 mm up the front panel, and
     from the shelf the loom to it is a hand's width of straight wire instead
     of a climb past everything else in the box. */
  const SHELF = IN + 60
  const sx0 = -10
  const sz0 = -10
  for (const [ax, az] of [[-62, -32], [62, -32], [-62, 32], [62, 32]] as const) {
    b.add('standoff-hex', [sx0 + ax, IN, sz0 + az], { thread: 'M3', length: 60, ends: 'mf', material: 'brass' }, [0, 0, 0], 'Shelf pillar')
  }
  b.add('panel-sheet', [sx0, SHELF, sz0], { material: 'alu-5052', width: 140, depth: 80, thickness: 2, corner: 4 }, [0, 0, 0], 'Shelf')

  const boardY = SHELF + 2 + 8
  const holes = [[-20, 24], [32, 11], [32, -7], [-19, -24]] as const
  for (const [ax, az] of holes) {
    b.add('standoff-hex', [sx0 + ax, SHELF + 2, sz0 + az], { thread: 'M3', length: 8, ends: 'mf', material: 'nylon-black' }, [0, 0, 0], 'Board standoff')
  }
  const mcu = b.add(
    'mcu-board',
    [sx0, boardY, sz0],
    { program: 'lcd-clock', text1: 'DRAFTRIG', mask: 'fr4-black' },
    [0, 0, 0],
    'Controller',
  )
  for (const [ax, az] of holes) {
    b.add('screw-bhcs', [sx0 + ax, boardY + 2, sz0 + az], { thread: 'M3', length: 6, finish: 'stainless-304' }, [180, 0, 0], 'Board screw')
  }

  /*
   * --- The front panel and everything a hand touches.
   *
   * Clear, and that is the whole decision about how this build looks. In
   * aluminium the face is a pale slab with a knob on it; in black ABS it is
   * a dark slab with a knob on it, and either way the shelf, the board, the
   * loom and the whole reason the box is 134 tall are sealed behind it. Cast
   * acrylic puts the work on show and still carries a display and four
   * switches, which is what half the project boxes on a shelf are made of.
   *
   * Mounted on the +z face and photographed from +z, so the legends read the
   * right way round rather than mirrored.
   */
  b.add('panel-sheet', [0, IN + HW / 2, FACE - T], { material: 'acrylic-clear', width: W - T * 2, depth: HW }, [90, 0, 0], 'Front panel')
  const lcd = b.add('display-lcd-character', [-40, 102, FACE], { format: '1602', mask: 'fr4-green' }, [90, 0, 0], 'Display')
  const enc = b.add('encoder-rotary', [52, 102, FACE], { knob: true, knobColor: '#1A1D22' }, [90, 0, 0], 'Set')
  const btn = ([-62, -34] as const).map((x, i) =>
    b.add('pushbutton-tactile', [x, 48, FACE], { capColor: i ? '#C0272D' : '#D8DEE9' }, [90, 0, 0], i ? 'Stop' : 'Enter'),
  )
  const tog = b.add('switch-toggle', [10, 48, FACE], { poles: 'spst', on: true }, [90, 0, 0], 'Mode')
  const rocker = b.add('switch-rocker', [62, 48, FACE], { colour: 'red', on: true }, [90, 0, 0], 'Power')

  /* --- Closing up. Clear sides, and a brushed lid so the device has a top
     to it rather than being a fish tank on four posts. */
  b.add('panel-sheet', [-W / 2 + T, IN + HW / 2, 0], { material: 'acrylic-clear', width: HW, depth: D - T * 2 }, [0, 0, 90], 'Left side')
  b.add('panel-sheet', [W / 2, IN + HW / 2, 0], { material: 'acrylic-clear', width: HW, depth: D - T * 2 }, [0, 0, 90], 'Right side')
  b.add('panel-sheet', [0, TOP, 0], { material: 'alu-5052', width: W, depth: D, thickness: T, corner: 4 }, [0, 0, 0], 'Top cap')
  for (const px of postX) {
    for (const pz of postZ) {
      b.add('screw-bhcs', [px - POST / 2, TOP + T, pz], { thread: 'M3', length: 10, finish: 'stainless-304' }, [180, 0, 0], 'Cap screw')
    }
  }

  /* --- Wiring. Twelve volts in at the back, switched at the front, fused,
     dropped to nine for the board's own regulator, and distributed from the
     block. The board declares itself USB-powered, which is how it is flashed
     and what the solver runs it from; this chain is the one the finished
     thing lives on. */
  b.wire([jack, 'tip'], [rocker, 'a'], RED, 0.5)
  b.wire([rocker, 'b'], [fuse, 'a'], RED, 0.5)
  b.wire([fuse, 'b'], [buck, 'in'], RED, 0.5)
  b.wire([jack, 'sleeve'], [buck, 'ing'], BLACK, 0.5)
  b.wire([cap, 'p'], [buck, 'in'], RED, 0.3)
  b.wire([cap, 'n'], [buck, 'ing'], BLACK, 0.3)
  /*
   * Both wires of a pair land on the same way of the block.
   *
   * A way is one screw, not a pair of them: t1 and t2 are two separate
   * terminals, and feeding the converter into t1 and taking the board off t2
   * joins nothing. It also costs more than a dead board — with its output on
   * a dead end, the converter had no reference at all, and the solver spent
   * twenty-five milliseconds a timestep failing to find one. The whole
   * device ran at four ten-thousandths of real time and the display never
   * finished its own wake-up sequence.
   */
  b.wire([buck, 'out'], [tb, 't1'], RED, 0.3)
  b.wire([tb, 't1'], [mcu, 'vin'], RED, 0.3)
  b.wire([buck, 'outg'], [tb, 't3'], BLACK, 0.3)
  b.wire([tb, 't3'], [mcu, 'gnd'], BLACK, 0.3)
  b.wire([usb, 'vbus'], [mcu, 'v5'], ORANGE, 0.2)
  b.wire([usb, 'gnd'], [mcu, 'gnd3'], BLACK, 0.2)

  /* The panel in four-bit mode, on the pins the LiquidCrystal example uses —
     which is also the wiring the board's own driver assumes, so these six are
     not a choice. RW to ground is write-only, which is all anybody does. */
  b.wire([mcu, 'v5'], [lcd, 'vdd'], RED, 0.16)
  b.wire([mcu, 'gnd'], [lcd, 'vss'], BLACK, 0.16)
  b.wire([mcu, 'v5'], [lcd, 'a'], RED, 0.16)
  b.wire([mcu, 'gnd2'], [lcd, 'k'], BLACK, 0.16)
  b.wire([mcu, 'gnd3'], [lcd, 'rw'], BLACK, 0.16)
  b.wire([mcu, 'd12'], [lcd, 'rs'], GREEN, 0.16)
  b.wire([mcu, 'd11'], [lcd, 'e'], GREEN, 0.16)
  b.wire([mcu, 'd5'], [lcd, 'd4'], BLUE, 0.16)
  b.wire([mcu, 'd4'], [lcd, 'd5'], BLUE, 0.16)
  b.wire([mcu, 'd3'], [lcd, 'd6'], BLUE, 0.16)
  b.wire([mcu, 'd2'], [lcd, 'd7'], BLUE, 0.16)

  /* The controls. Two quadrature lines and a push on the encoder, a button
     each, and the mode switch — every one of them returning to a ground pin
     rather than to a rail, because that is what the board has. */
  b.wire([enc, 'a'], [mcu, 'a0'], YELLOW, 0.16)
  b.wire([enc, 'b'], [mcu, 'a1'], YELLOW, 0.16)
  b.wire([enc, 'c'], [mcu, 'gnd'], BLACK, 0.16)
  b.wire([enc, 'sw1'], [mcu, 'd9'], WHITE, 0.16)
  b.wire([enc, 'sw2'], [mcu, 'gnd'], BLACK, 0.16)
  b.wire([btn[0], 'a1'], [mcu, 'd8'], WHITE, 0.16)
  b.wire([btn[0], 'b1'], [mcu, 'gnd'], BLACK, 0.16)
  b.wire([btn[1], 'a1'], [mcu, 'd10'], WHITE, 0.16)
  b.wire([btn[1], 'b1'], [mcu, 'gnd'], BLACK, 0.16)
  b.wire([tog, 'com'], [mcu, 'd13'], ORANGE, 0.16)
  b.wire([tog, 'no'], [mcu, 'gnd'], BLACK, 0.16)

  /* And what it has to say. Time off the clock chip over two wires,
     temperature off the sensor over one, and a buzzer. */
  b.wire([rtc, 'vcc'], [mcu, 'v5'], RED, 0.16)
  b.wire([rtc, 'gnd'], [mcu, 'gnd'], BLACK, 0.16)
  b.wire([rtc, 'scl'], [mcu, 'scl'], BLUE, 0.16)
  b.wire([rtc, 'sda'], [mcu, 'sda'], GREEN, 0.16)
  b.wire([dht, 'vcc'], [mcu, 'v5'], RED, 0.16)
  b.wire([dht, 'gnd'], [mcu, 'gnd'], BLACK, 0.16)
  b.wire([dht, 'data'], [mcu, 'd7'], GREEN, 0.16)
  b.wire([buzz, 'p'], [mcu, 'd6'], ORANGE, 0.16)
  b.wire([buzz, 'n'], [mcu, 'gnd'], BLACK, 0.16)

  return b.doc
}

/* ================================================================== */
/* Control cabinet                                                     */
/* ================================================================== */

/**
 * What the ESP32 in the cabinet is running.
 *
 * Kept out of the build so the build reads as placement and wiring. Four
 * zones, one at a time, which is the whole of an irrigation schedule once
 * the clock is somebody else's problem — and the modules are active low, so
 * HIGH is off.
 */
const ESP_ZONES = `const ZONES = [25, 26, 27, 14]

function setup() {
  for (const p of ZONES) {
    pinMode(p, OUTPUT)
    digitalWrite(p, HIGH)
  }
}

function* loop() {
  for (const p of ZONES) {
    digitalWrite(p, LOW)
    yield delay(1500)
    digitalWrite(p, HIGH)
    yield delay(400)
  }
}
`

/**
 * Four switched outputs behind a clear door.
 *
 * The other half of what a finished thing looks like. The terminal is a
 * consumer object — a screen, a knob, a case you would put on a desk — and
 * this is the same amount of work done to industrial habits: a rail, modules
 * clipped onto it in a row, lever connectors instead of a spliced loom, and
 * every wire leaving the box through a numbered terminal. Nothing in here is
 * cleverer than the terminal. It is laid out differently because it is
 * maintained differently, and that is most of what a panel is.
 *
 * Two boards, which is not clutter. The ESP32 holds the schedule and the
 * network; the other board drives the display in the door, because the panel
 * decodes a real four-bit bus and bit-banging one from a sketch is a page of
 * code rather than a build. They talk over two wires, which is exactly the
 * arrangement anybody who has put a screen on an ESP project ends up with.
 */
export function controlCabinet(): Doc {
  const b = new Builder('Control cabinet')

  const W = 240
  const D = 160
  const T = 3
  const FOOT = 20
  const FLOOR = FOOT * 0.45
  const IN = FLOOR + T
  /* 185 rather than 230. At 230 everything on the floor sat in the bottom
     sixth of the picture with half a cabinet of air above it, which is not
     how a panel is built — a panel is as tall as what is in it plus the
     room to get a hand in. */
  const HW = 185
  const TOP = IN + HW
  const POST = 12
  const DOORT = 4
  /** Where a part mounted through the door is placed: its outside face. */
  const FACE = D / 2

  b.add('panel-sheet', [0, FLOOR, 0], { material: 'abs-black', width: W, depth: D, thickness: T, corner: 4 }, [0, 0, 0], 'Base')
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.add('rubber-foot', [sx * (W / 2 - 16), 0, sz * (D / 2 - 16)], { dia: FOOT }, [0, 0, 0], 'Foot')
    }
  }

  /* Posts short enough to leave the door its own 4 mm, so the acrylic lands
     on the walls rather than on the corners. */
  const postX = [-(W / 2 - T) + POST, W / 2 - T]
  const postZ = [-(D / 2 - DOORT - POST / 2 - 1), D / 2 - DOORT - POST / 2 - 1]
  for (const px of postX) {
    for (const pz of postZ) {
      b.add('tube-square', [px, IN + HW / 2, pz], { size: POST, wall: 1.5, length: HW, material: 'alu-anod-black' }, [0, 0, 90], 'Corner post')
    }
  }
  for (const px of postX) {
    for (const pz of postZ) {
      b.add('screw-bhcs', [px - POST / 2, FLOOR, pz], { thread: 'M3', length: 10, finish: 'steel-zinc' }, [0, 0, 0], 'Base screw')
    }
  }

  b.add('panel-sheet', [0, IN + HW / 2, -D / 2], { material: 'abs-black', width: W - T * 2, depth: HW }, [90, 0, 0], 'Back wall')

  /* --- The rail, and the row of modules on it. A rail puts everything at one
     height and one depth, which is the whole reason it exists: the four
     outputs below come out as four identical runs rather than four different
     ones. */
  b.add('din-rail', [0, IN, -52], { length: 220 }, [0, 0, 0], 'DIN rail')
  const relayX = [-78, -26, 26, 78]
  const relay = relayX.map((x, i) =>
    b.add('relay-module', [x, IN + 8, -52], { coilV: '5', activeLow: true }, [0, 0, 0], `Zone ${i + 1} relay`),
  )

  /* Field wiring leaves through these and nothing else, one pair a zone. */
  const zone = [-84, -28, 28, 84].map((x, i) =>
    b.add('terminal-block', [x, IN, -22], { ways: 2, pitch: '5.08' }, [0, 0, 0], `Zone ${i + 1} out`),
  )

  /* --- The two boards. The one that drives the door sits on the left, under
     the display it drives; the ESP32 is on the right, under nothing. */
  for (const [ax, az] of [[-20, 24], [32, 11], [32, -7], [-19, -24]] as const) {
    b.add('standoff-hex', [-30 + ax, IN, 10 + az], { thread: 'M3', length: 8, ends: 'mf', material: 'nylon-black' }, [0, 0, 0], 'Board standoff')
  }
  const mcu = b.add(
    'mcu-board',
    [-30, IN + 8, 10],
    { program: 'lcd-clock', text1: 'ZONE CONTROL', mask: 'fr4-black' },
    [0, 0, 0],
    'Panel display board',
  )

  for (const [ax, az] of [[-20, 9], [20, 9], [-20, -9], [20, -9]] as const) {
    b.add('standoff-hex', [45 + ax, IN, 10 + az], { thread: 'M2.5', length: 6, ends: 'mf', material: 'nylon-black' }, [0, 0, 0], 'Board standoff')
  }
  const esp = b.add(
    'esp-board',
    [50, IN + 6, 10],
    {
      board: 'doit-30',
      program: 'custom',
      code: ESP_ZONES,
    },
    [0, 90, 0],
    'ESP32',
  )
  /* The board's rails are named for the pins they come out on rather than for
     what they carry: five volts in is vin, the regulator's output is v33r14,
     the ground is gndl13. */
  const V5 = 'vin'
  const GND = 'gndl13'

  /*
   * --- Supply, protection, and one lever rail on each side wall.
   *
   * The two rails face each other across the cabinet rather than sitting
   * side by side at the front, and that is a wiring decision rather than a
   * styling one. In a row, every wire leaving the far rail crosses the near
   * one — four relay coils, two boards and the field return, all of them
   * threading between two connectors nobody can then get a screwdriver to.
   * Split, the positive chain starts at the left-hand relay and the return
   * chain at the right-hand one, and no run crosses anything.
   */
  /* Incoming terminal, fuse and switch all on the right, one above the other.
     Split across the cabinet they were two 200 mm diagonals of red cable
     through the middle of the picture, for a circuit that is four
     centimetres of wire if the parts are put where the wire wants them. */
  const supply = b.add('terminal-block', [92, IN, 56], { ways: 2, pitch: '7.62' }, [0, 0, 0], 'Supply in')
  const fuse = b.add('fuse-glass', [60, IN, 66], { rating: '3', speed: 'slow' }, [0, 0, 0], 'Fuse')
  const buck = b.add('buck-converter', [0, IN, 60], { vout: 5, imax: 3 }, [0, 0, 0], 'Buck converter')
  const pos = b.add('wago-lever', [-90, IN, 20], { ways: '5' }, [0, 0, 0], '+5 V rail')
  const neg = b.add('wago-lever', [90, IN, 20], { ways: '5' }, [0, 0, 0], '0 V rail')

  /* --- The door, and the interface in it. */
  b.add('panel-sheet', [0, IN + HW / 2, FACE - DOORT], { material: 'acrylic-clear', width: W - T * 2, depth: HW, thickness: DOORT }, [90, 0, 0], 'Door')
  const lcd = b.add('display-lcd-character', [-40, 150, FACE], { format: '1602', mask: 'fr4-black' }, [90, 0, 0], 'Panel display')
  const hand = b.add('switch-toggle', [25, 150, FACE], { poles: 'spst', on: false }, [90, 0, 0], 'Hand / auto')
  const rocker = b.add('switch-rocker', [70, 150, FACE], { colour: 'red', on: true }, [90, 0, 0], 'Mains')
  for (const px of postX) {
    for (const py of [IN + 30, TOP - 30]) {
      b.add('screw-bhcs', [px - POST / 2, py, D / 2], { thread: 'M3', length: 12, finish: 'steel-zinc' }, [-90, 0, 0], 'Door screw')
    }
  }

  /* --- Sides and cap. */
  b.add('panel-sheet', [-W / 2 + T, IN + HW / 2, 0], { material: 'acrylic-clear', width: HW, depth: D - T * 2 }, [0, 0, 90], 'Left side')
  b.add('panel-sheet', [W / 2, IN + HW / 2, 0], { material: 'acrylic-clear', width: HW, depth: D - T * 2 }, [0, 0, 90], 'Right side')
  b.add('panel-sheet', [0, TOP, 0], { material: 'abs-black', width: W, depth: D, thickness: T, corner: 4 }, [0, 0, 0], 'Top cap')
  for (const px of postX) {
    for (const pz of postZ) {
      b.add('screw-bhcs', [px - POST / 2, TOP + T, pz], { thread: 'M3', length: 10, finish: 'steel-zinc' }, [180, 0, 0], 'Cap screw')
    }
  }

  /* --- Wiring. In at the terminal, up to the switch in the door, back down
     through the fuse, into the converter, and out onto the two rails. */
  b.wire([supply, 't1'], [rocker, 'a'], RED, 0.8)
  b.wire([rocker, 'b'], [fuse, 'a'], RED, 0.8)
  b.wire([fuse, 'b'], [buck, 'in'], RED, 0.8)
  b.wire([supply, 't2'], [buck, 'ing'], BLACK, 0.8)
  b.wire([buck, 'out'], [pos, 'w1'], RED, 0.5)
  b.wire([buck, 'outg'], [neg, 'w1'], BLACK, 0.5)

  /* Both boards off the converter directly rather than off the rails. A coil
     collapsing on a rail a board is sharing is what browns the board out,
     and this one has a display on it that shows exactly that when it
     happens. */
  b.wire([buck, 'out'], [mcu, 'vin'], RED, 0.3)
  b.wire([buck, 'outg'], [mcu, 'gnd'], BLACK, 0.3)
  b.wire([buck, 'out'], [esp, V5], RED, 0.3)
  b.wire([buck, 'outg'], [esp, GND], BLACK, 0.3)

  /*
   * The coils, jumpered along the row.
   *
   * One wire from each rail to the end of the row and a link between
   * neighbours after that: 52 mm a hop, which is what laying the modules in
   * a row is for. Fanned out from the rail instead it is eight long
   * diagonals across the middle of the cabinet, which is where a hand goes
   * when something needs changing.
   */
  b.wire([pos, 'w2'], [relay[0], 'vcc'], RED, 0.2)
  for (let i = 1; i < 4; i++) b.wire([relay[i - 1], 'vcc'], [relay[i], 'vcc'], RED, 0.2)
  b.wire([neg, 'w2'], [relay[3], 'gnd'], BLACK, 0.2)
  for (let i = 3; i > 0; i--) b.wire([relay[i], 'gnd'], [relay[i - 1], 'gnd'], BLACK, 0.2)

  /* Switched on the high side, which is what a contact is for: the supply
     reaches the common, the normally-open goes out to the field terminal,
     and the four returns are commoned the same way the coils are. */
  b.wire([supply, 't1'], [relay[3], 'com'], RED, 0.8)
  for (let i = 3; i > 0; i--) b.wire([relay[i], 'com'], [relay[i - 1], 'com'], RED, 0.8)
  for (let i = 0; i < 4; i++) b.wire([relay[i], 'no'], [zone[i], 't1'], ORANGE, 0.8)
  for (let i = 1; i < 4; i++) b.wire([zone[i - 1], 't2'], [zone[i], 't2'], BLACK, 0.8)
  b.wire([zone[3], 't2'], [neg, 'w3'], BLACK, 0.8)

  /*
   * Four outputs from the ESP32, routed behind the other board.
   *
   * The straight line from one board to the other passes through the middle
   * of it. A waypoint behind both puts the four of them in the gap between
   * the field terminals and the rail, which is where they would be dressed.
   */
  const sig = ['io25', 'io26', 'io27', 'io14'] as const
  for (let i = 0; i < 4; i++) {
    const via: Vec3[] = [[20, IN + 22, -32], [relayX[i] + 20, IN + 24, -34]]
    b.wireVia([esp, sig[i]], [relay[i], 'in'], via, YELLOW, 0.16)
  }

  /* Two wires between the boards, crossed, and a shared ground — the thing
     everybody forgets and then spends an evening on. */
  b.wire([esp, 'io17'], [mcu, 'd0'], GREEN, 0.16)
  b.wire([esp, 'io16'], [mcu, 'd1'], BLUE, 0.16)
  b.wire([esp, GND], [mcu, 'gnd2'], BLACK, 0.16)
  b.wire([hand, 'com'], [esp, 'io32'], WHITE, 0.16)
  b.wire([hand, 'no'], [esp, GND], BLACK, 0.16)

  /*
   * And the loom up to the door.
   *
   * Hand-routed, because the shortest clear line from the board to a display
   * 170 mm above it goes diagonally across the middle of the cabinet, which
   * is the one place a loom must not be. A real panel takes this up the side
   * in a bundle and leaves a loop at the hinge; the two waypoints are that
   * bundle.
   */
  const up: Vec3[] = [[-86, 80, 40], [-72, 132, 68]]
  const toLcd = (from: string, to: string, color: string): void =>
    b.wireVia([mcu, from], [lcd, to], up, color, 0.16)
  toLcd('v5', 'vdd', RED)
  toLcd('gnd', 'vss', BLACK)
  toLcd('v5', 'a', RED)
  toLcd('gnd2', 'k', BLACK)
  toLcd('gnd3', 'rw', BLACK)
  toLcd('d12', 'rs', GREEN)
  toLcd('d11', 'e', GREEN)
  toLcd('d5', 'd4', BLUE)
  toLcd('d4', 'd5', BLUE)
  toLcd('d3', 'd6', BLUE)
  toLcd('d2', 'd7', BLUE)

  return b.doc
}
