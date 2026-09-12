import { isHigh, registerBehaviour, slot, type BehaviourContext } from './index'
import { GATE_FAMILY, REGULATORS } from '@/parts/kernel/deviceData'
import { LCD_WIRING, newLcdDriver, runLcdDriver, type LcdDriverState } from './lcddriver'
import {
  newOledDriver, oledBar, oledClear, oledText, runOledDriver, OLED_CHARS, type OledDriverState,
} from './oleddriver'

/**
 * Built-in behavioural models.
 *
 * Each one is a small state machine evaluated once per timestep. They read the
 * pins they care about and present a Thevenin source on the pins they drive,
 * so they interact with the analogue solver rather than sitting beside it, a
 * 555 driving an LED through a resistor loads down exactly as the real chip
 * does, and a shorted output shows up as a fault, not a magic ideal source.
 */

const num = (p: Record<string, unknown>, k: string, d: number): number =>
  typeof p[k] === 'number' ? (p[k] as number) : d
const str = (p: Record<string, unknown>, k: string, d: string): string =>
  typeof p[k] === 'string' ? (p[k] as string) : d

/* ================================================================== */
/* 555 timer                                                           */
/* ================================================================== */

interface T555 {
  q: boolean
}

registerBehaviour('ne555', (c) => {
  const s = slot<T555>(c.state, 'ne555', () => ({ q: false }))
  const vcc = c.read('vcc')

  // Everything is read-only except OUT and DISCH.
  c.hiZ('vcc')
  c.hiZ('trig')
  c.hiZ('thresh')
  c.hiZ('reset')
  c.hiZ('ctrl')

  if (vcc < 3) {
    // Below the minimum supply the chip does nothing.
    c.hiZ('out')
    c.hiZ('disch')
    s.q = false
    return
  }

  // CTRL is held at 2/3 Vcc by the internal divider, which is a real resistor
  // chain in the part, so tying a capacitor or a pot to pin 5 shifts it.
  const upper = c.read('ctrl')
  const lower = upper / 2

  if (c.read('reset') < 0.7) {
    s.q = false
  } else if (c.read('trig') < lower) {
    s.q = true
  } else if (c.read('thresh') > upper) {
    s.q = false
  }

  // Bipolar 555 output stage: roughly 1.7 V below the rail when sourcing.
  if (s.q) {
    c.drive('out', Math.max(vcc - 1.7, 0), 12)
    c.hiZ('disch') // discharge transistor off
  } else {
    c.drive('out', 0.25, 12)
    c.drive('disch', 0.1, 15)
  }
})

/* ================================================================== */
/* Logic gate                                                          */
/* ================================================================== */

interface GateState {
  out: boolean
  /** Time at which a pending change becomes visible. */
  changeAt: number
  pending: boolean | null
}

const GATE_FN: Record<string, (ins: boolean[]) => boolean> = {
  and: (i) => i.every(Boolean),
  nand: (i) => !i.every(Boolean),
  or: (i) => i.some(Boolean),
  nor: (i) => !i.some(Boolean),
  xor: (i) => i.filter(Boolean).length % 2 === 1,
  xnor: (i) => i.filter(Boolean).length % 2 === 0,
  not: (i) => !i[0],
  buf: (i) => !!i[0],
}

registerBehaviour('logic-gate', (c) => {
  const s = slot<GateState>(c.state, 'gate', () => ({ out: false, changeAt: 0, pending: null }))
  const vcc = c.read('vcc')
  c.hiZ('vcc')

  // The part identifies itself by device type; the truth table lives in the
  // shared device table so the two can never disagree.
  const spec = GATE_FAMILY[str(c.params, 'type', '7400')]
  const n = Math.max(1, Math.round(num(c.params, 'inputs', spec?.inputs ?? 2)))
  const fn = GATE_FN[spec?.fn ?? str(c.params, 'fn', 'and')] ?? GATE_FN.and
  const tpd = num(c.params, 'tpd', spec?.tpd ?? 9e-9)

  const ins: boolean[] = []
  for (let i = 0; i < n; i++) {
    const id = `i${i}`
    c.hiZ(id)
    ins.push(isHigh(c.read(id), vcc || 5))
  }

  if (vcc < 2) {
    c.hiZ('y')
    return
  }

  const want = fn(ins)
  if (want !== s.out && s.pending !== want) {
    s.pending = want
    s.changeAt = c.t + tpd
  }
  if (s.pending !== null && c.t >= s.changeAt) {
    s.out = s.pending
    s.pending = null
  }

  // CMOS push-pull: a few tens of ohms either way.
  c.drive('y', s.out ? vcc : 0, 45)
})

/* ================================================================== */
/* Linear regulator                                                    */
/* ================================================================== */

registerBehaviour('regulator-linear', (c) => {
  c.hiZ('in')
  const vin = c.read('in')

  // A fixed part names its preset; an adjustable one (or a buck module) sets
  // the numbers directly.
  const preset = REGULATORS[str(c.params, 'model', '')]
  const vset = preset?.adjustable
    ? num(c.params, 'vadj', preset.vout)
    : num(c.params, 'vout', preset?.vout ?? 5)
  const dropout = num(c.params, 'dropout', preset?.dropout ?? 2)
  const imax = num(c.params, 'imax', preset?.imax ?? 1)
  const rout = 0.08

  // Below the dropout voltage the output simply follows the input down.
  const target = Math.min(vset, Math.max(vin - dropout, 0))
  const vout = c.read('out')

  // Constant voltage until the current limit, then constant current. Raising
  // the series resistance rather than collapsing the source is what makes this
  // recoverable: as the load voltage rises the limit relaxes on its own.
  const wanted = (target - vout) / rout
  if (wanted > imax) {
    c.drive('out', target, Math.max(rout, (target - vout) / imax))
  } else {
    c.drive('out', target, rout)
  }
})

/* ================================================================== */
/* H-bridge motor driver                                               */
/* ================================================================== */

registerBehaviour('h-bridge', (c) => {
  c.hiZ('vm')
  c.hiZ('gnd')
  c.hiZ('in1')
  c.hiZ('in2')
  c.hiZ('en')

  const vm = c.read('vm')
  const logic = num(c.params, 'vlogic', 5)
  const drop = str(c.params, 'kind', 'mosfet') === 'bipolar' ? 1.4 : 0.25
  const ron = str(c.params, 'kind', 'mosfet') === 'bipolar' ? 2.5 : 0.35

  const enabled = c.read('en') > logic * 0.5 || num(c.params, 'alwaysEnabled', 0) === 1
  if (!enabled || vm < 2) {
    c.hiZ('out1')
    c.hiZ('out2')
    return
  }

  const a = c.read('in1') > logic * 0.5
  const b = c.read('in2') > logic * 0.5

  const side = (pin: string, high: boolean) => {
    if (high) c.drive(pin, Math.max(vm - drop, 0), ron)
    else c.drive(pin, drop * 0.4, ron)
  }
  if (a === b) {
    // Both inputs the same: brake (both low side on) rather than coast.
    side('out1', false)
    side('out2', false)
  } else {
    side('out1', a)
    side('out2', b)
  }
})

/* ================================================================== */
/* 74HC595 shift register                                              */
/* ================================================================== */

interface ShiftState {
  shift: number
  latch: number
  lastClock: boolean
  lastLatch: boolean
}

registerBehaviour('shift-register-595', (c) => {
  const s = slot<ShiftState>(c.state, '595', () => ({ shift: 0, latch: 0, lastClock: false, lastLatch: false }))
  const vcc = c.read('vcc')
  for (const p of ['vcc', 'gnd', 'ds', 'shcp', 'stcp', 'oe', 'mr']) c.hiZ(p)

  if (vcc < 2) {
    for (let i = 0; i < 8; i++) c.hiZ(`q${i}`)
    return
  }

  if (!isHigh(c.read('mr'), vcc)) s.shift = 0

  const clock = isHigh(c.read('shcp'), vcc)
  if (clock && !s.lastClock) {
    s.shift = ((s.shift << 1) | (isHigh(c.read('ds'), vcc) ? 1 : 0)) & 0xff
  }
  s.lastClock = clock

  const latch = isHigh(c.read('stcp'), vcc)
  if (latch && !s.lastLatch) s.latch = s.shift
  s.lastLatch = latch

  // Output enable is active low.
  const enabled = !isHigh(c.read('oe'), vcc)
  for (let i = 0; i < 8; i++) {
    if (!enabled) c.hiZ(`q${i}`)
    else c.drive(`q${i}`, s.latch & (1 << i) ? vcc : 0, 45)
  }
  c.drive('q7s', s.shift & 0x80 ? vcc : 0, 45)
})

/* ================================================================== */
/* Microcontroller                                                     */
/* ================================================================== */

interface McuState {
  /** Digital output latch, by pin id. */
  out: Record<string, number>
  step: number
  nextStep: number
  toggleAt: number
  on: boolean
  lastButton: boolean
  latched: boolean
  /** Present only while an LCD sketch is selected. */
  lcd?: LcdDriverState
  /** Present only while an OLED sketch is selected. */
  oled?: OledDriverState
  /** What was last drawn on the OLED, so a static screen is not redrawn. */
  oledSent: string
  count: number
  countAt: number
}

const DIGITAL = Array.from({ length: 14 }, (_, i) => `d${i}`)

/**
 * A small microcontroller running one of a set of stock sketches. This is not
 * an instruction-set emulator, it is the behaviour of the program, which is
 * what matters when you are checking whether a circuit works.
 */
registerBehaviour('mcu', (c) => {
  const s = slot<McuState>(c.state, 'mcu', () => ({
    out: {}, step: 0, nextStep: 0, toggleAt: 0, on: false, lastButton: false, latched: false,
    oledSent: '', count: 0, countAt: 0,
  }))

  const usb = str(c.params, 'power', 'usb') === 'usb'
  const vin = c.read('vin')
  const powered = usb || vin > 6.5
  const rail = 5

  c.hiZ('vin')
  c.hiZ('gnd')

  if (!powered) {
    c.hiZ('v5')
    c.hiZ('v33')
    for (const d of DIGITAL) c.hiZ(d)
    for (let i = 0; i < 6; i++) c.hiZ(`a${i}`)
    return
  }

  // On-board regulators.
  c.drive('v5', rail, 0.2)
  c.drive('v33', 3.3, 0.6)

  // Analogue pins are inputs in every stock sketch here.
  for (let i = 0; i < 6; i++) c.hiZ(`a${i}`)

  const program = str(c.params, 'program', 'blink')
  const interval = Math.max(num(c.params, 'interval', 0.5), 1e-3)
  const duty = Math.min(Math.max(num(c.params, 'duty', 50) / 100, 0), 1)

  /** Drive a digital pin as a push-pull output, 25 mA-ish source impedance. */
  const write = (pin: string, high: boolean) => {
    s.out[pin] = high ? 1 : 0
    c.drive(pin, high ? rail : 0, 28)
  }
  const input = (pin: string) => {
    c.hiZ(pin)
    return c.read(pin)
  }

  switch (program) {
    case 'off': {
      for (const d of DIGITAL) c.hiZ(d)
      break
    }

    case 'blink': {
      for (const d of DIGITAL) if (d !== 'd13') c.hiZ(d)
      if (c.t >= s.toggleAt) {
        s.on = !s.on
        s.toggleAt = c.t + interval
      }
      write('d13', s.on)
      break
    }

    case 'fade': {
      // 490 Hz PWM with a triangle envelope, as analogWrite in a loop gives.
      for (const d of DIGITAL) if (d !== 'd9') c.hiZ(d)
      const period = 1 / 490
      const phase = (c.t % period) / period
      const env = Math.abs(((c.t / interval) % 2) - 1)
      write('d9', phase < env)
      break
    }

    case 'pwm': {
      for (const d of DIGITAL) if (d !== 'd5') c.hiZ(d)
      const period = 1 / 490
      write('d5', (c.t % period) / period < duty)
      break
    }

    case 'button': {
      // D2 is the input with a pull-up; D13 follows it, latching on each press.
      for (const d of DIGITAL) if (d !== 'd13' && d !== 'd2') c.hiZ(d)
      const pressed = input('d2') < rail * 0.4
      if (pressed && !s.lastButton) s.latched = !s.latched
      s.lastButton = pressed
      write('d13', s.latched)
      break
    }

    case 'chase': {
      const pins = ['d2', 'd3', 'd4', 'd5', 'd6', 'd7']
      for (const d of DIGITAL) if (!pins.includes(d)) c.hiZ(d)
      if (c.t >= s.nextStep) {
        s.step = (s.step + 1) % pins.length
        s.nextStep = c.t + interval
      }
      pins.forEach((p, i) => write(p, i === s.step))
      break
    }

    case 'lcd-text':
    case 'lcd-count':
    case 'lcd-clock': {
      // Six pins go to the panel, on the wiring the LiquidCrystal example uses.
      const used = new Set(Object.values(LCD_WIRING))
      for (const d of DIGITAL) if (!used.has(d)) c.hiZ(d)

      if (!s.lcd) s.lcd = newLcdDriver()

      let rows: string[]
      if (program === 'lcd-clock') {
        const total = Math.floor(c.t)
        const mm = String(Math.floor(total / 60)).padStart(2, '0')
        const ss = String(total % 60).padStart(2, '0')
        const tenths = Math.floor((c.t % 1) * 10)
        rows = [str(c.params, 'text1', 'Draftrig'), `Up  ${mm}:${ss}.${tenths}`]
      } else if (program === 'lcd-count') {
        if (c.t >= s.countAt) {
          s.count++
          s.countAt = c.t + interval
        }
        rows = [str(c.params, 'text1', 'Draftrig'), `Count ${s.count}`]
      } else {
        rows = [str(c.params, 'text1', 'Draftrig'), str(c.params, 'text2', 'LCD ready')]
      }

      runLcdDriver(s.lcd, c.t, rows, 16, { write })
      break
    }

    case 'oled-text':
    case 'oled-clock': {
      // I2C lives on A4 and A5. Nothing else is driven.
      for (const d of DIGITAL) c.hiZ(d)
      if (!s.oled) s.oled = newOledDriver()

      const title = str(c.params, 'text1', 'Draftrig').slice(0, OLED_CHARS)
      let body: string
      if (program === 'oled-clock') {
        const total = Math.floor(c.t)
        const mm = String(Math.floor(total / 60)).padStart(2, '0')
        const ss = String(total % 60).padStart(2, '0')
        body = `Up  ${mm}:${ss}`
      } else {
        body = str(c.params, 'text2', 'OLED ready').slice(0, OLED_CHARS)
      }

      // Rebuilding the frame costs a kilobyte of work, so only do it when the
      // text has actually changed rather than forty thousand times a second.
      const wanted = `${title}
${body}`
      if (wanted !== s.oledSent) {
        s.oledSent = wanted
        oledClear(s.oled)
        oledText(s.oled, 0, title)
        oledText(s.oled, 2, body)
        if (program === 'oled-clock') oledBar(s.oled, 5, (c.t % 4) / 4)
      }

      runOledDriver(
        s.oled, c.t, 0x3c,
        { pull: (pin) => c.drive(pin, 0, 30), release: (pin) => c.hiZ(pin) },
        { sda: 'a4', scl: 'a5' },
      )
      break
    }

    default: {
      for (const d of DIGITAL) c.hiZ(d)
    }
  }
})

/* ================================================================== */
/* Momentary / analogue sensors                                        */
/* ================================================================== */

/** A sensor that presents a resistance to ground, driven by a parameter. */
registerBehaviour('analog-sensor', (c: BehaviourContext) => {
  c.hiZ('vcc')
  c.hiZ('gnd')
  const vcc = c.read('vcc')
  const frac = Math.min(Math.max(num(c.params, 'reading', 50) / 100, 0), 1)
  if (vcc < 1) {
    c.hiZ('out')
    return
  }
  // A ratiometric output, exactly like a real 3-wire analogue sensor.
  c.drive('out', vcc * frac, 900)
})

/* ================================================================== */
/* Ultrasonic range finder                                             */
/* ================================================================== */

interface Sonar {
  /** Trigger level last timestep, for edge detection. */
  lastTrig: boolean
  /** Simulated time the echo pulse ends, or -1 when idle. */
  echoUntil: number
  /** When the trigger went high, so a runt pulse is ignored. */
  trigSince: number
}

/**
 * HC-SR04 timing.
 *
 * A trigger pulse of at least ten microseconds starts a ping, and the echo pin
 * then goes high for the round trip: about 58 microseconds per centimetre at
 * room temperature. Reproducing the timing rather than the number is what lets
 * a sketch that measures the pulse work here at all.
 */
registerBehaviour('ultrasonic', (c: BehaviourContext) => {
  const s = slot<Sonar>(c.state, 'sonar', () => ({ lastTrig: false, echoUntil: -1, trigSince: -1 }))
  c.hiZ('vcc')
  c.hiZ('trig')

  const vcc = c.read('vcc')
  if (vcc < 3) {
    c.hiZ('echo')
    s.echoUntil = -1
    return
  }

  const trig = c.read('trig') > vcc * 0.5
  if (trig && !s.lastTrig) s.trigSince = c.t
  if (!trig && s.lastTrig && s.trigSince >= 0 && c.t - s.trigSince >= 9e-6 && s.echoUntil < 0) {
    const cm = Math.min(Math.max(num(c.params, 'distance', 30), 2), 400)
    s.echoUntil = c.t + cm * 58e-6
  }
  s.lastTrig = trig

  if (s.echoUntil > 0 && c.t < s.echoUntil) {
    c.drive('echo', vcc, 40)
  } else {
    if (s.echoUntil > 0 && c.t >= s.echoUntil) s.echoUntil = -1
    c.drive('echo', 0, 40)
  }
})

/* ================================================================== */
/* Hobby servo                                                         */
/* ================================================================== */

interface ServoState {
  lastHigh: boolean
  roseAt: number
  /** Most recent pulse width, seconds. */
  width: number
}

/**
 * Reads the signal line the way a servo does: it measures how long the pulse
 * stays high and holds the angle that width asks for, between one and two
 * milliseconds for nought to a hundred and eighty degrees.
 *
 * The horn in the viewport is posed by its parameter rather than by this,
 * because geometry is a pure function of parameters and the simulation is not
 * allowed to write into the document. What this does model is the electrical
 * side, which is the part that matters to the rest of the circuit: a servo
 * pulls real current from the rail, and a small board trying to feed one from
 * its 5 V pin browns out here the same way it does on a bench.
 */
registerBehaviour('servo', (c: BehaviourContext) => {
  const s = slot<ServoState>(c.state, 'servo', () => ({ lastHigh: false, roseAt: -1, width: 0 }))
  c.hiZ('sig')

  const vcc = c.read('vcc')
  if (vcc < 3.5) {
    c.hiZ('vcc')
    return
  }

  const high = c.read('sig') > vcc * 0.5
  if (high && !s.lastHigh) s.roseAt = c.t
  if (!high && s.lastHigh && s.roseAt >= 0) s.width = c.t - s.roseAt
  s.lastHigh = high

  // Idle holding current, or stall current when the user says it is loaded.
  const stall = c.params.stall === true
  const amps = stall ? (str(c.params, 'size', 'sg90') === 'mg996' ? 2.5 : 0.65) : 0.02
  c.drive('vcc', 0, Math.max(vcc / amps, 0.5))
})
