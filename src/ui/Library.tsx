import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconChevron, IconSearch, IconX } from './Icons'
import { CategoryIcon, PartIcon } from './PartIcons'
import { PanelTabs } from './PanelTabs'
import { Vector3 } from 'three'
import { allParts, CATEGORY_META, defaultParams, getPart, searchParts, valueTargetFor } from '@/parts/kernel/registry'
import type { LibrarySection } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'
import type { Params, PartCategory, PartDef, Vec3 } from '@/parts/kernel/types'
import { cameraAnchor } from '@/scene/anchor'
import { useDoc } from '@/state/doc'

const SECTION_ORDER: LibrarySection[] = ['Space', 'AV & cinema', 'Workstation', 'Build', 'Lab', 'Electronics']

/**
 * Which categories are expanded, remembered between sessions.
 *
 * Everything starts closed. With five sections and twenty-six categories, any
 * category left open pushes the rest off the bottom of the panel, and the
 * first thing you see is the middle of a list you did not ask for. Closed, the
 * whole catalogue fits on one screen and you can see what is in it.
 */
const OPEN_KEY = 'draftrig.library.open.v1'

/**
 * The last parts placed, most recent first.
 *
 * Worth the storage because of how the catalogue has grown: at two hundred
 * and fifty parts, the thing you reached for a minute ago is four levels of
 * tree away from the thing you want next, and the two are nearly always the
 * same handful. A recents list is the difference between a library you
 * navigate and one you use.
 */
const RECENT_KEY = 'draftrig.library.recent.v1'
const RECENT_MAX = 10

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    // Private windows and blocked site data both land here; the fallback is
    // the right answer, not a crash.
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable; the panel still works, it just forgets */
  }
}

/**
 * A part named in the URL, so a link can open the library on one.
 *
 * The front page searches the same catalog and sends people here; without
 * this it would send them to an editor that looks exactly as it would have
 * anyway, which is a link that lies about what it does.
 *
 * Read once, at mount, and then forgotten: it seeds the field rather than
 * controlling it, so the first keystroke is not fighting the address bar.
 */
function askedFor(): string {
  try {
    const want = new URLSearchParams(window.location.search).get('part')
    if (!want) return ''
    const def = getPart(want)
    return def ? def.name : want
  } catch {
    return ''
  }
}

/**
 * Where a part clicked in the library should land.
 *
 * On the ground under the camera's orbit centre — the point the view turns
 * and zooms around — so a part arrives in front of you wherever you are
 * working. It used to go into a spiral around the world origin, which is
 * only ever right on an empty bench: pan across a room to the far corner,
 * click a part, and it appeared somewhere behind you.
 *
 * Nothing lands exactly on top of something else. The test is against
 * instance origins rather than their real bounds, because measuring the
 * bounds means compiling the geometry of every part in the document on
 * every click, and the case this is for is the one where you add six of
 * something and want to see six of them. Dropping a monitor onto a desk is
 * not an overlap worth dodging — it is the point.
 */
function placementFor(def: PartDef, params: Params): Vec3 {
  const anchor = cameraAnchor() ?? [0, 0, 0]
  const { snap, doc } = useDoc.getState()
  const box = buildPart(def, params).bbox
  const size = box.isEmpty() ? new Vector3(40, 40, 40) : box.getSize(new Vector3())
  const radius = Math.max(size.x, size.z) / 2

  const grid = snap.enabled ? Math.max(1, snap.grid) : 1
  const toGrid = (v: number): number => Math.round(v / grid) * grid
  /*
   * "Taken" means another part is standing on the same spot, not that the
   * two would touch. Footprint-sized clearance was the first cut and it put
   * a desk mat half a metre from the desk it belongs on: the second part of
   * a pair is usually meant to go on, in or beside the first. Capped at
   * 150 mm so a desk does not clear half the room.
   */
  const taken = Object.values(doc.instances).map((i) => i.pos)
  const spacing = Math.min(radius + 30, 150)
  const clear = (x: number, z: number): boolean =>
    taken.every((p) => Math.hypot(p[0] - x, p[2] - z) > spacing)

  if (clear(toGrid(anchor[0]), toGrid(anchor[2]))) return [toGrid(anchor[0]), 0, toGrid(anchor[2])]

  // Occupied: step outward on a golden-angle spiral, which spreads evenly
  // without ever repeating a direction, until something is clear.
  const step = Math.min(radius * 2 + 40, 300)
  for (let k = 1; k <= 48; k++) {
    const a = k * 2.399
    const d = step * Math.sqrt(k) * 0.6
    const x = toGrid(anchor[0] + Math.cos(a) * d)
    const z = toGrid(anchor[2] + Math.sin(a) * d)
    if (clear(x, z)) return [x, 0, z]
  }
  return [toGrid(anchor[0]), 0, toGrid(anchor[2])]
}

/**
 * One row in the library.
 *
 * A single line, not two. The two-line row was right for a library of forty
 * parts and is wrong for one of two hundred and fifty: eight categories of
 * what you are looking for no longer fit on screen at once, and scanning a
 * list means scrolling it. Name and blurb on one line keeps the whole of a
 * category visible, and the blurb is still there to read.
 */
function PartRow({ def, onPlace }: { def: PartDef; onPlace: (def: PartDef) => void }) {
  return (
    <button
      className="part-item"
      onClick={() => onPlace(def)}
      title={`${def.name} — ${def.doc?.description ?? def.blurb}`}
    >
      <span className="swatch">
        <PartIcon def={def} size={15} />
      </span>
      <span className="pi-name">{def.name}</span>
      <span className="pi-blurb">{def.blurb}</span>
    </button>
  )
}

export function Library() {
  const [query, setQuery] = useState(askedFor)
  const [open, setOpen] = useState<Record<string, boolean>>(() => readJson(OPEN_KEY, {}))
  const [recent, setRecent] = useState<string[]>(() => readJson<string[]>(RECENT_KEY, []))
  const addPart = useDoc((s) => s.addPart)
  const setMode = useDoc((s) => s.setMode)
  const partsInBuild = useDoc((s) => s.doc.order.length)

  useEffect(() => writeJson(OPEN_KEY, open), [open])

  const searching = query.trim().length > 0
  const results = useMemo(() => (searching ? searchParts(query) : allParts()), [query, searching])

  const grouped = useMemo(() => {
    const map = new Map<PartCategory, PartDef[]>()
    for (const def of results) {
      const list = map.get(def.category)
      if (list) list.push(def)
      else map.set(def.category, [def])
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [results])

  const anyOpen = useMemo(() => Object.values(open).some(Boolean), [open])

  const recentDefs = useMemo(
    () => recent.map((id) => getPart(id)).filter((d): d is PartDef => !!d),
    [recent],
  )

  const place = useCallback(
    (def: PartDef) => {
      // Searching "10k" and clicking Resistor should give you a 10k resistor,
      // not a default one you then have to edit.
      const target = valueTargetFor(def, query)
      const params = { ...defaultParams(def), ...(target ? { [target.key]: target.value } : {}) }
      const at = placementFor(def, params)
      const id = addPart(def.id, at, target ? { [target.key]: target.value } : undefined)
      if (useDoc.getState().mode === 'sim') setMode('build')
      /*
       * And make it the thing the camera turns around.
       *
       * Placing it in front of you is half the job: the orbit centre is
       * still wherever it was, so the first scroll pulls away from the part
       * you just added towards a pivot somewhere else. Moving the pivot onto
       * it means zoom, orbit and the next placement all happen here.
       */
      if (id) {
        const inst = useDoc.getState().doc.instances[id]
        const box = buildPart(def, inst.params).bbox
        const mid = box.isEmpty() ? 0 : (box.min.y + box.max.y) / 2
        useDoc.getState().focusOn([at[0], inst.pos[1] + mid, at[2]])
      }
      setRecent((prev) => {
        const next = [def.id, ...prev.filter((id) => id !== def.id)].slice(0, RECENT_MAX)
        writeJson(RECENT_KEY, next)
        return next
      })
    },
    [addPart, query, setMode],
  )

  /* Section totals, so the header says how much is behind it. */
  const sectionCounts = useMemo(() => {
    const counts = new Map<LibrarySection, number>()
    for (const [cat, list] of grouped) {
      const section = CATEGORY_META[cat]?.section
      if (!section) continue
      counts.set(section, (counts.get(section) ?? 0) + list.length)
    }
    return counts
  }, [grouped])

  return (
    <aside className="panel" data-tour="library">
      <div className="panel-head">
        <PanelTabs count={partsInBuild} />
        <div className="grow" />
        {!searching && anyOpen && (
          <button className="link-btn" onClick={() => setOpen({})} title="Collapse all">
            Collapse all
          </button>
        )}
      </div>

      <div className="search">
        <IconSearch size={13} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter places the top hit. At this size of catalogue, typing the
            // name and pressing return is the fastest way to place anything,
            // and it was two clicks away from working already.
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault()
              place(results[0])
            }
          }}
          placeholder="Search parts, values, part numbers…"
          spellCheck={false}
        />
        {searching && (
          <button className="clear" onClick={() => setQuery('')} title="Clear">
            <IconX size={12} />
          </button>
        )}
      </div>

      <div className="panel-body scroll-y">
        {searching && results.length > 0 && (
          // While searching, show one ranked list. Grouping by category would
          // bury the best match under whichever section happens to sort first.
          <div>
            <div className="lib-section">
              <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
              <span className="lib-count">↵ places the first</span>
            </div>
            {results.map((def) => (
              <PartRow key={def.id} def={def} onPlace={place} />
            ))}
          </div>
        )}

        {results.length === 0 && (
          <div className="lib-empty">
            Nothing matches “{query}”.
            <br />
            Try a value like <b>10k</b>, a package like <b>2020</b>, or a function like <b>switch</b>.
          </div>
        )}

        {!searching && recentDefs.length > 0 && (
          <div>
            <div className="lib-section">
              <span>Recent</span>
              <button
                className="lib-count link-btn"
                onClick={() => {
                  setRecent([])
                  writeJson(RECENT_KEY, [])
                }}
                title="Forget the recent list"
              >
                Clear
              </button>
            </div>
            {recentDefs.map((def) => (
              <PartRow key={def.id} def={def} onPlace={place} />
            ))}
          </div>
        )}

        {!searching &&
          SECTION_ORDER.map((section) => {
            const cats = ([...grouped.keys()] as PartCategory[])
              .filter((c) => CATEGORY_META[c]?.section === section)
              .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)
            if (!cats.length) return null
            return (
              <div key={section}>
                <div className="lib-section">
                  <span>{section}</span>
                  <span className="lib-count">{sectionCounts.get(section) ?? 0}</span>
                </div>
                {cats.map((cat) => {
                  const parts = grouped.get(cat) ?? []
                  const isOpen = open[cat]
                  return (
                    <div key={cat}>
                      <button
                        className="lib-group"
                        data-open={!!isOpen}
                        aria-expanded={!!isOpen}
                        onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))}
                      >
                        <IconChevron size={12} className="chev" />
                        <span className="lib-glyph">
                          <CategoryIcon category={cat} />
                        </span>
                        {CATEGORY_META[cat].label}
                        <span className="count">{parts.length}</span>
                      </button>
                      {isOpen && parts.map((def) => <PartRow key={def.id} def={def} onPlace={place} />)}
                    </div>
                  )
                })}
              </div>
            )
          })}
      </div>
    </aside>
  )
}
