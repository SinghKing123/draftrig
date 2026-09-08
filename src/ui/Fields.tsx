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
}

const clamp = (v: number, min?: number, max?: number): number => {
  if (min !== undefined && v < min) return min
  if (max !== undefined && v > max) return max
  return v
}

export function NumberField({ value, onChange, unit, min, max, step = 1, eng: useEng, disabled }: NumberFieldProps) {
  const format = (v: number) => (useEng ? eng(v, '', 4) : String(Math.round(v * 1000) / 1000))
  const [text, setText] = useState(() => format(value))
  const [editing, setEditing] = useState(false)
  const drag = useRef<{ x: number; start: number } | null>(null)

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

  // Horizontal drag scrubs the value, the way every 3D tool does it.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || editing) return
    if (e.button !== 0) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, start: value }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) < 3) return
    const scale = useEng ? Math.max(Math.abs(d.start), 1e-12) * 0.012 : (e.shiftKey ? step / 10 : step)
    const next = clamp(useEng ? d.start * Math.pow(1.03, dx) : d.start + dx * scale, min, max)
    onChange(useEng ? next : Math.round(next / step) * step, false)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      drag.current = null
      onChange(value, true)
    }
  }

  return (
    <div
      className="input-unit scrub"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
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
