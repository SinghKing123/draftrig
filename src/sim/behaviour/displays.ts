import { registerBehaviour, slot, type BehaviourContext } from './index'
import {
  newCharBuffer, newSegBuffer, type CharBuffer, type SegBuffer,
} from '@/sim/display/framebuffer'

/**
 * Display controllers.
 *
 * These decode the actual pin protocol rather than being told what to show. An
 * LCD wired with E and RS swapped displays garbage here for the same reason it
 * does on a bench, and one wired correctly but never initialised stays blank,
 * which is the single most common thing to get wrong with these modules.
 */

const num = (p: Record<string, unknown>, k: string, d: number): number =>
  typeof p[k] === 'number' ? (p[k] as number) : d
const str = (p: Record<string, unknown>, k: string, d: string): string =>
  typeof p[k] === 'string' ? (p[k] as string) : d

/* ================================================================== */
/* HD44780 character LCD                                               */
/* ================================================================== */

interface HD44780 {
  /** 80 bytes of display RAM, as in the real controller. */
  ddram: Uint8Array
  cgram: Uint8Array
  /** Address counter. Points into DDRAM or CGRAM depending on mode. */
  addr: number
  cgMode: boolean
  bus8: boolean
  /** Which half of a byte the next 4-bit transfer carries. */
  phase: 0 | 1
  pending: number
  entryInc: boolean
  entryShift: boolean
  dispOn: boolean
  cursorOn: boolean
  blinkOn: boolean
  twoLine: boolean
  shift: number
  lastE: boolean
  /** Set when anything the viewer could see has changed. */
  dirty: boolean
}

function newHd(): HD44780 {
  return {
    ddram: new Uint8Array(80).fill(32),
    cgram: new Uint8Array(64),
    addr: 0,
    cgMode: false,
    // A cold HD44780 powers up in 8-bit mode. The familiar 0x33 / 0x32 dance
    // at the start of every driver exists precisely to get it out of there.
    bus8: true,
    phase: 0,
    pending: 0,
    entryInc: true,
    entryShift: false,
    dispOn: false,
    cursorOn: false,
    blinkOn: false,
    twoLine: false,
    shift: 0,
    lastE: false,
    dirty: true,
  }
}

/** DDRAM address of the first character of each row. */
function rowBases(cols: number, rows: number): number[] {
  // Two-line parts split RAM at 0x40. Four-line parts are really two-line
  // parts whose rows three and four continue rows one and two.
  if (rows === 4) return [0x00, 0x40, 0x00 + cols, 0x40 + cols]
  return [0x00, 0x40]
}

function execute(s: HD44780, rs: boolean, byte: number, cols: number, rows: number): void {
  if (rs) {
    if (s.cgMode) {
      s.cgram[s.addr & 0x3f] = byte & 0x1f
      s.addr = (s.addr + (s.entryInc ? 1 : -1)) & 0x3f
    } else {
      s.ddram[s.addr % 80] = byte
      s.addr = (s.addr + (s.entryInc ? 1 : -1)) & 0x7f
    }
    s.dirty = true
    return
  }

  // Commands are decoded from the highest set bit down, which is how the
  // instruction set is actually laid out.
  if (byte & 0x80) {
    s.addr = byte & 0x7f
    s.cgMode = false
  } else if (byte & 0x40) {
    s.addr = byte & 0x3f
    s.cgMode = true
  } else if (byte & 0x20) {
    s.bus8 = (byte & 0x10) !== 0
    s.twoLine = (byte & 0x08) !== 0
    s.phase = 0
  } else if (byte & 0x10) {
    // Cursor or display shift.
    const right = (byte & 0x04) !== 0
    if (byte & 0x08) s.shift += right ? 1 : -1
    else s.addr = (s.addr + (right ? 1 : -1)) & 0x7f
  } else if (byte & 0x08) {
    s.dispOn = (byte & 0x04) !== 0
    s.cursorOn = (byte & 0x02) !== 0
    s.blinkOn = (byte & 0x01) !== 0
  } else if (byte & 0x04) {
    s.entryInc = (byte & 0x02) !== 0
    s.entryShift = (byte & 0x01) !== 0
  } else if (byte & 0x02) {
    s.addr = 0
    s.shift = 0
    s.cgMode = false
  } else if (byte & 0x01) {
    s.ddram.fill(32)
    s.addr = 0
    s.shift = 0
    s.cgMode = false
  }
  void cols
  void rows
  s.dirty = true
}

/** Copy the visible window of DDRAM into the framebuffer. */
function present(s: HD44780, fb: CharBuffer, backlight: number, contrast: number): void {
  const bases = rowBases(fb.cols, fb.rows)
  for (let r = 0; r < fb.rows; r++) {
    for (let c = 0; c < fb.cols; c++) {
      const base = bases[r]
      // Rows wrap within their own 40-character half of RAM.
      const half = base >= 0x40 ? 0x40 : 0x00
      const off = (base - half + c + s.shift + 40) % 40
      fb.chars[r * fb.cols + c] = s.ddram[(half + off) % 80]
    }
  }
  fb.cgram.set(s.cgram)

  // Where the cursor lands on screen, if it is inside the visible window.
  fb.cursor = -1
  if (!s.cgMode) {
    for (let r = 0; r < fb.rows; r++) {
      const base = bases[r]
      const half = base >= 0x40 ? 0x40 : 0x00
      const off = (s.addr - half - s.shift + 40) % 40
      if (s.addr >= half && s.addr < half + 40 && off < fb.cols) {
        fb.cursor = r * fb.cols + off
        break
      }
    }
  }

  fb.displayOn = s.dispOn
  fb.cursorOn = s.cursorOn
  fb.blinkOn = s.blinkOn
  fb.backlight = backlight
  fb.contrast = contrast
  fb.version++
}

registerBehaviour('hd44780', (c: BehaviourContext) => {
  const cols = Math.round(num(c.params, 'cols', 16))
  const rows = Math.round(num(c.params, 'rows', 2))
  const s = slot<HD44780>(c.state, 'hd', newHd)
  const fb = c.display('main', () => newCharBuffer(cols, rows)) as CharBuffer

  // Every pin on this part is an input. The controller never drives the bus
  // back because read mode is not modelled, so RW high is simply ignored.
  for (const pin of ['rs', 'rw', 'e', 'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'vdd', 'v0', 'a', 'k']) {
    c.hiZ(pin)
  }

  const vdd = c.read('vdd')
  if (vdd < 2.7) {
    // Unpowered. Hold the last picture but show it dark, and forget the
    // controller state so a power cycle really does need re-initialising.
    if (fb.backlight !== 0 || fb.displayOn) {
      fb.backlight = 0
      fb.displayOn = false
      fb.version++
    }
    Object.assign(s, newHd())
    return
  }

  const hi = vdd * 0.5
  const e = c.read('e') > hi

  if (s.lastE && !e) {
    // The falling edge of E is what latches, on the real part and here.
    const rs = c.read('rs') > hi
    const rw = c.read('rw') > hi
    if (!rw) {
      const nib = (c.read('d7') > hi ? 8 : 0) | (c.read('d6') > hi ? 4 : 0) |
        (c.read('d5') > hi ? 2 : 0) | (c.read('d4') > hi ? 1 : 0)
      if (s.bus8) {
        const low = (c.read('d3') > hi ? 8 : 0) | (c.read('d2') > hi ? 4 : 0) |
          (c.read('d1') > hi ? 2 : 0) | (c.read('d0') > hi ? 1 : 0)
        execute(s, rs, (nib << 4) | low, cols, rows)
      } else if (s.phase === 0) {
        s.pending = nib << 4
        s.phase = 1
      } else {
        s.phase = 0
        execute(s, rs, s.pending | nib, cols, rows)
      }
    }
  }
  s.lastE = e

  // Backlight: a real module's LED array runs from A to K and needs its own
  // series resistor, which is why it is a stamped diode rather than something
  // this behaviour invents. All that happens here is reading how hard it is lit.
  const vBack = c.read('a') - c.read('k')
  const backlight = Math.max(0, Math.min(1, (vBack - 2.6) / 0.7))

  const contrast =
    str(c.params, 'contrastSource', 'preset') === 'pin'
      ? Math.max(0, Math.min(1, (1.15 - c.read('v0')) / 1.15))
      : Math.max(0, Math.min(1, num(c.params, 'contrast', 0.62)))

  if (s.dirty || Math.abs(fb.backlight - backlight) > 0.01 || Math.abs(fb.contrast - contrast) > 0.01) {
    s.dirty = false
    present(s, fb, backlight, contrast)
  }
})

/* ================================================================== */
/* Seven-segment display                                               */
/* ================================================================== */

/**
 * A multiplexed common-cathode or common-anode digit array.
 *
 * Segment pins are shared across every digit and one digit pin is enabled at a
 * time, which is why these flicker on camera. The persistence here is real: a
 * digit is remembered briefly after its common pin goes inactive, so a driver
 * that scans fast enough shows a steady number and one that scans too slowly
 * visibly flickers, exactly as it would.
 */
interface SegState {
  /** Latest latched pattern per digit. */
  seen: number[]
  /** Simulated time each digit was last driven. */
  at: number[]
}

const SEG_PINS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']

registerBehaviour('seven-seg', (c: BehaviourContext) => {
  const digits = Math.round(num(c.params, 'digits', 4))
  const commonAnode = str(c.params, 'common', 'cathode') === 'anode'
  const s = slot<SegState>(c.state, 'seg', () => ({
    seen: new Array<number>(digits).fill(0),
    at: new Array<number>(digits).fill(-1),
  }))
  const fb = c.display('main', () => newSegBuffer(digits)) as SegBuffer

  for (const p of SEG_PINS) c.hiZ(p)
  for (let d = 0; d < digits; d++) c.hiZ(`d${d + 1}`)

  // Reference the logic thresholds to whatever is actually driving the pins.
  let vmax = 0
  for (const p of SEG_PINS) vmax = Math.max(vmax, c.read(p))
  for (let d = 0; d < digits; d++) vmax = Math.max(vmax, c.read(`d${d + 1}`))
  const hi = Math.max(1.2, vmax * 0.5)

  for (let d = 0; d < digits; d++) {
    const common = c.read(`d${d + 1}`)
    const enabled = commonAnode ? common > hi : common < hi * 0.6
    if (!enabled) continue
    let pattern = 0
    for (let i = 0; i < SEG_PINS.length; i++) {
      const v = c.read(SEG_PINS[i])
      const lit = commonAnode ? v < hi * 0.6 : v > hi
      if (lit) pattern |= 1 << i
    }
    s.seen[d] = pattern
    s.at[d] = c.t
  }

  // Persistence of vision, roughly. Below about 50 Hz per digit the eye starts
  // to see the scan, and so does this.
  const HOLD = 0.02
  let changed = false
  for (let d = 0; d < digits; d++) {
    const alive = s.at[d] >= 0 && c.t - s.at[d] < HOLD
    const shown = alive ? s.seen[d] : 0
    if (fb.digits[d] !== shown) {
      fb.digits[d] = shown
      changed = true
    }
  }
  if (changed) fb.version++
})
