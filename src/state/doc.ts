import { useMemo } from 'react'
import { create } from 'zustand'
import type { Connection, Instance, Params, ParamValue, PartDef, PortRef, Vec3 } from '@/parts/kernel/types'
import { defaultParams, getPart } from '@/parts/kernel/registry'

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export interface Doc {
  name: string
  instances: Record<string, Instance>
  /** Draw order / tree order. */
  order: string[]
  connections: Record<string, Connection>
  connectionOrder: string[]
}

export type EditorMode = 'build' | 'wire' | 'sim'

export type TransformMode = 'move' | 'rotate'

export interface Snap {
  enabled: boolean
  /** Translation grid, mm. */
  grid: number
  /** Rotation step, degrees. */
  angle: number
  /** Snap a dragged part's ports to nearby ports. */
  ports: boolean
}

interface ViewFlags {
  grid: boolean
  ports: boolean
  wires: boolean
  labels: boolean
  shadows: boolean
  xray: boolean
  /** Post-processing level. 'off' skips the composer entirely. */
  quality: 'off' | 'balanced' | 'high'
}

export interface DocState {
  doc: Doc
  mode: EditorMode
  transformMode: TransformMode
  selection: string[]
  hovered: string | null
  /** Wire-mode: the port we started dragging from. */
  pendingWire: PortRef | null
  snap: Snap
  /** Colour the next wire is drawn in. */
  wireColor: string
  view: ViewFlags
  /** Instance ids that failed a design rule, with messages. */
  issues: Record<string, string[]>
  /** Bumped to ask the viewport to reframe; the scene owns the camera. */
  frameToken: number
  frameTarget: 'all' | 'selection'

  past: Doc[]
  future: Doc[]

  /* actions */
  setMode: (m: EditorMode) => void
  setTransformMode: (m: TransformMode) => void
  addPart: (defId: string, at?: Vec3, params?: Params) => string | null
  duplicateSelection: () => void
  removeInstances: (ids: string[]) => void
  moveInstance: (id: string, pos: Vec3, commit?: boolean) => void
  rotateInstance: (id: string, rot: Vec3, commit?: boolean) => void
  /** Move several parts in one edit, what a gizmo drag actually does. */
  transformInstances: (updates: { id: string; pos?: Vec3; rot?: Vec3 }[], commit?: boolean) => void
  setParam: (id: string, key: string, value: ParamValue, commit?: boolean) => void
  renameInstance: (id: string, name: string) => void
  toggleLock: (id: string) => void
  toggleHidden: (id: string) => void

  connect: (a: PortRef, b: PortRef, opts?: Partial<Connection>) => string | null
  disconnect: (ids: string[]) => void
  setConnectionColor: (id: string, color: string) => void
  setWireColor: (color: string) => void
  setPendingWire: (p: PortRef | null) => void

  select: (ids: string[], additive?: boolean) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void

  requestFrame: (target?: 'all' | 'selection') => void
  setSnap: (s: Partial<Snap>) => void
  setView: (v: Partial<ViewFlags>) => void
  setIssues: (issues: Record<string, string[]>) => void

  undo: () => void
  redo: () => void
  loadDoc: (doc: Doc) => void
  newDoc: () => void
  /** Push the current doc onto the undo stack before a compound edit. */
  beginEdit: () => void
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let counter = 0
const uid = (prefix: string): string => `${prefix}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const emptyDoc = (): Doc => ({
  name: 'Untitled build',
  instances: {},
  order: [],
  connections: {},
  connectionOrder: [],
})

const cloneDoc = (d: Doc): Doc => ({
  name: d.name,
  instances: Object.fromEntries(Object.entries(d.instances).map(([k, v]) => [k, { ...v, params: { ...v.params }, pos: [...v.pos] as Vec3, rot: [...v.rot] as Vec3 }])),
  order: [...d.order],
  connections: Object.fromEntries(Object.entries(d.connections).map(([k, v]) => [k, { ...v, a: { ...v.a }, b: { ...v.b } }])),
  connectionOrder: [...d.connectionOrder],
})

const HISTORY_LIMIT = 100

/** Auto-name: "Resistor 3" style, unique per part type. */
function nextName(doc: Doc, def: PartDef): string {
  let n = 1
  const used = new Set(Object.values(doc.instances).filter((i) => i.defId === def.id).map((i) => i.name))
  while (used.has(`${def.name} ${n}`)) n++
  return `${def.name} ${n}`
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

/**
 * How far a part sits above the ground plane, supplied by the editor once its
 * geometry compiler has loaded. Without it, parts seat at y = 0, which is what
 * anything outside the viewport wants anyway.
 */
type SeatFn = (def: PartDef, params: Params) => number
let seatHeight: SeatFn | null = null

export function registerSeating(fn: SeatFn): void {
  seatHeight = fn
}

/**
 * The wire colours on offer.
 *
 * Named rather than just listed, because on a real bench the colour is how you
 * read a harness at a glance: red is the positive rail, black is the return,
 * and the rest are whatever you decided they meant.
 */
export const WIRE_COLORS: { value: string; label: string }[] = [
  { value: '#E34B4B', label: 'Red, positive' },
  { value: '#1C1F24', label: 'Black, ground' },
  { value: '#C8A227', label: 'Yellow' },
  { value: '#3DD68C', label: 'Green' },
  { value: '#4C8DFF', label: 'Blue' },
  { value: '#B06CD8', label: 'Violet' },
  { value: '#E88A3C', label: 'Orange' },
  { value: '#D8DCE2', label: 'White' },
]

export const useDoc = create<DocState>()((set, get) => {
  /** Run a mutation, optionally recording an undo entry first. */
  const edit = (fn: (d: Doc) => void, record = true) => {
    const s = get()
    const next = cloneDoc(s.doc)
    fn(next)
    set({
      doc: next,
      past: record ? [...s.past, s.doc].slice(-HISTORY_LIMIT) : s.past,
      future: record ? [] : s.future,
    })
  }

  return {
    doc: emptyDoc(),
    mode: 'build',
    transformMode: 'move',
    selection: [],
    hovered: null,
    pendingWire: null,
    snap: { enabled: true, grid: 2.54, angle: 15, ports: true },
    wireColor: WIRE_COLORS[0].value,
    view: { grid: true, ports: true, wires: true, labels: false, shadows: true, xray: false, quality: 'high' },
    issues: {},
    frameToken: 0,
    frameTarget: 'all',
    past: [],
    future: [],

    setMode: (m) => set({ mode: m, pendingWire: null }),
    setTransformMode: (m) => set({ transformMode: m }),

    addPart: (defId, at = [0, 0, 0], params) => {
      const def = getPart(defId)
      if (!def) {
        console.warn(`[doc] cannot add unknown part "${defId}"`)
        return null
      }
      const id = uid('i')
      const resolved = { ...defaultParams(def), ...params }
      // Drop the part onto the ground plane. Through-hole parts stand on their
      // lead tips, which is exactly what they do on a real bench. Working out
      // where the tips are needs the geometry compiler, so the editor lends it
      // to the store rather than the store importing it: a document has to be
      // creatable without pulling a 3D engine in behind it.
      const seat: Vec3 = [...at] as Vec3
      if (at[1] === 0 && seatHeight) seat[1] = seatHeight(def, resolved)
      edit((d) => {
        d.instances[id] = {
          id,
          defId,
          name: nextName(d, def),
          params: resolved,
          pos: seat,
          rot: [0, 0, 0],
        }
        d.order.push(id)
      })
      set({ selection: [id] })
      return id
    },

    duplicateSelection: () => {
      const { selection, doc } = get()
      if (!selection.length) return
      const newIds: string[] = []
      edit((d) => {
        for (const sid of selection) {
          const src = doc.instances[sid]
          if (!src) continue
          const def = getPart(src.defId)
          const id = uid('i')
          d.instances[id] = {
            ...src,
            id,
            name: def ? nextName(d, def) : src.name + ' copy',
            params: { ...src.params },
            pos: [src.pos[0] + 20, src.pos[1], src.pos[2] + 20],
            rot: [...src.rot] as Vec3,
          }
          d.order.push(id)
          newIds.push(id)
        }
      })
      set({ selection: newIds })
    },

    removeInstances: (ids) => {
      const kill = new Set(ids)
      edit((d) => {
        for (const id of ids) {
          delete d.instances[id]
        }
        d.order = d.order.filter((i) => !kill.has(i))
        // Drop any connection touching a removed instance.
        for (const cid of [...d.connectionOrder]) {
          const c = d.connections[cid]
          if (!c || kill.has(c.a.instanceId) || kill.has(c.b.instanceId)) {
            delete d.connections[cid]
            d.connectionOrder = d.connectionOrder.filter((x) => x !== cid)
          }
        }
      })
      set((s) => ({ selection: s.selection.filter((i) => !kill.has(i)) }))
    },

    moveInstance: (id, pos, commit = true) =>
      edit((d) => {
        const inst = d.instances[id]
        if (inst && !inst.locked) inst.pos = [...pos] as Vec3
      }, commit),

    rotateInstance: (id, rot, commit = true) =>
      edit((d) => {
        const inst = d.instances[id]
        if (inst && !inst.locked) inst.rot = [...rot] as Vec3
      }, commit),

    transformInstances: (updates, commit = true) =>
      edit((d) => {
        for (const u of updates) {
          const inst = d.instances[u.id]
          if (!inst || inst.locked) continue
          if (u.pos) inst.pos = [...u.pos] as Vec3
          if (u.rot) inst.rot = [...u.rot] as Vec3
        }
      }, commit),

    setParam: (id, key, value, commit = true) =>
      edit((d) => {
        const inst = d.instances[id]
        if (inst) inst.params[key] = value
      }, commit),

    renameInstance: (id, name) =>
      edit((d) => {
        const inst = d.instances[id]
        if (inst) inst.name = name
      }),

    toggleLock: (id) =>
      edit((d) => {
        const inst = d.instances[id]
        if (inst) inst.locked = !inst.locked
      }),

    toggleHidden: (id) =>
      edit((d) => {
        const inst = d.instances[id]
        if (inst) inst.hidden = !inst.hidden
      }),

    connect: (a, b, opts) => {
      if (a.instanceId === b.instanceId && a.portId === b.portId) return null
      const { doc } = get()
      // Reject exact duplicates in either direction.
      const dupe = doc.connectionOrder.find((cid) => {
        const c = doc.connections[cid]
        return (
          (c.a.instanceId === a.instanceId && c.a.portId === a.portId && c.b.instanceId === b.instanceId && c.b.portId === b.portId) ||
          (c.a.instanceId === b.instanceId && c.a.portId === b.portId && c.b.instanceId === a.instanceId && c.b.portId === a.portId)
        )
      })
      if (dupe) return null
      const id = uid('c')
      edit((d) => {
        d.connections[id] = { id, kind: 'wire', a, b, color: '#E34B4B', gauge: 0.2, ...opts }
        d.connectionOrder.push(id)
      })
      return id
    },

    disconnect: (ids) => {
      const kill = new Set(ids)
      edit((d) => {
        for (const id of ids) delete d.connections[id]
        d.connectionOrder = d.connectionOrder.filter((c) => !kill.has(c))
      })
    },

    setConnectionColor: (id, color) =>
      edit((d) => {
        const c = d.connections[id]
        if (c) c.color = color
      }),

    setPendingWire: (p) => set({ pendingWire: p }),

    select: (ids, additive = false) =>
      set((s) => ({ selection: additive ? [...new Set([...s.selection, ...ids])] : ids })),

    toggleSelect: (id) =>
      set((s) => ({
        selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id],
      })),

    clearSelection: () => set({ selection: [] }),
    setHovered: (id) => set({ hovered: id }),

    requestFrame: (target = 'all') => set((s) => ({ frameToken: s.frameToken + 1, frameTarget: target })),

    setSnap: (s) => set((st) => ({ snap: { ...st.snap, ...s } })),
    setWireColor: (wireColor) => set({ wireColor }),
    setView: (v) => set((st) => ({ view: { ...st.view, ...v } })),
    setIssues: (issues) => set({ issues }),

    undo: () => {
      const s = get()
      const prev = s.past[s.past.length - 1]
      if (!prev) return
      set({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future].slice(0, HISTORY_LIMIT) })
    },

    redo: () => {
      const s = get()
      const next = s.future[0]
      if (!next) return
      set({ doc: next, past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: s.future.slice(1) })
    },

    loadDoc: (doc) =>
      set((s) => ({ doc, selection: [], past: [], future: [], issues: {}, frameToken: s.frameToken + 1, frameTarget: 'all' })),
    newDoc: () => set({ doc: emptyDoc(), selection: [], past: [], future: [], issues: {} }),

    beginEdit: () => set((s) => ({ past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: [] })),
  }
})

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

/**
 * These must be hooks rather than plain selectors: zustand compares snapshots
 * by identity, so a selector that builds a fresh array on every call re-renders
 * forever. Subscribing to the two stable slices and joining them in a memo
 * gives a snapshot that only changes when the document does.
 */
export function useInstanceList(): Instance[] {
  const instances = useDoc((s) => s.doc.instances)
  const order = useDoc((s) => s.doc.order)
  return useMemo(() => order.map((id) => instances[id]).filter(Boolean), [instances, order])
}

export function useConnectionList(): Connection[] {
  const connections = useDoc((s) => s.doc.connections)
  const order = useDoc((s) => s.doc.connectionOrder)
  return useMemo(() => order.map((id) => connections[id]).filter(Boolean), [connections, order])
}

export function listInstances(doc: Doc): Instance[] {
  return doc.order.map((id) => doc.instances[id]).filter(Boolean)
}

export function instanceDef(inst: Instance): PartDef | undefined {
  return getPart(inst.defId)
}
