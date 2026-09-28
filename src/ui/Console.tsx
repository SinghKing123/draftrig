import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { IconChevron, IconDownload, IconList, IconScope, IconWarning } from './Icons'
import { Scope } from './Scope'
import { useDoc, WIRE_COLORS } from '@/state/doc'
import { useConsole } from '@/state/console'
import { useSim } from '@/state/sim'
import { getPart, unitPrice } from '@/parts/kernel/registry'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { formatMass, formatMoney } from '@/parts/kernel/units'
import type { Params } from '@/parts/kernel/types'

type Tab = 'issues' | 'bom' | 'scope'

/* ------------------------------------------------------------------ */
/* Bill of materials                                                   */
/* ------------------------------------------------------------------ */

interface BomRow {
  key: string
  name: string
  detail: string
  qty: number
  unitMass: number
  unitPrice: number
  /** Manufacturer part number, where the catalog knows one. */
  mpn?: string
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
        name: 'Hook-up wire',
        detail: `${WIRE_NAMES[colour] ?? colour} · ${n} link${n === 1 ? '' : 's'} · ${(mm / 10).toFixed(1)} cm`,
        qty: 1,
        // Copper at roughly 24 AWG, which is what the wire in the viewport is.
        unitMass: (mm / 1000) * 3.4,
        unitPrice: (mm / 1000) * WIRE_PER_M,
      }))
  }, [instances, connections, order])
}

/** So the bill says "red" rather than "#E34B4B". */
const WIRE_NAMES: Record<string, string> = Object.fromEntries(
  WIRE_COLORS.map((c) => [c.value.toUpperCase(), c.label]),
)

function useBom(): { rows: BomRow[]; mass: number; cost: number } {
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
          name: def.name,
          mpn: def.doc?.mpn,
          detail: detail ? `${detail.label}: ${detail.value}` : def.blurb,
          qty: 1,
          unitMass: built.mass,
          unitPrice: linePrice,
        })
      }
      mass += built.mass
      cost += linePrice
    }

    return { rows: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)), mass, cost }
  }, [instances, order])
}

/** Parts and wire together, which is what you actually have to buy. */
function useFullBom(): { rows: BomRow[]; mass: number; cost: number } {
  const parts = useBom()
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

/** One CSV cell, quoted only when it has to be. */
const cell = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function bomCsv(rows: BomRow[], mass: number, cost: number, name: string): string {
  const lines = [
    ['Part', 'Part number', 'Specification', 'Qty', 'Unit mass (g)', 'Unit price', 'Line price'].map(cell).join(','),
    ...rows.map((r) =>
      [
        r.name,
        r.mpn ?? '',
        r.detail,
        r.qty,
        (r.unitMass).toFixed(2),
        r.unitPrice > 0 ? r.unitPrice.toFixed(2) : '',
        r.unitPrice > 0 ? (r.unitPrice * r.qty).toFixed(2) : '',
      ].map(cell).join(','),
    ),
    ['Total', '', name, rows.reduce((s, r) => s + r.qty, 0), mass.toFixed(2), '', cost.toFixed(2)].map(cell).join(','),
  ]
  // CRLF: spreadsheets on Windows, which is where a BOM usually ends up,
  // treat a bare LF as one very long row.
  return lines.join('\r\n')
}

function Bom() {
  const { rows, mass, cost } = useFullBom()
  const name = useDoc((s) => s.doc.name)
  const [copied, setCopied] = useState(false)

  if (!rows.length) {
    return <div className="console-empty">Add parts and they will be totalled here.</div>
  }

  const csv = () => bomCsv(rows, mass, cost, name)

  const download = () => {
    const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (name.trim() || 'draftrig').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() + '-bom.csv'
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

  return (
    <div className="bom">
      <div className="bom-bar">
        <span>
          {rows.length} line{rows.length === 1 ? '' : 's'} · everything on the bench, wire included
        </span>
        <div className="grow" />
        <button className="btn ghost" onClick={copy}>{copied ? 'Copied' : 'Copy as CSV'}</button>
        <button className="btn" onClick={download}><IconDownload size={12} /> Download CSV</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: '26%' }}>Part</th>
            <th style={{ width: '16%' }}>Part number</th>
            <th>Specification</th>
            <th className="num" style={{ width: 54 }}>Qty</th>
            <th className="num" style={{ width: 84 }}>Mass</th>
            <th className="num" style={{ width: 90 }}>Est. cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.name}</td>
              <td className="mono" style={{ color: 'var(--tx-3)' }}>{r.mpn ?? '—'}</td>
              <td style={{ color: 'var(--tx-2)' }}>{r.detail}</td>
              <td className="num">{r.qty}</td>
              <td className="num">{formatMass(r.unitMass * r.qty)}</td>
              <td className="num">{r.unitPrice > 0 ? formatMoney(r.unitPrice * r.qty) : 'n/a'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td className="num">{rows.reduce((s, r) => s + r.qty, 0)}</td>
            <td className="num">{formatMass(mass)}</td>
            <td className="num">{formatMoney(cost)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="bom-note">
        Prices are typical single-unit trade prices, for working out whether a build is a ten
        dollar idea or a two hundred dollar one. They are not quotes.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Issues                                                              */
/* ------------------------------------------------------------------ */

function Issues() {
  const issues = useSim((s) => s.issues)
  const instances = useDoc((s) => s.doc.instances)
  const select = useDoc((s) => s.select)

  if (!issues.length) {
    return (
      <div className="console-empty">
        <span style={{ color: 'var(--ok)', fontSize: 18 }}>✓</span>
        <span>No problems found. Nothing here is going to let out the magic smoke.</span>
      </div>
    )
  }

  return (
    <div>
      {issues.map((issue, i) => (
        <div
          key={i}
          className={`issue ${issue.severity}`}
          onClick={() => issue.instanceId && select([issue.instanceId])}
          style={{ cursor: issue.instanceId ? 'pointer' : 'default' }}
        >
          <span className="dot" />
          <span>
            <span className="msg">{issue.message}</span>
            {issue.instanceId && instances[issue.instanceId] && (
              <span className="who">{instances[issue.instanceId].name}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Console                                                             */
/* ------------------------------------------------------------------ */

export function Console() {
  const tab = useConsole((s) => s.tab)
  const setTab = useConsole((s) => s.setTab)
  const issues = useSim((s) => s.issues)
  const probes = useSim((s) => s.probes)

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors

  /*
   * Starts closed, unless you have opened it before.
   *
   * It was taking a quarter of the window to say "No problems found", and the
   * 3D view got what was left. The tab strip still carries the badge, so a
   * real error is visible without the drawer being open at all. State lives in
   * the console store so the status bar totals can open it on the right tab.
   */
  const open = useConsole((s) => s.open)
  const setOpen = useConsole((s) => s.setOpen)
  const collapsed = !open


  // An error is worth interrupting for; a warning is not.
  const firstErrors = useRef(true)
  useEffect(() => {
    if (!errors) return
    if (!firstErrors.current) return
    firstErrors.current = false
    setOpen(true)
  }, [errors, setOpen])

  const tabs: { id: Tab; label: string; icon: typeof IconList; badge?: React.ReactNode }[] = [
    {
      id: 'issues',
      label: 'Checks',
      icon: IconWarning,
      badge: errors ? <span className="pill err">{errors}</span>
        : warnings ? <span className="pill warn">{warnings}</span>
        : <span className="pill ok">✓</span>,
    },
    { id: 'bom', label: 'Bill of materials', icon: IconList },
    { id: 'scope', label: 'Scope', icon: IconScope, badge: probes.length ? <span className="pill ok">{probes.length}</span> : undefined },
  ]

  return (
    <div className="console" data-tour="console" data-collapsed={collapsed}>
      <div className="console-tabs">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              className="console-tab"
              data-on={tab === t.id && !collapsed}
              onClick={() => {
                setTab(t.id)
                setOpen(true)
              }}
            >
              <Icon size={12} />
              {t.label}
              {t.badge}
            </button>
          )
        })}
        <div className="grow" />
        <button
          className="btn ghost icon"
          title={collapsed ? 'Show checks, bill of materials and scope' : 'Hide, and give the space to the view'}
          onClick={() => setOpen(collapsed)}
        >
          <IconChevron size={12} style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
        </button>
      </div>

      {!collapsed && (
        <div className="console-body scroll-y">
          {tab === 'issues' && <Issues />}
          {tab === 'bom' && <Bom />}
          {tab === 'scope' && <Scope />}
        </div>
      )}
    </div>
  )
}
