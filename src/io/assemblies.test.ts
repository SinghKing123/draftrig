import { describe, expect, it } from 'vitest'
import '@/parts'
import { getPart } from '@/parts/kernel/registry'
import { listInstances } from '@/state/doc'
import { PortIndex } from '@/scene/portIndex'
import { drawerUnit, piCase, workbench } from './assemblies'

/**
 * The builds that are not circuits.
 *
 * Checked the same way the circuits are, and for the same reason: a part
 * given a parameter it does not have takes the default and says nothing, so
 * a case built with `thickness` where the part wanted `thick` comes out
 * looking plausible and wrong. Every key is checked against the definition.
 *
 * Also checked for being assemblies rather than drawings. An enclosure with
 * no inserts and no screws is a picture of an enclosure; the point of these
 * is that the fasteners are in the bill of materials.
 */

const BUILDS = { 'pi-case': piCase, workbench, 'drawer-unit': drawerUnit }

describe('assemblies', () => {
  it('uses parameters the parts actually have', () => {
    const bad: string[] = []
    for (const [name, build] of Object.entries(BUILDS)) {
      for (const inst of listInstances(build())) {
        const def = getPart(inst.defId)
        if (!def) {
          bad.push(`${name}: no part ${inst.defId}`)
          continue
        }
        const keys = new Set((def.params ?? []).map((p) => p.key))
        for (const k of Object.keys(inst.params)) {
          if (!keys.has(k)) bad.push(`${name}: ${inst.defId} has no "${k}"`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('takes only values the parameter allows', () => {
    const bad: string[] = []
    for (const [name, build] of Object.entries(BUILDS)) {
      for (const inst of listInstances(build())) {
        const def = getPart(inst.defId)!
        for (const p of def.params ?? []) {
          if (p.type !== 'enum' || !p.options) continue
          const v = inst.params[p.key]
          const allowed = p.options.map((o) => (typeof o === 'string' ? o : o.value))
          if (v !== undefined && !allowed.includes(v as string)) {
            bad.push(`${name}: ${inst.defId}.${p.key} = ${String(v)} (allows ${allowed.join('|')})`)
          }
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('resolves every port it wires to', () => {
    for (const [name, build] of Object.entries(BUILDS)) {
      const doc = build()
      const index = new PortIndex(listInstances(doc))
      for (const cid of doc.connectionOrder) {
        const c = doc.connections[cid]
        for (const end of [c.a, c.b]) {
          expect(index.get(end.instanceId, end.portId), `${name}: ${end.portId}`).toBeTruthy()
        }
      }
    }
  })

  it('is fastened, not just drawn', () => {
    const counts: Record<string, number> = {}
    for (const [name, build] of Object.entries(BUILDS)) {
      const ids = listInstances(build()).map((i) => i.defId)
      counts[name] = ids.length
      // Every one of these is something somebody has to buy and fit.
      const fasteners = ids.filter((d) =>
        /screw|insert|tnut|bracket|standoff|foot|slide|caster|knob/.test(d),
      ).length
      expect(fasteners, `${name} fasteners`).toBeGreaterThan(3)
    }
    console.log('assemblies:', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '))
    expect(Object.values(counts).every((n) => n > 12)).toBe(true)
  })

  it('is not secretly a circuit', () => {
    // The point of these is the structure. A board or two is fine; a build
    // that is mostly electronics belongs in builds.ts with the rest.
    for (const [name, build] of Object.entries(BUILDS)) {
      const ids = listInstances(build()).map((i) => i.defId)
      const electronic = ids.filter((d) =>
        /resistor|capacitor|led|ic-|ne555|shift-register|breadboard|perfboard|display|sensor/.test(d),
      ).length
      expect(electronic / ids.length, `${name} electronics share`).toBeLessThan(0.3)
    }
  })
})
