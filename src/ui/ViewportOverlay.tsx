import { useEffect, useState } from 'react'
import {
  IconEye, IconEyeOff, IconFrame, IconGrid, IconHelp, IconMagnet, IconMove, IconRotate,
  IconX, IconXray, IconZap,
} from './Icons'
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


/**
 * How to move the camera.
 *
 * A 3D viewport is the one part of an interface that cannot be worked out by
 * looking at it: nothing on screen says that dragging orbits, that the right
 * button pans, or that the coloured markers in the corner are buttons. Every
 * 3D tool answers this somewhere, and the ones that answer it in the viewport
 * rather than in a manual are the ones people get started in.
 *
 * Shows itself once, unprompted, on a first visit; after that it lives behind
 * the question mark and stays out of the way.
 */

const NAV_SEEN = 'draftrig.nav.seen.v1'

const NAV_ROWS: { how: React.ReactNode; what: string }[] = [
  { how: <><b>Drag</b></>, what: 'Turn the view around the build' },
  { how: <><b>Right-drag</b></>, what: 'Slide the view sideways' },
  { how: <><b>Scroll</b></>, what: 'Zoom towards the pointer' },
  { how: <kbd>F</kbd>, what: 'Fill the view with what is selected' },
  { how: <span className="nav-axes"><i style={{ background: '#FF6B6B' }} /><i style={{ background: '#3DD68C' }} /><i style={{ background: '#4C8DFF' }} /></span>, what: 'Click a marker, bottom right, for a straight-on view' },
]

function NavHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="nav-help" role="dialog" aria-label="Moving around the view">
      <div className="nav-head">
        Moving around
        <button className="btn ghost icon sm" onClick={onClose} aria-label="Close">
          <IconX size={12} />
        </button>
      </div>
      <dl>
        {NAV_ROWS.map((r, i) => (
          <div key={i}>
            <dt>{r.how}</dt>
            <dd>{r.what}</dd>
          </div>
        ))}
      </dl>
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
  const setStandardView = useDoc((s) => s.setStandardView)
  const pinQuality = useDoc((s) => s.pinQuality)

  const running = useSim((s) => s.running)
  const time = useSim((s) => s.time)

  // Opens itself once, on a first visit, then only when asked for.
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(NAV_SEEN)) return
      localStorage.setItem(NAV_SEEN, '1')
    } catch {
      // Private window: show it, and show it again next time. Harmless.
    }
    setNavOpen(true)
  }, [])

  const hint = MODE_HINT[mode]

  return (
    <>
      {mode === 'wire' && <WirePalette />}
      <div className="vp-toolbar">
        <button
          className="btn ghost icon"
          data-on={transformMode === 'move'}
          title="Drag parts to move them (G)"
          onClick={() => setTransformMode('move')}
        >
          <IconMove />
        </button>
        <button
          className="btn ghost icon"
          data-on={transformMode === 'rotate'}
          title="Drag parts to turn them (R)"
          onClick={() => setTransformMode('rotate')}
        >
          <IconRotate />
        </button>

        <div className="sep" />

        <button
          className="btn ghost icon"
          data-on={snap.enabled}
          title={`Snapping is ${snap.enabled ? 'on' : 'off'}: parts land on a ${snap.grid} mm grid and jump to nearby terminals`}
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

        {/*
          * Standard views.
          *
          * The one thing the viewport had no answer for: once you had orbited
          * somewhere strange there was no way back to a known angle short of
          * reloading the page. Each of these also fits the build, because a
          * top view of something off the edge of the screen is not a view of
          * anything, and having to press Fit afterwards every time defeats the
          * point of a preset.
          */}
        <span className="vp-views" role="group" aria-label="Standard views">
          <button className="vp-view" title="Look straight down" onClick={() => setStandardView('top')}>Top</button>
          <button className="vp-view" title="Look at the front" onClick={() => setStandardView('front')}>Front</button>
          <button className="vp-view" title="Look from the right" onClick={() => setStandardView('right')}>Side</button>
          <button className="vp-view" title="Back to the three-quarter view" onClick={() => setStandardView('iso')}>3D</button>
        </span>

        {/* Named rather than drawn. "Fit" is the control people look for by
            name when they have lost the build off the edge of the screen, and
            a glyph of a frame is not something anyone searches for. */}
        <button className="btn ghost vp-text" title="Fit the whole build on screen (F)" onClick={() => requestFrame('all')}>
          <IconFrame />
          Fit
        </button>

        <div className="sep" />

        <button className="btn ghost icon" data-on={view.grid} title="Ground grid (H)" onClick={() => setView({ grid: !view.grid })}>
          <IconGrid />
        </button>
        <button className="btn ghost icon" data-on={view.ports} title="Show terminals (P)" onClick={() => setView({ ports: !view.ports })}>
          {view.ports ? <IconEye /> : <IconEyeOff />}
        </button>
        <button className="btn ghost icon" data-on={view.xray} title="See through solid parts (X)" onClick={() => setView({ xray: !view.xray })}>
          <IconXray />
        </button>
        {/*
          * Render quality, which has lived in the store since the beginning and
          * has never once been shown. It is the setting that decides whether
          * this runs at sixty frames a second or twenty-nine, so it belongs
          * somewhere a person can reach it rather than in a source file.
          */}
        <select
          className="input"
          style={{ width: 106, height: 'var(--ctl-h)' }}
          value={view.quality}
          onChange={(e) => pinQuality(e.target.value as 'off' | 'balanced' | 'high')}
          title="Render quality. Drop this if the view feels slow."
        >
          <option value="high">Best look</option>
          <option value="balanced">Balanced</option>
          <option value="off">Fastest</option>
        </select>

        <div className="sep" />

        <button
          className="btn ghost icon"
          data-on={navOpen}
          title="How to move around the view"
          aria-label="How to move around the view"
          onClick={() => setNavOpen((v) => !v)}
        >
          <IconHelp />
        </button>
      </div>

      <NavHelp open={navOpen} onClose={() => setNavOpen(false)} />

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
