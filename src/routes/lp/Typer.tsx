import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { REDUCED, useMedia } from '@/ui/motion'

/**
 * The headline word, retyped.
 *
 * "Build anything" is a claim, and a claim is cheap. Watching the word
 * get deleted and replaced by circuits, then cinemas, then racks, is
 * the same claim made as evidence — and it is the one piece of motion
 * on this page doing the job of a sentence rather than decorating one.
 *
 * It runs once. A headline that retypes itself forever is a headline
 * nobody can finish reading, so this plays its round and settles back
 * on "anything", which is the word the sentence actually wants.
 *
 * ## Why the width is measured
 *
 * The first version just swapped the text, and at a hundred-pixel
 * headline that is violent: every character added or removed shoved
 * the full stop after it half a glyph sideways, so the line juddered
 * through forty discrete jumps. The letters were fine; the reflow was
 * the problem.
 *
 * So the box is given an explicit width, measured off a hidden copy of
 * the current text, and that width is transitioned. The glyphs still
 * appear one at a time — it is a typewriter, it is supposed to — but
 * the edge they push against glides instead of stepping, and nothing
 * downstream of it jumps at all. The cadence is fixed rather than
 * randomised for the same reason: jitter that reads as human at 16px
 * reads as a dropped frame at 104.
 *
 * The badge changes with the word and carries that thing's real size
 * out of the catalogue: a cinema measures 4800 x 6600, a 555 blinker
 * measures 154 x 58. The joke only works because the numbers are true.
 */

interface Word {
  word: string
  /** The real footprint of that thing, millimetres, from a shipped build. */
  size: string
}

const HOME: Word = { word: 'anything', size: '4310 × 3710' }

const ROUND: Word[] = [
  { word: 'circuits', size: '154 × 58' },
  { word: 'cinemas', size: '4800 × 6600' },
  { word: 'desks', size: '1400 × 700' },
  { word: 'racks', size: '553 × 460' },
  { word: 'studios', size: '3600 × 3000' },
]

/** Before the first deletion, so the sentence can be read as written. */
const SETTLE = 3800
/** How long a swapped-in word is held before it goes again. */
const HOLD = 1600
/** Milliseconds a character takes. Deleting is quicker, as it is by hand. */
const TYPE = 68
const WIPE = 38
/** The beat between the last letter going and the first arriving. */
const BEAT = 200

export function Typer() {
  const reduced = useMedia(REDUCED)
  const [text, setText] = useState(HOME.word)
  const [size, setSize] = useState(HOME.size)
  const [live, setLive] = useState(false)
  const sizer = useRef<HTMLSpanElement>(null)
  const [w, setW] = useState<number | null>(null)

  /*
   * Measured before paint, so the box is never one frame behind the
   * text it is sized for. The transition does the smoothing; this only
   * has to supply the right target.
   */
  useLayoutEffect(() => {
    const el = sizer.current
    if (el) setW(el.getBoundingClientRect().width)
  }, [text])

  useEffect(() => {
    if (reduced) return
    let alive = true
    const wait = (ms: number) =>
      new Promise<void>((done) => {
        setTimeout(done, ms)
      })

    const run = async () => {
      let cur = HOME.word
      await wait(SETTLE)
      for (const next of [...ROUND, HOME]) {
        if (!alive) return
        setLive(true)
        for (let i = cur.length; i > 0; i--) {
          if (!alive) return
          cur = cur.slice(0, i - 1)
          setText(cur)
          await wait(WIPE)
        }
        setSize(next.size)
        await wait(BEAT)
        for (let i = 1; i <= next.word.length; i++) {
          if (!alive) return
          cur = next.word.slice(0, i)
          setText(cur)
          await wait(TYPE)
        }
        setLive(false)
        if (next === HOME) return
        await wait(HOLD)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [reduced])

  return (
    <span className="dr-sel" data-above data-live={live || undefined}>
      <span className="dr-type" style={w === null ? undefined : { width: `${w}px` }}>
        {text}
        {/* A caret while it is being edited, and nothing once it settles. */}
        <em className="dr-caret" aria-hidden="true" />
        {/* The same glyphs, laid out and not drawn, purely to be measured. */}
        <span className="dr-type-sizer" ref={sizer} aria-hidden="true">
          {text}
        </span>
      </span>
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <b aria-hidden="true">{size}</b>
    </span>
  )
}
