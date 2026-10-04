import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PartDef } from '@/parts/kernel/types'
import { PartIcon } from '@/ui/PartIcons'

/**
 * The parts list, searchable.
 *
 * Every manual has one, and the visitor's real question at this point in the
 * page is the one a parts list answers: is my part in here. So it is a ruled
 * table with quantities and designations, over the actual catalog and the
 * actual ranked search the editor runs — not a mock-up of one. Typing "10k"
 * returns the resistor and the pots because the search scores values against
 * the parameters each part accepts.
 *
 * The catalog is a dynamic import, so several hundred kilobytes of part
 * definitions stay out of the bundle that renders the first screen. Until it
 * lands the field says so rather than silently returning nothing.
 */

/** What the field offers when nobody has typed. Each one returns something. */
const TRY = ['555', 'esp32', '10k', 'oled', 'breadboard', 'hall']

/** Nine rows: enough to show range, short of reprinting the catalog. */
const SHOWN = 9

type Catalog = {
  search: (q: string) => PartDef[]
  all: PartDef[]
}

/**
 * One part from each of nine categories, rather than the first nine the
 * registry happens to hold — which opened on two development boards and a
 * header. The point of the resting state is the breadth of the list, so it
 * should look broad.
 */
function spread(all: PartDef[]): PartDef[] {
  const seen = new Set<string>()
  const out: PartDef[] = []
  for (const def of all) {
    if (seen.has(def.category)) continue
    seen.add(def.category)
    out.push(def)
    if (out.length === SHOWN) break
  }
  for (const def of all) {
    if (out.length === SHOWN) break
    if (!out.includes(def)) out.push(def)
  }
  return out
}

export function Find({ total }: { total: number | null }) {
  const nav = useNavigate()
  const [cat, setCat] = useState<Catalog | null>(null)
  const [q, setQ] = useState('')
  const [live, setLive] = useState(false)
  const box = useRef<HTMLSelectElement | HTMLDivElement | null>(null)

  // Only once it is near. The catalog is the heaviest import on the page.
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return setLive(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setLive(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!live) return
    let ok = true
    void import('@/parts/catalog').then(async (m) => {
      // The definitions register themselves on import and the index re-exports
      // the registry, so this has to happen before anything is searched.
      await import('@/parts')
      if (ok) setCat({ search: m.searchParts, all: m.allParts() })
    })
    return () => {
      ok = false
    }
  }, [live])

  const hits = useMemo(() => {
    if (!cat) return []
    if (!q.trim()) return spread(cat.all)
    return cat.search(q).slice(0, SHOWN)
  }, [cat, q])

  const open = useCallback((def: PartDef) => nav(`/app?part=${encodeURIComponent(def.id)}`), [nav])

  const none = Boolean(cat && q.trim() && hits.length === 0)
  const count = total ?? cat?.all.length ?? null

  return (
    <section className="mn-parts" id="parts" ref={box as React.RefObject<HTMLDivElement>}>
      <div className="mn-rule-head">
        <span className="mn-sect" aria-hidden="true">3</span>
        <h2>Parts list</h2>
        <p>
          {count === null ? 'Loading' : <><b className="mn-fig-no">{count}</b> in the catalog</>}
          <span className="mn-dot" aria-hidden="true" />
          searched the way the editor searches
        </p>
      </div>

      <div className="mn-locate">
        <label className="mn-field">
          <span className="mn-field-tag">Locate</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={cat ? 'name, part number, or a value' : 'loading…'}
            disabled={!cat}
            aria-label="Search the parts list"
            spellCheck={false}
            autoComplete="off"
          />
          {q && (
            <button className="mn-clear" onClick={() => setQ('')} aria-label="Clear">
              ×
            </button>
          )}
        </label>

        <div className="mn-try">
          {TRY.map((t) => (
            <button key={t} onClick={() => setQ(t)} data-on={q === t}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/*
        * A list of controls, not a table.
        *
        * It was marked up with `role="table"` over `<button role="row">`,
        * which strips the buttons' own semantics and leaves a screen reader
        * with a table it cannot operate. Each row is a thing you press, so it
        * says so, and the ruled columns are the manual's layout rather than a
        * claim about the data.
        *
        * There is no quantity column. A catalog search has no quantities, and
        * printing a hardcoded 1 beside every part was manual costume over a
        * listing — invented data in a product whose whole argument is that
        * what it shows you is real.
        */}
      <div className="mn-tr mn-th" aria-hidden="true">
        <span>Part</span>
        <span>Description</span>
      </div>

      <ul className="mn-table">
        {hits.map((def) => (
          <li key={def.id}>
            <button className="mn-tr" onClick={() => open(def)}>
              <span className="mn-name">
                <i aria-hidden="true">
                  <PartIcon def={def} size={15} />
                </i>
                <span>{def.name}</span>
              </span>
              <span className="mn-desc">{def.blurb}</span>
            </button>
          </li>
        ))}
        {/*
          * The visible message IS the live region.
          *
          * It was announced twice before — once here and once in the count
          * below, in two different spellings — on the one screen whose whole
          * job is to be the single clear thing on it.
          */}
        {none && (
          <li className="mn-nohit" role="status" aria-live="polite">
            No part matches “{q}”.
          </li>
        )}
      </ul>

      {/* Typing replaces the rows silently; this is what says so. It stands
          down when the list is empty, because that state speaks for itself. */}
      {!none && (
        <p className="mn-count" role="status" aria-live="polite">
          {!cat
            ? 'Loading the catalog'
            : q.trim()
              ? `${hits.length} ${hits.length === 1 ? 'part' : 'parts'} match ${q}`
              : `Showing ${hits.length} of ${count ?? hits.length}`}
        </p>
      )}
    </section>
  )
}
