import { useMemo, useState, type ReactNode } from 'react'
import { hasUsedEditor } from './firstRun'
import { useSketchPanel } from '@/state/sketch'
import * as THREE from 'three'
import { Field, NumberField, Readout, Toggle } from './Fields'
import { IconChevron, IconCopy, IconLock, IconTrash, IconUnlock, IconZap } from './Icons'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { getPart, unitPrice } from '@/parts/kernel/registry'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import type { ParamSpec, Params, Vec3 } from '@/parts/kernel/types'
import { awgToMm2, eng, formatMass, formatMoney, wireAmpacity, wireResistance } from '@/parts/kernel/units'
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
  spec, params, onChange, onEditCode,
}: {
  spec: ParamSpec
  params: Params
  onChange: (key: string, value: number | string | boolean, commit: boolean) => void
  /** Open the sketch panel. Only a 'code' parameter has anywhere to send it. */
  onEditCode?: () => void
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
    case 'code': {
      /* The source itself lives in the panel: a one-line field is the wrong
         shape for a program, and the inspector column is 300px wide. */
      const value = String(params[spec.key] ?? spec.default)
      const lines = value.split('\n').length
      return (
        <Field label={spec.label}>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'space-between' }}
            onClick={onEditCode}
          >
            <span>Open editor</span>
            <span className="mono" style={{ color: 'var(--tx-3)' }}>{lines} lines</span>
          </button>
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

/* ================================================================== */
/* A wire                                                             */
/* ================================================================== */

/**
 * Common cable, as choices rather than numbers.
 *
 * Nobody picks 0.824 mm^2; they pick "mains flex" and get it. The number is
 * still shown and still editable, because the number is what the solver uses
 * and the point of this panel is that the two agree.
 */
const WIRE_KINDS: { label: string; mm2: number; volts: number; note: string }[] = [
  { label: 'Jumper, 24 AWG', mm2: awgToMm2(24), volts: 300, note: 'breadboard and signal' },
  { label: 'Hook-up, 22 AWG', mm2: awgToMm2(22), volts: 300, note: 'board to board' },
  { label: 'Hook-up, 20 AWG', mm2: awgToMm2(20), volts: 600, note: 'a few amps' },
  { label: 'Silicone, 18 AWG', mm2: awgToMm2(18), volts: 600, note: 'motors, LED strip' },
  { label: 'Mains flex, 0.75', mm2: 0.75, volts: 500, note: '6 A appliance lead' },
  { label: 'Mains flex, 1.0', mm2: 1.0, volts: 500, note: '10 A appliance lead' },
  { label: 'Mains flex, 1.5', mm2: 1.5, volts: 500, note: '13 A, a kettle' },
  { label: 'Mains T&E, 2.5', mm2: 2.5, volts: 600, note: 'ring final, in the wall' },
]

function WirePanel({ id }: { id: string }) {
  const conn = useDoc((s) => s.doc.connections[id])
  const instances = useDoc((s) => s.doc.instances)
  const setProps = useDoc((s) => s.setConnectionProps)
  const disconnect = useDoc((s) => s.disconnect)
  const selectWire = useDoc((s) => s.selectWire)
  const wireI = useSim((s) => s.wireI)
  const nodeV = useSim((s) => s.nodeV)
  const running = useSim((s) => s.running)

  /*
   * Length is measured, not stored.
   *
   * It is the distance the wire actually spans in the scene, which is the
   * whole reason this can say anything useful about volt drop: move the tower
   * to the other side of the desk and the lead gets longer and the drop gets
   * worse, with nobody having typed a number. The 15% is the same allowance
   * the netlist makes, because a wire is never the straight line.
   */
  const lengthMm = useMemo(() => {
    if (!conn) return 0
    const ends = [conn.a, conn.b].map((ref) => {
      const inst = instances[ref.instanceId]
      const def = inst ? getPart(inst.defId) : null
      if (!inst || !def) return null
      const port = buildPart(def, inst.params).ports.find((pt) => pt.id === ref.portId)
      if (!port) return null
      return new THREE.Vector3(...port.pos).applyMatrix4(instanceMatrix(inst.pos, inst.rot))
    })
    if (!ends[0] || !ends[1]) return 0
    return Math.max(ends[0].distanceTo(ends[1]) * 1.15, 5)
  }, [conn, instances])

  const endName = (ref: { instanceId: string; portId: string }) => {
    const inst = instances[ref.instanceId]
    const def = inst ? getPart(inst.defId) : null
    const port = inst && def ? buildPart(def, inst.params).ports.find((pt) => pt.id === ref.portId) : null
    return (inst ? inst.name : '?') + ' / ' + (port ? port.label : ref.portId)
  }

  if (!conn) return null

  const mm2 = conn.gauge ?? awgToMm2(24)
  const volts = conn.insulationV ?? 300
  const amps = Math.abs(wireI[id] ?? 0)
  const ampacity = wireAmpacity(mm2)
  const ohms = wireResistance(lengthMm, mm2)
  const drop = amps * ohms
  const across = Math.max(
    Math.abs(nodeV[portKey(conn.a.instanceId, conn.a.portId)] ?? 0),
    Math.abs(nodeV[portKey(conn.b.instanceId, conn.b.portId)] ?? 0),
  )
  const preset = WIRE_KINDS.findIndex((k) => Math.abs(k.mm2 - mm2) < 1e-6)

  return (
    <aside className="panel inspector">
      <div className="panel-head">
        Wire
        <div className="grow" />
        <button
          className="btn ghost icon danger"
          title="Remove this wire"
          onClick={() => { disconnect([id]); selectWire(null) }}
        >
          <IconTrash size={12} />
        </button>
      </div>

      <div className="insp-title">
        <div className="wire-ends">
          <span>{endName(conn.a)}</span>
          <span className="wire-arrow">to</span>
          <span>{endName(conn.b)}</span>
        </div>
      </div>

      <div className="panel-body scroll-y">
        <Group title="Conductor">
          <Field label="Cable">
            <select
              className="input"
              value={preset}
              onChange={(e) => {
                const k = WIRE_KINDS[Number(e.target.value)]
                if (k) setProps(id, { gauge: k.mm2, insulationV: k.volts })
              }}
            >
              {preset === -1 && <option value={-1}>Custom</option>}
              {WIRE_KINDS.map((k, i) => (
                <option key={k.label} value={i}>{k.label} mm2 - {k.note}</option>
              ))}
            </select>
          </Field>
          <Field label="Cross-section">
            <NumberField
              value={mm2}
              unit="mm2"
              step={0.05}
              min={0.02}
              max={16}
              onChange={(v, c) => setProps(id, { gauge: v }, c)}
            />
          </Field>
          <Field label="Insulation">
            <NumberField
              value={volts}
              unit="V"
              step={50}
              min={30}
              max={1000}
              onChange={(v, c) => setProps(id, { insulationV: v }, c)}
            />
          </Field>
          <Field label="Colour">
            <div className="row" style={{ gap: 6 }}>
              <input
                className="color-chip"
                type="color"
                value={conn.color ?? '#E34B4B'}
                onChange={(e) => setProps(id, { color: e.target.value })}
              />
              <span className="mono" style={{ color: 'var(--tx-2)' }}>{conn.color ?? '#E34B4B'}</span>
            </div>
          </Field>
        </Group>

        <Group title="This run">
          <Readout k="Length" v={`${lengthMm.toFixed(0)} mm`} />
          <Readout k="Resistance" v={eng(ohms, 'ohm')} />
          <Readout k="Rated" v={`${ampacity.toFixed(1)} A, ${volts} V`} />
          {running ? (
            <>
              <Readout k="Carrying" v={eng(amps, 'A')} />
              <Readout k="Volt drop" v={eng(drop, 'V')} />
              <Readout k="Working at" v={eng(across, 'V')} />
            </>
          ) : (
            <Readout k="Carrying" v="Not running" />
          )}
        </Group>

        {running && amps > ampacity && (
          <div className="wire-warn">
            {eng(amps, 'A')} through {mm2.toFixed(2)} mm2 is above the {ampacity.toFixed(1)} A this
            conductor is good for. Use a thicker cable.
          </div>
        )}
        {running && across > volts && (
          <div className="wire-warn">
            {eng(across, 'V')} on insulation rated {volts} V.
          </div>
        )}
      </div>
    </aside>
  )
}

export function Inspector() {
  /* Read once. The answer changes at most once per session, and a panel that
     loses a line out from under the pointer mid-session is its own defect. */
  const [returning] = useState(hasUsedEditor)
  const selectedWire = useDoc((s) => s.selectedWire)
  const selection = useDoc((s) => s.selection)
  const instances = useDoc((s) => s.doc.instances)
  const setParam = useDoc((s) => s.setParam)
  const openSketch = useSketchPanel((s) => s.open)
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
    // Live controls come first, they are what you reach for while simulating.
    return [...map.entries()].sort(([a], [b]) => (a === 'Control' ? -1 : b === 'Control' ? 1 : 0))
  }, [def])

  // A wire and a part are never both selected; see `selectWire` in the store.
  if (selectedWire) return <WirePanel id={selectedWire} />

  if (selection.length > 1) {
    return (
      <aside className="panel inspector">
        <div className="panel-head">Properties</div>
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
    /*
     * Nothing selected, so nothing to show.
     *
     * This panel used to spend its empty state teaching: a sentence telling
     * you to select a part, and the three mode keys under it. Nothing is
     * selected for most of the time anyone spends in here — between placing
     * parts, after a delete, on every new document — so that was not an
     * empty state, it was a permanent instruction panel occupying the
     * width of the property sheet.
     *
     * Someone who has used the editor gets what the property editor in any
     * such tool gives them, which is an empty column. Someone who has not
     * gets the keys once.
     */
    return (
      <aside className="panel inspector">
        <div className="panel-head">Properties</div>
        {!returning && (
          <div className="insp-empty">
            <kbd>1</kbd> build · <kbd>2</kbd> wire · <kbd>3</kbd> simulate
          </div>
        )}
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

  // unitPrice, not doc.price: a graphics card's price is a function of how it
  // is configured, and reading the flat field showed nothing for every part
  // that prices itself. The bill of materials has always used this one.
  const price = unitPrice(def, inst.params)
  const size = built ? built.bbox.getSize(new THREE.Vector3()) : null

  return (
    <aside className="panel inspector" data-tour="inspector">
      <div className="panel-head">
        Properties
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
              <ParamControl
                key={spec.key}
                spec={spec}
                params={inst.params}
                onChange={onParam}
                onEditCode={() => openSketch(inst.id)}
              />
            ))}
          </Group>
        ))}

        {/*
          * Location and rotation, named the way the rest of the trade names
          * them, with the axis inside the field it belongs to. Six rows that
          * each said "Position X" spent a third of the column repeating the
          * word "Position" and the word "Rotate".
          */}
        <Group title="Transform">
          <div className="axis-set">
            <div className="axis-head">Location</div>
            <NumberField label="X" value={inst.pos[0]} unit="mm" step={1} onChange={(v, c) => setPos(0, v, c)} />
            <NumberField label="Y" value={inst.pos[1]} unit="mm" step={1} onChange={(v, c) => setPos(1, v, c)} />
            <NumberField label="Z" value={inst.pos[2]} unit="mm" step={1} onChange={(v, c) => setPos(2, v, c)} />
          </div>
          <div className="axis-set">
            <div className="axis-head">Rotation</div>
            <NumberField label="X" value={inst.rot[0]} unit="°" step={15} onChange={(v, c) => setRot(0, v, c)} />
            <NumberField label="Y" value={inst.rot[1]} unit="°" step={15} onChange={(v, c) => setRot(1, v, c)} />
            <NumberField label="Z" value={inst.rot[2]} unit="°" step={15} onChange={(v, c) => setRot(2, v, c)} />
          </div>
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
              return <Readout key={p.id} k={p.label} v={v === undefined ? 'n/a' : eng(v, 'V')} />
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
          {price > 0 && <Readout k="Unit price" v={formatMoney(price)} />}
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
