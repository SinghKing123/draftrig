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
    <section className="sec" id="parts" ref={box as React.RefObject<HTMLDivElement>}>
      <div className="lpw">
        <div className="sec-head center">
          <h2>Search the catalog</h2>
          <p>
            Type <span className="mono">10k</span> and it finds the resistor and the pots.
          </p>
        </div>

        <label className="find-bar">
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.8 10.8 14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={cat ? 'Search parts, values, part numbers' : 'Loading the catalog…'}
            disabled={!cat}
            aria-label="Search parts"
            spellCheck={false}
            autoComplete="off"
          />
          {q && <button className="find-x" onClick={() => setQ('')} aria-label="Clear">×</button>}
        </label>

        <div className="find-try">
          {TRY.map((t) => (
            <button key={t} onClick={() => setQ(t)} data-on={q === t}>{t}</button>
          ))}
        </div>

        <div className="find-grid">
          {hits.map((def) => (
            <button className="hit" key={def.id} onClick={() => open(def)}>
              <span className="hit-ico"><PartIcon def={def} size={17} /></span>
              <span className="hit-txt">
                <b>{def.name}</b>
                <span>{def.blurb}</span>
              </span>
            </button>
          ))}
          {none && <p className="find-none">No part matches “{q}”.</p>}
        </div>

        <p className="find-count" role="status" aria-live="polite">
          {!cat
            ? 'Loading the catalog'
            : none
              ? `No part matches ${q}`
              : q.trim()
                ? `${hits.length} ${hits.length === 1 ? 'part' : 'parts'} match ${q}`
                : `Showing ${hits.length} of ${count ?? hits.length}`}
        </p>
      </div>
    </section>
  )
}
