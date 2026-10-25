import type { Doc } from '@/state/doc'
import type { Vec3 } from '@/parts/kernel/types'
import { BLACK, BLUE, Builder, GREEN, ORANGE, RED, WHITE, YELLOW } from './builds'

/*
 * Mains core colours, which are not the signal colours and never were.
 * Brown is live, blue is neutral, green-and-yellow is earth; using the
 * breadboard red and black for a 230 V run is the one thing in a picture of
 * a mains build that an electrician would notice immediately.
 */
const BROWN = '#7A4A2B'
const BLUE_N = '#2F6BD8'
const GREEN_E = '#9FBF2B'

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

/* ================================================================== */
/* LED message board                                                   */
/* ================================================================== */

/**
 * A sign, four rows of matrix modules on a stand.
 *
 * Forty-eight MAX7219 modules in four chains, three thousand and seventy-two
 * dots, and a message laid across the whole width in the same 5 by 7 font a
 * character LCD uses. It is the biggest single thing in the catalog measured
 * in light, and it is here because the question everybody asks about a
 * design tool is what it can make rather than what it can draw.
 *
 * Honest about one thing: what the panels show is a parameter on the part,
 * not something decoded off the clock and data lines. The chain is wired the
 * way a chain is wired — in at the left of a row, out at the right, on to
 * the next — and the current it would pull is why the converter is a five
 * amp one rather than the usual two. But the pin protocol for this part is
 * not simulated, so the sign shows what the build says it shows.
 *
 * Twelve modules is ninety-six columns, and a character is six of them, so
 * a row holds sixteen. The lines below are exactly that long or padded to
 * sit in the middle, because a sign with its text hard against the left edge
 * looks like a sign that has gone wrong.
 */
export function messageBoard(): Doc {
  const b = new Builder('LED message board')

  const MODULES = 12
  /** A module is 32 mm square, so a row is this wide and this tall. */
  const ROW = 32
  const SIGN = MODULES * ROW
  const PANEL_W = SIGN + 56
  const PANEL_H = ROW * 4 + 62
  const T = 6
  /** The front face of the backing panel. Modules stand off it. */
  const FACE = T
  const STANDOFF = 8
  const DOTS = FACE + STANDOFF
  /*
   * The eight millimetres of air between the panel and the backs of the
   * modules, which is where the loom is dressed.
   *
   * Worth deriving rather than guessing: the first cut put it at
   * DOTS - STANDOFF - 2, which is inside the backing panel, and the whole
   * harness came up the front of the sign and across the face of it.
   */
  const BEHIND = FACE + 2

  /* Base, legs, and the backing panel they carry. The panel's bottom edge is
     high enough that the message is at eye level on a bench. */
  const BASE_Y = 15
  /*
   * Most of a metre of leg, and that is a framing decision as much as a
   * practical one. A sign on short legs is a wide, shallow object, and a
   * wide shallow object in a nine-by-sixteen frame is a band across the
   * middle with bench above and below it. Standing it at eye level makes
   * the whole thing about as tall as it is wide, which is what a portrait
   * frame wants — and is also where you would actually put a sign.
   */
  const LEG = 900
  const PANEL_BOT = BASE_Y + LEG - PANEL_H

  b.add('panel-sheet', [0, 0, 0], { material: 'plywood', width: PANEL_W + 120, depth: 260, thickness: BASE_Y, corner: 8 }, [0, 0, 0], 'Base')

  /* A square tube is authored along X with its underside at y = 0, so
     standing one up is [0, 0, 90] and it occupies its own width in -x from
     where it is placed. Placing the pair at -(W/2) and +(W/2 + 25) is what
     makes the two bodies symmetric about the middle rather than both
     offset the same way. */
  const legX = PANEL_W / 2
  for (const [x, name] of [[-legX, 'Left leg'], [legX + 25, 'Right leg']] as const) {
    b.add('tube-square', [x, BASE_Y + LEG / 2, 0], { size: 25, wall: 2, length: LEG, material: 'alu-anod-black' }, [0, 0, 90], name)
  }
  /* A bracket each side, foot inboard. The L is authored with its upright
     in +y and its foot in +x, so the right-hand one is turned through 180
     rather than placed differently. */
  b.add('bracket-l', [-legX, BASE_Y, 0], { leg: 60, width: 25, thick: 3, finish: 'steel-zinc' }, [0, 0, 0], 'Leg foot')
  b.add('bracket-l', [legX, BASE_Y, 0], { leg: 60, width: 25, thick: 3, finish: 'steel-zinc' }, [0, 180, 0], 'Leg foot')

  b.add('panel-sheet', [0, PANEL_BOT + PANEL_H / 2, 0], { material: 'abs-black', width: PANEL_W, depth: PANEL_H, thickness: T, corner: 6 }, [90, 0, 0], 'Backing panel')

  /* --- The sign itself. Four rows, top first, the way they read.
     A row of modules mounted [90, 0, 0] faces +z with its columns along X
     and its first row of dots at the top, which is what the font wants. */
  const lines = [
    'DESIGN THE WHOLE',
    'BUILD BEFORE YOU',
    ' SPEND A PENNY',
    '  DRAFTRIG.COM',
  ]
  const top = PANEL_BOT + PANEL_H / 2 + ROW * 1.5
  const rows = lines.map((text, i) => {
    const y = top - i * ROW
    for (const sx of [-1, 1] as const) {
      b.add('standoff-hex', [sx * (SIGN / 2 - 10), y, FACE], { thread: 'M3', length: STANDOFF, ends: 'mf', material: 'nylon-black' }, [90, 0, 0], 'Panel standoff')
    }
    return b.add(
      'led-matrix-8x8',
      [0, y, DOTS],
      { modules: MODULES, color: 'red', intensity: 11, text },
      [90, 0, 0],
      `Row ${i + 1}`,
    )
  })

  /* --- The gear on the base. A sign this size is most of an amp at full
     brightness and three at white-out, which is why the converter is rated
     where it is and why the supply comes in on a fused terminal rather than
     a barrel jack. */
  const supply = b.add('terminal-block', [160, BASE_Y, 62], { ways: 2, pitch: '7.62' }, [0, 0, 0], 'Supply in')
  const fuse = b.add('fuse-glass', [118, BASE_Y, 62], { rating: '5', speed: 'slow' }, [0, 0, 0], 'Fuse')
  const buck = b.add('buck-converter', [60, BASE_Y, 62], { vout: 5, imax: 5 }, [0, 0, 0], 'Buck converter')
  const tog = b.add('switch-toggle', [-150, BASE_Y, 62], { poles: 'spst', on: true }, [0, 0, 0], 'Power')
  /* Nothing is written to the chain here: the message is set on the parts.
     A board that claims to be running a sketch it is not running is worse
     than one that admits it is only holding the wires. */
  const mcu = b.add('mcu-board', [-50, BASE_Y, 62], { program: 'off', mask: 'fr4-black' }, [0, 0, 0], 'Controller')

  /* --- Wiring. In, switched, fused, down to five volts, then the chain. */
  b.wire([supply, 't1'], [tog, 'com'], RED, 0.8)
  b.wire([tog, 'no'], [fuse, 'a'], RED, 0.8)
  b.wire([fuse, 'b'], [buck, 'in'], RED, 0.8)
  b.wire([supply, 't2'], [buck, 'ing'], BLACK, 0.8)
  b.wire([buck, 'out'], [mcu, 'vin'], RED, 0.5)
  b.wire([buck, 'outg'], [mcu, 'gnd'], BLACK, 0.5)

  /*
   * Up the left-hand side to the bottom row, then row to row.
   *
   * Hand-routed, and it has to be: the straight line from the base to a row
   * of modules goes through the face of the sign, and the straight line from
   * one row's output to the next row's input goes diagonally across the
   * dots. Both of those belong in the eight millimetres of air the standoffs
   * leave behind the panels, which is exactly where a real one is dressed.
   */
  /* Up behind the left leg, round the bottom edge of the panel, and into
     the gap. Crossing the panel rather than going under it puts the whole
     loom through 6 mm of ABS, and brushing the leg on the way up costs
     seven millimetres of wire inside a 25 mm tube. */
  const side = -PANEL_W / 2 + 20
  const up: Vec3[] = [
    [side, BASE_Y + 240, -40],
    [side, PANEL_BOT - 65, -16],
    [side, PANEL_BOT - 23, BEHIND + 2],
  ]
  const last = rows[rows.length - 1]
  b.wireVia([buck, 'out'], [last, 'vcc'], up, RED, 0.5)
  b.wireVia([buck, 'outg'], [last, 'gnd'], up, BLACK, 0.5)
  b.wireVia([mcu, 'd11'], [last, 'din'], up, GREEN, 0.16)
  b.wireVia([mcu, 'd10'], [last, 'cs'], up, YELLOW, 0.16)
  b.wireVia([mcu, 'd13'], [last, 'clk'], up, BLUE, 0.16)

  /* Out of the right-hand end of one row and back along the top of the next,
     which is the loop you see hanging behind every one of these. */
  for (let i = rows.length - 1; i > 0; i--) {
    const a = rows[i]
    const c = rows[i - 1]
    const mid = top - (i - 0.5) * ROW
    const via: Vec3[] = [[SIGN / 2 + 20, mid, BEHIND], [-SIGN / 2 - 20, mid, BEHIND]]
    b.wireVia([a, 'vcco'], [c, 'vcc'], via, RED, 0.5)
    b.wireVia([a, 'gndo'], [c, 'gnd'], via, BLACK, 0.5)
    b.wireVia([a, 'dino'], [c, 'din'], via, GREEN, 0.16)
    b.wireVia([a, 'cso'], [c, 'cs'], via, YELLOW, 0.16)
    b.wireVia([a, 'clko'], [c, 'clk'], via, BLUE, 0.16)
  }

  return b.doc
}

/* ================================================================== */
/* Desk setup                                                          */
/* ================================================================== */

/**
 * A desk, and everything plugged in at it.
 *
 * Not a circuit. It is the other thing people turn up wanting to lay out —
 * where the monitors go, how long the HDMI has to be to get from a tower on
 * the floor to a screen on an arm, and whether the whole lot will run off
 * the one socket behind the desk.
 *
 * That last question is the one worth having a solver for, and the answer
 * here is no. A tower, two monitors, a charger and a router come to about
 * 350 W between them, which is nothing. A three kilowatt fan heater on the
 * same extension lead is not nothing, and the lead is rated at thirteen amps
 * for everything plugged into it put together — so this build opens with the
 * checks already complaining, which is the point of it.
 *
 * Turn the heater down to 1 kW, or move it to its own socket, and watch them
 * clear. That is the whole argument for drawing a room before wiring it.
 */
export function deskSetup(): Doc {
  const b = new Builder('Desk setup')

  const DW = 1600
  const DD = 750
  const DH = 740

  b.add('desk', [0, 0, 0], { width: DW, depth: DD, height: DH, top: 'oak', frame: 'sit-stand' }, [0, 0, 0], 'Desk')

  /* The socket behind the desk, at skirting height. Everything in the room
     is downstream of this one pair of terminals. */
  const wall = b.add('outlet-mains', [-520, 300, -DD / 2 - 40], { region: 'uk', ways: '2', switched: true }, [0, 0, 0], 'Wall socket')

  /* One lead under the desk, and this is where it gets interesting: six ways
     does not mean six times the current. */
  const lead = b.add('extension-lead', [-120, 60, -DD / 2 + 120], { ways: '6', length: 2000, fuse: '13' }, [0, 0, 0], 'Extension lead')

  /* --- On the desk. */
  /*
   * The arm, and the screen actually on the end of it.
   *
   * Worth getting right rather than drawing an arm near a monitor: the arm
   * is authored reaching along its own +x with the VESA plate at the end,
   * so [0, -90, 0] turns that reach to +z, over the desk. The screen then
   * goes where the plate is — clamp at the rear edge, 240 of reach, and the
   * plate 350 above the clamp, which puts the panel centre 350 above the
   * top and 110 back from the middle. Pointed the other way the boom hangs
   * off the back of the desk, which is where the first cut had it and is
   * also what the mains run was going through.
   */
  const ARM_REACH = 240
  const ARM_POST = 420
  const ARM_Z = -DD / 2 + 20
  b.add('monitor-arm', [-330, DH, ARM_Z], { reach: ARM_REACH, height: ARM_POST, load: '2-9' }, [0, -90, 0], 'Monitor arm')
  const mon1 = b.add('monitor-desk', [-330, DH + ARM_POST - 70 - 188, ARM_Z + ARM_REACH + 4 + 21], { diagonal: '27', hz: '144', stand: false }, [0, 0, 0], 'Monitor, left')
  const mon2 = b.add('monitor-desk', [330, DH, -DD / 2 + 180], { diagonal: '27', hz: '60', stand: true }, [0, -18, 0], 'Monitor, right')
  const lap = b.add('laptop', [330, DH, 170], { diagonal: '14', lid: 105, watts: '65' }, [0, -12, 0], 'Laptop')
  const handset = b.add('phone-handset', [-620, DH, 120], { size: 'standard', stand: true }, [0, 14, 0], 'Phone')
  const psu = b.add('charger-usb-mains', [-120, 112, -DD / 2 + 120], { watts: '65', ports: '2', load: 70 }, [0, 0, 0], 'USB charger')

  /* --- Under it. */
  const pc = b.add('pc-tower', [600, 0, -DD / 2 + 230], { size: 'midi', psu: '850', gpu: true, load: 35 }, [0, -24, 0], 'Tower')
  const net = b.add('router-wifi', [-660, 0, -DD / 2 + 160], { aerials: 4, ports: '4' }, [0, 0, 0], 'Router')
  /* And the thing that makes it a question rather than a layout. Everything
     else at this desk together is about 650 W; a fan heater on high is five
     times that, and it is on the same lead. */
  const heat = b.add('heater-fan', [120, 0, 240], { watts: '3000', on: true }, [0, 12, 0], 'Fan heater')

  /*
   * --- Mains, routed along the floor.
   *
   * Hand-routed, and for once not to dodge an obstacle. A cable between two
   * things a metre and a half apart does not take the straight line between
   * their sockets: it falls to the floor, crosses, and comes back up. Left
   * to the router these came out as taut diagonals through the middle of the
   * room, which is the one thing a picture of a room must not look like.
   *
   * Three waypoints each: down behind the thing it leaves, along the floor,
   * and up behind the thing it arrives at. Desk-mounted kit comes up behind
   * the rear edge rather than through the top, which is what the grommet in
   * a real desk is for.
   */
  const FLOOR = 26
  /* The line the desk cables climb, 55 mm behind the back edge. Twenty was
     not enough: the arm's boom reaches to 20 behind the edge itself, and
     the left monitor's supply came up through it. */
  const REAR = -DD / 2 - 55
  const at = (id: string): Vec3 => b.doc.instances[id].pos

  /** Down to the floor, across, and up — for anything standing on the floor. */
  const floorRun = (from: string, to: string, pair: [string, string], color: string, g: number): void => {
    const a = at(from)
    const c = at(to)
    b.wireVia([from, pair[0]], [to, pair[1]], [
      [a[0], FLOOR, a[2] - 110],
      [c[0], FLOOR, c[2] - 110],
    ], color, g)
  }

  /** Down to the floor and up again behind the desk, for anything on it. */
  const deskRun = (from: string, to: string, pair: [string, string], color: string, g: number): void => {
    const a = at(from)
    const c = at(to)
    b.wireVia([from, pair[0]], [to, pair[1]], [
      [a[0], FLOOR, a[2] - 90],
      /* Up on the socket side of the thing, not the far side: climbing on
         the far side means the last hop crosses the whole width of whatever
         is in the way, which for the arm-mounted screen is the arm. */
      [c[0] + 60, FLOOR, REAR],
      [c[0] + 60, c[1] + 60, REAR],
    ], color, g)
  }

  /*
   * Two and a half rather than the one and a half a real 13 A flex is.
   *
   * The solver rates a conductor at 6 A per square millimetre, which is the
   * figure for wiring bundled inside a chassis rather than for a flex lying
   * on a floor in free air — the real cable is good for about sixteen amps
   * and the model calls it nine. Sized at 1.5 the build filled the checks
   * with complaints about the cable, which buried the complaint that
   * matters: the socket. Sized at 2.5 the only thing left saying anything
   * is the thing that should be.
   */
  const CORES: [string, string, string, number][] = [
    ['l', 'l', BROWN, 2.5],
    ['n', 'n', BLUE_N, 2.5],
    ['e', 'e', GREEN_E, 2.5],
  ]

  /* Socket to lead. The second face of the socket is left spare, and it is
     worth knowing that taking it would not help: both faces are the same
     pair of terminals behind the plate. */
  for (const [pa, pb, col] of CORES) {
    b.wireVia([wall, `a${pa}`], [lead, pb], [[-520, FLOOR, REAR], [at(lead)[0], FLOOR, at(lead)[2] - 110]], col, 2.5)
  }

  /* On the desk lead: the tower, both monitors, the charger and the heater. */
  const onFloor: [string, number][] = [[pc, 1], [heat, 2]]
  for (const [id, way] of onFloor) {
    for (const [pa, pb, col, g] of CORES) floorRun(lead, id, [`${way}${pa}`, pb], col, g)
  }
  const onDesk: [string, number][] = [[mon1, 3], [mon2, 4]]
  for (const [id, way] of onDesk) {
    for (const [pa, pb, col, g] of CORES) deskRun(lead, id, [`${way}${pa}`, pb], col, g * 0.4)
  }
  /* The charger is plugged straight into the lead, so it is a plug rather
     than a run: no floor, no waypoints, 40 mm of lead. */
  for (const [pa, pb, col] of CORES) b.wire([lead, `5${pa}`], [psu, pb], col, 0.75)

  /* --- Low voltage, which is short enough to leave alone. */
  b.wire([psu, 'vbus1'], [lap, 'usbc'], WHITE, 0.5)
  b.wire([psu, 'gnd1'], [lap, 'usbcg'], BLACK, 0.5)
  b.wire([psu, 'vbus2'], [handset, 'usbc'], WHITE, 0.3)
  b.wire([psu, 'gnd2'], [handset, 'usbcg'], BLACK, 0.3)

  /* --- Picture and network. These carry nothing worth solving; what they
     carry is length, and length is the reason they are drawn. A metre and a
     half of HDMI does not reach from the floor to an arm, and that is a
     thing worth finding out before the cable is bought. */
  for (const [from, fp, to, tp] of [
    [pc, 'dp1', mon1, 'dp'],
    [pc, 'hdmi', mon2, 'hdmi'],
  ] as [string, string, string, string][]) {
    const a = at(from)
    const c = at(to)
    b.wireVia([from, fp], [to, tp], [[a[0], FLOOR + 10, a[2] - 130], [c[0], FLOOR + 10, c[2] - 130]], BLACK, 0.4)
  }
  b.wire([lap, 'hdmi'], [mon2, 'usbc'], BLACK, 0.4)
  const n = at(net)
  const c = at(pc)
  b.wireVia([net, 'lan1'], [pc, 'eth'], [[n[0], FLOOR, n[2] - 120], [c[0], FLOOR, c[2] - 130]], YELLOW, 0.3)

  return b.doc
}


/* ------------------------------------------------------------------ */

/**
 * A room, with a setup laid out in it.
 *
 * The other builds are objects. This one is a space, and the question it
 * answers is the one anybody planning a setup actually has: does this fit
 * along that wall, and does the wall it is against have enough sockets.
 *
 * The room shell puts its corner at the origin and runs +x and +z, so every
 * position here reads as a distance from the back-left corner — which is
 * how you would measure it standing in the room with a tape. Nothing is
 * centred on the origin the way a single device is, because a room has a
 * corner and a device has a middle.
 */
export function roomSetup(): Doc {
  const b = new Builder('Room setup')

  const RW = 4200
  const RD = 3600
  const at = (id: string): Vec3 => b.doc.instances[id].pos

  b.add('room-shell', [0, 0, 0], { width: RW, depth: RD, height: 2400, paint: 'warm', floor: 'oak', skirting: true, sockets: 2 }, [0, 0, 0], 'Room')

  /* --- the desk, against the back wall --- */
  const DW = 1600
  const DD = 750
  const DH = 740
  const DX = 1180
  const DZ = DD / 2 + 70 /* 70 mm of clearance behind, for the cables */

  b.add('desk', [DX, 0, DZ], { width: DW, depth: DD, height: DH, top: 'oak', frame: 'sit-stand' }, [0, 0, 0], 'Desk')

  const ARM_REACH = 240
  const ARM_POST = 420
  const ARM_Z = DZ - DD / 2 + 20
  b.add('monitor-arm', [DX - 330, DH, ARM_Z], { reach: ARM_REACH, height: ARM_POST, load: '2-9' }, [0, -90, 0], 'Monitor arm')
  b.add('monitor-desk', [DX - 330, DH + ARM_POST - 70 - 188, ARM_Z + ARM_REACH + 25], { diagonal: '27', hz: '144', stand: false }, [0, 0, 0], 'Monitor, left')
  b.add('monitor-desk', [DX + 330, DH, DZ - DD / 2 + 180], { diagonal: '27', hz: '60', stand: true }, [0, -16, 0], 'Monitor, right')
  const pc = b.add('pc-tower', [DX + 640, 0, DZ - DD / 2 + 240], { size: 'midi', psu: '850', gpu: true, load: 35 }, [0, -22, 0], 'Tower')

  /* --- the television, on the left wall --- */
  /* Authored facing +z, so a quarter turn puts its face into the room. */
  const tv = b.add('tv-set', [120, 950, 2300], { diagonal: '55', stand: false }, [0, 90, 0], 'Television')
  const bar = b.add('soundbar', [160, 760, 2300], { watts: 200 }, [0, 90, 0], 'Soundbar')
  const con = b.add('console-game', [210, 0, 2650], { load: 70 }, [0, 90, 0], 'Console')

  /* --- mains --- */
  const w1 = b.add('outlet-mains', [RW / 3, 450, 14], { region: 'uk', ways: '2', switched: true }, [0, 0, 0], 'Socket, desk wall')
  const w2 = b.add('outlet-mains', [(RW * 2) / 3, 450, 14], { region: 'uk', ways: '2', switched: true }, [0, 0, 0], 'Socket, media wall')
  const lead = b.add('extension-lead', [DX - 120, 60, DZ - DD / 2 + 130], { ways: '6', length: 2000, fuse: '13' }, [0, 0, 0], 'Extension lead')

  /* The lead's ways are named way-then-core: 1l, 1n, 1e for the first. */
  const CORES: [string, string][] = [['l', BROWN], ['n', BLUE_N], ['e', GREEN_E]]
  const FLOORY = 26

  /** A run that drops to the floor, crosses, and comes back up. */
  const floorRun = (from: string, to: string, ports: [string, string], col: string, mm2: number) => {
    const a = at(from)
    const c = at(to)
    b.wireVia([from, ports[0]], [to, ports[1]], [
      [a[0], FLOORY, a[2] + 70],
      [c[0], FLOORY, c[2] + 70],
    ], col, mm2)
  }

  /* Socket to lead, then the tower off the lead. */
  for (const [core, col] of CORES) floorRun(w1, lead, [`a${core}`, core], col, 2.5)
  for (const [core, col] of CORES) floorRun(lead, pc, [`1${core}`, core], col, 1.5)

  /* The media wall runs off its own socket, which is the point of having
     put a second one in: the television and the console are nowhere near
     the desk and nothing about them should be on the desk's lead. */
  for (const [core, col] of CORES) floorRun(w2, con, [`a${core}`, core], col, 1.5)
  for (const [core, col] of CORES) floorRun(w2, tv, [`b${core}`, core], col, 1.5)
  for (const [core, col] of CORES) floorRun(w2, bar, [`b${core}`, core], col, 1.0)

  return b.doc
}
