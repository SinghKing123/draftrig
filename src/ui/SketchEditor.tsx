import { useEffect, useMemo, useRef, useState } from 'react'
import { useDoc } from '@/state/doc'
import { useSketchPanel } from '@/state/sketch'
import { useGuard } from '@/auth/gate'
import { compileSketch, DEFAULT_SKETCH } from '@/sim/behaviour/sketch'
import { engine } from '@/sim/engine'
import { IconX } from './Icons'

/**
 * Writing the program a board runs.
 *
 * A plain textarea with a gutter, rather than a code editor component. The
 * reason is weight: the two obvious choices add 300 to 900 kB to a bundle
 * whose whole eager budget is under a megabyte, and they buy syntax colouring
 * and an autocomplete list for an API of fourteen functions. What a textarea
 * cannot do on its own — hold the caret on a Tab, keep the gutter lined up,
 * and say where the error is — is about forty lines of code, and they are
 * below.
 *
 * The sketch is stored on the instance like any other parameter, so it is in
 * the document, in the undo history and in the saved project without anything
 * here having to arrange it.
 */

/** Debounce before a keystroke reaches the simulation, ms. */
const SETTLE_MS = 400

const EXAMPLES: { name: string; code: string }[] = [
  { name: 'Blink', code: DEFAULT_SKETCH },
  {
    name: 'Fade',
    code: `// analogWrite sets a duty cycle, not a voltage. The pin really does
// switch at 490 Hz; an LED averages it, a scope does not.
function setup() {
  pinMode(9, OUTPUT)
}

function* loop() {
  for (let v = 0; v <= 255; v += 5) {
    analogWrite(9, v)
    yield delay(12)
  }
  for (let v = 255; v >= 0; v -= 5) {
    analogWrite(9, v)
    yield delay(12)
  }
}
`,
  },
  {
    name: 'Button',
    code: `// D2 reads a switch, D13 follows it.
function setup() {
  pinMode(2, INPUT)
  pinMode(13, OUTPUT)
}

function loop() {
  digitalWrite(13, digitalRead(2) ? HIGH : LOW)
}
`,
  },
  {
    name: 'Read a pot',
    code: `// analogRead gives 0..1023 across the supply, as a ten-bit ADC does.
function setup() {
  Serial.begin(9600)
  pinMode(13, OUTPUT)
}

function* loop() {
  const v = analogRead(A0)
  Serial.println('A0 = ' + v)
  digitalWrite(13, v > 512 ? HIGH : LOW)
  yield delay(250)
}
`,
  },
  {
    name: 'Chase',
    code: `// Six pins in turn. Wire an LED and a resistor to each.
const PINS = [2, 3, 4, 5, 6, 7]

function setup() {
  for (const p of PINS) pinMode(p, OUTPUT)
}

function* loop() {
  for (const on of PINS) {
    for (const p of PINS) digitalWrite(p, p === on ? HIGH : LOW)
    yield delay(90)
  }
}
`,
  },
]

export function SketchEditor() {
  const editing = useSketchPanel((s) => s.editing)
  const close = useSketchPanel((s) => s.close)
  const instances = useDoc((s) => s.doc.instances)
  const setParam = useDoc((s) => s.setParam)

  const inst = editing ? instances[editing] : undefined
  const stored = typeof inst?.params.code === 'string' ? inst.params.code : DEFAULT_SKETCH

  /**
   * The text being typed, held here rather than in the document.
   *
   * Every keystroke would otherwise be an undo step and a netlist recompile,
   * which on a board wired to a display means rebuilding its bus mid-byte
   * forty times a sentence. It is pushed down on a pause instead.
   */
  const [text, setText] = useState(stored)
  const [dirty, setDirty] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)

  // A different board, or the same one changed from elsewhere: take its text.
  useEffect(() => {
    setText(stored)
    setDirty(false)
  }, [editing, stored])

  useEffect(() => {
    if (!dirty || !editing) return
    const t = setTimeout(() => {
      setParam(editing, 'code', text, true)
      setDirty(false)
    }, SETTLE_MS)
    return () => clearTimeout(t)
  }, [text, dirty, editing, setParam])

  const problem = useMemo(() => compileSketch(text).error, [text])
  const lines = useMemo(() => text.split('\n').length, [text])

  if (!inst) return null

  const running = inst.params.program === 'custom'

  /** Tab indents instead of leaving the field, which is what a code box must do. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: a, selectionEnd: b } = el
    const next = text.slice(0, a) + '  ' + text.slice(b)
    setText(next)
    setDirty(true)
    requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
  }

  return (
    <aside className="sketch-panel" aria-label="Sketch">
      <header className="sketch-head">
        <div>
          <b>Sketch</b>
          <span className="sketch-sub">{inst.name || 'Controller'}</span>
        </div>
        <button className="btn ghost icon" onClick={close} title="Close">
          <IconX size={13} />
        </button>
      </header>

      {!running && (
        <p className="sketch-note">
          This board is running a stock program. Set its <b>Sketch</b> to <b>Your own sketch</b> in
          the inspector for this code to take effect.
        </p>
      )}

      <div className="sketch-body">
        <div className="sketch-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          ref={area}
          className="sketch-code"
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => {
            setText(e.target.value)
            setDirty(true)
          }}
          onKeyDown={onKeyDown}
          onScroll={(e) => {
            // The gutter is a separate element, so it has to be told.
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop
          }}
        />
      </div>

      <div className="sketch-status" data-bad={Boolean(problem)}>
        {problem ? problem : dirty ? 'Typing…' : 'Compiles'}
      </div>

      <footer className="sketch-foot">
        <label className="sketch-examples">
          <span>Start from</span>
          <select
            className="input"
            value=""
            onChange={(e) => {
              const ex = EXAMPLES.find((x) => x.name === e.target.value)
              if (!ex) return
              setText(ex.code)
              setDirty(true)
            }}
          >
            <option value="">an example…</option>
            {EXAMPLES.map((ex) => (
              <option key={ex.name} value={ex.name}>{ex.name}</option>
            ))}
          </select>
        </label>
        <div className="grow" />
        <button
          className="btn"
          title="Run it from the beginning"
          onClick={() => {
            if (editing && dirty) {
              setParam(editing, 'code', text, true)
              setDirty(false)
            }
            engine.reset()
          }}
        >
          Restart
        </button>
      </footer>
    </aside>
  )
}

/** The tab on the edge of the window, shown only when a board is selected. */
export function SketchTab() {
  const editing = useSketchPanel((s) => s.editing)
  const toggle = useSketchPanel((s) => s.toggle)
  const guard = useGuard()
  const selection = useDoc((s) => s.selection)
  const instances = useDoc((s) => s.doc.instances)

  // One controller selected is the only case where "edit the sketch" has an
  // unambiguous meaning.
  const board = selection.length === 1 ? instances[selection[0]] : undefined
  if (!board || board.defId !== 'mcu-board') return null

  return (
    <button
      className="sketch-tab"
      data-open={editing === board.id}
      onClick={() => guard('Sign in to write a sketch', () => toggle(board.id))}
      title="Write the program this board runs"
      aria-expanded={editing === board.id}
    >
      <span>{'{ }'}</span>
      <span>Sketch</span>
    </button>
  )
}
