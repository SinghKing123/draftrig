import { useEffect, useState } from 'react'
import {
  IconEye, IconEyeOff, IconFrame, IconGrid, IconHelp, IconMagnet, IconMove, IconRotate,
  IconX, IconXray, IconZap,
} from './Icons'
import { hasSeenTour } from './Tour'
import { useDoc, WIRE_COLORS } from '@/state/doc'
import { useSim } from '@/state/sim'
import { usePortHover } from '@/scene/portHover'
import { useModalHud } from '@/scene/ModalTransform'
import { useDiagnostics } from '@/scene/diagnostics'
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
  { how: <><b>Drag</b></>, what: 'Orbit' },
  { how: <><b>Right-drag</b></>, what: 'Pan' },
  { how: <><b>Scroll</b></>, what: 'Zoom to pointer' },
  { how: <kbd>F</kbd>, what: 'Frame selection' },
  { how: <span className="nav-axes"><i style={{ background: '#FF6B6B' }} /><i style={{ background: '#3DD68C' }} /><i style={{ background: '#4C8DFF' }} /></span>, what: 'Axis marker for an orthographic view' },
]

function NavHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="nav-help" role="dialog" aria-label="Moving around the view">
      <div className="nav-head">
        Navigation
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


/**
 * The diagnostics readout, on Ctrl+Shift+D.
 *
 * Deliberately plain text in a fixed-width block: the point is that it can be
 * photographed or copied and pasted into a bug report, and read without any
 * context by somebody who was not there.
 *
 * The row that matters is usually obvious — geometries or objects climbing
 * means something is being created and never released; a worst frame in the
 * hundreds of milliseconds is the freeze itself; GL errors climbing means a
 * call is failing every frame; more than one gizmo means duplication.
 */
function DiagnosticsPanel() {
  const open = useDiagnostics((s) => s.open)
  const toggle = useDiagnostics((s) => s.toggle)
  const d = useDiagnostics((s) => s.data)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        useDiagnostics.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  const rows: [string, string, boolean][] = [
    ['fps', String(d.fps), d.fps > 0 && d.fps < 30],
    ['worst frame', `${d.worstFrame} ms`, d.worstFrame > 120],
    ['geometries', String(d.geometries), false],
    ['textures', String(d.textures), false],
    ['programs', String(d.programs), false],
    ['scene objects', String(d.objects), false],
    ['move gizmos', String(d.gizmos), d.gizmos > 1],
    ['draw calls', String(d.calls), false],
    ['triangles', d.triangles.toLocaleString(), false],
    ['failing GL calls', String(d.glErrors), d.glErrors > 0],
    ['context lost', d.contextLost ? 'YES' : 'no', d.contextLost],
    ['quality', d.quality, false],
    ['JS heap', d.heapMb ? `${d.heapMb} MB` : 'n/a', false],
  ]

  const text = rows.map(([k, v]) => `${k.padEnd(18)}${v}`).join('\n')

  return (
    <div className="diag" role="dialog" aria-label="Viewport diagnostics">
      <div className="diag-head">
        Diagnostics
        <div className="grow" />
        <button className="link-btn" onClick={() => void navigator.clipboard.writeText(text).catch(() => {})}>
          Copy
        </button>
        <button className="btn ghost icon sm" onClick={toggle} aria-label="Close"><IconX size={12} /></button>
      </div>
      <dl>
        {rows.map(([k, v, bad]) => (
          <div key={k} data-bad={bad}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="diag-note">
        Watch for a number that keeps climbing while you work, or a worst frame in
        the hundreds. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> closes this.
      </p>
    </div>
  )
}

/**
 * What the modal transform is doing, while it does it.
 *
 * Without this the operator is invisible: the part moves and nothing says
 * which axis it is locked to or what was typed. It also carries the keys,
 * because an operator nobody can see is an operator nobody finds.
 */
function ModalReadout() {
  const hud = useModalHud((h) => h.hud)
  if (!hud) return null
  const unit = hud.kind === 'move' ? 'mm' : '°'
  const shown = hud.typed !== '' ? hud.typed : hud.value.toFixed(hud.kind === 'move' ? 2 : 1)
  return (
    <div className="modal-readout" role="status">
      <b>{hud.kind === 'move' ? 'Move' : 'Rotate'}</b>
      {hud.axis && <span className="mr-axis" data-axis={hud.axis}>{hud.axis.toUpperCase()}</span>}
      <span className="mr-val">{shown} {unit}</span>
      <span className="mr-keys">X Y Z axis · type a number · Enter confirm · Esc cancel</span>
    </div>
  )
}

export function ViewportOverlay({
  onReplayTour,
  onExamples,
}: {
  onReplayTour: () => void
  onExamples: () => void
}) {
  const mode = useDoc((s) => s.mode)
  const view = useDoc((s) => s.view)
  const setView = useDoc((s) => s.setView)
  const snap = useDoc((s) => s.snap)
  const setSnap = useDoc((s) => s.setSnap)
  const transformMode = useDoc((s) => s.transformMode)
  const setTransformMode = useDoc((s) => s.setTransformMode)
  const empty = useDoc((s) => s.doc.order.length === 0)
  /*
   * The empty bench used to carry a card offering a tour. Every time.
   *
   * An empty bench is not an unusual state: it is where every build starts and
   * where you land every time you press New. So what reads as a helpful
   * first-run prompt was in practice a dialog sitting on top of the thing you
   * had just asked for, several times an hour, saying the same two sentences.
   * It is for somebody who has never been here before. Everyone else gets an
   * empty bench, which is what they asked for and what they can see.
   *
   * Read once rather than watched: the flag is set by finishing or dismissing
   * the tour, and a card vanishing out from under the button you are reaching
   * for is its own small annoyance.
   */
  const [firstVisit] = useState(() => !hasSeenTour())
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
      <ModalReadout />
      <div className="vp-toolbar">
        <button
          className="btn ghost icon"
          data-on={transformMode === 'move'}
          title="Translate (G)"
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
          <button className="vp-view" title="Right view" onClick={() => setStandardView('right')}>Side</button>
          <button className="vp-view" title="Isometric view" onClick={() => setStandardView('iso')}>3D</button>
        </span>

        {/* Named rather than drawn. "Fit" is the control people look for by
            name when they have lost the build off the edge of the screen, and
            a glyph of a frame is not something anyone searches for. */}
        <button className="btn ghost vp-text" title="Frame all (F)" onClick={() => requestFrame('all')}>
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
        <button className="btn ghost icon" data-on={view.xray} title="X-ray (X)" onClick={() => setView({ xray: !view.xray })}>
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

      <DiagnosticsPanel />
      <PortTip />
      {pendingWire ? <PendingHint /> : hint ? <div className="vp-hint">{hint}</div> : null}

      <div className="vp-stats">
        {running && (
          <span style={{ color: 'var(--volt)' }}>
            <IconZap size={9} /> t = {time < 1 ? `${(time * 1000).toFixed(1)} ms` : `${time.toFixed(3)} s`}
          </span>
        )}
      </div>

      {empty && firstVisit && (
        <div className="empty-state">
          <div className="empty-hint">
            <p>Empty bench.</p>
            <p className="sub">Place a part from the library.</p>
            <div className="empty-actions">
              <button className="btn primary" onClick={onExamples}>Open an example</button>
              <button className="btn" onClick={onReplayTour}>Show me around</button>
            </div>
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
