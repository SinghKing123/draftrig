import { IconEye, IconEyeOff, IconFrame, IconGrid, IconMagnet, IconMove, IconPlus, IconRotate, IconXray, IconZap } from './Icons'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { STARTERS } from '@/io/starters'
import { engine } from '@/sim/engine'

const MODE_HINT: Record<string, React.ReactNode> = {
  wire: (
    <>
      <b>Wire mode</b> — click a terminal, then click another to join them. <kbd>Esc</kbd> cancels.
    </>
  ),
  sim: (
    <>
      <b>Simulate</b> — <kbd>Space</kbd> runs it. Click any terminal to put it on the scope.
    </>
  ),
}

export function ViewportOverlay() {
  const mode = useDoc((s) => s.mode)
  const view = useDoc((s) => s.view)
  const setView = useDoc((s) => s.setView)
  const snap = useDoc((s) => s.snap)
  const setSnap = useDoc((s) => s.setSnap)
  const transformMode = useDoc((s) => s.transformMode)
  const setTransformMode = useDoc((s) => s.setTransformMode)
  const empty = useDoc((s) => s.doc.order.length === 0)
  const loadDoc = useDoc((s) => s.loadDoc)
  const requestFrame = useDoc((s) => s.requestFrame)
  const setMode = useDoc((s) => s.setMode)

  const running = useSim((s) => s.running)
  const time = useSim((s) => s.time)

  const hint = MODE_HINT[mode]

  return (
    <>
      <div className="vp-toolbar">
        <button
          className="btn ghost icon"
          data-on={transformMode === 'move'}
          title="Move (G)"
          onClick={() => setTransformMode('move')}
        >
          <IconMove />
        </button>
        <button
          className="btn ghost icon"
          data-on={transformMode === 'rotate'}
          title="Rotate (R)"
          onClick={() => setTransformMode('rotate')}
        >
          <IconRotate />
        </button>

        <div className="sep" />

        <button
          className="btn ghost icon"
          data-on={snap.enabled}
          title={`Snap to a ${snap.grid} mm grid and to nearby terminals`}
          onClick={() => setSnap({ enabled: !snap.enabled })}
        >
          <IconMagnet />
        </button>
        <select
          className="input"
          style={{ width: 74, height: 28 }}
          value={snap.grid}
          onChange={(e) => setSnap({ grid: Number(e.target.value) })}
          title="Grid step"
        >
          <option value={0.5}>0.5 mm</option>
          <option value={1}>1 mm</option>
          <option value={2.54}>2.54 mm</option>
          <option value={5}>5 mm</option>
          <option value={10}>10 mm</option>
          <option value={20}>20 mm</option>
        </select>

        <div className="sep" />

        <button className="btn ghost icon" title="Frame the build (F)" onClick={() => requestFrame('all')}>
          <IconFrame />
        </button>
        <button className="btn ghost icon" data-on={view.grid} title="Ground grid (H)" onClick={() => setView({ grid: !view.grid })}>
          <IconGrid />
        </button>
        <button className="btn ghost icon" data-on={view.ports} title="Show terminals (P)" onClick={() => setView({ ports: !view.ports })}>
          {view.ports ? <IconEye /> : <IconEyeOff />}
        </button>
        <button className="btn ghost icon" data-on={view.xray} title="X-ray (X)" onClick={() => setView({ xray: !view.xray })}>
          <IconXray />
        </button>
      </div>

      {hint && <div className="vp-hint">{hint}</div>}

      <div className="vp-stats">
        {running && (
          <span style={{ color: 'var(--volt)' }}>
            <IconZap size={9} /> t = {time < 1 ? `${(time * 1000).toFixed(1)} ms` : `${time.toFixed(3)} s`}
          </span>
        )}
      </div>

      {empty && (
        <div className="empty-state">
          <div className="empty-card">
            <h2>Start building</h2>
            <p>
              Pick a part from the library on the left, or open one of these to see how a finished
              build is put together.
            </p>
            <div className="starters">
              {STARTERS.map((s) => (
                <button
                  key={s.id}
                  className="btn"
                  style={{ height: 'auto', padding: '8px 12px', justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => {
                    loadDoc(s.build())
                    setMode('build')
                    engine.reset()
                  }}
                >
                  <IconPlus />
                  <span>
                    <span style={{ display: 'block', color: 'var(--tx-0)', fontWeight: 550 }}>{s.title}</span>
                    <span style={{ display: 'block', color: 'var(--tx-3)', fontSize: 'var(--fs-xs)' }}>{s.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
