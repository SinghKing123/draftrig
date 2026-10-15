import { describe, expect, it } from 'vitest'
import '@/parts'
import { getPart } from '@/parts/kernel/registry'
import { listInstances } from '@/state/doc'
import { PortIndex } from '@/scene/portIndex'
import { arcadeCabinet } from './builds'

/**
 * The cabinet.
 *
 * Checked the way the other builds are, plus one thing specific to it: the
 * control panel has to come back to a single common. A loom wired to four
 * different grounds works in the simulator and is wrong on a bench, and the
 * whole point of this build is that it is the real construction.
 */
describe('arcade cabinet', () => {
  const doc = arcadeCabinet()
  const parts = listInstances(doc)

  it('resolves every port it wires to', () => {
    const index = new PortIndex(parts)
    const bad: string[] = []
    for (const cid of doc.connectionOrder) {
      const c = doc.connections[cid]
      for (const end of [c.a, c.b]) {
        if (!index.get(end.instanceId, end.portId)) {
          bad.push(`${doc.instances[end.instanceId]?.defId}.${end.portId}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('uses parameters the parts have', () => {
    const bad: string[] = []
    for (const inst of parts) {
      const def = getPart(inst.defId)
      if (!def) { bad.push(`no part ${inst.defId}`); continue }
      const keys = new Set((def.params ?? []).map((p) => p.key))
      for (const k of Object.keys(inst.params)) {
        if (!keys.has(k)) bad.push(`${inst.defId} has no "${k}"`)
      }
      for (const p of def.params ?? []) {
        if (p.type !== 'enum' || !p.options) continue
        const v = inst.params[p.key]
        const allowed = p.options.map((o) => (typeof o === 'string' ? o : o.value))
        if (v !== undefined && !allowed.includes(v as string)) {
          bad.push(`${inst.defId}.${p.key} = ${String(v)} (allows ${allowed.join('|')})`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('is a cabinet, not a circuit on a board', () => {
    const ids = parts.map((i) => i.defId)
    console.log(`arcade: ${ids.length} parts, ${doc.connectionOrder.length} wires`)
    for (const want of ['panel-sheet', 'monitor-panel', 'arcade-joystick', 'arcade-button',
      'sbc-raspberry-pi', 'speaker-cone', 'cable-hdmi', 'power-adapter']) {
      expect(ids, want).toContain(want)
    }
    expect(ids.filter((d) => d === 'panel-sheet').length, 'ply pieces').toBeGreaterThanOrEqual(6)
    expect(ids.filter((d) => d === 'arcade-button').length).toBe(6)
  })

  it('returns the whole control panel to one common', () => {
    const byId = Object.fromEntries(parts.map((p) => [p.id, p]))
    const isCom = (r: { instanceId: string; portId: string }) =>
      r.portId === 'com' && /arcade-/.test(byId[r.instanceId]?.defId ?? '')

    // Walk the chain of com-to-com links; it must reach every switch.
    const linked = new Map<string, Set<string>>()
    for (const cid of doc.connectionOrder) {
      const c = doc.connections[cid]
      if (!isCom(c.a) || !isCom(c.b)) continue
      for (const [x, y] of [[c.a, c.b], [c.b, c.a]] as const) {
        if (!linked.has(x.instanceId)) linked.set(x.instanceId, new Set())
        linked.get(x.instanceId)!.add(y.instanceId)
      }
    }
    const switches = parts.filter((p) => /arcade-/.test(p.defId)).map((p) => p.id)
    const seen = new Set<string>([switches[0]])
    const queue = [switches[0]]
    while (queue.length) {
      for (const n of linked.get(queue.pop()!) ?? []) {
        if (!seen.has(n)) { seen.add(n); queue.push(n) }
      }
    }
    expect([...switches].filter((s) => !seen.has(s)), 'switches off the common chain').toEqual([])
  })
})
