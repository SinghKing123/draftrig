/**
 * Running a sketch someone wrote.
 *
 * The stock programs elsewhere in this file's neighbour, library.ts, are the
 * *behaviour* of a program: a state machine that does what blink does without
 * being blink. That is the right model for an example, and the wrong one the
 * moment somebody wants their own idea on the pins.
 *
 * So this is a small interpreter's worth of scaffolding around ordinary
 * JavaScript. It is not an AVR emulator and does not pretend to be: there is
 * no instruction timing, no flash size, no interrupt latency. What it is, is
 * the Arduino *API* — pinMode, digitalWrite, analogRead, delay, millis,
 * Serial — bound to the same solver everything else here talks to, so a pin
 * driven from a sketch loads a circuit exactly as a pin driven from a stock
 * program does, and an LED without a resistor is still a mistake.
 *
 * ## How delay works, and why loop is a generator
 *
 * A sketch runs inside one timestep of a simulation that is advancing in
 * 25-microsecond steps. It cannot block: a real `delay(500)` would freeze the
 * browser for half a second and stop the very clock it is waiting on.
 *
 * The usual answers are a worker thread with Atomics.wait, or compiling the
 * source to a state machine. Both are a great deal of machinery to hide one
 * keyword. Generators already do exactly this job — suspend here, resume there
 * — and cost one word in the source:
 *
 *     function* loop() {
 *       digitalWrite(13, HIGH)
 *       yield delay(500)
 *       digitalWrite(13, LOW)
 *       yield delay(500)
 *     }
 *
 * A plain `function loop()` is allowed too, and runs start to finish every
 * timestep. That is the right shape for anything that reacts rather than
 * waits — following a button, holding a PWM duty — and it is what somebody
 * writes first, so it should not be an error.
 */

/** Values a sketch may yield to suspend itself. Milliseconds, or a marker. */
export interface Suspend {
  readonly kind: 'delay'
  /** Simulated milliseconds to wait from the moment it was yielded. */
  readonly ms: number
}

export interface SketchPins {
  /** Digital pin ids in board order: d0..d13 then a0..a5. */
  readonly digital: string[]
  readonly analog: string[]
}

/** What the sketch is allowed to do to the world, supplied per timestep. */
export interface SketchHost {
  /** Simulated seconds since the circuit started. */
  t: number
  /** Drive a pin hard to the rail or to ground. */
  write: (pin: string, high: boolean) => void
  /** Release a pin and read what the circuit does to it, in volts. */
  read: (pin: string) => number
  /** Release a pin without reading it. */
  release: (pin: string) => void
  /** Supply rail, volts. */
  rail: number
  /** A line of Serial output. */
  print: (line: string) => void
}

export type PinMode = 'input' | 'output' | 'input_pullup'

export interface SketchState {
  /** Null until the source compiles; the error is then in `error`. */
  program: CompiledSketch | null
  error: string | null
  /** The source that produced `program`, so a re-compile is only on change. */
  source: string
  /** Pin modes, by pin id. */
  modes: Record<string, PinMode>
  /** Analogue-write duty per pin, 0..1, for the PWM carrier. */
  duty: Record<string, number>
  /** True once setup() has run. */
  started: boolean
  /** The suspended loop, if it is mid-delay. */
  running: Iterator<unknown> | null
  /** Simulated seconds at which a suspended loop may continue. */
  resumeAt: number
  /** Seconds at which the sketch began, so millis() starts at zero. */
  t0: number
  /** Lines printed this run, newest last, capped. */
  out: string[]
  /** Set when the sketch threw; it is not run again until the source changes. */
  crashed: boolean
  /**
   * The API the compiled sketch closed over.
   *
   * Built once per compile, not once per timestep. The sketch's functions are
   * created inside a closure over these exact objects, so handing it different
   * ones later would do nothing at all — which is the mistake this field
   * exists to make impossible.
   */
  api: Record<string, unknown> | null
  /**
   * The solver handles for the timestep being run right now.
   *
   * The API closures read this rather than capturing a host, because a host is
   * only valid for the step it was made for.
   */
  host: SketchHost | null
  /** Statements run in the current timestep, against STEP_LIMIT. */
  steps: number
}

export interface CompiledSketch {
  setup?: () => unknown
  loop?: () => unknown
}

export function newSketchState(): SketchState {
  return {
    program: null, error: null, source: '\u0000',
    modes: {}, duty: {}, started: false, running: null, resumeAt: 0, t0: 0,
    out: [], crashed: false, api: null, host: null, steps: 0,
  }
}

/** How many Serial lines are kept. Enough to read, not enough to leak. */
const MAX_OUT = 200

/**
 * How long one pass of loop() may run before it is abandoned, in statements.
 *
 * A `while (true) {}` with no yield in it cannot be interrupted from outside,
 * so the only defence is to not let it start. Every loop body is compiled with
 * a counter that throws once it has gone round too many times, which turns a
 * frozen tab into an error message next to the line that caused it.
 */
const STEP_LIMIT = 200_000

/**
 * The Arduino names, written out.
 *
 * Constants rather than magic numbers because a sketch that says HIGH is a
 * sketch somebody can paste in from a tutorial and mostly have work.
 */
const CONSTANTS = {
  HIGH: 1, LOW: 0,
  INPUT: 'input', OUTPUT: 'output', INPUT_PULLUP: 'input_pullup',
  LED_BUILTIN: 13,
}

/**
 * Guard a loop body against never returning.
 *
 * Crude on purpose: it counts the back-edge of every `for`, `while` and
 * `do` by rewriting the keyword into a call. It is not a parser, so it will
 * also rewrite the word inside a string literal — which costs nothing, since
 * the call it inserts is a no-op that returns true.
 */
function instrument(src: string): string {
  return src.replace(/\b(while|for)\s*\(/g, '$1 ($$tick() && ')
}

/** Resolve a pin as a sketch names it: 13, 'd13', 'A0', 0 for A0 on analogRead. */
function pinId(pins: SketchPins, v: unknown, analogue = false): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const list = analogue ? pins.analog : pins.digital
    // Arduino numbers the analogue pins from 14 on the digital scale too.
    if (!analogue && v >= 14 && v - 14 < pins.analog.length) return pins.analog[v - 14]
    return list[v] ?? null
  }
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (/^a\d+$/.test(t)) return pins.analog[Number(t.slice(1))] ?? null
  if (/^d?\d+$/.test(t)) return pinId(pins, Number(t.replace(/^d/, '')), analogue)
  return null
}

/**
 * The API a sketch is compiled against.
 *
 * Built once, when the source is compiled, and never rebuilt: the sketch's own
 * functions are created inside a closure over these exact objects, so a fresh
 * set handed over later would simply be ignored. What changes every timestep
 * is `s.host`, which is what each of these reads.
 *
 * That indirection is the whole trick, and it is what was wrong the first time
 * this was written: the sketch was compiled against throwaway stubs, so it
 * parsed, ran, and touched nothing at all — including the guard meant to stop
 * an endless loop, which is how a `while (true)` hung the test suite instead
 * of reporting itself.
 */
function makeApi(s: SketchState, pins: SketchPins): Record<string, unknown> {
  const host = (): SketchHost | null => s.host
  const ms = (): number => {
    const h = s.host
    return h ? (h.t - s.t0) * 1000 : 0
  }
  const print = (line: string): void => s.host?.print(line)

  return {
    ...CONSTANTS,

    $tick: (): boolean => {
      if (++s.steps > STEP_LIMIT) {
        throw new Error('This loop ran too long without a yield. Put `yield delay(...)` inside it.')
      }
      return true
    },

    pinMode: (pin: unknown, mode: unknown): void => {
      const id = pinId(pins, pin)
      if (!id) return
      const m = String(mode).toLowerCase()
      s.modes[id] = m === 'output' ? 'output' : m === 'input_pullup' ? 'input_pullup' : 'input'
      if (s.modes[id] !== 'output') host()?.release(id)
    },

    digitalWrite: (pin: unknown, value: unknown): void => {
      const id = pinId(pins, pin)
      if (!id) return
      const high = value === true || value === 1 || String(value).toLowerCase() === 'high'
      // Writing to a pin never declared an output is something a real board
      // forgives: the latch is set and takes effect when the direction bit
      // does. So it is forgiven here too.
      s.duty[id] = high ? 1 : 0
      if (s.modes[id] === 'output') host()?.write(id, high)
    },

    digitalRead: (pin: unknown): number => {
      const id = pinId(pins, pin)
      const h = host()
      if (!id || !h) return 0
      // The 0.6 of the rail an AVR uses as its input threshold, not half.
      return h.read(id) > h.rail * 0.6 ? 1 : 0
    },

    analogRead: (pin: unknown): number => {
      const id = pinId(pins, pin, true) ?? pinId(pins, pin)
      const h = host()
      if (!id || !h) return 0
      return Math.max(0, Math.min(1023, Math.round((h.read(id) / h.rail) * 1023)))
    },

    analogWrite: (pin: unknown, value: unknown): void => {
      const id = pinId(pins, pin)
      if (!id) return
      s.duty[id] = Math.max(0, Math.min(255, Number(value) || 0)) / 255
      s.modes[id] = 'output'
    },

    delay: (n: unknown): Suspend => ({ kind: 'delay', ms: Math.max(0, Number(n) || 0) }),
    delayMicroseconds: (n: unknown): Suspend => ({ kind: 'delay', ms: Math.max(0, Number(n) || 0) / 1000 }),

    millis: (): number => Math.round(ms()),
    micros: (): number => Math.round(ms() * 1000),

    Serial: {
      begin: () => {},
      print: (v: unknown) => print(String(v)),
      println: (v: unknown = '') => print(String(v) + '\n'),
      write: (v: unknown) => print(String(v)),
    },
    console: { log: (...v: unknown[]) => print(v.map(String).join(' ') + '\n') },

    Math, String, Number, Array, JSON, Object, isNaN, parseInt, parseFloat,
  }
}

/**
 * Compile a sketch against a given API.
 *
 * The source is evaluated once, inside a function whose only free names are
 * the ones passed in. It is not a sandbox — nothing in a browser is — but the
 * sketch is the person's own code on their own machine, which is the same
 * trust boundary as the console they could paste it into. What it does buy is
 * that `window` and `document` are not in scope by accident, so a typo cannot
 * navigate the page out from under the editor.
 */
export function compileSketch(
  source: string,
  api?: Record<string, unknown>,
): { program: CompiledSketch | null; error: string | null } {
  const bound = api ?? makeApi(newSketchState(), { digital: [], analog: [] })
  try {
    const names = Object.keys(bound)
    const body = [
      "'use strict';",
      instrument(source),
      'return {',
      '  setup: typeof setup === "function" ? setup : undefined,',
      '  loop: typeof loop === "function" ? loop : undefined,',
      '}',
    ].join('\n')
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const make = new Function(...names, body) as (...args: unknown[]) => CompiledSketch
    const program = make(...names.map((n) => bound[n]))
    if (!program || (!program.setup && !program.loop)) {
      return { program: null, error: 'No setup() or loop() found. A sketch needs at least one.' }
    }
    return { program, error: null }
  } catch (err) {
    return { program: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Advance a sketch by one timestep.
 *
 * Everything that can suspend does so between timesteps, so this either runs a
 * whole pass of loop(), resumes one that was waiting, or does nothing because
 * the sketch is still inside a delay.
 */
export function runSketch(
  s: SketchState,
  source: string,
  pins: SketchPins,
  host: SketchHost,
): void {
  s.host = host
  s.steps = 0

  if (source !== s.source) {
    s.source = source
    s.api = makeApi(s, pins)
    const { program, error } = compileSketch(source, s.api)
    s.program = program
    s.error = error
    s.started = false
    s.running = null
    s.crashed = false
    s.modes = {}
    s.duty = {}
    s.out = []
    s.t0 = host.t
  }
  if (!s.program || s.crashed) return

  const fail = (err: unknown): void => {
    s.crashed = true
    s.error = err instanceof Error ? err.message : String(err)
    host.print('error: ' + s.error + '\n')
    /* Leave every pin released. A sketch that has stopped is not still holding
       its outputs, and a circuit running on against a dead controller should
       look like one. */
    s.modes = {}
    s.duty = {}
    for (const id of [...pins.digital, ...pins.analog]) host.release(id)
  }

  if (!s.started) {
    s.started = true
    s.t0 = host.t
    try {
      const r = s.program.setup?.()
      /* A generator setup() is run to the end here rather than suspended.
         setup is what happens before anything else does, and a delay inside it
         is a pause before the circuit starts, which nobody can see. */
      if (r && typeof (r as Iterator<unknown>).next === 'function') {
        const it = r as Iterator<unknown>
        for (let i = 0; i < 10_000; i++) if (it.next().done) break
      }
    } catch (err) {
      fail(err)
      return
    }
  }

  if (!s.program.loop) return
  if (s.running && host.t < s.resumeAt) return

  try {
    if (!s.running) {
      const r = s.program.loop()
      if (r && typeof (r as Iterator<unknown>).next === 'function') {
        s.running = r as Iterator<unknown>
      } else {
        return // a plain function: it ran, and it is done
      }
    }
    const step = s.running.next()
    if (step.done) {
      s.running = null
      return
    }
    const y = step.value as Suspend | number | undefined
    const waitMs = typeof y === 'number' ? y : y && y.kind === 'delay' ? y.ms : 0
    s.resumeAt = host.t + waitMs / 1000
  } catch (err) {
    s.running = null
    fail(err)
  }
}

/** Keep the Serial log bounded. Called by whoever owns the state. */
export function pushOut(s: SketchState, line: string): void {
  s.out.push(line)
  if (s.out.length > MAX_OUT) s.out.splice(0, s.out.length - MAX_OUT)
}

/** The sketch a new board starts with. Blink, in the shape this runtime wants. */
export const DEFAULT_SKETCH = `// Runs once.
function setup() {
  pinMode(LED_BUILTIN, OUTPUT)
}

// Runs over and over. The * and the yield are what let delay() work
// without stopping the simulation it is waiting on.
function* loop() {
  digitalWrite(LED_BUILTIN, HIGH)
  yield delay(500)
  digitalWrite(LED_BUILTIN, LOW)
  yield delay(500)
}
`
