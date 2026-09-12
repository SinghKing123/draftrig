/**
 * I2C, as two wires rather than as a function call.
 *
 * A master here bit-bangs SDA and SCL and a slave decodes them, which means a
 * display wired with the two swapped shows nothing, a bus with no pull-ups
 * shows nothing, and a device at the wrong address ignores everything, exactly
 * as on a bench. Nothing shortcuts from one part to another.
 *
 * Both ends are open drain: to send a one they release the line and let the
 * pull-up raise it, and to send a zero they pull it down. That is not an
 * affectation, it is what makes the acknowledge bit work, since the slave
 * answers on the same wire the master just stopped driving.
 *
 * Speed. A real module runs this bus at 100 or 400 kHz. The solver steps at
 * 25 microseconds, so a 400 kHz bus would be one sample per two bits and the
 * decoder would see nothing but aliasing. The bus here runs at about 6 kHz,
 * which gives three samples per half bit and is the fastest that can be
 * decoded honestly. A full 1 kB screen refresh therefore takes about a second
 * of simulated time, and the picture builds up in bands while it happens.
 */

/** Seconds per half bit. Three solver steps at the default 25 us. */
export const I2C_HALF = 75e-6

/** Pull-up strength on a typical module, ohms. */
export const I2C_PULLUP = 4700

/* ------------------------------------------------------------------ */
/* Master                                                              */
/* ------------------------------------------------------------------ */

/** One line state: bit 1 is SCL, bit 0 is SDA. 1 means released, not driven. */
type LineState = number

export interface I2cMasterState {
  /** Queued line states, played out one per half bit. */
  q: LineState[]
  qi: number
  nextAt: number
  /** Current state of the two lines, so the pins can be held between steps. */
  scl: boolean
  sda: boolean
}

export function newI2cMaster(): I2cMasterState {
  return { q: [], qi: 0, nextAt: 0, scl: true, sda: true }
}

/** Whether the master has run out of things to say. */
export const i2cIdle = (s: I2cMasterState): boolean => s.qi >= s.q.length

/**
 * Queue one complete transaction: start, an address byte, some payload, stop.
 *
 * `address` is the seven-bit device address; the read/write bit is appended
 * here and is always write, because nothing in this catalog reads back yet.
 */
export function i2cWrite(s: I2cMasterState, address: number, bytes: number[]): void {
  const q = s.q
  // Start: SDA falls while SCL is high, then SCL follows it down.
  q.push(0b11, 0b10, 0b00)
  for (const byte of [(address << 1) & 0xfe, ...bytes]) {
    for (let bit = 7; bit >= 0; bit--) {
      const v = (byte >> bit) & 1
      // Set the data line with the clock low, then clock it in.
      q.push(v, 0b10 | v)
    }
    // The ninth clock: the master releases SDA and the slave pulls it down.
    q.push(0b01, 0b11)
  }
  // Stop: SCL rises with SDA held low, then SDA is released.
  q.push(0b00, 0b10, 0b11)
}

/** Drop anything not yet sent. Used when a transfer is being replaced. */
export function i2cAbort(s: I2cMasterState): void {
  s.q.length = 0
  s.qi = 0
}

/**
 * Advance the master and drive its two pins.
 *
 * `pull` drives a pin low, `release` lets it float up to the pull-up. Returns
 * true while a transfer is in flight.
 */
export function runI2cMaster(
  s: I2cMasterState,
  t: number,
  io: { pull: (pin: string) => void; release: (pin: string) => void },
  pins: { sda: string; scl: string } = { sda: 'sda', scl: 'scl' },
): boolean {
  if (!i2cIdle(s) && t >= s.nextAt) {
    const state = s.q[s.qi++]
    s.scl = (state & 0b10) !== 0
    s.sda = (state & 0b01) !== 0
    s.nextAt = t + I2C_HALF
    if (i2cIdle(s)) {
      // Leave both lines released so the bus is idle between transfers.
      s.q.length = 0
      s.qi = 0
    }
  }
  if (s.scl) io.release(pins.scl)
  else io.pull(pins.scl)
  if (s.sda) io.release(pins.sda)
  else io.pull(pins.sda)
  return !i2cIdle(s)
}

/* ------------------------------------------------------------------ */
/* Slave                                                               */
/* ------------------------------------------------------------------ */

export interface I2cSlaveState {
  scl: boolean
  sda: boolean
  /** True between a start condition and the stop that ends it. */
  active: boolean
  /** Bits received so far in the byte being shifted in. */
  shift: number
  bits: number
  /** How many bytes have arrived since the start, address included. */
  index: number
  /** Set once the address byte matched, cleared on stop. */
  addressed: boolean
  /** True while the acknowledge bit is being held low. */
  acking: boolean
  /** The acknowledge clock has been seen; release on the next falling edge. */
  ackDone: boolean
}

export function newI2cSlave(): I2cSlaveState {
  return {
    scl: true, sda: true, active: false, shift: 0, bits: 0, index: 0,
    addressed: false, acking: false, ackDone: false,
  }
}

export type I2cEvent =
  | { kind: 'start' }
  | { kind: 'stop' }
  /** A payload byte, once the address has matched. `n` counts from 0. */
  | { kind: 'byte'; value: number; n: number }

/**
 * Sample the two lines and return whatever the bus did since the last call.
 *
 * `address` is this device's seven-bit address. Traffic for anyone else is
 * decoded far enough to stay in step and then thrown away, which is the whole
 * reason two devices can share a pair of wires.
 */
export function feedI2cSlave(s: I2cSlaveState, address: number, sclHigh: boolean, sdaHigh: boolean): I2cEvent[] {
  const events: I2cEvent[] = []
  const prevScl = s.scl
  const prevSda = s.sda

  // Start and stop are the only times SDA is allowed to move while SCL is high.
  //
  // Except while this device is acknowledging, when the thing pulling SDA down
  // with the clock high is us. Without that exception a slave reads its own
  // acknowledge as a start condition, resets itself, and the transfer dies
  // after its first byte, every time, on every device.
  if (!s.acking && prevScl && sclHigh && prevSda !== sdaHigh) {
    if (!sdaHigh) {
      s.active = true
      s.shift = 0
      s.bits = 0
      s.index = 0
      s.addressed = false
      s.acking = false
      s.ackDone = false
      events.push({ kind: 'start' })
    } else {
      if (s.active) events.push({ kind: 'stop' })
      s.active = false
      s.addressed = false
      s.acking = false
      s.ackDone = false
    }
    s.scl = sclHigh
    s.sda = sdaHigh
    return events
  }

  // Everything else happens on the rising edge of the clock.
  if (s.active && !prevScl && sclHigh) {
    if (s.bits < 8) {
      s.shift = ((s.shift << 1) | (sdaHigh ? 1 : 0)) & 0xff
      s.bits++
      if (s.bits === 8) {
        if (s.index === 0) {
          s.addressed = (s.shift >> 1) === address
        } else if (s.addressed) {
          events.push({ kind: 'byte', value: s.shift, n: s.index - 1 })
        }
        // Acknowledge by holding SDA down through the ninth clock.
        s.acking = s.addressed
      }
    } else {
      // That was the acknowledge clock. Start the next byte, but keep holding
      // SDA down: a slave releases the acknowledge when the clock falls, not
      // when it rises. Letting go here puts a rising edge on SDA while SCL is
      // still high, which is the bit pattern for a stop condition, and the
      // transfer ended after its first byte every time.
      s.bits = 0
      s.shift = 0
      s.index++
      s.ackDone = true
    }
  }

  if (s.active && prevScl && !sclHigh && s.ackDone) {
    s.acking = false
    s.ackDone = false
  }

  s.scl = sclHigh
  s.sda = sdaHigh
  return events
}
