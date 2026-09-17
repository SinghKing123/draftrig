import { useEffect, useMemo, useState } from 'react'
import { IconChevron, IconSearch, IconX } from './Icons'
import { CategoryIcon, PartIcon } from './PartIcons'
import { allParts, CATEGORY_META, searchParts, valueTargetFor } from '@/parts/kernel/registry'
import type { PartCategory, PartDef } from '@/parts/kernel/types'
import { useDoc } from '@/state/doc'

const SECTION_ORDER: ('Electronics' | 'Build' | 'Computers')[] = ['Electronics', 'Computers', 'Build']

/**
 * Which categories are expanded, remembered between sessions.
 *
 * Everything starts closed. With four sections and nineteen categories, any
 * category left open pushes the rest off the bottom of the panel, and the
 * first thing you see is the middle of a list you did not ask for. Closed, the
 * whole catalogue fits on one screen and you can see what is in it.
 */
const OPEN_KEY = 'draftrig.library.open.v1'

function readOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    // Private windows and blocked site data both land here; everything closed
    // is the right answer, not a crash.
    return {}
  }
}

export function Library() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen)
  const addPart = useDoc((s) => s.addPart)
  const setMode = useDoc((s) => s.setMode)

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open))
    } catch {
      /* storage full or unavailable; the panel still works, it just forgets */
    }
  }, [open])

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

  const place = (def: PartDef) => {
    // Drop new parts in a loose spiral so they never land on top of each other.
    const n = useDoc.getState().doc.order.length
    const a = n * 2.399
    const r = 26 * Math.sqrt(n)
    // Searching "10k" and clicking Resistor should give you a 10k resistor,
    // not a default one you then have to edit.
    const target = valueTargetFor(def, query)
    addPart(
      def.id,
      [Math.round(Math.cos(a) * r), 0, Math.round(Math.sin(a) * r)],
      target ? { [target.key]: target.value } : undefined,
    )
    if (useDoc.getState().mode === 'sim') setMode('build')
  }

  return (
    <aside className="panel" data-tour="library">
      <div className="panel-head">
        Parts
        <div className="grow" />
        {!searching && anyOpen && (
          <button className="link-btn" onClick={() => setOpen({})} title="Close every category">
            Collapse all
          </button>
        )}
      </div>

      <div className="search">
        <IconSearch size={13} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
            <div className="lib-section">{results.length} result{results.length === 1 ? '' : 's'}</div>
            {results.map((def) => (
              <button key={def.id} className="part-item" onClick={() => place(def)} title={def.doc?.description ?? def.blurb}>
                <span className="swatch"><PartIcon def={def} /></span>
                <span className="pi-text">
                  <span className="pi-name">{def.name}</span>
                  <span className="pi-blurb">{def.blurb}</span>
                </span>
              </button>
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

        {!searching && SECTION_ORDER.map((section) => {
          const cats = ([...grouped.keys()] as PartCategory[])
            .filter((c) => CATEGORY_META[c]?.section === section)
            .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)
          if (!cats.length) return null
          return (
            <div key={section}>
              <div className="lib-section">{section}</div>
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
                      <span className="lib-glyph"><CategoryIcon category={cat} /></span>
                      {CATEGORY_META[cat].label}
                      <span className="count">{parts.length}</span>
                    </button>
                    {isOpen &&
                      parts.map((def) => (
                        <button key={def.id} className="part-item" onClick={() => place(def)} title={def.doc?.description ?? def.blurb}>
                          <span className="swatch"><PartIcon def={def} /></span>
                          <span className="pi-text">
                            <span className="pi-name">{def.name}</span>
                            <span className="pi-blurb">{def.blurb}</span>
                          </span>
                        </button>
                      ))}
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
