import { glyph } from '@/sim/display/font5x7'
import { i2cIdle, i2cWrite, newI2cMaster, runI2cMaster, type I2cMasterState } from './i2c'

/**
 * The driver half of the OLED: a sketch bit-banging I2C at a panel.
 *
 * This is the counterpart to the SSD1306 model, and the two only ever meet on
 * the two wires between them. It keeps a shadow of what it believes is on the
 * screen and sends only the columns that have changed, which is what every
 * real library does and is the difference between a counter that ticks and one
 * that repaints for a second and a half each time.
 */

export const OLED_COLS = 128
export const OLED_PAGES = 8

/** Six pixels per character: five of glyph and one of gap. */
const CHAR_W = 6
export const OLED_CHARS = Math.floor(OLED_COLS / CHAR_W)

export interface OledDriverState {
  bus: I2cMasterState
  booted: boolean
  /** What the driver believes the panel is showing. */
  shadow: Uint8Array
  /** What it wants the panel to show. */
  want: Uint8Array
  /** True until the first whole-frame push has been queued. */
  needsFull: boolean
}

export function newOledDriver(): OledDriverState {
  return {
    bus: newI2cMaster(),
    booted: false,
    shadow: new Uint8Array(OLED_COLS * OLED_PAGES),
    want: new Uint8Array(OLED_COLS * OLED_PAGES),
    needsFull: true,
  }
}

/**
 * The wake-up sequence. Ends with 0xAF, display on, which is why an OLED that
 * is wired correctly but never initialised stays black rather than showing
 * noise.
 */
const INIT = [
  0xae, // display off while we set up
  0x20, 0x00, // horizontal addressing: the pointer walks the whole frame
  0xc8, // scan direction
  0x40, // start line 0
  0x81, 0x7f, // contrast
  0xa1, // segment remap
  0xa6, // not inverted
  0xa8, 0x3f, // multiplex ratio, 64 rows
  0xa4, // follow RAM rather than lighting everything
  0xd3, 0x00, // no display offset
  0xd5, 0x80, // clock divide
  0xd9, 0x22, // pre-charge
  0xda, 0x12, // COM pin layout
  0xdb, 0x20, // VCOMH
  0x8d, 0x14, // charge pump on, or the panel has no high rail
  0xaf, // display on
]

/** Draw one line of text into the wanted frame, on the given text row. */
export function oledText(s: OledDriverState, row: number, text: string): void {
  if (row < 0 || row >= OLED_PAGES) return
  const base = row * OLED_COLS
  for (let i = 0; i < OLED_CHARS; i++) {
    const code = i < text.length ? text.charCodeAt(i) : 32
    const g = glyph(code)
    for (let c = 0; c < 5; c++) s.want[base + i * CHAR_W + c] = g[c]
    s.want[base + i * CHAR_W + 5] = 0
  }
}

/** Clear the wanted frame. */
export function oledClear(s: OledDriverState): void {
  s.want.fill(0)
}

/** A filled bar, for a progress or level readout. */
export function oledBar(s: OledDriverState, row: number, fraction: number): void {
  if (row < 0 || row >= OLED_PAGES) return
  const base = row * OLED_COLS
  const end = Math.round(Math.min(Math.max(fraction, 0), 1) * (OLED_COLS - 4))
  for (let c = 0; c < OLED_COLS; c++) {
    // A hollow rounded box with a solid fill that grows across it.
    const border = c === 0 || c === OLED_COLS - 1
    s.want[base + c] = border ? 0xff : c > 1 && c < 2 + end ? 0x7e : 0x81
  }
}

/** Queue a command transfer. The 0x00 control byte says these are commands. */
const sendCommands = (s: OledDriverState, address: number, bytes: number[]): void => {
  i2cWrite(s.bus, address, [0x00, ...bytes])
}

/**
 * Queue whatever has changed since the last push.
 *
 * Works a page at a time and sends the span between the first and last changed
 * column in it, which is both simple and close enough to optimal for text.
 */
function queueDiff(s: OledDriverState, address: number): boolean {
  if (s.needsFull) {
    sendCommands(s, address, [0x21, 0, OLED_COLS - 1, 0x22, 0, OLED_PAGES - 1])
    i2cWrite(s.bus, address, [0x40, ...s.want])
    s.shadow.set(s.want)
    s.needsFull = false
    return true
  }

  let sent = false
  for (let page = 0; page < OLED_PAGES; page++) {
    const base = page * OLED_COLS
    let first = -1
    let last = -1
    for (let c = 0; c < OLED_COLS; c++) {
      if (s.shadow[base + c] !== s.want[base + c]) {
        if (first < 0) first = c
        last = c
      }
    }
    if (first < 0) continue
    sendCommands(s, address, [0x21, first, last, 0x22, page, page])
    const slice = Array.from(s.want.subarray(base + first, base + last + 1))
    i2cWrite(s.bus, address, [0x40, ...slice])
    s.shadow.set(s.want.subarray(base + first, base + last + 1), base + first)
    sent = true
  }
  return sent
}

/**
 * Advance the driver.
 *
 * `io.pull` takes a pin low and `io.release` lets it float; the module's own
 * pull-up resistors are what make a released line read as a one.
 */
export function runOledDriver(
  s: OledDriverState,
  t: number,
  address: number,
  io: { pull: (pin: string) => void; release: (pin: string) => void },
  pins: { sda: string; scl: string },
): void {
  if (!s.booted) {
    sendCommands(s, address, INIT)
    s.booted = true
  } else if (i2cIdle(s.bus)) {
    queueDiff(s, address)
  }
  runI2cMaster(s.bus, t, io, pins)
}
