import { registerBehaviour, slot, type BehaviourContext } from './index'
import { feedI2cSlave, newI2cSlave, type I2cSlaveState } from './i2c'
import { newPixelBuffer, type PixelBuffer } from '@/sim/display/framebuffer'

/**
 * SSD1306, the controller inside every small OLED module.
 *
 * It decodes the I2C traffic on its two pins and nothing else. There is no
 * back channel from whatever is driving it, so a module that is never
 * initialised stays dark, one addressed at 0x3D when the strap says 0x3C is
 * ignored, and one whose SDA and SCL are swapped receives gibberish. All three
 * are the usual reasons a real one stays blank.
 */

const str = (p: Record<string, unknown>, k: string, d: string): string =>
  typeof p[k] === 'string' ? (p[k] as string) : d

/** Addressing modes, as the datasheet numbers them. */
const MODE_HORIZONTAL = 0
const MODE_VERTICAL = 1
const MODE_PAGE = 2

interface Ssd1306 {
  bus: I2cSlaveState
  /** Display RAM: one byte per column per page, eight vertical pixels each. */
  gddram: Uint8Array
  pages: number
  cols: number
  /** Command bytes still expected for the instruction in flight. */
  pending: number[]
  /** Set by the 0x00 / 0x40 control byte at the head of each transfer. */
  dataMode: boolean
  /** True once the control byte of this transfer has been consumed. */
  gotControl: boolean
  on: boolean
  inverse: boolean
  contrast: number
  mode: number
  col: number
  page: number
  colStart: number
  colEnd: number
  pageStart: number
  pageEnd: number
  dirty: boolean
}

function newSsd(cols: number, pages: number): Ssd1306 {
  return {
    bus: newI2cSlave(),
    gddram: new Uint8Array(cols * pages),
    pages,
    cols,
    pending: [],
    dataMode: false,
    gotControl: false,
    // A cold panel is off. Turning it on is the last thing every init does.
    on: false,
    inverse: false,
    contrast: 0.8,
    mode: MODE_PAGE,
    col: 0,
    page: 0,
    colStart: 0,
    colEnd: cols - 1,
    pageStart: 0,
    pageEnd: pages - 1,
    dirty: true,
  }
}

/** Apply one command byte, consuming its arguments as they arrive. */
function command(s: Ssd1306, byte: number): void {
  if (s.pending.length) {
    s.pending.push(byte)
    const op = s.pending[0]
    const args = s.pending.length - 1
    switch (op) {
      case 0x81: // contrast
        if (args === 1) {
          s.contrast = byte / 255
          s.pending = []
        }
        break
      case 0x20: // addressing mode
        if (args === 1) {
          s.mode = byte & 3
          s.pending = []
        }
        break
      case 0x21: // column range
        if (args === 2) {
          s.colStart = s.pending[1] & 0x7f
          s.colEnd = byte & 0x7f
          s.col = s.colStart
          s.pending = []
        }
        break
      case 0x22: // page range
        if (args === 2) {
          s.pageStart = s.pending[1] & 7
          s.pageEnd = byte & 7
          s.page = s.pageStart
          s.pending = []
        }
        break
      default:
        // Everything else here takes exactly one argument we do not model.
        if (args >= 1) s.pending = []
    }
    return
  }

  if (byte >= 0xb0 && byte <= 0xb7) {
    s.page = byte & 7
    return
  }
  if (byte <= 0x0f) {
    s.col = (s.col & 0xf0) | byte
    return
  }
  if (byte >= 0x10 && byte <= 0x1f) {
    s.col = (s.col & 0x0f) | ((byte & 0x0f) << 4)
    return
  }

  switch (byte) {
    case 0xae:
      s.on = false
      s.dirty = true
      break
    case 0xaf:
      s.on = true
      s.dirty = true
      break
    case 0xa6:
      s.inverse = false
      s.dirty = true
      break
    case 0xa7:
      s.inverse = true
      s.dirty = true
      break
    // Instructions that carry arguments.
    case 0x81:
    case 0x20:
    case 0x21:
    case 0x22:
    case 0xa8:
    case 0xd3:
    case 0xd5:
    case 0xd9:
    case 0xda:
    case 0xdb:
    case 0x8d:
      s.pending = [byte]
      break
    default:
      // Charge pump, segment remap, COM scan direction and the rest change
      // nothing that can be seen at this level of detail.
      break
  }
}

/** Write one byte of picture into display RAM and advance the pointer. */
function data(s: Ssd1306, byte: number): void {
  if (s.page < s.pages && s.col < s.cols) {
    const at = s.page * s.cols + s.col
    if (s.gddram[at] !== byte) {
      s.gddram[at] = byte
      s.dirty = true
    }
  }
  if (s.mode === MODE_VERTICAL) {
    s.page++
    if (s.page > s.pageEnd) {
      s.page = s.pageStart
      s.col++
      if (s.col > s.colEnd) s.col = s.colStart
    }
  } else {
    s.col++
    if (s.mode === MODE_HORIZONTAL) {
      if (s.col > s.colEnd) {
        s.col = s.colStart
        s.page = s.page >= s.pageEnd ? s.pageStart : s.page + 1
      }
    } else if (s.col >= s.cols) {
      // Page mode wraps within the page it is on and goes no further, which
      // is the trap that makes a driver written for one mode fail in the other.
      s.col = 0
    }
  }
}

/** Unpack display RAM into the one-byte-per-pixel buffer the renderer reads. */
function present(s: Ssd1306, fb: PixelBuffer): void {
  fb.displayOn = s.on
  for (let page = 0; page < s.pages; page++) {
    for (let col = 0; col < s.cols; col++) {
      const bits = s.gddram[page * s.cols + col]
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit
        if (y >= fb.h) break
        const lit = ((bits >> bit) & 1) !== 0
        fb.bits[y * fb.w + col] = (s.inverse ? !lit : lit) ? 1 : 0
      }
    }
  }
  fb.version++
}

registerBehaviour('ssd1306', (c: BehaviourContext) => {
  // The part names its panel as a pixel grid, "128x64". The controller needs
  // the page count that implies, since display RAM is organised in bands of
  // eight rows rather than in pixels.
  const [w, h] = str(c.params, 'size', '128x64').split('x').map((n) => Math.round(Number(n) || 0))
  const cols = w > 0 ? w : 128
  const rows = h > 0 ? h : 64
  const s = slot<Ssd1306>(c.state, 'ssd', () => newSsd(cols, Math.ceil(rows / 8)))
  const address = str(c.params, 'address', '0x3C') === '0x3D' ? 0x3d : 0x3c

  const vcc = c.read('vcc')
  // Below about 3 V the controller is not running, whatever is on the bus.
  const alive = vcc > 2.6

  const fb = c.display('main', () => newPixelBuffer(cols, rows, str(c.params, 'color', '#8FE3FF'))) as PixelBuffer

  c.hiZ('vcc')
  c.hiZ('gnd')

  if (!alive) {
    c.hiZ('sda')
    c.hiZ('scl')
    if (fb.displayOn) {
      fb.displayOn = false
      fb.version++
    }
    return
  }

  // The module's own pull-ups. Without these a master that only ever pulls
  // low would leave both lines at nothing, which is exactly what happens on a
  // bare chip with no resistors fitted.
  c.drive('sda', vcc, 4700)
  c.drive('scl', vcc, 4700)

  const high = (v: number): boolean => v > vcc * 0.6
  const events = feedI2cSlave(s.bus, address, high(c.read('scl')), high(c.read('sda')))

  for (const e of events) {
    if (e.kind === 'start') {
      s.gotControl = false
    } else if (e.kind === 'byte') {
      if (!s.gotControl) {
        // Control byte: bit 6 says the rest of this transfer is picture data.
        s.dataMode = (e.value & 0x40) !== 0
        s.gotControl = true
      } else if (s.dataMode) {
        data(s, e.value)
      } else {
        command(s, e.value)
      }
    }
  }

  // Acknowledge by pulling SDA down through the ninth clock, over the top of
  // the pull-up we are also presenting. The stronger source wins, as in life.
  if (s.bus.acking) c.drive('sda', 0, 20)

  if (s.dirty) {
    present(s, fb)
    s.dirty = false
  }
})
