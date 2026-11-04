import { useEffect, useRef, useState } from 'react'
import { eng, parseEng } from '@/parts/kernel/units'

/* ------------------------------------------------------------------ */
/* Number field with drag-to-scrub                                     */
/* ------------------------------------------------------------------ */

interface NumberFieldProps {
  value: number
  onChange: (v: number, committed: boolean) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  /** Show and accept engineering notation (4k7, 100n). */
  eng?: boolean
  disabled?: boolean
  /**
   * The name of the value, drawn inside the widget rather than in a column
   * beside it.
   *
   * A label in its own column makes a property sheet a web form: half the
   * width is spent on words, the controls are a ragged second column, and
   * nothing about the row says it can be dragged. Every tool that edits
   * geometry for a living puts the name, the number and the unit in one
   * draggable box, and that box is the whole row. Use it where the name is
   * short — an axis, a channel. A long name still wants the column.
   */
  label?: string
}

/** How far the pointer must travel before a press counts as a scrub, px. */
const DRAG_SLOP = 4

const clamp = (v: number, min?: number, max?: number): number => {
  if (min !== undefined && v < min) return min
  if (max !== undefined && v > max) return max
  return v
}

export function NumberField({ value, onChange, unit, min, max, step = 1, eng: useEng, disabled, label }: NumberFieldProps) {
  const format = (v: number) => (useEng ? eng(v, '', 4) : String(Math.round(v * 1000) / 1000))
  const [text, setText] = useState(() => format(value))
  const [editing, setEditing] = useState(false)
  const drag = useRef<{ x: number; start: number; live: boolean } | null>(null)

  useEffect(() => {
    if (!editing) setText(format(value))
    // `format` depends only on useEng, which is stable for a given field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editing, useEng])

  const commit = (raw: string) => {
    const parsed = useEng ? parseEng(raw) : parseFloat(raw)
    if (isNaN(parsed)) {
      setText(format(value))
      return
    }
    onChange(clamp(parsed, min, max), true)
  }

  /*
   * Horizontal drag scrubs the value, the way every 3D tool does it.
   *
   * Two things here are deliberate and were both wrong before. The pointer is
   * not captured until the drag has actually started, because a capture taken
   * on press retargets the click that follows and the field then cannot be
   * focused by clicking it. And a press that never became a drag commits
   * nothing: it used to commit the unchanged value, which recorded an undo
   * step for every click on a number, so Ctrl+Z spent a while undoing nothing
   * before it undid anything.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || editing) return
    if (e.button !== 0) return
    drag.current = { x: e.clientX, start: value, live: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.live) {
      if (Math.abs(dx) < DRAG_SLOP) return
      d.live = true
      e.currentTarget.setPointerCapture(e.pointerId)
      // Typing and scrubbing at once makes no sense, and the caret sitting in
      // a field whose value is being dragged out from under it looks broken.
      ;(e.currentTarget.querySelector('input') as HTMLInputElement | null)?.blur()
    }
    const scale = useEng ? Math.max(Math.abs(d.start), 1e-12) * 0.012 : (e.shiftKey ? step / 10 : step)
    const next = clamp(useEng ? d.start * Math.pow(1.03, dx) : d.start + dx * scale, min, max)
    onChange(useEng ? next : Math.round(next / step) * step, false)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (!d.live) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    onChange(value, true)
  }

  return (
    <div
      className={label === undefined ? 'input-unit scrub' : 'input-unit scrub named'}
      data-editing={editing}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {label !== undefined && <span className="scrub-label">{label}</span>}
      <input
        className="input"
        value={text}
        disabled={disabled}
        spellCheck={false}
        onFocus={(e) => {
          setEditing(true)
          e.target.select()
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false)
          commit(text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(text)
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'Escape') {
            setText(format(value))
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const dir = e.key === 'ArrowUp' ? 1 : -1
            const next = useEng ? value * (dir > 0 ? 1.1 : 1 / 1.1) : value + dir * (e.shiftKey ? step * 10 : step)
            onChange(clamp(next, min, max), true)
          }
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="switch"
      data-on={on}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    />
  )
}

export function Field({ label, children, wide }: { label?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'field wide' : 'field'}>
      {label !== undefined && <label>{label}</label>}
      {children}
    </div>
  )
}

export function Readout({ k, v }: { k: string; v: string }) {
  return (
    <div className="readout">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  )
}
