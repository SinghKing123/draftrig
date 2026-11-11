import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Vec2 } from '@/parts/kernel/types'
import { useDoc } from '@/state/doc'
import { useBoard } from '@/state/board'
import { Connectivity, flatten, ratsnest, type Flat, type PlacedPad } from '@/pcb/copper'
import { buildNets } from '@/pcb/nets'
import { checkBoard, type Violation } from '@/pcb/drc'
import { dist, distToSegment, run45, snapPt } from '@/pcb/geom'
import { bodyRect, footprintOf } from '@/pcb/footprint'
import { padKey, type Side } from '@/pcb/types'

/**
 * The board, drawn and operated.
 *
 * SVG rather than canvas or WebGL, for one reason that outweighs the
 * rest: a board is a few thousand shapes, which SVG draws without
 * complaint, and in return every pad is a real element that can be
 * hovered, focused and read by a screen reader. A canvas would be a
 * picture of a board with a hit-test table beside it, and the hit-test
 * table is the part that goes wrong.
 *
 * The transform is the only place board millimetres become pixels. The
 * group carries `scale(z, -z)` so y counts upwards inside it, the way
 * the board and the Gerber both do, and nothing below this line has to
 * remember which way up it is.
 */

/** Zoom limits, pixels per millimetre. */
const MIN_Z = 1
const MAX_Z = 60

interface Props {
  flat: Flat
  violations: Violation[]
}

export function BoardCanvas({ flat, violations }: Props) {
  const doc = useDoc((s) => s.doc)
  const pcb = doc.pcb
  const editPcb = useDoc((s) => s.editPcb)
  const beginEdit = useDoc((s) => s.beginEdit)

  const tool = useBoard((s) => s.tool)
  const layer = useBoard((s) => s.layer)
  const grid = useBoard((s) => s.grid)
  const width = useBoard((s) => s.width)
  const zoom = useBoard((s) => s.zoom)
  const pan = useBoard((s) => s.pan)
  const pending = useBoard((s) => s.pending)
  const cursor = useBoard((s) => s.cursor)
  const focusNet = useBoard((s) => s.focusNet)
  const selection = useBoard((s) => s.selection)
  const hoverPad = useBoard((s) => s.hoverPad)
  const showViolation = useBoard((s) => s.showViolation)
  const board = useBoard

  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Vec2>([800, 600])

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize([el.clientWidth, el.clientHeight]))
    ro.observe(el)
    setSize([el.clientWidth, el.clientHeight])
    return () => ro.disconnect()
  }, [])

  const nets = useMemo(() => buildNets(doc), [doc])
  const conn = useMemo(() => Connectivity.of(flat), [flat])
  const rats = useMemo(() => ratsnest(flat, nets, conn), [flat, nets, conn])

  /* ---- screen <-> board ---- */
  const toBoard = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const r = wrap.current?.getBoundingClientRect()
      if (!r) return [0, 0]
      return [
        (clientX - r.left - r.width / 2) / zoom + pan[0],
        -((clientY - r.top - r.height / 2) / zoom) + pan[1],
      ]
    },
    [zoom, pan],
  )

  /* ---- fit the board when it first appears, and on F ---- */
  const fit = useCallback(() => {
    if (!pcb) return
    const [w, h] = size
    const z = Math.min((w - 48) / pcb.w, (h - 48) / pcb.h)
    board.getState().setView(Math.max(MIN_Z, Math.min(MAX_Z, z)), [0, 0])
  }, [pcb, size, board])

  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || !pcb || size[0] < 50) return
    fitted.current = true
    fit()
  }, [pcb, size, fit])

  /* ---- what the pointer is over ---- */
  const padUnder = useCallback(
    (at: Vec2): PlacedPad | null => {
      let best: { p: PlacedPad; d: number } | null = null
      for (const p of flat.pads) {
        const r = Math.max(p.size[0], p.size[1]) / 2
        const d = dist(p.at, at)
        if (d > r) continue
        if (!best || d < best.d) best = { p, d }
      }
      return best?.p ?? null
    },
    [flat],
  )

  /**
   * Where a click lands.
   *
   * A pad wins over the grid, always. Routing to the middle of a pad is
   * the whole job, and a tenth-of-an-inch grid that is one step out puts
   * the track beside the pad instead of on it — which the checker then
   * reports as an unrouted net, correctly, and which looks on screen
   * exactly like a routed one.
   */
  const landing = useCallback(
    (at: Vec2): { at: Vec2; pad: PlacedPad | null } => {
      const pad = padUnder(at)
      return pad ? { at: pad.at, pad } : { at: snapPt(at, grid), pad: null }
    },
    [padUnder, grid],
  )

  /* ---- the run being drawn ---- */
  const preview = useMemo(() => {
    if (!pending) return null
    const last = pending.pts[pending.pts.length - 1]
    const end = landing(cursor)
    return { pts: run45(last, end.at), pad: end.pad }
  }, [pending, cursor, landing])

  /* ---- gestures ---- */
  const drag = useRef<
    | { kind: 'pan'; from: Vec2; pan: Vec2 }
    | { kind: 'part'; id: string; grab: Vec2; start: Vec2 }
    | null
  >(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pcb) return
    const at = toBoard(e.clientX, e.clientY)

    /* Middle button, or the select tool on bare board, pans. */
    if (e.button === 1 || e.button === 2) {
      drag.current = { kind: 'pan', from: [e.clientX, e.clientY], pan }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      e.preventDefault()
      return
    }
    if (e.button !== 0) return

    if (tool === 'route') {
      const end = landing(at)
      if (!pending) {
        // A run has to start on a pad: that is what tells it its net.
        if (!end.pad || !end.pad.net) return
        board.getState().begin({ net: end.pad.net, layer, width, pts: [end.pad.at] })
        return
      }
      const last = pending.pts[pending.pts.length - 1]
      const pts = run45(last, end.at).slice(1)
      for (const q of pts) board.getState().push(q)
      // Landing on a pad of this net finishes the run.
      if (end.pad && end.pad.net === pending.net) commitPending()
      return
    }

    if (tool === 'via') {
      const end = landing(at)
      const net = end.pad?.net ?? pending?.net ?? null
      if (!net) return
      const id = crypto.randomUUID()
      editPcb((b) => {
        b.vias[id] = { id, net, at: end.at, drill: b.rules.drill, pad: b.rules.via }
        b.viaOrder.push(id)
      })
      return
    }

    /* Select: a part body under the pointer is dragged, anything else pans. */
    const hit = partUnder(at)
    if (hit) {
      board.getState().select([hit])
      const pl = pcb.placements[hit]
      /*
       * History is taken now, before the part has moved.
       *
       * Every frame of the drag edits without recording, so the one
       * entry that undo has to find is the board as it was when the
       * pointer went down. Recording on pointer-up instead captured the
       * board as it already was at the end of the drag, which made undo
       * restore the position it had just put the part in.
       */
      beginEdit()
      drag.current = { kind: 'part', id: hit, grab: at, start: [pl.x, pl.y] }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }
    const copper = copperUnder(at)
    board.getState().select(copper ? [copper] : [])
    if (!copper) {
      drag.current = { kind: 'pan', from: [e.clientX, e.clientY], pan }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
  }

  const partUnder = (at: Vec2): string | null => {
    for (let i = flat.bodies.length - 1; i >= 0; i--) {
      const b = flat.bodies[i]
      const r = b.rect
      const dx = at[0] - r.at[0]
      const dy = at[1] - r.at[1]
      const a = (-r.rot * Math.PI) / 180
      const lx = dx * Math.cos(a) - dy * Math.sin(a)
      const ly = dx * Math.sin(a) + dy * Math.cos(a)
      if (Math.abs(lx) <= r.size[0] / 2 && Math.abs(ly) <= r.size[1] / 2) return b.instanceId
    }
    // Missing the body but hitting one of its pads still picks the part.
    const pad = padUnder(at)
    return pad?.instanceId ?? null
  }

  const copperUnder = (at: Vec2): string | null => {
    for (const s of flat.segments) {
      if (s.layer !== layer) continue
      if (distToSegment(at, s.a, s.b) <= s.width / 2 + 0.2) return s.trackId
    }
    for (const v of flat.vias) if (dist(at, v.at) <= v.pad / 2) return v.id
    return null
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const at = toBoard(e.clientX, e.clientY)
    board.getState().setCursor(at)

    const d = drag.current
    if (d?.kind === 'pan') {
      board.getState().setView(zoom, [
        d.pan[0] - (e.clientX - d.from[0]) / zoom,
        d.pan[1] + (e.clientY - d.from[1]) / zoom,
      ])
      return
    }
    if (d?.kind === 'part') {
      const nx = snapPt([d.start[0] + at[0] - d.grab[0], d.start[1] + at[1] - d.grab[1]], grid)
      editPcb((b) => {
        const pl = b.placements[d.id]
        if (pl) {
          pl.x = nx[0]
          pl.y = nx[1]
        }
      }, false)
      return
    }

    if (tool !== 'select') {
      const pad = padUnder(at)
      board.getState().setHoverPad(pad?.key ?? null)
    } else {
      board.getState().setHoverPad(null)
    }
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const commitPending = useCallback(() => {
    const p = board.getState().pending
    if (!p || p.pts.length < 2) {
      board.getState().finish()
      return
    }
    const id = crypto.randomUUID()
    editPcb((b) => {
      b.tracks[id] = { id, net: p.net, layer: p.layer, width: p.width, pts: p.pts.map((q) => [...q] as Vec2) }
      b.trackOrder.push(id)
    })
    board.getState().finish()
  }, [board, editPcb])

  const onDoubleClick = () => {
    if (pending) commitPending()
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    const factor = Math.exp(-e.deltaY * 0.0015)
    const next = Math.max(MIN_Z, Math.min(MAX_Z, zoom * factor))
    // Zoom about the pointer: the board point under it does not move.
    const before = toBoard(e.clientX, e.clientY)
    const sx = (e.clientX - r.left - r.width / 2) / next
    const sy = -((e.clientY - r.top - r.height / 2) / next)
    board.getState().setView(next, [before[0] - sx, before[1] - sy])
  }

  /* ---- keys ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return
      const s = board.getState()

      if (e.key === 'Escape') {
        if (s.pending) s.finish()
        else s.select([])
        return
      }
      if (e.key === 'Backspace' && s.pending) {
        e.preventDefault()
        s.dropCorner()
        return
      }
      if (e.key === 'Enter' && s.pending) {
        commitPending()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.length) {
        e.preventDefault()
        const ids = s.selection
        /*
         * Delete here takes a thing off the board, and never out of the
         * build. A part selected in this workspace is a footprint, so
         * removing it means it is not fitted to this board — the part is
         * still on the bench and still wired, and its net simply leaves
         * the board. Deleting the part itself is Build's job, and doing
         * it from here would be a keystroke in a layout tool quietly
         * changing the circuit.
         */
        editPcb((b) => {
          for (const id of ids) {
            delete b.tracks[id]
            delete b.vias[id]
            delete b.placements[id]
          }
          b.trackOrder = b.trackOrder.filter((t) => b.tracks[t])
          b.viaOrder = b.viaOrder.filter((v) => b.vias[v])
        })
        s.select([])
        return
      }
      if (e.key === 'f' || e.key === 'F') {
        fit()
        return
      }
      if (e.key === 'b' || e.key === 'B') {
        s.flipLayer()
        return
      }
      if ((e.key === 'r' || e.key === 'R') && s.selection.length) {
        const ids = s.selection
        editPcb((b) => {
          for (const id of ids) {
            const pl = b.placements[id]
            if (pl) pl.rot = (pl.rot + 90) % 360
          }
        })
        return
      }
      if (e.key === 'v' || e.key === 'V') {
        /*
         * A via in the middle of a run, which is what a via is for.
         * It drops one at the last committed corner and carries the run
         * on down the other side, so crossing a track is one key rather
         * than three gestures.
         */
        if (!s.pending) return
        const p = s.pending
        const at = p.pts[p.pts.length - 1]
        const id = crypto.randomUUID()
        const current = { ...p }
        editPcb((b) => {
          b.vias[id] = { id, net: p.net, at: [...at] as Vec2, drill: b.rules.drill, pad: b.rules.via }
          b.viaOrder.push(id)
          if (current.pts.length >= 2) {
            const tid = crypto.randomUUID()
            b.tracks[tid] = { id: tid, net: p.net, layer: p.layer, width: p.width, pts: current.pts.map((q) => [...q] as Vec2) }
            b.trackOrder.push(tid)
          }
        })
        const other: Side = p.layer === 'top' ? 'bottom' : 'top'
        s.setLayer(other)
        s.begin({ net: p.net, layer: other, width: p.width, pts: [[...at] as Vec2] })
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, editPcb, fit, commitPending])

  if (!pcb) return null

  const [vw, vh] = size
  const hx = pcb.w / 2
  const hy = pcb.h / 2
  const marker = violations.find((v) => v.id === showViolation)

  /* Front layer last, so the one being worked on is the one on top. */
  const layers: Side[] = layer === 'top' ? ['bottom', 'top'] : ['top', 'bottom']
  const dimmed = (n: string | null) => focusNet !== null && n !== focusNet

  return (
    <div
      ref={wrap}
      className="pcb-canvas"
      data-tool={tool}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width={vw} height={vh} className="pcb-svg">
        <defs>
          <pattern
            id="pcb-grid"
            width={grid > 0 ? grid * zoom : 10}
            height={grid > 0 ? grid * zoom : 10}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={0.5} cy={0.5} r={0.5} className="pcb-grid-dot" />
          </pattern>
        </defs>

        <g transform={`translate(${vw / 2} ${vh / 2}) scale(${zoom} ${-zoom}) translate(${-pan[0]} ${-pan[1]})`}>
          {/* the board itself */}
          <rect className="pcb-board" x={-hx} y={-hy} width={pcb.w} height={pcb.h} />
          {grid > 0 && zoom * grid > 7 && (
            <g className="pcb-grid">
              {gridLines(hx, hy, grid).map((l, i) => (
                <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} strokeWidth={0.6 / zoom} />
              ))}
            </g>
          )}
          <rect
            className="pcb-keepout"
            x={-hx + pcb.rules.edge}
            y={-hy + pcb.rules.edge}
            width={pcb.w - 2 * pcb.rules.edge}
            height={pcb.h - 2 * pcb.rules.edge}
            strokeWidth={0.5 / zoom}
          />

          {/* silkscreen: the part outlines */}
          {flat.bodies.map((b) => (
            <g key={b.instanceId} className="pcb-body" data-side={b.side} data-on={selection.includes(b.instanceId) || undefined}>
              <rect
                x={-b.rect.size[0] / 2}
                y={-b.rect.size[1] / 2}
                width={b.rect.size[0]}
                height={b.rect.size[1]}
                transform={`translate(${b.rect.at[0]} ${b.rect.at[1]}) rotate(${b.rect.rot})`}
                strokeWidth={1.2 / zoom}
              />
            </g>
          ))}

          {/* the lines still to route */}
          <g className="pcb-rats">
            {rats.map((r, i) => (
              <line
                key={i}
                x1={r.a[0]}
                y1={r.a[1]}
                x2={r.b[0]}
                y2={r.b[1]}
                strokeWidth={0.8 / zoom}
                data-dim={dimmed(r.net) || undefined}
              />
            ))}
          </g>

          {/* copper, back layer first */}
          {layers.map((side) => (
            <g key={side} className="pcb-copper" data-side={side} data-front={side === layer || undefined}>
              {pcb.trackOrder.map((id) => {
                const t = pcb.tracks[id]
                if (!t || t.layer !== side) return null
                return (
                  <polyline
                    key={id}
                    className="pcb-track"
                    points={t.pts.map((q) => `${q[0]},${q[1]}`).join(' ')}
                    strokeWidth={t.width}
                    data-on={selection.includes(id) || undefined}
                    data-dim={dimmed(t.net) || undefined}
                  />
                )
              })}
            </g>
          ))}

          {/* pads, always in front of copper: they are what you aim at */}
          <g className="pcb-pads">
            {flat.pads.map((p) => (
              <g key={p.key} data-dim={dimmed(p.net) || undefined} data-on={hoverPad === p.key || undefined}>
                {p.shape === 'rect' ? (
                  <rect
                    className="pcb-pad"
                    x={p.at[0] - p.size[0] / 2}
                    y={p.at[1] - p.size[1] / 2}
                    width={p.size[0]}
                    height={p.size[1]}
                  />
                ) : (
                  <circle className="pcb-pad" cx={p.at[0]} cy={p.at[1]} r={Math.max(p.size[0], p.size[1]) / 2} />
                )}
                {p.drill > 0 && <circle className="pcb-drill" cx={p.at[0]} cy={p.at[1]} r={p.drill / 2} />}
              </g>
            ))}
          </g>

          <g className="pcb-vias">
            {flat.vias.map((v) => (
              <g key={v.id} data-dim={dimmed(v.net) || undefined} data-on={selection.includes(v.id) || undefined}>
                <circle className="pcb-via" cx={v.at[0]} cy={v.at[1]} r={v.pad / 2} />
                <circle className="pcb-drill" cx={v.at[0]} cy={v.at[1]} r={v.drill / 2} />
              </g>
            ))}
          </g>

          {/* the run under the pointer */}
          {pending && (
            <g className="pcb-pending" data-side={pending.layer}>
              <polyline points={pending.pts.map((q) => `${q[0]},${q[1]}`).join(' ')} strokeWidth={pending.width} />
              {preview && (
                <polyline
                  className="pcb-preview"
                  points={preview.pts.map((q) => `${q[0]},${q[1]}`).join(' ')}
                  strokeWidth={pending.width}
                  data-ok={preview.pad?.net === pending.net || undefined}
                />
              )}
            </g>
          )}

          {/* the violation being pointed at */}
          {marker && (
            <g className="pcb-marker">
              <circle cx={marker.at[0]} cy={marker.at[1]} r={2.2} strokeWidth={0.5 / zoom} />
              <line x1={marker.at[0] - 3.4} y1={marker.at[1]} x2={marker.at[0] + 3.4} y2={marker.at[1]} strokeWidth={0.3 / zoom} />
              <line x1={marker.at[0]} y1={marker.at[1] - 3.4} x2={marker.at[0]} y2={marker.at[1] + 3.4} strokeWidth={0.3 / zoom} />
            </g>
          )}
        </g>
      </svg>

      <div className="pcb-readout">
        <span>{cursor[0].toFixed(2)}, {cursor[1].toFixed(2)} mm</span>
        <span className="sp" />
        {pending ? (
          <span className="pcb-live">
            Routing <b>{pending.net}</b> on {pending.layer} · {pending.width.toFixed(2)} mm · Enter or
            double-click to end
          </span>
        ) : (
          <span>{hoverPadLabel(flat, hoverPad)}</span>
        )}
      </div>
    </div>
  )
}

function hoverPadLabel(flat: Flat, key: string | null): string {
  if (!key) return ''
  const p = flat.padByKey.get(key)
  if (!p) return ''
  return `${p.label}${p.net ? ` · ${p.net}` : ' · no net'}`
}

/** Grid lines across the board, as [x1,y1,x2,y2]. */
function gridLines(hx: number, hy: number, grid: number): number[][] {
  const out: number[][] = []
  for (let x = Math.ceil(-hx / grid) * grid; x <= hx; x += grid) out.push([x, -hy, x, hy])
  for (let y = Math.ceil(-hy / grid) * grid; y <= hy; y += grid) out.push([-hx, y, hx, y])
  return out
}

/** Used by the panel when it needs a fresh flatten outside the canvas. */
export function useFlat(): { flat: Flat; violations: Violation[] } {
  const doc = useDoc((s) => s.doc)
  return useMemo(() => {
    const pcb = doc.pcb
    const nets = buildNets(doc)
    if (!pcb) {
      return {
        flat: { pads: [], padByKey: new Map(), segments: [], vias: [], footprints: new Map(), bodies: [] },
        violations: [],
      }
    }
    const flat = flatten(doc, pcb, nets)
    return { flat, violations: checkBoard(pcb, flat, nets) }
  }, [doc])
}

/** Re-exported so the panels can address a pad the same way the canvas does. */
export { padKey, footprintOf, bodyRect }
