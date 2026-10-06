import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import type { Instance, Params, Vec3 } from '@/parts/kernel/types'
import { defaultParams, requirePart } from '@/parts/kernel/registry'

/**
 * The two 555 breadboard labs, wired exactly as their sheets draw them.
 *
 * These follow a printed lab handout rather than my own judgement, which is
 * the point: somebody is going to hold the screen next to the paper. Where
 * the sheet does something unusual it is kept and the reason is noted, not
 * quietly corrected into the arrangement a textbook would use.
 *
 * Both are on a real breadboard with the chip straddling the channel,
 * because both sheets say "breadboard the following schematic" and a
 * point-to-point tangle would not be the thing that was asked for.
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

  wire(a: [string, string], b: [string, string], color = RED, gauge = 0.16): void {
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

const BLACK = '#1C1F24'
const RED = '#E34B4B'
const BLUE = '#4C8DFF'
const GREEN = '#3DD68C'
const YELLOW = '#F2C14E'
const VIOLET = '#C77DFF'

/**
 * The breadboard rail hole nearest a given x.
 *
 * Fifty positions span the board, the first at x = -74.8 and the rest every
 * 3.1 mm after it. A rail is one node, so the index is free to choose — but
 * choosing the far end sends the jumper back across everything in between,
 * which is how a wire ends up drawn through a part.
 */
const rail = (x: number): number => Math.max(0, Math.min(49, Math.round((x + 74.8) / 3.1)))

/* ================================================================== */
/* Lab 9 — a blinking light                                            */
/* ================================================================== */

/**
 * 555 astable, 1 kΩ / 10 kΩ / 100 µF, driving an LED.
 *
 * f = 1.44 / ((R1 + 2·R2)·C1) = 1.44 / (21 kΩ · 100 µF), about 0.69 Hz —
 * a blink a touch under a second and a half, which is what the sheet wants
 * somebody to be able to watch.
 *
 * The LED hangs off the positive rail and the output sinks it, which is how
 * the sheet draws it: the lamp is lit while pin 3 is LOW. Wiring it the
 * other way round (pin 3 → resistor → LED → ground) blinks identically and
 * is what most textbooks print, so this is worth not quietly "fixing".
 */
export function lab9Blinker(): Doc {
  const b = new Builder('Lab 9 — blinking light, 555')

  const bb = b.add('breadboard', [0, 0, 0], {}, [0, 0, 0], 'Breadboard')

  // Straddling the channel, which is the one thing a DIP package is shaped for.
  const ic = b.add('ne555', [-10, 9, 0], {}, [0, 90, 0], 'NE555')

  const r1 = b.add('resistor-axial', [-40, 9, -12], { value: 1000, watt: '0.25' }, [0, 0, 0], 'R1 1k')
  const r2 = b.add('resistor-axial', [-40, 9, 12], { value: 10000, watt: '0.25' }, [0, 0, 0], 'R2 10k')
  const c1 = b.add('capacitor-electrolytic', [-58, 9, 4], { value: 1e-4, vmax: 16 }, [0, 0, 0], 'C1 100uF')
  const r3 = b.add('resistor-axial', [26, 9, -8], { value: 470, watt: '0.25' }, [0, 0, 0], 'R3 470')
  const led = b.add('led-5mm', [50, 9, -8], { color: 'red', diffused: true }, [0, 90, 0], 'LED')

  const bat = b.add('battery-9v', [-14, 0, 78], { chem: 'alkaline' }, [0, 0, 0], '9 V battery')

  // Supply onto the rails, chip across them.
  b.wire([bat, 'p'], [bb, `pos-near-${rail(-14)}`], RED, 0.33)
  b.wire([bat, 'n'], [bb, `neg-near-${rail(-14)}`], BLACK, 0.33)
  /* The link between the two ground rails.
     A breadboard's near and far rails are separate strips of metal: without
     this jumper the chip's ground pin is not connected to the battery at all,
     and the output sits at the positive rail doing nothing. */
  b.wire([bb, 'neg-near-2'], [bb, 'neg-far-2'], BLACK)

  /* The sheet draws no ground symbol, because on a battery circuit the
     negative terminal is the reference by definition. The solver still wants
     to be told which node is zero, and left to guess it says so in the
     checks panel — which would be the first thing anybody watching sees. */
  const gnd = b.add('ground', [-62, 9, 24], {}, [0, 0, 0], 'Ground')
  b.wire([gnd, 'gnd'], [bb, 'neg-near-6'], BLACK)
  b.wire([bb, `pos-near-${rail(-13)}`], [ic, 'vcc'], RED)
  b.wire([bb, `pos-near-${rail(-7)}`], [ic, 'reset'], RED)
  b.wire([bb, `neg-far-${rail(-13)}`], [ic, 'gnd'], BLACK)

  /* The timing network. Trigger tied to threshold is what makes a 555 run on
     its own instead of waiting to be poked. */
  b.wire([bb, `pos-near-${rail(-40)}`], [r1, '1'], RED)
  b.wire([r1, '2'], [ic, 'disch'], YELLOW)
  b.wire([ic, 'disch'], [r2, '1'], YELLOW)
  b.wire([r2, '2'], [ic, 'thresh'], GREEN)
  b.wire([ic, 'thresh'], [ic, 'trig'], GREEN)
  b.wire([ic, 'thresh'], [c1, 'p'], GREEN)
  b.wire([c1, 'n'], [bb, `neg-far-${rail(-58)}`], BLACK)

  // Output, through the limiting resistor, into the lamp.
  b.wire([ic, 'out'], [r3, '1'], BLUE)
  b.wire([r3, '2'], [led, 'c'], BLUE)
  b.wire([led, 'a'], [bb, `pos-near-${rail(50)}`], RED)

  return b.doc
}

/* ================================================================== */
/* Lab 10 — what the buzz                                              */
/* ================================================================== */

/**
 * The same chip four decades faster, into a speaker, with the pitch on a knob.
 *
 * f = 1.44 / ((R1 + 2·R2)·C1) with C1 at 10 nF and R2 at 15 kΩ, so the
 * 50 kΩ pot sweeps roughly 4.8 kHz down to 1.8 kHz — the whole audible
 * range the sheet asks somebody to listen across.
 *
 * Two things here are the sheet's own and not what a textbook would print:
 *
 *   R3 goes from the control pin to ground, not in series with the speaker.
 *   In series with an 8 Ω voice coil a 5.6 kΩ resistor would make the thing
 *   silent, so that reading cannot be what is drawn. On pin 5 it sits across
 *   the lower half of the chip's internal divider and pulls the threshold
 *   down, which raises the pitch — a deliberate tuning trick.
 *
 *   C3 couples the output to the speaker so the coil carries no standing
 *   current, and C2 sits across the supply. A PP3 is a high-impedance
 *   battery and a 555 output slams between rails; without C2 the supply
 *   would sag on every edge.
 */
export function lab10Buzzer(): Doc {
  const b = new Builder('Lab 10 — what the buzz, 555')

  const bb = b.add('breadboard', [0, 0, 0], {}, [0, 0, 0], 'Breadboard')
  const ic = b.add('ne555', [-6, 9, 0], {}, [0, 90, 0], 'NE555')

  const pot = b.add('potentiometer', [-48, 9, 14], { value: 50000 }, [0, 0, 0], 'R1 50k')
  const r2 = b.add('resistor-axial', [-28, 9, -12], { value: 15000, watt: '0.25' }, [0, 0, 0], 'R2 15k')
  const c1 = b.add('capacitor-ceramic', [-10, 9, -14], { value: 1e-8 }, [0, 0, 0], 'C1 10nF')
  const c2 = b.add('capacitor-electrolytic', [-72, 9, -14], { value: 1e-4, vmax: 16 }, [0, 0, 0], 'C2 100uF')
  const r3 = b.add('resistor-axial', [12, 9, -14], { value: 5600, watt: '0.25' }, [0, 0, 0], 'R3 5.6k')
  const c3 = b.add('capacitor-electrolytic', [30, 9, 10], { value: 1e-4, vmax: 16 }, [0, 0, 0], 'C3 100uF')

  const spk = b.add('speaker-cone', [104, 0, 22], { diameter: 66, impedance: '8', power: 3 }, [0, 0, 0], 'Speaker')
  const bat = b.add('battery-9v', [-16, 0, 80], { chem: 'alkaline' }, [0, 0, 0], '9 V battery')

  // Supply, and the reservoir across it.
  b.wire([bat, 'p'], [bb, `pos-near-${rail(-16)}`], RED, 0.33)
  b.wire([bat, 'n'], [bb, `neg-near-${rail(-16)}`], BLACK, 0.33)
  // The two ground rails are separate strips; this is what joins them.
  b.wire([bb, 'neg-near-2'], [bb, 'neg-far-2'], BLACK)

  // The reference node, for the same reason as in lab 9.
  const gnd = b.add('ground', [-66, 9, 24], {}, [0, 0, 0], 'Ground')
  b.wire([gnd, 'gnd'], [bb, 'neg-near-5'], BLACK)
  b.wire([c2, 'p'], [bb, `pos-near-${rail(-72)}`], RED)
  b.wire([c2, 'n'], [bb, `neg-far-${rail(-72)}`], BLACK)

  b.wire([bb, `pos-near-${rail(-9)}`], [ic, 'vcc'], RED)
  b.wire([bb, `pos-near-${rail(-3)}`], [ic, 'reset'], RED)
  b.wire([bb, `neg-far-${rail(-9)}`], [ic, 'gnd'], BLACK)

  /* The pot is a rheostat: the supply into one end, the wiper out, and the
     far end tied to the wiper so turning it fully never opens the circuit. */
  b.wire([bb, `pos-near-${rail(-48)}`], [pot, 'a'], RED)
  b.wire([pot, 'w'], [pot, 'b'], VIOLET)
  b.wire([pot, 'w'], [ic, 'disch'], YELLOW)

  b.wire([ic, 'disch'], [r2, '1'], YELLOW)
  b.wire([r2, '2'], [ic, 'thresh'], GREEN)
  b.wire([ic, 'thresh'], [ic, 'trig'], GREEN)
  b.wire([ic, 'thresh'], [c1, '1'], GREEN)
  b.wire([c1, '2'], [bb, `neg-far-${rail(-10)}`], BLACK)

  // The sheet's tuning resistor, on the control pin.
  b.wire([ic, 'ctrl'], [r3, '1'], VIOLET)
  b.wire([r3, '2'], [bb, `neg-far-${rail(12)}`], BLACK)

  // Out through the coupling cap into the coil.
  b.wire([ic, 'out'], [c3, 'p'], BLUE)
  b.wire([c3, 'n'], [spk, 'p'], BLUE, 0.33)
  b.wire([spk, 'n'], [bb, `neg-far-${rail(49)}`], BLACK, 0.33)

  return b.doc
}
