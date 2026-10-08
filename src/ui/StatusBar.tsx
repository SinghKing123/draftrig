import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { formatMass, formatMoney } from '@/parts/kernel/units'
import { useBomPanel } from '@/state/bom'
import { useFullBom } from './Bom'

export function StatusBar() {
  const openBom = useBomPanel((s) => s.setOpen)
  const order = useDoc((s) => s.doc.order)
  const connections = useDoc((s) => s.doc.connectionOrder)
  const selection = useDoc((s) => s.selection)
  const snap = useDoc((s) => s.snap)
  const mode = useDoc((s) => s.mode)

  const running = useSim((s) => s.running)
  const converged = useSim((s) => s.converged)
  const issues = useSim((s) => s.issues)
  const realtime = useSim((s) => s.realtimeRatio)

  /*
   * The same totals the panel prints, wire included. They used to be totalled
   * separately here and came out lower, because this one counted parts and the
   * bill counted parts and the hook-up wire between them — two different
   * numbers for the same build, a centimetre apart on screen, one of them the
   * button that opens the other.
   */
  const { mass, cost } = useFullBom()

  const errors = issues.filter((i) => i.severity === 'error').length

  return (
    <footer className="statusbar">
      <span className="sb-item">
        <span className={`sb-dot ${running ? 'live' : errors ? 'err' : 'ok'}`} />
        {running ? (converged ? 'Simulating' : 'Not converging') : errors ? `${errors} issue${errors > 1 ? 's' : ''}` : 'Ready'}
      </span>

      {running && realtime < 0.9 && (
        <span className="sb-item" title="Solver cannot keep up at this speed. Lower the speed or reduce the node count.">
          <span className="sb-dot err" />
          Running at <b>{Math.round(realtime * 100)}%</b> of the selected speed
        </span>
      )}

      <span className="sb-item">Parts <b>{order.length}</b></span>
      <span className="sb-item">Connections <b>{connections.length}</b></span>
      {selection.length > 0 && <span className="sb-item">Selected <b>{selection.length}</b></span>}

      <span className="grow" />

      {/* These two are the totals the bill of materials explains, so they are
          a way into it — the tab on the right edge being the other. Until
          this they were a dead end: the breakdown sat on a tab in a drawer
          that starts closed. */}
      <button
        className="sb-item link"
        title="Show the bill of materials"
        onClick={() => openBom(true)}
      >
        Mass <b>{formatMass(mass)}</b>
      </button>
      <button
        className="sb-item link"
        title="Show the bill of materials"
        onClick={() => openBom(true)}
      >
        Est. cost <b>{formatMoney(cost)}</b>
      </button>
      <span className="sb-item">Snap <b>{snap.enabled ? `${snap.grid} mm` : 'off'}</b></span>
      <span className="sb-item">Mode <b style={{ textTransform: 'capitalize' }}>{mode}</b></span>
      <span className="sb-item">mm · Y-up</span>
    </footer>
  )
}
