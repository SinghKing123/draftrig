import { useMemo } from 'react'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { getPart, unitPrice } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'
import { formatMass, formatMoney } from '@/parts/kernel/units'

export function StatusBar() {
  const instances = useDoc((s) => s.doc.instances)
  const order = useDoc((s) => s.doc.order)
  const connections = useDoc((s) => s.doc.connectionOrder)
  const selection = useDoc((s) => s.selection)
  const snap = useDoc((s) => s.snap)
  const mode = useDoc((s) => s.mode)

  const running = useSim((s) => s.running)
  const converged = useSim((s) => s.converged)
  const issues = useSim((s) => s.issues)
  const realtime = useSim((s) => s.realtimeRatio)

  const { mass, cost } = useMemo(() => {
    let m = 0
    let c = 0
    for (const id of order) {
      const inst = instances[id]
      if (!inst) continue
      const def = getPart(inst.defId)
      if (!def) continue
      m += buildPart(def, inst.params).mass
      const per = unitPrice(def, inst.params)
      const len = typeof inst.params.length === 'number' ? (inst.params.length as number) : 1
      c += def.category === 'structural' ? per * len : per
    }
    return { mass: m, cost: c }
  }, [instances, order])

  const errors = issues.filter((i) => i.severity === 'error').length

  return (
    <footer className="statusbar">
      <span className="sb-item">
        <span className={`sb-dot ${running ? 'live' : errors ? 'err' : 'ok'}`} />
        {running ? (converged ? 'Simulating' : 'Not converging') : errors ? `${errors} issue${errors > 1 ? 's' : ''}` : 'Ready'}
      </span>

      {running && realtime < 0.9 && (
        <span className="sb-item" title="The circuit is too heavy to solve at this speed. Lower the speed, or simplify it.">
          <span className="sb-dot err" />
          Running at <b>{Math.round(realtime * 100)}%</b> of the selected speed
        </span>
      )}

      <span className="sb-item">Parts <b>{order.length}</b></span>
      <span className="sb-item">Connections <b>{connections.length}</b></span>
      {selection.length > 0 && <span className="sb-item">Selected <b>{selection.length}</b></span>}

      <span className="grow" />

      <span className="sb-item">Mass <b>{formatMass(mass)}</b></span>
      <span className="sb-item">Est. cost <b>{formatMoney(cost)}</b></span>
      <span className="sb-item">Snap <b>{snap.enabled ? `${snap.grid} mm` : 'off'}</b></span>
      <span className="sb-item">Mode <b style={{ textTransform: 'capitalize' }}>{mode}</b></span>
      <span className="sb-item">mm · Y-up</span>
    </footer>
  )
}
