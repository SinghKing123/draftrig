import * as THREE from 'three'
import { buildPart, defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import type { Instance, Params, Vec3 } from '@/parts/kernel/types'
import type { Doc } from '@/state/doc'
import type { Plan } from './plan'

/**
 * Turning a validated plan into a document.
 *
 * The model is never asked where to put anything. Positions are worked out
 * here from each part's actual bounding box, because a language model guessing
 * millimetres produces parts inside one another, and a layout that is merely
 * tidy is worth more than one that is merely plausible.
 */

/** Gap between neighbouring parts, mm. */
const GAP = 22
/** Width of a row before it wraps, mm. */
const ROW_WIDTH = 420

interface Placed {
  ref: string
  id: string
}

function footprint(defId: string, params: Params): { w: number; d: number } {
  try {
    const built = buildPart(requirePart(defId), params)
    const size = built.bbox.getSize(new THREE.Vector3())
    return { w: Math.max(size.x, 6), d: Math.max(size.z, 6) }
  } catch {
    return { w: 30, d: 30 }
  }
}

export interface AppliedPlan {
  doc: Doc
  placed: Placed[]
  /** Wires that could not be made, with the reason. */
  skipped: string[]
}

/**
 * Build a document from a plan.
 *
 * `base` is merged into, so the assistant can add to a bench rather than
 * replacing it. Pass an empty document to start clean.
 */
export function applyPlan(plan: Plan, base: Doc, idPrefix = 'ai'): AppliedPlan {
  const doc: Doc = {
    ...base,
    instances: { ...base.instances },
    order: [...base.order],
    connections: { ...base.connections },
    connectionOrder: [...base.connectionOrder],
  }

  // Start clear of anything already on the bench.
  let originZ = 0
  for (const id of base.order) {
    const inst = base.instances[id]
    if (inst) originZ = Math.max(originZ, inst.pos[2] + 60)
  }

  let n = 0
  const nextId = (): string => `${idPrefix}${Date.now().toString(36).slice(-4)}${n++}`

  const placed: Placed[] = []
  const byRef = new Map<string, string>()

  let cursorX = 0
  let cursorZ = originZ
  let rowDepth = 0

  for (const p of plan.parts) {
    const def = requirePart(p.part)
    const params: Params = { ...defaultParams(def), ...p.params }
    const { w, d } = footprint(p.part, params)

    if (cursorX > 0 && cursorX + w > ROW_WIDTH) {
      cursorX = 0
      cursorZ += rowDepth + GAP
      rowDepth = 0
    }

    const id = nextId()
    const inst: Instance = {
      id,
      defId: p.part,
      name: p.name || def.name,
      params,
      pos: [cursorX + w / 2, 0, cursorZ + d / 2] as Vec3,
      rot: [0, 0, 0],
    }
    doc.instances[id] = inst
    doc.order.push(id)
    placed.push({ ref: p.ref, id })
    byRef.set(p.ref, id)

    cursorX += w + GAP
    rowDepth = Math.max(rowDepth, d)
  }

  // Centre the new block on the origin so it lands where the camera is looking.
  if (placed.length) {
    const xs = placed.map((p) => doc.instances[p.id].pos[0])
    const shift = (Math.min(...xs) + Math.max(...xs)) / 2
    for (const p of placed) {
      const inst = doc.instances[p.id]
      doc.instances[p.id] = { ...inst, pos: [inst.pos[0] - shift, inst.pos[1], inst.pos[2]] }
    }
  }

  const skipped: string[] = []
  for (const w of plan.wires) {
    const a = byRef.get(w.from[0])
    const b = byRef.get(w.to[0])
    if (!a || !b) {
      skipped.push(`${w.from.join('.')} to ${w.to.join('.')}: one end was not placed.`)
      continue
    }
    const id = nextId()
    doc.connections[id] = {
      id,
      kind: 'wire',
      a: { instanceId: a, portId: w.from[1] },
      b: { instanceId: b, portId: w.to[1] },
      color: w.color && /^#[0-9a-f]{6}$/i.test(w.color) ? w.color : '#E34B4B',
      gauge: 0.205,
    }
    doc.connectionOrder.push(id)
  }

  return { doc, placed, skipped }
}

/** What is already on the bench, for the model to build onto. */
export function describeBench(doc: Doc): string {
  if (!doc.order.length) return ''
  const lines = doc.order.slice(0, 40).map((id) => {
    const inst = doc.instances[id]
    if (!inst) return ''
    const params = Object.entries(inst.params)
      .filter(([, v]) => typeof v !== 'object')
      .slice(0, 4)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
    return `- ${inst.name} (${inst.defId})${params ? ` ${params}` : ''}`
  })
  const wires = doc.connectionOrder.length
  return `${lines.filter(Boolean).join('\n')}\n${wires} wire${wires === 1 ? '' : 's'} already placed.`
}
