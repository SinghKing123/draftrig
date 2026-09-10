/**
 * A four-bit HD44780 driver, as a sketch would implement it.
 *
 * This exists so the microcontroller talks to the character LCD over the real
 * bus rather than reaching into it. It bit-bangs RS, E and D4 to D7 on a fixed
 * phase clock, which means the picture on the panel is the result of six wires
 * being connected correctly, and swapping any two of them breaks it the way
 * swapping them on a bench would.
 */

/** Seconds per bus phase. Three phases make one nibble transfer. */
export const LCD_PHASE = 100e-6

/** Arduino's LiquidCrystal example wiring: lcd(12, 11, 5, 4, 3, 2). */
export const LCD_WIRING = { rs: 'd12', e: 'd11', d4: 'd5', d5: 'd4', d6: 'd3', d7: 'd2' }

export interface LcdDriverState {
  /** Queued transfers, each `single << 9 | rs << 8 | byte`. */
  q: number[]
  qi: number
  /** 0 sets up the bus, 1 raises E, 2 drops it and latches. */
  phase: 0 | 1 | 2
  /** Which nibble of the current byte is in flight. */
  nib: 0 | 1
  nextAt: number
  fourBit: boolean
  booted: boolean
  /** What was last pushed to the panel, so a static screen is not re-sent. */
  sent: string
}

export function newLcdDriver(): LcdDriverState {
  return { q: [], qi: 0, phase: 0, nib: 0, nextAt: 0, fourBit: false, booted: false, sent: '' }
}

const enqueue = (s: LcdDriverState, byte: number, rs = 0, single = false): void => {
  s.q.push((single ? 1 : 0) << 9 | rs << 8 | byte)
}

/**
 * The wake-up sequence every driver sends. A cold controller is in eight-bit
 * mode and the only way to reach it is with single nibbles, which is what the
 * three 0x30s are for.
 */
function queueInit(s: LcdDriverState): void {
  enqueue(s, 0x30, 0, true)
  enqueue(s, 0x30, 0, true)
  enqueue(s, 0x30, 0, true)
  enqueue(s, 0x20, 0, true) // switch to four-bit
  enqueue(s, 0x28) // four-bit, two lines, 5x8 font
  enqueue(s, 0x08) // display off while we set up
  enqueue(s, 0x01) // clear
  enqueue(s, 0x06) // entry mode: advance, no shift
  enqueue(s, 0x0c) // display on, cursor off
}

/** Queue a full screen refresh. Rows are padded or clipped to `cols`. */
function queueScreen(s: LcdDriverState, rows: string[], cols: number): void {
  const base = [0x80, 0xc0, 0x80 + cols, 0xc0 + cols]
  rows.forEach((row, i) => {
    if (i >= base.length) return
    enqueue(s, base[i])
    const padded = row.padEnd(cols, ' ').slice(0, cols)
    for (let c = 0; c < cols; c++) enqueue(s, padded.charCodeAt(c) & 0xff, 1)
  })
}

export interface LcdPins {
  /** Drive one of the driver's own pins. */
  write: (pin: string, high: boolean) => void
}

/**
 * Advance the driver. Call once per timestep with the text that should be on
 * screen; it works out what to send and when.
 */
export function runLcdDriver(
  s: LcdDriverState,
  t: number,
  rows: string[],
  cols: number,
  pins: LcdPins,
): void {
  if (!s.booted) {
    queueInit(s)
    s.booted = true
    s.nextAt = t
  }

  // Nothing left to send: refresh only if the picture has actually changed,
  // otherwise the bus would be saturated redrawing a static screen.
  if (s.qi >= s.q.length) {
    const want = rows.join('\n')
    if (want !== s.sent) {
      s.q.length = 0
      s.qi = 0
      queueScreen(s, rows, cols)
      s.sent = want
    } else {
      // Idle: hold E low so the panel is not left mid-transfer.
      pins.write(LCD_WIRING.e, false)
      return
    }
  }

  if (t < s.nextAt) return
  s.nextAt = t + LCD_PHASE

  const entry = s.q[s.qi]
  const byte = entry & 0xff
  const rs = (entry >> 8) & 1
  const single = (entry >> 9) & 1

  const nibble = s.nib === 0 || single ? (byte >> 4) & 0x0f : byte & 0x0f

  switch (s.phase) {
    case 0: {
      pins.write(LCD_WIRING.rs, rs === 1)
      pins.write(LCD_WIRING.d4, (nibble & 1) !== 0)
      pins.write(LCD_WIRING.d5, (nibble & 2) !== 0)
      pins.write(LCD_WIRING.d6, (nibble & 4) !== 0)
      pins.write(LCD_WIRING.d7, (nibble & 8) !== 0)
      pins.write(LCD_WIRING.e, false)
      s.phase = 1
      break
    }
    case 1: {
      pins.write(LCD_WIRING.e, true)
      s.phase = 2
      break
    }
    case 2: {
      // The falling edge is the one that latches.
      pins.write(LCD_WIRING.e, false)
      s.phase = 0
      const twoNibbles = !single && s.fourBit
      if (s.nib === 0 && twoNibbles) {
        s.nib = 1
      } else {
        s.nib = 0
        s.qi++
        // The controller is in four-bit mode from the moment it accepts 0x20.
        if (single && byte === 0x20) s.fourBit = true
      }
      break
    }
  }
}
