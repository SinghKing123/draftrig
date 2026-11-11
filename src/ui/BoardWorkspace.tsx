import { useEffect, useMemo, useState } from 'react'
import { useDoc } from '@/state/doc'
import { GRIDS, useBoard } from '@/state/board'
import { buildNets } from '@/pcb/nets'
import { Connectivity, type Flat } from '@/pcb/copper'
import { errorsIn, warningsIn, type Violation } from '@/pcb/drc'
import { arrange, boardParts } from '@/pcb/arrange'
import { gerberZip } from '@/pcb/gerber'
import { padKey, type Side } from '@/pcb/types'
import { BoardCanvas, useFlat } from './BoardCanvas'
import { IconChip, IconDownload, IconGrid, IconWarning, IconX, IconZap } from './Icons'

/**
 * The Board workspace: the circuit on the bench, as copper.
 *
 * Three columns, the same shape as the rest of the editor. The nets are
 * on the left because a net is the unit of work here — a board is
 * finished when the list has no unrouted lines left in it — the board is
 * in the middle, and what can be checked and exported is on the right.
 */

export function BoardWorkspace() {
  const { flat, violations } = useFlat()
  const ensurePcb = useDoc((s) => s.ensurePcb)
  const rules = useDoc((s) => s.doc.pcb?.rules)
  const setWidth = useBoard((s) => s.setWidth)

  /*
   * A board exists from the moment this workspace is looked at.
   *
   * Opening onto an empty rectangle with an Arrange button would be a
   * workspace that has to be operated before it says anything, and the
   * first arrangement is never the one anybody keeps anyway. So the
   * circuit is already on it, and the first thing to do is move things
   * around, which is the actual job.
   */
  useEffect(() => {
    ensurePcb()
  }, [ensurePcb])

  /* Start drawing at the board's own minimum rather than a constant. */
  const track = rules?.track
  useEffect(() => {
    if (track) setWidth(track)
  }, [track, setWidth])

  return (
    <>
      <BoardNets flat={flat} />
      <div className="pcb-centre">
        <BoardTools violations={violations} />
        <BoardCanvas flat={flat} violations={violations} />
      </div>
      <BoardPanel flat={flat} violations={violations} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Left: the nets                                                      */
/* ------------------------------------------------------------------ */

function BoardNets({ flat }: { flat: Flat }) {
  const doc = useDoc((s) => s.doc)
  const nets = useMemo(() => buildNets(doc), [doc])
  const conn = useMemo(() => Connectivity.of(flat), [flat])
  const focusNet = useBoard((s) => s.focusNet)
  const setFocusNet = useBoard((s) => s.setFocusNet)

  const rows = useMemo(
    () =>
      nets.list.map((n) => {
        const pads = n.pads
          .map((p) => flat.padByKey.get(padKey(p.instanceId, p.portId)))
          .filter((p): p is NonNullable<typeof p> => !!p)
        const placed = pads.length
        let joined = 0
        for (let i = 1; i < pads.length; i++) if (conn.joined(pads[0].key, pads[i].key)) joined++
        return { net: n, placed, routed: placed >= 2 && joined === placed - 1, total: n.pads.length }
      }),
    [nets, flat, conn],
  )

  const done = rows.filter((r) => r.routed).length
  const routable = rows.filter((r) => r.placed >= 2).length

  return (
    <aside className="panel pcb-nets">
      <div className="panel-head">
        Nets
        {routable > 0 && (
          <span className="pcb-progress" title={`${done} of ${routable} nets routed`}>
            {done}/{routable}
          </span>
        )}
      </div>
      <div className="panel-body scroll-y">
        {!rows.length ? (
          <div className="code-none">
            <IconWarning size={15} />
            <p>Nothing is wired yet.</p>
            <p className="sub">
              A board is the wiring made out of copper, so there has to be some wiring. Join a few
              terminals in Wire and come back.
            </p>
          </div>
        ) : (
          rows.map(({ net, placed, routed, total }) => (
            <button
              key={net.id}
              className="pcb-net"
              data-on={focusNet === net.id || undefined}
              data-routed={routed || undefined}
              onClick={() => setFocusNet(focusNet === net.id ? null : net.id)}
              title={routed ? 'Routed' : 'Still to route'}
            >
              <span className="pcb-net-dot" />
              <span className="pcb-net-name">{net.name}</span>
              <span className="pcb-net-n">
                {placed}
                {placed !== total && <em> of {total}</em>}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Centre: the toolbar over the canvas                                 */
/* ------------------------------------------------------------------ */

function BoardTools({ violations }: { violations: Violation[] }) {
  const tool = useBoard((s) => s.tool)
  const setTool = useBoard((s) => s.setTool)
  const layer = useBoard((s) => s.layer)
  const setLayer = useBoard((s) => s.setLayer)
  const grid = useBoard((s) => s.grid)
  const setGrid = useBoard((s) => s.setGrid)
  const width = useBoard((s) => s.width)
  const setWidth = useBoard((s) => s.setWidth)
  const focusNet = useBoard((s) => s.focusNet)
  const setFocusNet = useBoard((s) => s.setFocusNet)

  const errors = errorsIn(violations)

  return (
    <div className="pcb-tools">
      <div className="pcb-group" role="radiogroup" aria-label="Tool">
        {([
          ['select', 'Move', 'Drag parts, pick copper'],
          ['route', 'Route', 'Click a pad, then click to lay track'],
          ['via', 'Via', 'Drop a via to change layer'],
        ] as const).map(([id, label, hint]) => (
          <button key={id} role="radio" aria-checked={tool === id} data-on={tool === id || undefined} title={hint} onClick={() => setTool(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="pcb-group" role="radiogroup" aria-label="Layer">
        {(['top', 'bottom'] as Side[]).map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={layer === s}
            data-on={layer === s || undefined}
            data-layer={s}
            title={`Work on the ${s} copper  (B)`}
            onClick={() => setLayer(s)}
          >
            <span className="pcb-swatch" data-layer={s} />
            {s === 'top' ? 'Top' : 'Bottom'}
          </button>
        ))}
      </div>

      <label className="pcb-field" title="Width of the next track">
        <span>Track</span>
        <input
          type="number"
          min={0.1}
          max={5}
          step={0.05}
          value={width}
          onChange={(e) => setWidth(Math.max(0.1, Number(e.target.value) || 0.1))}
        />
        <span className="unit">mm</span>
      </label>

      <label className="pcb-field" title="Snap grid">
        <IconGrid size={13} />
        <select value={grid} onChange={(e) => setGrid(Number(e.target.value))}>
          {GRIDS.map((g) => (
            <option key={g} value={g}>
              {g === 0 ? 'Off' : g === 2.54 ? '2.54 (0.1 in)' : g === 1.27 ? '1.27 (0.05 in)' : g === 0.635 ? '0.635' : `${g}`}
            </option>
          ))}
        </select>
      </label>

      <span className="sp" />

      {focusNet && (
        <button className="pcb-chip" onClick={() => setFocusNet(null)} title="Show every net again">
          {focusNet}
          <IconX size={11} />
        </button>
      )}
      <span className="pcb-count" data-bad={errors > 0 || undefined}>
        {errors > 0 ? `${errors} to fix` : 'No errors'}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Right: the board, the rules, the check and the way out              */
/* ------------------------------------------------------------------ */

function BoardPanel({ flat, violations }: { flat: Flat; violations: Violation[] }) {
  const doc = useDoc((s) => s.doc)
  const pcb = doc.pcb
  const editPcb = useDoc((s) => s.editPcb)
  const setShowViolation = useBoard((s) => s.setShowViolation)
  const showViolation = useBoard((s) => s.showViolation)
  const setFocusNet = useBoard((s) => s.setFocusNet)
  const [note, setNote] = useState<string | null>(null)

  const unplaced = useMemo(
    () => (pcb ? boardParts(doc).filter((id) => !pcb.placements[id]) : []),
    [doc, pcb],
  )

  useEffect(() => {
    if (!note) return
    const t = window.setTimeout(() => setNote(null), 6000)
    return () => window.clearTimeout(t)
  }, [note])

  if (!pcb) return <aside className="panel pcb-panel" />

  const errors = errorsIn(violations)
  const warnings = warningsIn(violations)

  const download = () => {
    const blob = gerberZip(pcb, flat, doc.name)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(doc.name.trim() || 'board').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').toLowerCase()}-gerber.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <aside className="panel pcb-panel scroll-y">
      <div className="panel-head">Board</div>

      <section className="pcb-sec">
        <h4>Outline</h4>
        <div className="pcb-row">
          <label className="pcb-field">
            <span>Width</span>
            <input
              type="number"
              min={10}
              max={400}
              step={1}
              value={pcb.w}
              onChange={(e) => editPcb((b) => { b.w = clamp(Number(e.target.value), 10, 400) })}
            />
            <span className="unit">mm</span>
          </label>
          <label className="pcb-field">
            <span>Height</span>
            <input
              type="number"
              min={10}
              max={400}
              step={1}
              value={pcb.h}
              onChange={(e) => editPcb((b) => { b.h = clamp(Number(e.target.value), 10, 400) })}
            />
            <span className="unit">mm</span>
          </label>
        </div>
        <p className="pcb-note">
          {pcb.w} × {pcb.h} mm, two layers. {flat.pads.length} pads, {flat.vias.length} vias.
        </p>
      </section>

      <section className="pcb-sec">
        <h4>Placement</h4>
        <button
          className="btn"
          onClick={() => {
            const a = arrange(doc, pcb)
            editPcb((b) => {
              b.placements = a.placements
              b.w = a.w
              b.h = a.h
            })
            setNote(
              a.dropped.length
                ? `Arranged. ${a.dropped.length} part${a.dropped.length === 1 ? '' : 's'} would not fit.`
                : 'Arranged, and the board resized to fit.',
            )
          }}
        >
          <IconChip size={13} />
          Arrange the circuit
        </button>
        <p className="pcb-note">
          Packs every part onto the board and sizes it to fit. It throws away the layout you have,
          so it is for starting, not for tidying.
        </p>
        {unplaced.length > 0 && (
          <p className="pcb-note warn">
            {unplaced.length} part{unplaced.length === 1 ? ' is' : 's are'} in the build but not on the
            board. Arrange to bring {unplaced.length === 1 ? 'it' : 'them'} on.
          </p>
        )}
      </section>

      <section className="pcb-sec">
        <h4>Rules</h4>
        <div className="pcb-row">
          <label className="pcb-field">
            <span>Min track</span>
            <input type="number" min={0.1} max={3} step={0.05} value={pcb.rules.track}
              onChange={(e) => editPcb((b) => { b.rules.track = clamp(Number(e.target.value), 0.05, 5) })} />
            <span className="unit">mm</span>
          </label>
          <label className="pcb-field">
            <span>Clearance</span>
            <input type="number" min={0.1} max={3} step={0.05} value={pcb.rules.clearance}
              onChange={(e) => editPcb((b) => { b.rules.clearance = clamp(Number(e.target.value), 0.05, 5) })} />
            <span className="unit">mm</span>
          </label>
          <label className="pcb-field">
            <span>Via pad</span>
            <input type="number" min={0.4} max={3} step={0.05} value={pcb.rules.via}
              onChange={(e) => editPcb((b) => { b.rules.via = clamp(Number(e.target.value), 0.3, 5) })} />
            <span className="unit">mm</span>
          </label>
          <label className="pcb-field">
            <span>Via drill</span>
            <input type="number" min={0.2} max={2} step={0.05} value={pcb.rules.drill}
              onChange={(e) => editPcb((b) => { b.rules.drill = clamp(Number(e.target.value), 0.15, 3) })} />
            <span className="unit">mm</span>
          </label>
        </div>
        <p className="pcb-note">
          The defaults are a cheap two-layer prototype run, which is the class every hobby fab
          quotes at its lowest price.
        </p>
      </section>

      <section className="pcb-sec">
        <h4>
          Check
          <span className="pcb-tally">
            {errors > 0 && <b data-bad>{errors}</b>}
            {warnings > 0 && <b>{warnings}</b>}
            {errors + warnings === 0 && <em>clear</em>}
          </span>
        </h4>
        {violations.length === 0 ? (
          <p className="pcb-note ok">
            <IconZap size={13} /> Every net is routed and nothing breaks a rule.
          </p>
        ) : (
          <ul className="pcb-drc">
            {violations.slice(0, 60).map((v) => (
              <li key={v.id}>
                <button
                  data-sev={v.severity}
                  data-on={showViolation === v.id || undefined}
                  onClick={() => {
                    setShowViolation(showViolation === v.id ? null : v.id)
                    if (v.net) setFocusNet(v.net)
                  }}
                >
                  <span className="pcb-drc-title">{v.title}</span>
                  <span className="pcb-drc-detail">{v.detail}</span>
                </button>
              </li>
            ))}
            {violations.length > 60 && <li className="pcb-drc-more">and {violations.length - 60} more</li>}
          </ul>
        )}
      </section>

      <section className="pcb-sec">
        <h4>Manufacture</h4>
        <button className="btn go" onClick={download} disabled={!flat.pads.length}>
          <IconDownload size={13} />
          Gerbers and drill
        </button>
        <p className="pcb-note">
          A zip of RS-274X Gerbers and an Excellon drill file, named the way every board house
          recognises. Open it in a Gerber viewer before you order it.
        </p>
        {errors > 0 && (
          <p className="pcb-note warn">
            {errors} error{errors === 1 ? '' : 's'} on this board. It will export, and it will come
            back wrong.
          </p>
        )}
        {note && <p className="pcb-note ok">{note}</p>}
      </section>
    </aside>
  )
}

const clamp = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo
