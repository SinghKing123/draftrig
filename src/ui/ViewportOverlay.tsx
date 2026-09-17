import { IconEye, IconEyeOff, IconFrame, IconGrid, IconMagnet, IconMove, IconRotate, IconXray, IconZap } from './Icons'
import { useDoc, WIRE_COLORS } from '@/state/doc'
import { useSim } from '@/state/sim'
import { usePortHover } from '@/scene/portHover'
import { getPart } from '@/parts/kernel/registry'

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

/**
 * The name of the terminal under the pointer, pinned to it.
 *
 * Wiring without this was aiming at one grey dot among thirty. The label is
 * drawn as HTML over the canvas rather than in the scene, so it stays crisp
 * and level however the camera is turned.
 */
function PortTip() {
  const hover = usePortHover((s) => s.hover)
  if (!hover) return null
  return (
    <div className="port-tip" style={{ left: hover.x, top: hover.y }} data-role={hover.role ?? 'io'}>
      <b>{hover.label}</b>
      {hover.owner && <i>{hover.owner}</i>}
    </div>
  )
}

/** What a half-drawn wire is currently attached to. */
function PendingHint() {
  const pending = useDoc((s) => s.pendingWire)
  const instances = useDoc((s) => s.doc.instances)
  if (!pending) return null
  const inst = instances[pending.instanceId]
  const def = inst ? getPart(inst.defId) : undefined
  const port = def?.ports(inst.params).find((p) => p.id === pending.portId)
  return (
    <div className="vp-hint pending">
      Running a wire from <b>{inst?.name ?? 'a part'}</b>
      {port ? <> · <b>{port.label}</b></> : null}. Click the other end, or <kbd>Esc</kbd> to drop it.
    </div>
  )
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
  const pendingWire = useDoc((s) => s.pendingWire)

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
          /* Wide enough for "2.54 mm" plus the arrow. At 74px the longest
             option read "2.54 m", which is a different number. */
          style={{ width: 92, height: 'var(--ctl-h)' }}
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

      <PortTip />
      {pendingWire ? <PendingHint /> : hint ? <div className="vp-hint">{hint}</div> : null}

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
