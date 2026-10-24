import { useEffect, useMemo, useRef, useState } from 'react'
import { useDoc } from '@/state/doc'
import { getPart, CATEGORY_META } from '@/parts/kernel/registry'
import type { PartCategory } from '@/parts/kernel/types'
import { PartIcon } from './PartIcons'
import { PanelTabs } from './PanelTabs'
import { IconEye, IconEyeOff, IconLock, IconSearch, IconTrash, IconUnlock, IconX } from './Icons'

/**
 * Everything in the build, as a list.
 *
 * The one thing the editor had no answer for. Past about thirty parts the
 * viewport stops being a way to find anything: a standoff behind a board is
 * four pixels and under something else, and the only way to select it was
 * to hide what was in front of it first. A desk with a room plugged into it
 * makes that worse, not better — most of a setup is cables and most cables
 * end at something you cannot see.
 *
 * So: the document in build order, named, searchable, with the two
 * properties that decide whether you can get at a thing — hidden and locked
 * — on the row rather than three clicks away.
 *
 * Build order, not alphabetical. The order parts were added is the order
 * they were thought of, which is closer to how somebody looks for one than
 * any sort is, and it is also the order the reel plays them back in.
 */

/** Rows in the order they were added, filtered by what was typed. */
function useRows(query: string) {
  const doc = useDoc((s) => s.doc)
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = doc.order
      .map((id) => doc.instances[id])
      .filter(Boolean)
      .map((inst) => ({ inst, def: getPart(inst.defId) }))
    if (!q) return rows
    return rows.filter(
      ({ inst, def }) =>
        inst.name.toLowerCase().includes(q) ||
        inst.defId.includes(q) ||
        (def?.name.toLowerCase().includes(q) ?? false),
    )
  }, [doc, query])
}

export function Outline() {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const doc = useDoc((s) => s.doc)
  const selection = useDoc((s) => s.selection)
  const select = useDoc((s) => s.select)
  const setHovered = useDoc((s) => s.setHovered)
  const hovered = useDoc((s) => s.hovered)
  const toggleHidden = useDoc((s) => s.toggleHidden)
  const toggleLock = useDoc((s) => s.toggleLock)
  const removeInstances = useDoc((s) => s.removeInstances)
  const renameInstance = useDoc((s) => s.renameInstance)
  const requestFrame = useDoc((s) => s.requestFrame)

  const rows = useRows(query)
  const chosen = useMemo(() => new Set(selection), [selection])
  const listRef = useRef<HTMLDivElement>(null)

  /* Follow the selection. Picking a part in the viewport and then coming
     here to rename it should not mean hunting for the row that is already
     highlighted somewhere off the bottom. */
  useEffect(() => {
    if (!selection.length) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${selection[selection.length - 1]}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selection])

  const counts = useMemo(() => {
    const map = new Map<PartCategory, number>()
    for (const id of doc.order) {
      const def = getPart(doc.instances[id]?.defId ?? '')
      if (!def) continue
      map.set(def.category, (map.get(def.category) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [doc])

  return (
    <aside className="panel outline" data-tour="outline">
      <div className="panel-head">
        <PanelTabs count={doc.order.length} />
      </div>

      <div className="search">
        <IconSearch size={13} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a part in this build…"
          spellCheck={false}
        />
        {query && (
          <button className="clear" onClick={() => setQuery('')} title="Clear">
            <IconX size={12} />
          </button>
        )}
      </div>

      <div className="panel-body scroll-y" ref={listRef} onMouseLeave={() => setHovered(null)}>
        {rows.length === 0 && (
          <div className="lib-empty">
            {doc.order.length === 0
              ? 'Nothing in the build yet. Add a part from the Parts tab.'
              : `Nothing in this build matches “${query}”.`}
          </div>
        )}

        {rows.map(({ inst, def }) => {
          const on = chosen.has(inst.id)
          return (
            <div
              key={inst.id}
              data-row={inst.id}
              className="out-row"
              data-on={on}
              data-hover={hovered === inst.id}
              data-dim={inst.hidden === true}
              onMouseEnter={() => setHovered(inst.id)}
              onClick={(e) => select([inst.id], e.shiftKey || e.metaKey || e.ctrlKey)}
              onDoubleClick={() => {
                select([inst.id])
                requestFrame('selection')
              }}
            >
              <span className="out-glyph">{def ? <PartIcon def={def} size={14} /> : null}</span>

              {editing === inst.id ? (
                <input
                  className="out-name-edit"
                  autoFocus
                  defaultValue={inst.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v) renameInstance(inst.id, v)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="out-name"
                  title={`${inst.name} — ${def?.name ?? inst.defId}`}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditing(inst.id)
                  }}
                >
                  {inst.name}
                </span>
              )}

              <span className="out-kind">{def ? CATEGORY_META[def.category]?.label.split(' ')[0] : '—'}</span>

              <button
                className="out-act"
                title={inst.hidden ? 'Show' : 'Hide'}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleHidden(inst.id)
                }}
              >
                {inst.hidden ? <IconEyeOff size={12} /> : <IconEye size={12} />}
              </button>
              <button
                className="out-act"
                title={inst.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleLock(inst.id)
                }}
              >
                {inst.locked ? <IconLock size={12} /> : <IconUnlock size={12} />}
              </button>
              <button
                className="out-act danger"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  removeInstances([inst.id])
                }}
              >
                <IconTrash size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {/* What the build is made of, which is the question the list itself
          is too long to answer. */}
      {counts.length > 0 && !query && (
        <div className="out-foot">
          {counts.slice(0, 5).map(([cat, n]) => (
            <span key={cat}>
              {CATEGORY_META[cat]?.label ?? cat}
              <b>{n}</b>
            </span>
          ))}
        </div>
      )}
    </aside>
  )
}
