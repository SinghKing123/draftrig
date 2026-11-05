import { useEffect, useMemo, useRef, useState } from 'react'
import { BRAND } from '@/brand'
import { PARTS, CREDITS } from './floor/parts.gen'
import type { FloorHandle, Selection, Totals } from './floor/scene'
import { ROOMS } from './floor/rooms'

/**
 * The editor, running on the front page.
 *
 * Everything else on this page is a drawing of the arithmetic. This is
 * the other half of the argument and the half a line drawing cannot
 * make: that the thing you are laying out is a real room full of real
 * objects, at real size, that you can turn around and click on. It is
 * the actual product — the same meshes out of `public/models`, the same
 * three.js the editor ships — with a mock of the editor's chrome round
 * it, lifted from the advert artifact.
 *
 * It starts itself. There was a poster and a button here, on the
 * argument that 26 MB of mesh is not something to fetch without being
 * asked — but the room is the first thing on the page and a picture of
 * it behind a button is a picture, which is the one thing this page is
 * not supposed to be. So it loads on arrival, and the shell and the
 * floor paint while the furniture is still coming: what a reader sees
 * in the first second is the editor building the room, not a still of
 * one it built earlier.
 *
 * The mesh is why `Landing` does not render this below 900px. The
 * answer to 26 MB on a phone is not a poster of the room, it is the
 * rest of the page, which is the editor in six real frames and a
 * catalogue of 266 parts. Nothing here is deferred or progressive:
 * above the width it loads, below it this component never mounts and
 * not one .glb is requested.
 *
 * The orbit rig never takes the wheel. Scroll belongs to the page.
 */

/* ------------------------------------------------------------------ */

const WATT = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${w} W`)
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB')

/** What each room's circuit is rated at, in amps. */
const RATING: Record<string, number> = { cinema: 16, studio: 16, server: 16, workshop: 32 }

const ICON: Record<string, string> = {
  screen: 'M2 3h12v8H2zM6 13.5h4',
  speaker: 'M4 1.5h8v13H4zM8 7.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4M8 3.7a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8',
  seat: 'M4 9V4.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V9M3 9h10v2.5H3zM4.5 11.5V14M11.5 11.5V14',
  box: 'M2 4.5h12v7H2zM2 8h12',
  panel: 'M3 3h10v10H3zM3 6.3h10M3 9.6h10',
  lamp: 'M5 2.5h6L12.5 7h-9zM8 7v7M5.5 14h5',
  plant: 'M8 14V7M8 9C5 9 3.5 7 3.5 4.5 6.5 4.5 8 6 8 9zM8 8c2.5 0 4.5-1.5 4.5-4.5C9.5 3.5 8 5 8 8zM5.5 14h5',
  desk: 'M1.5 6h13M3 6v7.5M13 6v7.5M3 9.5h4',
  keys: 'M1.5 4.5h13v7h-13zM4.5 4.5v4M7 4.5v4M9.5 4.5v4M12 4.5v4',
  disc: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2M8 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2',
  camera: 'M1.5 4.5h10v7.5h-10zM11.5 7l3-1.5v5L11.5 9',
  rack: 'M3.5 1.5h9v13h-9zM3.5 5h9M3.5 8.5h9M3.5 12h9',
  battery: 'M2 4.5h11v7H2zM13 7v2M5 8h4M7 6v4',
  wifi: 'M2 6.5a9 9 0 0 1 12 0M4 9a6 6 0 0 1 8 0M6 11.4a3 3 0 0 1 4 0M8 12.7v.6',
  fan: 'M8 6.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6M8 6.7C8 4 9 2.5 10.5 2.5S12 5 8 6.7zM9.3 8.4c2.4 1.3 3.2 3 2.4 4.2S9 12.4 9.3 8.4zM6.7 8.2C4.3 9.6 2.6 9.5 2.1 8.2S3.6 6.2 6.7 8.2z',
  dial: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2M8 8l2.5-2.5',
  tool: 'M10 2.5a3 3 0 0 0-3 3.9L2.5 11a1.4 1.4 0 0 0 2 2l4.6-4.5A3 3 0 0 0 13 5.5l-1.8 1.8-2-.5-.5-2z',
  arm: 'M3 14h6M5 14v-3l4-4 3 1.5M9 7l1-3.5',
  plug: 'M6 1.5v3M10 1.5v3M4.5 4.5h7V8a3.5 3.5 0 0 1-7 0zM8 11.5v3',
  fridge: 'M4 1.5h8v13H4zM4 6.5h8M6 3.5v1.5M6 8.5v2',
}

function Ico({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[k] ?? ICON.box} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */

const VIEWS = [
  ['top', 'Top'],
  ['front', 'Front'],
  ['side', 'Side'],
  ['iso', '3D'],
] as const

export function Floor() {
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tags = useRef<HTMLDivElement>(null)
  const tick = useRef<HTMLDivElement>(null)
  const floor = useRef<FloorHandle | null>(null)

  const [prog, setProg] = useState({ n: 0, bad: 0, of: PARTS.length })
  const [sel, setSel] = useState<Selection | null>(null)
  /* Seeded from the part list rather than left empty until the scene
     reports: the mass and the price are facts about the build, and a
     status bar reading "Est. cost £—" next to a poster is a status bar
     admitting it has not been given the numbers it already has. */
  const [totals, setTotals] = useState<Totals>(() => ({
    parts: PARTS.length,
    kg: PARTS.reduce((a, p) => a + (p.kg ?? 0), 0),
    usd: PARTS.reduce((a, p) => a + (p.usd ?? 0), 0),
  }))
  const [view, setView] = useState('iso')
  const [q, setQ] = useState('')

  /* The checks are read off the part list rather than written: every
     load in a room, against what that room's circuit is rated for. */
  const checks = useMemo(() => {
    const out = ROOMS.map((r) => {
      const w = PARTS.filter((p) => p.r === r.id).reduce((a, p) => a + (p.pw ?? 0), 0)
      const a = w / 230
      const worst = PARTS.filter((p) => p.r === r.id).sort((x, y) => (y.pw ?? 0) - (x.pw ?? 0))[0]
      return { room: r, amps: a, rated: RATING[r.id], worst }
    })
      .filter((c) => c.amps > c.rated * 0.9)
      .sort((x, y) => y.amps / y.rated - x.amps / x.rated)
    return out
  }, [])
  const top = checks[0]

  useEffect(() => {
    if (!canvas.current || !stage.current || !tags.current) return
    let handle: FloorHandle | null = null
    let dead = false
    void import('./floor/scene').then(({ createFloor }) => {
      if (dead || !canvas.current || !stage.current || !tags.current) return
      handle = createFloor({
        canvas: canvas.current,
        stage: stage.current,
        tags: tags.current,
        shadows: window.innerWidth >= 1100,
        onProgress: (n, bad, of) => setProg({ n, bad, of }),
        onSelect: setSel,
        onTotals: setTotals,
        onView: setView,
      })
      floor.current = handle
    })
    return () => {
      dead = true
      handle?.dispose()
      floor.current = null
    }
  }, [])

  /* The clock in the corner, written straight to the node. Ten renders
     a second of a tree this size to move one number is not a trade. */
  useEffect(() => {
    const t0 = performance.now()
    const id = setInterval(() => {
      if (tick.current) tick.current.textContent = `t = ${((performance.now() - t0) / 1000).toFixed(1)} s`
    }, 100)
    return () => clearInterval(id)
  }, [])

  const loading = prog.n + prog.bad < prog.of
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ROOMS.map((r) => ({
      room: r,
      items: PARTS.filter(
        (p) => p.r === r.id && (!needle || p.n.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)),
      ),
    })).filter((g) => g.items.length)
  }, [q])

  const credit = sel ? CREDITS[sel.file] : null

  return (
    <div className="fl">
      {/* ---- title bar ---- */}
      <div className="fl-top">
        <img className="fl-brand" src={BRAND.logo.lockupOnDark} alt={BRAND.name} width={473} height={96} />
        <span className="fl-sep" />
        <span className="fl-proj">Ground floor</span>
        <span className="fl-saved">
          <i />
          Saved
        </span>
        <div className="fl-tabs" aria-hidden="true">
          <span className="on">Build</span>
          <span>Wire</span>
          <span>Code</span>
          <span>Simulate</span>
        </div>
        <span className="fl-run">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="1.5" width="3" height="9" rx=".8" fill="currentColor" />
            <rect x="7" y="1.5" width="3" height="9" rx=".8" fill="currentColor" />
          </svg>
          Pause
        </span>
      </div>

      {/* ---- the build list ---- */}
      <aside className="fl-left">
        <div className="fl-ltabs">
          <span>Parts</span>
          <span className="on">
            Build <b>{totals.parts}</b>
          </span>
        </div>
        <label className="fl-find">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a part in this build"
            aria-label="Find a part in this build"
          />
        </label>
        <div className="fl-list">
          {shown.map(({ room, items }) => (
            <div key={room.id}>
              <button type="button" className="fl-room" onClick={() => floor.current?.focusRoom(room.id)}>
                <span>{room.name}</span>
                <b>{items.length}</b>
              </button>
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`fl-item${sel?.id === p.id ? ' on' : ''}`}
                  onClick={() => floor.current?.select(p.id)}
                >
                  <Ico k={p.ic} />
                  <span>{p.n}</span>
                  <em>{p.pw ? WATT(p.pw) : ''}</em>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* ---- the viewport ---- */}
      <div className="fl-vp" ref={stage}>
        <canvas ref={canvas} aria-label="The ground floor in 3D. Drag to orbit, click a part to select it." />
        <div className="fl-tags" ref={tags} />
        <div className="fl-tools">
          <div className="fl-group">
            {VIEWS.map(([v, label]) => (
              <button key={v} type="button" className={view === v ? 'on' : ''} onClick={() => floor.current?.view(v)}>
                {label}
              </button>
            ))}
          </div>
          <div className="fl-group fl-snap" aria-hidden="true">
            <span>10 mm</span>
          </div>
        </div>
        <div className="fl-tick" ref={tick}>
          t = 0.0 s
        </div>
        {loading && (
          <p className="fl-load">
            Placing parts · {prog.n} of {prog.of}
          </p>
        )}
        {!loading && prog.bad > 0 && (
          <p className="fl-load">
            {prog.bad} of {prog.of} parts did not load
          </p>
        )}
      </div>

      {/* ---- checks ---- */}
      <div className="fl-checks">
        <span className="fl-chk-tab">
          Checks <b>{checks.length}</b>
        </span>
        {top && (
          <button type="button" className="fl-chk" onClick={() => floor.current?.select(top.worst.id)}>
            <i />
            <span>
              {top.room.name} is drawing {top.amps.toFixed(1)} A through a {top.rated} A circuit.{' '}
              {top.worst.n} alone is {WATT(top.worst.pw ?? 0)} of it.
            </span>
          </button>
        )}
      </div>

      {/* ---- inspector ---- */}
      <aside className="fl-right" aria-live="polite">
        <div className="fl-in-head">Inspector</div>
        {sel ? (
          <>
            <p className="fl-in-name">{sel.name}</p>
            <div className="fl-chips">
              <span>{sel.room}</span>
              {sel.live && <span className="live">live</span>}
            </div>
            <div className="fl-in-sec fl-in-tr">
              <h4>Transform</h4>
              {(['X', 'Y', 'Z'] as const).map((ax, i) => (
                <div className="fl-in-row" key={ax}>
                  <label>Position {ax}</label>
                  <span className="fl-field">
                    {fmt(sel.pos[i])}
                    <small>mm</small>
                  </span>
                </div>
              ))}
              <div className="fl-in-row">
                <label>Rotate Y</label>
                <span className="fl-field">
                  {sel.yaw}
                  <small>°</small>
                </span>
              </div>
            </div>
            <div className="fl-in-sec">
              <h4>Specification</h4>
              {sel.spec.map((s) => (
                <div className="fl-spec" key={s.k}>
                  <span>{s.k}</span>
                  <b>{s.v}</b>
                </div>
              ))}
            </div>
            {credit && (
              <p className="fl-credit">
                Model:{' '}
                <a href={credit.u} target="_blank" rel="noreferrer">
                  {credit.t}
                </a>{' '}
                by {credit.a}, CC BY 4.0, reduced in size.
              </p>
            )}
          </>
        ) : (
          <p className="fl-credit">Click anything in the room.</p>
        )}
      </aside>

      {/* ---- status ---- */}
      <div className="fl-status">
        <span className="run">
          <i />
          Simulating
        </span>
        <span>
          Parts <b>{totals.parts}</b>
        </span>
        <span className="fl-hide-s">
          Rooms <b>{ROOMS.length}</b>
        </span>
        <span className="fl-hide-s">
          Mass <b>{fmt(totals.kg)} kg</b>
        </span>
        <span>
          Est. cost <b>£{fmt(totals.usd)}</b>
        </span>
        <span className="fl-push fl-hide-s">
          Mode <b>Build</b>
        </span>
        <span className="fl-hide-s">mm · Y-up</span>
      </div>
    </div>
  )
}
