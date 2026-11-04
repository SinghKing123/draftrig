import type { Doc } from '@/state/doc'
import type { Vec3 } from '@/parts/kernel/types'
import { BLACK, Builder, WHITE } from './builds'

/**
 * A working desk, with everything on it that is usually left out of one.
 *
 * `devices.ts` has a desk setup already and this is deliberately not a
 * second version of it. That one is a question about a socket: a heater, a
 * tower and two screens on one thirteen amp lead, and whether it holds. This
 * one is the layout question — a desk that has to carry two screens, a pen
 * display, a pair of monitors at ear height, a microphone on an arm, a key
 * light, a dock, a rack on the wall behind it and the cable to tie all of it
 * together, in a space 1800 by 800.
 *
 * Nearly every part in it came out of the catalogue's newer half, which is
 * the other reason it exists: a library of two hundred and fifty parts
 * should have something in the templates that shows what is now in it.
 *
 * Dimensions are the real ones. The desk is 1800 × 800 at 740, the chair
 * seat is 470, ear height sitting is 1150, and the monitors are placed on
 * the equilateral triangle that follows from their spacing rather than
 * wherever there was room.
 */

/* Mains core colours, as in `devices.ts`: brown live, blue neutral, green
   and yellow earth. Signal colours on a 230 V run would be wrong. */
const BROWN = '#7A4A2B'
const BLUE_N = '#2F6BD8'
const GREEN_E = '#9FBF2B'

export function studioDesk(): Doc {
  const b = new Builder('Studio desk')

  const DW = 1800
  const DD = 800
  const DH = 740
  /* The rear edge, and the line cables climb behind it. */
  const REAR = -DD / 2
  const CLIMB = REAR - 60
  const FLOOR = 24

  b.add('desk', [0, 0, 0], { width: DW, depth: DD, height: DH, top: 'oak', frame: 'sit-stand' }, [0, 0, 0], 'Desk')
  b.add('chair-task', [0, 0, 620], { style: 'mesh', seat: 470, base: 680 }, [0, 180, 0], 'Chair')
  b.add('rug-floor', [0, 0, 420], { width: 2200, depth: 1600, pile: 6 }, [0, 0, 0], 'Rug')

  /* --- Power. One socket behind the desk, one lead under it. */
  const wall = b.add('outlet-mains', [-700, 320, REAR - 70], { region: 'uk', ways: '2' }, [0, 0, 0], 'Wall socket')
  const lead = b.add('extension-lead', [-300, 60, REAR + 90], { ways: '6', length: 2000, fuse: '13' }, [0, 0, 0], 'Extension lead')
  b.add('tray-cable', [-200, DH - 30, REAR + 160], { length: 900, width: 140, height: 100, style: 'basket', cables: 14, psus: 3 }, [0, 0, 0], 'Cable tray')

  /* --- Screens.
   *
   * The ultrawide is on the arm, which reaches 260 over the rear edge; the
   * pen display lies flat in front of it at 20 degrees and takes the depth
   * the keyboard would otherwise have, so the keyboard goes to the left of
   * it rather than under it.
   */
  const ARM_REACH = 260
  const ARM_POST = 430
  b.add('monitor-arm', [-120, DH, REAR + 20], { reach: ARM_REACH, height: ARM_POST, load: '2-9' }, [0, -90, 0], 'Monitor arm')
  const mon = b.add(
    'monitor-desk',
    [-120, DH + ARM_POST - 70 - 160, REAR + 20 + ARM_REACH + 25],
    { diagonal: '34', hz: '144', stand: false },
    [0, 0, 0],
    'Ultrawide',
  )
  const pen = b.add('tablet-pen-display', [-120, DH, 150], { size: '16', tilt: 20, supply: 'brick' }, [0, 0, 0], 'Pen display')

  /* --- What the hands are on. */
  b.add('mat-desk', [-640, DH, 60], { width: 900, depth: 400, material: 'cloth' }, [0, 0, 0], 'Desk mat')
  b.add('keyboard-desk', [-760, DH + 4, 40], { layout: 'tkl', backlit: true }, [0, 0, 0], 'Keyboard')
  b.add('mouse-desk', [-330, DH + 4, 60], { link: 'dongle', swing: 300 }, [0, -8, 0], 'Mouse')
  b.add('light-bar-monitor', [-120, DH + ARM_POST - 70 + 10, REAR + 20 + ARM_REACH + 10], { length: 500, kelvin: 4000 }, [0, 0, 0], 'Light bar')

  /* --- Sound.
   *
   * The pair is 1100 apart, which by the triangle puts the listening
   * position 950 back from the line between them — about where the chair
   * is. The tweeters want to be at 1150, and the cabinets are 320 tall, so
   * they sit on 110 mm risers on a 740 desk rather than on the desk itself.
   */
  const SPACING = 1100
  for (const [i, x] of [-SPACING / 2, SPACING / 2].entries()) {
    b.add('riser-monitor', [x, DH, REAR + 170], { width: 300, depth: 240, height: 110, material: 'oak' }, [0, 0, 0], `Riser ${i + 1}`)
  }
  const monitors = [-SPACING / 2, SPACING / 2].map((x, i) =>
    b.add(
      'monitor-studio',
      [x, DH + 110, REAR + 170],
      { driver: '5', spacing: SPACING, earHeight: 1150, level: 15 },
      [0, x < 0 ? -18 : 18, 0],
      `Studio monitor ${i === 0 ? 'left' : 'right'}`,
    ),
  )
  const iface = b.add('interface-audio', [430, DH, 230], { channels: '2', phantom: true, rate: '48' }, [0, -14, 0], 'Audio interface')
  b.add('arm-mic-boom', [820, DH, -60], { link1: 400, link2: 400, riser: 260, extend: 70 }, [0, 0, 0], 'Boom arm')
  /* On the end of the arm: 400 out at the first link's angle and 400 back
     along the second, which lands the capsule about 620 up and 430 forward
     of the clamp — roughly in front of a seated head. */
  const mic = b.add('mic-condenser', [820, DH + 620, 370], { link: 'xlr', pattern: 'cardioid', shock: true }, [18, 0, 0], 'Microphone')

  /* --- Light. One key at 45 degrees, one strip behind the desk. */
  const key = b.add('light-key-panel', [700, DH, REAR + 40], { size: '250', kelvin: 5600, brightness: 60, mount: 'pole' }, [0, -38, 0], 'Key light')
  const strip = b.add('strip-cob-24v', [0, DH - 20, REAR - 10], { length: 1700, wpm: 14, kelvin: 4000, feed: 'both' }, [0, 0, 0], 'Bias strip')
  const driver = b.add('driver-led', [-500, 20, REAR + 120], { vout: '24', rating: '60', loadW: 24 }, [0, 0, 0], 'LED driver')

  /* --- The machine, and the one cable to it. */
  const dock = b.add('dock-usbc', [430, DH, REAR + 120], { brick: '180', host: '96', displays: 2, usb: 4, draw: 16 }, [0, 0, 0], 'Dock')
  const lap = b.add('laptop', [120, DH, 240], { diagonal: '16', lid: 108, watts: '96' }, [0, 10, 0], 'Laptop')

  /* --- On the wall behind. */
  b.add('rack-network', [1150, 1250, REAR - 120], { style: 'wall', height: 6, depth: 450, used: 3 }, [0, 0, 0], 'Wall rack')
  b.add('patch-panel', [1150, 1250 + 30 + 44.45 * 4, REAR - 120 + 180], { ports: '24', cat: '6', used: 9 }, [0, 0, 0], 'Patch panel')
  const nas = b.add('nas-enclosure', [1150, 1250 + 40, REAR - 120 + 120], { bays: 4, size: '8', raid: 'single', state: 'idle' }, [0, 0, 0], 'NAS')
  const inj = b.add('poe-injector', [1150, 1250 + 200, REAR - 120 + 120], { poe: 'at' }, [0, 0, 0], 'PoE injector')
  const ap = b.add('access-point', [400, 2400, 300], { gen: 'wifi6', poe: 'at', runLength: 18 }, [0, 0, 0], 'Access point')

  /* --- Finish. The parts with no circuit in them, which are the ones that
     decide whether the rest of it fits. */
  b.add('panel-acoustic', [-700, 1150, REAR - 140], { width: 600, height: 1200, thickness: 50, gap: 40, count: 2, wallArea: 46 }, [0, 0, 0], 'Acoustic panel, left')
  b.add('panel-acoustic', [0, 1150, REAR - 140], { width: 600, height: 1200, thickness: 50, gap: 40, count: 2, wallArea: 46 }, [0, 0, 0], 'Acoustic panel, right')
  b.add('shelf-wall', [500, 1500, REAR - 140], { span: 900, depth: 240, thickness: 32, material: 'oak', height: 1500, load: 9000 }, [0, 0, 0], 'Shelf')
  b.add('plant-potted', [560, 1532, REAR - 20], { species: 'pothos', pot: 160, height: 420, potStyle: 'ceramic' }, [0, 0, 0], 'Plant')
  b.add('print-framed', [-350, 1750, REAR - 148], { size: 'a2', portrait: false, frame: 'oak', centre: 1750 }, [0, 0, 0], 'Print')
  b.add('stand-headphone', [660, DH, -120], { style: 'post', height: 280 }, [0, 0, 0], 'Headphone stand')

  /* ================================================================ */
  /* Wiring                                                            */
  /* ================================================================ */

  const at = (id: string): Vec3 => b.doc.instances[id].pos

  const CORES: [string, string, string][] = [
    ['l', 'l', BROWN],
    ['n', 'n', BLUE_N],
    ['e', 'e', GREEN_E],
  ]

  /** Down to the floor, along it, and up behind the desk. */
  const run = (from: string, to: string, pair: [string, string], color: string, gauge: number): void => {
    const a = at(from)
    const c = at(to)
    b.wireVia([from, pair[0]], [to, pair[1]], [
      [a[0], FLOOR, a[2] - 70],
      [c[0] + 50, FLOOR, CLIMB],
      [c[0] + 50, Math.max(FLOOR, c[1] + 40), CLIMB],
    ], color, gauge)
  }

  /* Socket to lead, in 2.5 — see the note in `devices.ts` about why this is
     a size up from the real flex. */
  for (const [pa, pb, col] of CORES) {
    b.wireVia([wall, `a${pa}`], [lead, pb], [[-700, FLOOR, CLIMB], [at(lead)[0], FLOOR, at(lead)[2] - 80]], col, 2.5)
  }

  /* Six ways, and this build uses all of them: the screen, the pen display,
     the two monitors on one double adaptor's worth of way, the dock and the
     light. The LED driver and the injector are the two that do not fit,
     which is the point — a desk like this is one lead short before anybody
     plugs a kettle in. */
  const ways: [string, number][] = [
    [mon, 1],
    [pen, 2],
    [monitors[0], 3],
    [monitors[1], 4],
    [dock, 5],
    [key, 6],
  ]
  for (const [id, way] of ways) {
    for (const [pa, pb, col] of CORES) run(lead, id, [`${way}${pa}`, pb], col, 1.0)
  }
  /* The driver and the injector go back to the second socket face. Both are
     small, both are permanent, and neither wants to be unplugged by someone
     reaching for a way on the lead. */
  for (const [pa, pb, col] of CORES) {
    for (const id of [driver, inj]) run(wall, id, [`b${pa}`, pb], col, 0.75)
  }

  /* --- 24 V to the strip, fed at both ends, which is why it has four
     terminals and why the far one is worth the extra metre of cable. */
  b.wireVia([driver, 'vout'], [strip, 'vin'], [[at(driver)[0], DH - 60, CLIMB]], '#D04A3A', 0.75)
  b.wireVia([driver, 'vneg'], [strip, 'gnd'], [[at(driver)[0] + 20, DH - 60, CLIMB]], BLACK, 0.75)
  b.wireVia([driver, 'vout'], [strip, 'vin2'], [[at(driver)[0], DH - 80, CLIMB], [900, DH - 80, CLIMB]], '#D04A3A', 0.75)
  b.wireVia([driver, 'vneg'], [strip, 'gnd2'], [[at(driver)[0] + 20, DH - 80, CLIMB], [920, DH - 80, CLIMB]], BLACK, 0.75)

  /* --- PoE up to the ceiling. Two conductors, because 48 V needs a return
     and the drop over eighteen metres of it is what decides whether the
     access point gets its class allowance. */
  b.wireVia([inj, 'poe'], [ap, 'poe'], [[1150, 2300, REAR - 100], [400, 2360, 300]], '#4C8DFF', 0.205)
  b.wireVia([inj, 'poen'], [ap, 'poen'], [[1170, 2300, REAR - 100], [420, 2360, 300]], WHITE, 0.205)
  b.wire([inj, 'datain'], [nas, 'lan1'], '#3DD68C', 0.205)

  /* --- USB. The dock feeds the laptop, and the interface hangs off it,
     which is the arrangement that makes the dock's budget readout mean
     something. */
  b.wire([dock, 'hostvbus'], [lap, 'usbc'], WHITE, 0.5)
  b.wire([dock, 'hostgnd'], [lap, 'usbcg'], BLACK, 0.5)
  b.wire([dock, 'p1vbus'], [iface, 'vbus'], WHITE, 0.5)
  b.wire([dock, 'p1gnd'], [iface, 'gnd'], BLACK, 0.5)

  /* --- The microphone, on phantom from the interface, and the monitors on
     its outputs. */
  b.wireVia([mic, 'hot'], [iface, 'in1'], [[820, DH + 300, 200]], '#C8C2B4', 0.205)
  b.wireVia([mic, 'shield'], [iface, 'gnd'], [[830, DH + 300, 200]], BLACK, 0.205)
  b.wireVia([iface, 'outl'], [monitors[0], 'xlr'], [[at(iface)[0], DH - 40, CLIMB], [-SPACING / 2, DH + 60, CLIMB]], '#C8C2B4', 0.205)
  b.wireVia([iface, 'outr'], [monitors[1], 'xlr'], [[at(iface)[0], DH - 50, CLIMB], [SPACING / 2, DH + 60, CLIMB]], '#C8C2B4', 0.205)

  /* --- Picture. Length is the only thing these carry and the only reason
     they are drawn: the run from the dock to a screen on an arm is longer
     than the lead in the box. */
  b.wireVia([dock, 'dp1'], [mon, 'hdmi'], [[at(dock)[0], DH - 40, CLIMB], [-120, DH + 200, CLIMB]], '#2E3136', 0.5)
  b.wireVia([dock, 'dp2'], [pen, 'hdmi'], [[at(dock)[0] - 40, DH - 50, CLIMB], [-120, DH + 20, CLIMB]], '#2E3136', 0.5)
  b.wire([dock, 'p2vbus'], [pen, 'usb'], '#2E3136', 0.5)

  return b.doc
}
