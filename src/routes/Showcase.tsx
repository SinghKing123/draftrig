import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STARTERS } from '@/io/starters'

/**
 * The builds, one at a time, big.
 *
 * A grid of small pictures with a line of text under each was the weakest
 * thing on the page: six thumbnails too small to read and six captions nobody
 * does. One picture at a time, at a size where the wiring is legible, says
 * more and asks for less.
 *
 * It advances on its own and stops the moment somebody touches it, because a
 * carousel that keeps moving while you are looking at one slide is a carousel
 * fighting its reader.
 */

/*
 * Which builds to show, and in what order.
 *
 * Ordered so no two next to each other look alike: an LED array, a
 * breadboard, a character display, a pile of modules, a 3.3 V board, and so
 * on round again.
 *
 * Circuits only. The router and the thrust rig were here and came out with
 * the rest of the motor builds — a front page is a promise, and those were
 * promising motion the simulator does not do yet.
 *
 * Every one of them is a starter, so whatever is here can be opened.
 */
const SHOWN = [
  'matrix',
  'logic-bench',
  'scoreboard',
  'rfid-lock',
  'esp-weather',
  'bench-clock',
  'sound-bench',
  'panel',
  'oled',
]

/** How long each slide holds, ms. */
const HOLD = 4200

export function Showcase() {
  const items = SHOWN
    .map((id) => STARTERS.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))

  const [at, setAt] = useState(0)
  const [live, setLive] = useState(true)
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)

  const go = useCallback((i: number) => {
    setAt(((i % items.length) + items.length) % items.length)
  }, [items.length])

  // Only runs while it is on screen and nobody is on it.
  useEffect(() => {
    if (!live) return
    const el = root.current
    if (!el) return
    let seen = true
    const io = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([e]) => { seen = e.isIntersecting })
    io?.observe(el)
    const t = setInterval(() => seen && setAt((i) => (i + 1) % items.length), HOLD)
    return () => {
      clearInterval(t)
      io?.disconnect()
    }
  }, [live, items.length])

  const stop = () => setLive(false)

  return (
    <section className="show" ref={root} id="builds">
      <div className="show-head">
        <h2>Things people make</h2>
        <div className="show-arrows">
          <button onClick={() => { stop(); go(at - 1) }} aria-label="Previous">‹</button>
          <button onClick={() => { stop(); go(at + 1) }} aria-label="Next">›</button>
        </div>
      </div>

      <div className="show-stage">
        {items.map((s, i) => (
          <button
            key={s.id}
            className="show-slide"
            data-on={i === at}
            tabIndex={i === at ? 0 : -1}
            aria-hidden={i !== at}
            onClick={() => navigate(`/app?start=${s.id}`)}
            onPointerEnter={stop}
          >
            <img src={`/presets/${s.id}.jpg`} alt={s.title} loading={i === 0 ? 'eager' : 'lazy'} />
            <span className="show-name">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="show-rail">
        {items.map((s, i) => (
          <button
            key={s.id}
            className="show-pip"
            data-on={i === at}
            onClick={() => { stop(); go(i) }}
            aria-label={s.title}
          >
            <img src={`/presets/${s.id}.jpg`} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </section>
  )
}
