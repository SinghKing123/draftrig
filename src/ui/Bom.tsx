import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { IconDownload, IconList, IconX } from './Icons'
import { useDoc, WIRE_COLORS } from '@/state/doc'
import { useBomPanel } from '@/state/bom'
import { getPart, unitPrice } from '@/parts/kernel/registry'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { formatMass, formatMoney } from '@/parts/kernel/units'
import type { Params, PartCategory } from '@/parts/kernel/types'

/**
 * The bill of materials.
 *
 * Reads the bench and says what it would take to build the thing for real:
 * every part, the manufacturer number where the catalog knows one, and the
 * hook-up wire measured between the terminals it actually runs between.
 *
 * It is its own panel rather than a tab in the console. The console is where
 * the solver complains and where the oscilloscope lives, and putting the one
 * screen a person actually wants to print in among the diagnostics made it
 * look like a developer tool. Nothing in here is diagnostic: it is a shopping
 * list, and it is titled and laid out like one.
 */

/* ------------------------------------------------------------------ */
/* Totalling                                                           */
/* ------------------------------------------------------------------ */

/** Which heading a line sits under. Coarse on purpose: three is legible. */
type Group = 'electronics' | 'structure' | 'wire'

const GROUP_LABEL: Record<Group, string> = {
  electronics: 'Electronics',
  structure: 'Structure and hardware',
  wire: 'Wire',
}

const STRUCTURAL: PartCategory[] = ['structural', 'panel', 'fastener', 'motion']

interface BomRow {
  key: string
  group: Group
  name: string
  detail: string
  qty: number
  unitMass: number
  unitPrice: number
  /** Manufacturer part number, where the catalog knows one. */
  mpn?: string
  /** Kept only so two lines of the same part can say how they differ. */
  params?: Params
  defId?: string
}

/** Parts that differ only in a value are different line items on a real order. */
function bomSignature(defId: string, params: Params): string {
  const keys = Object.keys(params).sort()
  return defId + '|' + keys.map((k) => `${k}=${String(params[k])}`).join(',')
}

/**
 * How much wire the build uses, by colour.
 *
 * Connections were missing from the bill entirely: a build with eleven links
 * in it listed two parts and no wire, which is exactly the thing you forget to
 * order. Measured as the straight run between terminals plus a fifth for the
 * bend out of each one and the slack a real harness needs — a bill of
 * materials that is slightly generous costs you nothing, and one that is
 * short stops the build.
 */
const SLACK = 1.2
/** Rough trade price of hook-up wire, dollars per metre. */
const WIRE_PER_M = 0.35

/** So the bill says "red" rather than "#E34B4B". */
const WIRE_NAMES: Record<string, string> = Object.fromEntries(
  WIRE_COLORS.map((c) => [c.value.toUpperCase(), c.label]),
)

function useWireRows(): BomRow[] {
  const instances = useDoc((s) => s.doc.instances)
  const connections = useDoc((s) => s.doc.connections)
  const order = useDoc((s) => s.doc.connectionOrder)

  return useMemo(() => {
    const ends = new Map<string, THREE.Vector3>()
    const at = (ref: { instanceId: string; portId: string }): THREE.Vector3 | null => {
      const key = ref.instanceId + '/' + ref.portId
      const hit = ends.get(key)
      if (hit) return hit
      const inst = instances[ref.instanceId]
      if (!inst) return null
      const def = getPart(inst.defId)
      if (!def) return null
      const port = buildPart(def, inst.params).ports.find((p) => p.id === ref.portId)
      if (!port) return null
      const v = new THREE.Vector3(...port.pos).applyMatrix4(instanceMatrix(inst.pos, inst.rot))
      ends.set(key, v)
      return v
    }

    const byColour = new Map<string, { mm: number; n: number }>()
    for (const id of order) {
      const c = connections[id]
      if (!c || c.kind !== 'wire') continue
      const a = at(c.a)
      const b = at(c.b)
      if (!a || !b) continue
      const colour = (c.color ?? '#E34B4B').toUpperCase()
      const entry = byColour.get(colour) ?? { mm: 0, n: 0 }
      entry.mm += a.distanceTo(b) * SLACK
      entry.n++
      byColour.set(colour, entry)
    }

    return [...byColour.entries()]
      .sort((x, y) => y[1].mm - x[1].mm)
      .map(([colour, { mm, n }]): BomRow => ({
        key: 'wire:' + colour,
        group: 'wire',
        name: `Hook-up wire, ${(WIRE_NAMES[colour] ?? colour).toLowerCase()}`,
        detail: `${n} link${n === 1 ? '' : 's'} · ${(mm / 10).toFixed(1)} cm of 24 AWG`,
        qty: 1,
        // Copper at roughly 24 AWG, which is what the wire in the viewport is.
        unitMass: (mm / 1000) * 3.4,
        unitPrice: (mm / 1000) * WIRE_PER_M,
      }))
  }, [instances, connections, order])
}

function usePartRows(): { rows: BomRow[]; mass: number; cost: number } {
  const instances = useDoc((s) => s.doc.instances)
  const order = useDoc((s) => s.doc.order)

  return useMemo(() => {
    const map = new Map<string, BomRow>()
    let mass = 0
    let cost = 0

    for (const id of order) {
      const inst = instances[id]
      if (!inst) continue
      const def = getPart(inst.defId)
      if (!def) continue
      const key = bomSignature(inst.defId, inst.params)
      const built = buildPart(def, inst.params)

      // Length-priced stock (extrusion, lumber) is quoted per millimetre.
      const lengthish = typeof inst.params.length === 'number' ? (inst.params.length as number) : 1
      const perUnit = unitPrice(def, inst.params)
      const linePrice = def.category === 'structural' ? perUnit * lengthish : perUnit

      const existing = map.get(key)
      if (existing) existing.qty++
      else {
        const detail = def.readouts?.(inst.params)?.[0]
        map.set(key, {
          key,
          group:
            def.category === 'wire'
              ? 'wire'
              : STRUCTURAL.includes(def.category)
                ? 'structure'
                : 'electronics',
          name: def.name,
          mpn: def.doc?.mpn,
          detail: detail ? `${detail.label}: ${detail.value}` : def.blurb,
          qty: 1,
          unitMass: built.mass,
          unitPrice: linePrice,
          params: inst.params,
          defId: inst.defId,
        })
      }
      mass += built.mass
      cost += linePrice
    }

    return { rows: separate([...map.values()]).sort((a, b) => a.name.localeCompare(b.name)), mass, cost }
  }, [instances, order])
}

/**
 * Two lines of the same part, told apart.
 *
 * A build with a blue button and a white one is two order lines, and it used
 * to print as the same sentence twice — "Pushbutton, momentary switch you can
 * click while it runs" — with no way to tell which was which or why there
 * were two. Where several lines share a name, this appends the parameters
 * that actually differ between them and leaves everything else alone.
 */
function separate(rows: BomRow[]): BomRow[] {
  const byName = new Map<string, BomRow[]>()
  for (const r of rows) {
    const list = byName.get(r.name)
    if (list) list.push(r)
    else byName.set(r.name, [r])
  }

  for (const list of byName.values()) {
    if (list.length < 2) continue
    const def = list[0].defId ? getPart(list[0].defId) : undefined
    if (!def) continue
    for (const spec of def.params) {
      const seen = new Set(list.map((r) => String(r.params?.[spec.key])))
      if (seen.size < 2) continue
      for (const r of list) {
        const v = r.params?.[spec.key]
        if (v === undefined) continue
        const unit = spec.type === 'number' && spec.unit ? ` ${spec.unit}` : ''
        r.detail = `${spec.label}: ${String(v)}${unit}`
      }
    }
  }
  return rows
}

/** Parts and wire together, which is what you actually have to buy. */
export function useFullBom(): { rows: BomRow[]; mass: number; cost: number } {
  const parts = usePartRows()
  const wire = useWireRows()
  return useMemo(() => {
    const rows = [...parts.rows, ...wire]
    return {
      rows,
      mass: parts.mass + wire.reduce((s, r) => s + r.unitMass * r.qty, 0),
      cost: parts.cost + wire.reduce((s, r) => s + r.unitPrice * r.qty, 0),
    }
  }, [parts, wire])
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** One CSV cell, quoted only when it has to be. */
const cell = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function bomCsv(rows: BomRow[], mass: number, cost: number, name: string): string {
  const lines = [
    ['Group', 'Part', 'Part number', 'Specification', 'Qty', 'Unit mass (g)', 'Unit price', 'Line price']
      .map(cell)
      .join(','),
    ...rows.map((r) =>
      [
        GROUP_LABEL[r.group],
        r.name,
        r.mpn ?? '',
        r.detail,
        r.qty,
        r.unitMass.toFixed(2),
        r.unitPrice > 0 ? r.unitPrice.toFixed(2) : '',
        r.unitPrice > 0 ? (r.unitPrice * r.qty).toFixed(2) : '',
      ]
        .map(cell)
        .join(','),
    ),
    ['Total', '', '', name, rows.reduce((s, r) => s + r.qty, 0), mass.toFixed(2), '', cost.toFixed(2)]
      .map(cell)
      .join(','),
  ]
  // CRLF: spreadsheets on Windows, which is where a BOM usually ends up,
  // treat a bare LF as one very long row.
  return lines.join('\r\n')
}

const fileName = (name: string): string =>
  (name.trim() || 'draftrig').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() + '-bom.csv'

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

/**
 * The tab on the edge of the window that opens it.
 *
 * Sits against the right edge and slides aside when the panel is out, so the
 * thing you press to open it is also the thing you press to close it, and it
 * never moves out from under the cursor by more than the panel's width.
 */
export function BomTab() {
  const open = useBomPanel((s) => s.open)
  const toggle = useBomPanel((s) => s.toggle)

  return (
    <button
      className="bom-tab"
      data-open={open}
      onClick={toggle}
      title={open ? 'Close the bill of materials' : 'What this build costs, and what to order'}
      aria-expanded={open}
    >
      <IconList size={13} />
      <span>BOM generator</span>
    </button>
  )
}

export function BomPanel() {
  const open = useBomPanel((s) => s.open)
  const setOpen = useBomPanel((s) => s.setOpen)
  const { rows, mass, cost } = useFullBom()
  const name = useDoc((s) => s.doc.name)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const csv = () => bomCsv(rows, mass, cost, name)

  const download = () => {
    const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName(name)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv())
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard permission refused, or an insecure origin. The download
      // button is right next to this one and always works.
    }
  }

  const count = rows.reduce((s, r) => s + r.qty, 0)
  const groups: Group[] = ['electronics', 'structure', 'wire']

  return (
    <aside className="bom-panel" aria-label="Bill of materials">
      <header className="bom-head">
        <div>
          <h2>BOM generator</h2>
          <p>Everything this build is made of, priced and weighed.</p>
        </div>
        <button className="btn ghost icon" onClick={() => setOpen(false)} title="Close">
          <IconX size={12} />
        </button>
      </header>

      {!rows.length ? (
        <div className="bom-blank">
          <IconList size={22} />
          <p>Nothing on the bench yet.</p>
          <p className="sub">
            Place a part and it appears here, with its price, its mass and its part number.
          </p>
        </div>
      ) : (
        <>
          <div className="bom-figures">
            <div>
              <b>{count}</b>
              <span>item{count === 1 ? '' : 's'}</span>
            </div>
            <div>
              <b>{formatMass(mass)}</b>
              <span>total mass</span>
            </div>
            <div className="lead">
              <b>{formatMoney(cost)}</b>
              <span>estimated cost</span>
            </div>
          </div>

          <div className="bom-actions">
            <button className="btn primary" onClick={download}>
              <IconDownload size={12} /> Download CSV
            </button>
            <button className="btn ghost" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>

          <div className="bom-list scroll-y">
            {groups.map((g) => {
              const lines = rows.filter((r) => r.group === g)
              if (!lines.length) return null
              const sub = lines.reduce((s, r) => s + r.unitPrice * r.qty, 0)
              return (
                <section key={g}>
                  <h3>
                    {GROUP_LABEL[g]}
                    <span>{formatMoney(sub)}</span>
                  </h3>
                  {lines.map((r) => (
                    <div className="bom-line" key={r.key}>
                      <span className="qty">{r.qty}&times;</span>
                      <div className="what">
                        <b>{r.name}</b>
                        <span>{r.detail}</span>
                        {r.mpn && <span className="mpn mono">{r.mpn}</span>}
                      </div>
                      <div className="money">
                        <b>{r.unitPrice > 0 ? formatMoney(r.unitPrice * r.qty) : '—'}</b>
                        <span>{formatMass(r.unitMass * r.qty)}</span>
                      </div>
                    </div>
                  ))}
                </section>
              )
            })}
          </div>

          <p className="bom-foot">
            Typical single-unit trade prices, for telling a ten dollar idea from a two hundred
            dollar one. They are not quotes.
          </p>
        </>
      )}
    </aside>
  )
}
