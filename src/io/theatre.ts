import type { Doc } from '@/state/doc'
import type { Vec3 } from '@/parts/kernel/types'
import { BLACK, Builder } from './builds'

/**
 * A home theatre, laid out the way one is actually laid out.
 *
 * This is the template the product is pointed at: a room somebody measured,
 * a screen size chosen from how far back the seats are, a projector placed
 * by arithmetic rather than by eye, two rows where the back one can see over
 * the front one, and seven speakers at the angles the standard specifies.
 *
 * Every number below is derived rather than chosen, and the derivation is in
 * the comments. That is the point of it being a template: open it, change
 * the room size, and watch what has to move.
 *
 * ------------------------------------------------------------------
 * The geometry, in the order it was worked out
 * ------------------------------------------------------------------
 *
 * The room is 4.8 × 6.6 m with a 2.5 m ceiling — a double garage or a
 * decent basement.
 *
 * A 120 inch 16:9 image is 2.656 m wide and 1.494 m tall. THX wants the
 * seat where that subtends 36 degrees, which is 4.09 m back; SMPTE's 30
 * degrees is 4.96 m. The front row here is at 3.8 m, which is 38 degrees —
 * slightly closer than THX, and deliberate, because the room has to hold
 * two rows and a walkway behind them.
 *
 * The projector is a 1.3 throw, so it hangs 1.3 × 2.656 = 3.45 m from the
 * screen, which lands it just behind the front row. On a 300 mm drop in a
 * 2.5 m ceiling the lens is at 2.08 m, and the top of the image is at
 * 2.254 m — so it needs a little lens shift down, which the mount's
 * readout says.
 *
 * The back row is 5.3 m back, on a 300 mm riser. The sightline from its eye
 * point over the front row's headrest to the bottom of the screen is what
 * that riser is for, and the riser part solves it both ways.
 *
 * Fronts want to be at 30 degrees from the front seat, which in a 4.8 m
 * room is 2.19 m either side of centre — outside the walls. They are at
 * 1.7 m instead, which is 24 degrees, and that compromise is real: a 120
 * inch screen in a room this wide cannot have its speakers where the
 * standard wants them. The readouts say 30 and the plan says 24, and that
 * disagreement is the useful part.
 */

const BROWN = '#7A4A2B'
const BLUE_N = '#2F6BD8'
const GREEN_E = '#9FBF2B'
const SPK_RED = '#C0453A'

export function homeTheatre(): Doc {
  const b = new Builder('Home theatre')

  const W = 4800
  const D = 6600
  const H = 2500
  const CX = W / 2

  /* Image geometry, from the diagonal. 120 inch, 16:9. */
  const IMG_W = 2656
  const IMG_H = 1494
  const SCREEN_BOTTOM = 760
  const SCREEN_Z = D - 60

  /* Seats, from the image width. */
  const ROW1_Z = SCREEN_Z - 3800
  const ROW2_Z = SCREEN_Z - 5300
  const RISER_H = 300

  b.add(
    'room-shell',
    [0, 0, 0],
    /*
     * Grey, not matt black.
     *
     * A real theatre is painted black and this one was. It made the
     * template unusable: every surface in a dark viewport went to the same
     * near-black, the seats disappeared into the floor, and a photograph of
     * it was a photograph of nothing. Grey keeps the room readable while
     * you work in it; paint it black on the room part when you want to see
     * what the reflections do.
     */
    { width: W, depth: D, height: H, walls: 'four', ceiling: false, paint: 'grey', floor: 'carpet', skirting: true, sockets: 4 },
    [0, 0, 0],
    'Room',
  )

  /* The way in, on the back wall, hung so it swings against the wall and
     not into the back row. */
  b.add('door-interior', [800, 0, 40], { width: 838, kind: 'swing', hinge: 'left', open: 25, swingIn: true }, [0, 0, 0], 'Door')

  /* --- The screen, which everything else is measured from. */
  const screen = b.add(
    'screen-projection',
    [CX, 0, SCREEN_Z],
    { diagonal: 120, aspect: '16:9', gain: 1.1, kind: 'fixed', bottom: SCREEN_BOTTOM, lumens: 1500 },
    [0, 180, 0],
    'Screen, 120 inch',
  )

  /* --- The projector, at the distance the throw ratio dictates. */
  b.add('mount-projector', [CX, H, SCREEN_Z - 3450], { drop: 300, load: 6800, ceiling: H, imageTop: SCREEN_BOTTOM + IMG_H }, [0, 0, 0], 'Projector mount')
  const proj = b.add(
    'projector',
    [CX, H - 420, SCREEN_Z - 3450],
    { lumens: '2500', throw: 1.3, image: IMG_W, aspect: '16:9', gain: 1.1, source: 'laser', shift: -12, on: true },
    [0, 180, 0],
    'Projector',
  )

  /*
   * --- Seating. The front row on the floor, the back row up on a riser.
   *
   * A row is built one chair at a time rather than as a single four-seat
   * part. The part will draw a row of any width, but the scan behind it is
   * one recliner: asked for four seats it has nothing honest to draw and
   * falls back to boxes. Four chairs, each drawn properly, is both the
   * better picture and the truer one — and it is how the room is actually
   * bought.
   */
  /* 800 is the widest seat the part allows, and a recliner needs the gap. */
  const SEAT_W = 880
  const seatRow = (n: number, z: number, y: number, label: string) =>
    Array.from({ length: n }, (_, i) =>
      b.add(
        'seating-cinema',
        [CX + (i - (n - 1) / 2) * SEAT_W, y, z],
        { seats: 1, width: 800, style: 'recliner', reclined: 0, eye: 1120, headrest: 1180, powered: true },
        [0, 0, 0],
        `${label} ${i + 1}`,
      ),
    )

  const row1 = seatRow(3, ROW1_Z, 0, 'Front row')
  b.add(
    'riser-seating',
    [CX, 0, ROW2_Z],
    {
      width: 4400, depth: 2400, height: RISER_H, step: true, nosing: true,
      frontEye: 1120, frontHead: 1180, rowGap: ROW1_Z - ROW2_Z, screenBottom: SCREEN_BOTTOM, toScreen: SCREEN_Z - ROW1_Z,
    },
    [0, 0, 0],
    'Riser',
  )
  const row2 = seatRow(4, ROW2_Z, RISER_H + 8, 'Back row')

  /* --- Sound.
   *
   * Seven channels and two subs' worth of work done by one. Angles are
   * measured from the front row's seat; the compromise on the fronts is
   * explained in the header.
   */
  const LR_X = 1700
  const EAR = 1120
  const toRow1 = SCREEN_Z - ROW1_Z

  const left = b.add('speaker-surround', [CX - LR_X, 0, SCREEN_Z - 300], { role: 'front', form: 'floor', impedance: '8', sensitivity: 88, watts: 110, distance: Math.hypot(LR_X, toRow1), height: EAR }, [0, 192, 0], 'Front left')
  const right = b.add('speaker-surround', [CX + LR_X, 0, SCREEN_Z - 300], { role: 'front', form: 'floor', impedance: '8', sensitivity: 88, watts: 110, distance: Math.hypot(LR_X, toRow1), height: EAR }, [0, 168, 0], 'Front right')
  const centre = b.add('speaker-surround', [CX, 0, SCREEN_Z - 240], { role: 'centre', form: 'centre', impedance: '8', sensitivity: 90, watts: 110, distance: toRow1, height: SCREEN_BOTTOM - 260 }, [0, 180, 0], 'Centre')

  /* Surrounds at 110 degrees from the front seat: just behind the listener,
     on the side walls, 600 above ear height. */
  const surL = b.add('speaker-surround', [60, 0, ROW1_Z - 500], { role: 'surround', form: 'onwall', impedance: '8', sensitivity: 87, watts: 110, distance: 2400, height: 1750 }, [0, 90, 0], 'Surround left')
  const surR = b.add('speaker-surround', [W - 60, 0, ROW1_Z - 500], { role: 'surround', form: 'onwall', impedance: '8', sensitivity: 87, watts: 110, distance: 2400, height: 1750 }, [0, -90, 0], 'Surround right')

  /* Heights, in the ceiling, slightly ahead of the front row. */
  const topL = b.add('speaker-ceiling', [CX - 1200, H, ROW1_Z + 600], { driver: '6.5', dispersion: 60, aimable: true, impedance: '8', sensitivity: 89, ceiling: H, earHeight: EAR }, [0, 0, 0], 'Height left')
  const topR = b.add('speaker-ceiling', [CX + 1200, H, ROW1_Z + 600], { driver: '6.5', dispersion: 60, aimable: true, impedance: '8', sensitivity: 89, ceiling: H, earHeight: EAR }, [0, 0, 0], 'Height right')

  const sub = b.add('subwoofer-desk', [400, 0, SCREEN_Z - 700], { driver: '12', crossover: 80, on: true, level: 25 }, [0, 24, 0], 'Subwoofer')

  /*
   * The equipment corner, standing on the riser rather than in it.
   *
   * The riser is 300 mm of platform filling the back 2.7 m of the room,
   * and all three of these were inside that footprint at floor height:
   * the rack buried to its third unit, the receiver floating 93 mm
   * above the rack top, the LED driver somewhere inside the step.
   *
   * The receiver goes in the rack rather than on it, which is what an
   * open 6U frame with three units used is for, and is also what stops
   * seven pairs of speaker cable being drawn down through the frame on
   * their way out of its back panel. Its terminals are then inside the
   * rack's own hull, where the router leaves them alone.
   */
  const avr = b.add('receiver-av', [W - 700, RISER_H + 40, 700], { channels: '7.2', watts: 110, hdmi: 6, state: 'watch' }, [0, 180, 0], 'Receiver')
  b.add('rack-network', [W - 700, RISER_H, 700], { style: 'open', height: 6, depth: 500, used: 3 }, [0, 180, 0], 'Rack')

  /* --- Treatment. First reflection points are halfway between the speaker
     and the seat on each side wall, which for this geometry is about 2.6 m
     from the screen. */
  for (const x of [40, W - 40]) {
    b.add('panel-acoustic', [x, 0, SCREEN_Z - 2600], { width: 600, height: 1200, thickness: 50, gap: 40, count: 4, wallArea: 58 }, [0, x < 100 ? 90 : -90, 0], 'Acoustic panel')
  }
  /* On the back wall, which behind the back row starts at the riser. */
  b.add('panel-acoustic', [CX - 900, RISER_H, 60], { width: 1200, height: 1200, thickness: 100, gap: 0, count: 2, wallArea: 58 }, [0, 0, 0], 'Rear absorber')

  /* --- Light. A strip under the riser nosing is part of the riser; this is
     the step lighting and the bias behind the screen. */
  const strip = b.add('strip-cob-24v', [CX, SCREEN_BOTTOM + IMG_H - 100, SCREEN_Z - 90], { length: 2400, wpm: 8, kelvin: 2700, feed: 'one', dim: 40 }, [0, 0, 0], 'Bias strip')
  const driver = b.add('driver-led', [W - 700, RISER_H + 20, 1100], { vout: '24', rating: '30', loadW: 8, dimmable: true }, [0, 0, 0], 'LED driver')

  /* ================================================================ */
  /* Wiring                                                            */
  /* ================================================================ */

  const at = (id: string): Vec3 => b.doc.instances[id].pos
  const CORES: [string, string, string][] = [
    ['l', 'l', BROWN],
    ['n', 'n', BLUE_N],
    ['e', 'e', GREEN_E],
  ]
  const FLOOR = 24
  /*
   * The riser's front edge, which is where the front row stands. Its
   * part draws a nosing and a step past the 2400 mm of depth it is
   * given, and the hull reaches ROW1_Z.
   */
  const RISER_FRONT = ROW1_Z
  /*
   * Cable height on the platform, as against on the floor.
   *
   * Sixty millimetres rather than resting on the surface, because this
   * is the height of the trunking these runs are in and because a
   * drawn cable is a spline: at 12 mm proud the sag between two
   * waypoints put every one of them back inside the riser, which is
   * the thing the trunking exists to stop.
   */
  const ON_RISER = RISER_H + 60

  /* Four socket positions on the back wall; this build uses three of them. */
  const outlet = b.add('outlet-mains', [W - 1400, 450, 20], { region: 'uk', ways: '2', switched: true }, [0, 0, 0], 'Wall socket')

  /**
   * Along the riser and up behind whatever it feeds.
   *
   * The socket is on the back wall 150 mm above the platform, and for
   * the first 2.7 m of the room there is no floor to run along — there
   * is riser. So the cable runs on the platform, and drops off the
   * front edge only for the things that are past it. Routed along the
   * floor instead, every one of these leads was drawn through the
   * inside of the riser, and the three to the receiver through the
   * rack as well.
   */
  const run = (from: string, fromPins: [string, string, string], to: string, gauge: number): void => {
    const a = at(from)
    const c = at(to)
    const beyond = c[2] > RISER_FRONT - 200
    CORES.forEach(([pa, pb, col], i) => {
      const via: Vec3[] = [[a[0], ON_RISER, a[2] + 160]]
      if (beyond) {
        via.push([c[0] - 120, ON_RISER, RISER_FRONT - 160])
        via.push([c[0] - 120, FLOOR, RISER_FRONT + 180])
        via.push([c[0] - 120, FLOOR, c[2] - 160])
      } else {
        via.push([c[0] - 120, ON_RISER, c[2] - 160])
      }
      b.wireVia([from, fromPins[i]], [to, pb], via, col, gauge)
      void pa
    })
  }

  run(outlet, ['al', 'an', 'ae'], avr, 1.5)
  run(outlet, ['bl', 'bn', 'be'], driver, 0.75)
  /* The projector is the long one: back wall to the middle of the ceiling,
     which is why it is drawn rather than assumed. */
  CORES.forEach(([pa, pb, col]) => {
    b.wireVia([outlet, `a${pa}`], [proj, pb], [
      [W - 1400, ON_RISER, 200],
      [W - 200, ON_RISER, 200],
      [W - 200, ON_RISER + 500, 200],
      [W - 200, H - 100, 200],
      [W - 200, H - 100, SCREEN_Z - 3450],
    ], col, 1.0)
  })
  /* Both rows of seats, which are mains-powered recliners. */
  /* Every powered chair is its own load, so every chair gets its own
     flex back to the socket. Seven of them is most of the seating
     figure in the inspector. */
  for (const chair of [...row1, ...row2]) run(outlet, ['al', 'an', 'ae'], chair, 0.75)
  run(outlet, ['bl', 'bn', 'be'], sub, 1.0)

  /* --- Speaker wire. Seven pairs out of the receiver, and the lengths are
     the point: the surrounds are a 9 m run each and that is 1.5 mm² before
     the resistance starts to matter against an 8 ohm load. */
  const CHANNELS: [string, number, number][] = [
    [left, 1, 1.5],
    [right, 2, 1.5],
    [centre, 3, 1.5],
    [surL, 4, 1.5],
    [surR, 5, 1.5],
    [topL, 6, 1.5],
    [topR, 7, 1.5],
  ]
  /*
   * Out of the rack, up the back corner and across the ceiling.
   *
   * Three routes were tried along the floor and all three are drawn
   * through something: the first 2.7 m of floor is riser, the front
   * edge is where the front row sits, and the gap beside the chairs is
   * narrower than the bow the router needs. The ceiling is clear the
   * whole way, it reaches a wall speaker, a ceiling speaker and a
   * floor-standing one without a special case for each, and it is
   * where this cable goes in a room that has been built rather than
   * drawn: up the corner, along the void, down at the speaker.
   */
  const CEIL = H - 100
  const SIDE = W - 200
  const over = (x: number, z: number, lift: number): Vec3[] => [
    [SIDE, ON_RISER, 400 + lift],
    [SIDE, ON_RISER + 500, 400 + lift],
    [SIDE, CEIL, 400 + lift],
    [SIDE, CEIL, z],
    [x, CEIL, z],
  ]
  for (const [spk, ch, gauge] of CHANNELS) {
    const s = at(spk)
    b.wireVia([avr, `ch${ch}p`], [spk, 'pos'], over(s[0], s[2] - 120, 0), SPK_RED, gauge)
    b.wireVia([avr, `ch${ch}n`], [spk, 'neg'], over(s[0] + 30, s[2] - 90, 24), BLACK, gauge)
  }

  /* --- 24 V to the bias strip. */
  b.wireVia([driver, 'vout'], [strip, 'vin'], [[W - 700, H - 200, 1100], [CX + 900, H - 200, SCREEN_Z - 200]], '#D04A3A', 0.5)
  b.wireVia([driver, 'vneg'], [strip, 'gnd'], [[W - 680, H - 220, 1100], [CX + 920, H - 220, SCREEN_Z - 200]], BLACK, 0.5)

  /* --- Picture. One HDMI from the receiver to the projector, up the same
     route as its mains and nowhere near as long as people expect. */
  b.wireVia([avr, 'hdmiout'], [proj, 'hdmi1'], [
    [W - 700, ON_RISER, 300],
    [W - 240, ON_RISER, 300],
    [W - 240, ON_RISER + 500, 300],
    [W - 240, H - 140, 300],
    [W - 240, H - 140, SCREEN_Z - 3450],
  ], '#2E3136', 0.5)

  void screen
  return b.doc
}
