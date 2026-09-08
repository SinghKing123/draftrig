import { useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Field, NumberField, Readout, Toggle } from './Fields'
import { IconChevron, IconCopy, IconLock, IconTrash, IconUnlock, IconZap } from './Icons'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { getPart } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'
import type { ParamSpec, Params, Vec3 } from '@/parts/kernel/types'
import { eng, formatMass, formatMoney } from '@/parts/kernel/units'
import { portKey } from '@/sim/circuit/netlist'

function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="group">
      <button className="group-head" data-open={open} onClick={() => setOpen((o) => !o)}>
        <IconChevron size={10} className="chev" />
        {title}
      </button>
      {open && <div className="group-body">{children}</div>}
    </section>
  )
}

function ParamControl({
  spec, params, onChange,
}: {
  spec: ParamSpec
  params: Params
  onChange: (key: string, value: number | string | boolean, commit: boolean) => void
}) {
  if (spec.showIf && !spec.showIf(params)) return null

  switch (spec.type) {
    case 'number': {
      const value = typeof params[spec.key] === 'number' ? (params[spec.key] as number) : spec.default
      const isPercent = spec.unit === '%'
      return (
        <Field label={spec.label}>
          {isPercent ? (
            <div className="row" style={{ gap: 8 }}>
              <input
                className="slider"
                type="range"
                min={spec.min ?? 0}
                max={spec.max ?? 100}
                step={spec.step ?? 1}
                value={value}
                onChange={(e) => onChange(spec.key, Number(e.target.value), false)}
                onPointerUp={() => onChange(spec.key, value, true)}
              />
              <span className="mono" style={{ width: 34, textAlign: 'right', color: 'var(--tx-1)' }}>
                {Math.round(value)}%
              </span>
            </div>
          ) : (
            <NumberField
              value={value}
              unit={spec.unit}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              eng={spec.eng}
              onChange={(v, committed) => onChange(spec.key, v, committed)}
            />
          )}
        </Field>
      )
    }
    case 'enum': {
      const value = String(params[spec.key] ?? spec.default)
      return (
        <Field label={spec.label}>
          <select className="input" value={value} onChange={(e) => onChange(spec.key, e.target.value, true)}>
            {spec.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      )
    }
    case 'bool': {
      const value = params[spec.key] === true
      return (
        <Field label={spec.label}>
          <Toggle on={value} onChange={(v) => onChange(spec.key, v, true)} />
        </Field>
      )
    }
    case 'color': {
      const value = String(params[spec.key] ?? spec.default)
      return (
        <Field label={spec.label}>
          <div className="row" style={{ gap: 6 }}>
            <input
              className="color-chip"
              type="color"
              value={value}
              onChange={(e) => onChange(spec.key, e.target.value, true)}
            />
            <span className="mono" style={{ color: 'var(--tx-2)' }}>{value}</span>
          </div>
        </Field>
      )
    }
    case 'text': {
      const value = String(params[spec.key] ?? spec.default)
      return (
        <Field label={spec.label}>
          <input className="input" value={value} onChange={(e) => onChange(spec.key, e.target.value, true)} />
        </Field>
      )
    }
  }
}

export function Inspector() {
  const selection = useDoc((s) => s.selection)
  const instances = useDoc((s) => s.doc.instances)
  const setParam = useDoc((s) => s.setParam)
  const moveInstance = useDoc((s) => s.moveInstance)
  const rotateInstance = useDoc((s) => s.rotateInstance)
  const renameInstance = useDoc((s) => s.renameInstance)
  const removeInstances = useDoc((s) => s.removeInstances)
  const duplicateSelection = useDoc((s) => s.duplicateSelection)
  const toggleLock = useDoc((s) => s.toggleLock)

  const nodeV = useSim((s) => s.nodeV)
  const instI = useSim((s) => s.instI)
  const power = useSim((s) => s.power)
  const running = useSim((s) => s.running)

  const id = selection.length === 1 ? selection[0] : null
  const inst = id ? instances[id] : null
  const def = inst ? getPart(inst.defId) : null

  const built = useMemo(() => (def && inst ? buildPart(def, inst.params) : null), [def, inst])

  const groups = useMemo(() => {
    if (!def) return []
    const map = new Map<string, ParamSpec[]>()
    for (const spec of def.params) {
      const g = spec.group ?? 'Parameters'
      const list = map.get(g)
      if (list) list.push(spec)
      else map.set(g, [spec])
    }
    // Live controls come first — they are what you reach for while simulating.
    return [...map.entries()].sort(([a], [b]) => (a === 'Control' ? -1 : b === 'Control' ? 1 : 0))
  }, [def])

  if (selection.length > 1) {
    return (
      <aside className="panel">
        <div className="panel-head">Inspector</div>
        <div className="insp-empty">
          <b style={{ color: 'var(--tx-1)' }}>{selection.length} parts selected</b>
          <br />
          Move or rotate them together, or press <kbd>Del</kbd> to remove them.
          <div style={{ marginTop: 16, display: 'flex', gap: 6, justifyContent: 'center' }}>
            <button className="btn" onClick={duplicateSelection}><IconCopy /> Duplicate</button>
            <button className="btn danger" onClick={() => removeInstances(selection)}><IconTrash /> Delete</button>
          </div>
        </div>
      </aside>
    )
  }

  if (!inst || !def) {
    return (
      <aside className="panel">
        <div className="panel-head">Inspector</div>
        <div className="insp-empty">
          Nothing selected.
          <br />
          Pick a part in the viewport, or add one from the library.
          <br />
          <br />
          <span style={{ color: 'var(--tx-2)' }}>
            <kbd>1</kbd> build · <kbd>2</kbd> wire · <kbd>3</kbd> simulate
          </span>
        </div>
      </aside>
    )
  }

  const onParam = (key: string, value: number | string | boolean, commit: boolean) =>
    setParam(inst.id, key, value, commit)

  const setPos = (axis: 0 | 1 | 2, v: number, commit: boolean) => {
    const p: Vec3 = [...inst.pos] as Vec3
    p[axis] = v
    moveInstance(inst.id, p, commit)
  }
  const setRot = (axis: 0 | 1 | 2, v: number, commit: boolean) => {
    const r: Vec3 = [...inst.rot] as Vec3
    r[axis] = v
    rotateInstance(inst.id, r, commit)
  }

  const electricalPorts = built?.ports.filter((p) => p.kind === 'electrical') ?? []
  const hasLive = Object.keys(nodeV).length > 0

  const price = def.doc?.price
  const size = built ? built.bbox.getSize(new THREE.Vector3()) : null

  return (
    <aside className="panel">
      <div className="panel-head">
        Inspector
        <div className="grow" />
        <button className="btn ghost icon" title={inst.locked ? 'Unlock' : 'Lock'} onClick={() => toggleLock(inst.id)}>
          {inst.locked ? <IconLock size={12} /> : <IconUnlock size={12} />}
        </button>
        <button className="btn ghost icon" title="Duplicate (Ctrl+D)" onClick={duplicateSelection}><IconCopy size={12} /></button>
        <button className="btn ghost icon danger" title="Delete (Del)" onClick={() => removeInstances([inst.id])}><IconTrash size={12} /></button>
      </div>

      <div className="insp-title">
        <input value={inst.name} spellCheck={false} onChange={(e) => renameInstance(inst.id, e.target.value)} />
        <div className="insp-sub">
          <span className="tag">{def.name}</span>
          {def.doc?.mpn && <span className="tag">{def.doc.mpn}</span>}
          {running && <span className="live-badge"><IconZap size={9} /> live</span>}
        </div>
      </div>

      <div className="panel-body scroll-y">
        {groups.map(([title, specs]) => (
          <Group key={title} title={title === 'Control' ? 'Live control' : title}>
            {specs.map((spec) => (
              <ParamControl key={spec.key} spec={spec} params={inst.params} onChange={onParam} />
            ))}
          </Group>
        ))}

        <Group title="Transform">
          <Field label="Position X"><NumberField value={inst.pos[0]} unit="mm" step={1} onChange={(v, c) => setPos(0, v, c)} /></Field>
          <Field label="Position Y"><NumberField value={inst.pos[1]} unit="mm" step={1} onChange={(v, c) => setPos(1, v, c)} /></Field>
          <Field label="Position Z"><NumberField value={inst.pos[2]} unit="mm" step={1} onChange={(v, c) => setPos(2, v, c)} /></Field>
          <div className="divider" />
          <Field label="Rotate X"><NumberField value={inst.rot[0]} unit="°" step={15} onChange={(v, c) => setRot(0, v, c)} /></Field>
          <Field label="Rotate Y"><NumberField value={inst.rot[1]} unit="°" step={15} onChange={(v, c) => setRot(1, v, c)} /></Field>
          <Field label="Rotate Z"><NumberField value={inst.rot[2]} unit="°" step={15} onChange={(v, c) => setRot(2, v, c)} /></Field>
        </Group>

        {def.readouts && (
          <Group title="Specification">
            {def.readouts(inst.params).map((r) => (
              <Readout key={r.label} k={r.label} v={r.value} />
            ))}
          </Group>
        )}

        {hasLive && electricalPorts.length > 0 && (
          <Group title="Measurements">
            {electricalPorts.slice(0, 12).map((p) => {
              const v = nodeV[portKey(inst.id, p.id)]
              return <Readout key={p.id} k={p.label} v={v === undefined ? '—' : eng(v, 'V')} />
            })}
            {electricalPorts.length > 12 && (
              <div className="readout"><span className="k">…</span><span className="v">{electricalPorts.length - 12} more terminals</span></div>
            )}
            <div className="divider" />
            {instI[inst.id] !== undefined && <Readout k="Current" v={eng(Math.abs(instI[inst.id]), 'A')} />}
            {power[inst.id] !== undefined && <Readout k="Dissipation" v={eng(power[inst.id], 'W')} />}
          </Group>
        )}

        <Group title="Physical" defaultOpen={false}>
          {built && <Readout k="Mass" v={formatMass(built.mass)} />}
          {built && <Readout k="Volume" v={`${built.volume.toFixed(2)} cm³`} />}
          {size && <Readout k="Bounding box" v={`${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`} />}
          {price !== undefined && <Readout k="Unit price" v={formatMoney(price)} />}
          {built && <Readout k="Terminals" v={String(built.ports.length)} />}
        </Group>

        {def.doc?.description && (
          <Group title="About" defaultOpen={false}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx-2)', lineHeight: 1.6 }}>{def.doc.description}</p>
            {def.doc.manufacturer && (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--tx-3)', marginTop: 8 }}>{def.doc.manufacturer}</p>
            )}
          </Group>
        )}
      </div>
    </aside>
  )
}
