import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LIBRARY, type LibRow } from './library.gen'

/**
 * The library panel, with the editor taken away.
 *
 * Type "socket" and the catalogue answers, the way it answers inside
 * the product. It is the one claim on this page a reader can audit in
 * three seconds — whether the thing they came here to lay out is in
 * the box — and no sentence about breadth can do that, because the
 * reader is not thinking about breadth. They are thinking about the
 * one part they need.
 *
 * Every row carries a photograph of the part rendered by the editor
 * itself, shot by `tools/shoot-thumbs.mjs`, which places each part on
 * an empty document and reads the viewport back. That matters more
 * than it looks: the shelf this replaced drew each part as a rectangle
 * at its bounding size, and a rectangle is exactly what a catalogue of
 * real objects must not be.
 *
 * Ranked rather than filtered. A search for "led" should answer with
 * the LED before the LED driver, and `includes` on its own puts them
 * in registration order, which is nobody's order.
 */

/** Rows rendered at once. The rest are a scroll away, not a page away. */
const PAGE = 40

/**
 * Whether the word starts somewhere in the text, rather than merely
 * occurring in it. "rack" occurs in "bracket", which is how a search
 * for a 19-inch rack came back with two brackets above the shelf.
 */
function atWordStart(text: string, needle: string): boolean {
  let i = text.indexOf(needle)
  while (i >= 0) {
    if (i === 0 || !/[a-z0-9]/.test(text[i - 1])) return true
    i = text.indexOf(needle, i + 1)
  }
  return false
}

function rank(row: LibRow, needle: string): number {
  const name = row.n.toLowerCase()
  if (name === needle) return 0
  if (name.startsWith(needle)) return 1
  if (atWordStart(name, needle)) return 2
  if (atWordStart(row.c.toLowerCase(), needle)) return 3
  if (atWordStart(row.s.toLowerCase(), needle)) return 4
  /* Tags are the editor's own synonyms — "kettle lead" finds the C13 —
     so they count, but under anything with the word in its name. */
  if (atWordStart(row.t, needle) || atWordStart(row.id, needle)) return 5
  /* Last, the word buried inside another one. Still worth answering —
     somebody typing "led" should be shown the LED driver — but under
     everything that matched it properly. */
  if (name.includes(needle) || row.t.includes(needle)) return 6
  return -1
}

export function Library() {
  const [q, setQ] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return LIBRARY
    return LIBRARY.map((row) => ({ row, r: rank(row, needle) }))
      .filter((h) => h.r >= 0)
      .sort((a, b) => a.r - b.r || a.row.n.length - b.row.n.length)
      .map((h) => h.row)
  }, [q])

  /* Whether the list runs past the bottom of its box, so the fade that
     says so is only drawn when it is true. A permanent fade over a
     list of three results is a fade over the third result. */
  useLayoutEffect(() => {
    const el = list.current
    if (el) setMore(el.scrollHeight > el.clientHeight + 2)
  }, [hits])

  return (
    <div className="dr-lib">
      <div className="dr-lib-find">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4.6" />
          <path d="M10 10 L14 14" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the catalogue"
          aria-label="Search the part catalogue"
        />
        <span className="n">
          {hits.length === LIBRARY.length ? LIBRARY.length : `${hits.length}/${LIBRARY.length}`}
        </span>
      </div>

      <div className="dr-lib-list" ref={list} data-more={more || undefined}>
        {hits.slice(0, PAGE).map((row) => (
          <div className="dr-lib-row" key={row.id}>
            <img
              src={`/shots/parts/${row.id}.jpg`}
              alt=""
              width={400}
              height={300}
              loading="lazy"
              decoding="async"
            />
            <span className="dr-lib-name">{row.n}</span>
            <span className="dr-lib-cat">{row.c}</span>
          </div>
        ))}

        {hits.length === 0 && (
          <p className="dr-lib-none">
            Nothing matches “{q.trim()}”. It is 266 parts, not everything — try
            socket, rack, seat or resistor.
          </p>
        )}
      </div>
    </div>
  )
}
