import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STARTERS } from '@/io/starters'

/**
 * Completed assemblies, plated.
 *
 * The back of a manual shows what the finished unit looks like, and that is
 * the job here: one build at a time, at a size where the wiring is legible,
 * in the same drawn frame every other figure on the page uses. Six thumbnails
 * under six captions was the weakest thing on the old page — too small to
 * read and too many to look at.
 *
 * It advances on its own and stops the moment somebody touches it, because a
 * carousel still moving while you read one slide is fighting its reader.
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

/** How long each plate holds, ms. */
const HOLD = 4600

export function Showcase() {
  const items = SHOWN.map((id) => STARTERS.find((s) => s.id === id)).filter(
    (s): s is NonNullable<typeof s> => Boolean(s),
  )

  const [at, setAt] = useState(0)
  const [live, setLive] = useState(true)
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (i: number) => setAt(((i % items.length) + items.length) % items.length),
    [items.length],
  )

  // Only runs while it is on screen and nobody is on it.
  useEffect(() => {
    if (!live) return
    const el = root.current
    if (!el) return
    let seen = true
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([e]) => {
            seen = e.isIntersecting
          })
    io?.observe(el)
    const t = setInterval(() => seen && setAt((i) => (i + 1) % items.length), HOLD)
    return () => {
      clearInterval(t)
      io?.disconnect()
    }
  }, [live, items.length])

  const stop = () => setLive(false)
  const here = items[at]

  return (
    <section className="mn-built" ref={root} id="built">
      <div className="mn-rule-head">
        <h2>Completed assemblies</h2>
        <p>
          <b className="mn-fig-no">{items.length}</b> of the builds that ship with it
          <span className="mn-dot" aria-hidden="true" />
          every one opens
        </p>
      </div>

      <figure className="mn-plate mn-plate-wide">
        <div className="mn-mount">
          {items.map((s, i) => (
            <button
              key={s.id}
              className="mn-slide"
              data-on={i === at}
              tabIndex={i === at ? 0 : -1}
              aria-hidden={i !== at}
              onClick={() => navigate(`/app?start=${s.id}`)}
              onPointerEnter={stop}
            >
              <img
                src={`/presets/${s.id}.jpg`}
                alt={s.title}
                loading={i === 0 ? 'eager' : 'lazy'}
                width={860}
                height={538}
              />
            </button>
          ))}

          <div className="mn-plate-nav">
            <button
              onClick={() => {
                stop()
                go(at - 1)
              }}
              aria-label="Previous assembly"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2 L4 8 L10 14" /></svg>
            </button>
            <button
              onClick={() => {
                stop()
                go(at + 1)
              }}
              aria-label="Next assembly"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2 L12 8 L6 14" /></svg>
            </button>
          </div>
        </div>

        <figcaption>
          <b>Fig.&nbsp;4&#8209;{at + 1}</b>
          <span>
            {here.title}. {here.blurb}.
          </span>
        </figcaption>
      </figure>

      <ol className="mn-index">
        {items.map((s, i) => (
          <li key={s.id}>
            <button
              data-on={i === at}
              onClick={() => {
                stop()
                go(i)
              }}
            >
              <span className="mn-index-no">4&#8209;{i + 1}</span>
              <span className="mn-index-name">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
