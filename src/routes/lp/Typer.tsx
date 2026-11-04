import { useEffect, useState } from 'react'
import { REDUCED, useMedia } from '@/ui/motion'

/**
 * The headline word, retyped.
 *
 * "Build anything" is a claim, and a claim is cheap. Watching the word
 * get deleted and replaced by circuits, then cinemas, then racks, is
 * the same claim made as evidence — and it is the one piece of motion
 * on this page that is doing the job of a sentence rather than
 * decorating one.
 *
 * It runs once. A headline that retypes itself forever is a headline
 * nobody can finish reading, so this plays its round and settles back
 * on "anything", which is the word the sentence actually wants.
 *
 * The badge changes with the word, and carries that thing's real size
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
const SETTLE = 3600
/** How long a swapped-in word is held before it goes again. */
const HOLD = 1500

export function Typer() {
  const reduced = useMedia(REDUCED)
  const [text, setText] = useState(HOME.word)
  const [size, setSize] = useState(HOME.size)
  const [live, setLive] = useState(false)

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
        /* Backspace. Faster than typing, the way a person deletes. */
        for (let i = cur.length; i > 0; i--) {
          if (!alive) return
          cur = cur.slice(0, i - 1)
          setText(cur)
          await wait(30 + Math.random() * 24)
        }
        setSize(next.size)
        for (let i = 1; i <= next.word.length; i++) {
          if (!alive) return
          cur = next.word.slice(0, i)
          setText(cur)
          await wait(48 + Math.random() * 52)
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
      {text}
      {/* A caret while it is being edited, and nothing once it settles. */}
      <em className="dr-caret" aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <b aria-hidden="true">{size}</b>
    </span>
  )
}
