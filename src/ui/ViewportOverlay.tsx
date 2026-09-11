import { IconEye, IconEyeOff, IconFrame, IconGrid, IconMagnet, IconMove, IconRotate, IconXray, IconZap } from './Icons'
import { useDoc, WIRE_COLORS } from '@/state/doc'
import { useSim } from '@/state/sim'

const MODE_HINT: Record<string, React.ReactNode> = {
  wire: (
    <>
      <b>Wire mode</b>, click a terminal, then click another to join them. <kbd>Esc</kbd> cancels.
    </>
  ),
  sim: (
    <>
      <b>Simulate</b>, <kbd>Space</kbd> runs it. Click any terminal to put it on the scope.
    </>
  ),
}

export function ViewportOverlay({ onReplayTour }: { onReplayTour: () => void }) {
  const mode = useDoc((s) => s.mode)
  const view = useDoc((s) => s.view)
  const setView = useDoc((s) => s.setView)
  const snap = useDoc((s) => s.snap)
  const setSnap = useDoc((s) => s.setSnap)
  const transformMode = useDoc((s) => s.transformMode)
  const setTransformMode = useDoc((s) => s.setTransformMode)
  const empty = useDoc((s) => s.doc.order.length === 0)
  const requestFrame = useDoc((s) => s.requestFrame)

  const running = useSim((s) => s.running)
  const time = useSim((s) => s.time)

  const hint = MODE_HINT[mode]

  return (
    <>
      {mode === 'wire' && <WirePalette />}
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
          <div className="empty-hint">
            <p>Nothing on the bench yet.</p>
            <p className="sub">Pick a part from the library on the left to get started.</p>
            <button className="btn" onClick={onReplayTour}>Show me around again</button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Colour for the next wire.
 *
 * Sits in the viewport rather than the inspector because it is a choice you
 * make while wiring, not one you come back and fix afterwards. Picking the
 * colour first is how anyone wires a harness: red for the rail, black for the
 * return, and then whatever you decided the rest mean.
 */
function WirePalette() {
  const wireColor = useDoc((s) => s.wireColor)
  const setWireColor = useDoc((s) => s.setWireColor)
  return (
    <div className="wire-palette" role="radiogroup" aria-label="Wire colour">
      <span className="wp-label">Wire</span>
      {WIRE_COLORS.map((c) => (
        <button
          key={c.value}
          className="wp-dot"
          role="radio"
          aria-checked={c.value === wireColor}
          data-on={c.value === wireColor}
          title={c.label}
          style={{ background: c.value }}
          onClick={() => setWireColor(c.value)}
        />
      ))}
    </div>
  )
}
