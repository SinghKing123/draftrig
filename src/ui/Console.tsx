import { useMemo, useState } from 'react'
import { IconChevron, IconList, IconScope, IconWarning } from './Icons'
import { Scope } from './Scope'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { getPart } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'
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
}

/** Parts that differ only in a value are different line items on a real order. */
function bomSignature(defId: string, params: Params): string {
  const keys = Object.keys(params).sort()
  return defId + '|' + keys.map((k) => `${k}=${String(params[k])}`).join(',')
}

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
      const perUnit = def.doc?.price ?? 0
      const unitPrice = def.category === 'structural' ? perUnit * lengthish : perUnit

      const existing = map.get(key)
      if (existing) existing.qty++
      else {
        const detail = def.readouts?.(inst.params)?.[0]
        map.set(key, {
          key,
          name: def.name,
          detail: detail ? `${detail.label}: ${detail.value}` : def.blurb,
          qty: 1,
          unitMass: built.mass,
          unitPrice,
        })
      }
      mass += built.mass
      cost += unitPrice
    }

    return { rows: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)), mass, cost }
  }, [instances, order])
}

function Bom() {
  const { rows, mass, cost } = useBom()
  if (!rows.length) {
    return <div className="console-empty">Add parts and they will be totalled here.</div>
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th style={{ width: '32%' }}>Part</th>
          <th>Specification</th>
          <th className="num" style={{ width: 60 }}>Qty</th>
          <th className="num" style={{ width: 90 }}>Mass</th>
          <th className="num" style={{ width: 90 }}>Est. cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td>{r.name}</td>
            <td style={{ color: 'var(--tx-2)' }}>{r.detail}</td>
            <td className="num">{r.qty}</td>
            <td className="num">{formatMass(r.unitMass * r.qty)}</td>
            <td className="num">{r.unitPrice > 0 ? formatMoney(r.unitPrice * r.qty) : '—'}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>Total</td>
          <td className="num">{rows.reduce((s, r) => s + r.qty, 0)}</td>
          <td className="num">{formatMass(mass)}</td>
          <td className="num">{formatMoney(cost)}</td>
        </tr>
      </tfoot>
    </table>
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
  const [tab, setTab] = useState<Tab>('issues')
  const [collapsed, setCollapsed] = useState(false)
  const issues = useSim((s) => s.issues)
  const probes = useSim((s) => s.probes)

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors

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
    <div className="console" data-collapsed={collapsed}>
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
                setCollapsed(false)
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
          title={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => setCollapsed((c) => !c)}
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
