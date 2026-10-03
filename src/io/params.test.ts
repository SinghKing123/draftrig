import { describe, expect, it } from 'vitest'
import { getPart } from '@/parts/kernel/registry'
import { STARTERS } from './starters'
import '@/parts'

/**
 * Every parameter a shipped build sets has to exist, and mean something.
 *
 * A key the part does not declare is not an error anywhere — it is dropped
 * and the part falls back to its default, silently. That is how six of these
 * builds shipped with a propeller whose diameter was ignored, a panel asking
 * for brushed aluminium and getting plywood, and three servos the size of
 * nothing in particular. The failure has no symptom except the picture being
 * wrong, so it needs a test rather than an eye.
 */
describe('the parameters the builds set', () => {
  it('all exist on the part, with a value it accepts', () => {
    const wrong: string[] = []

    for (const starter of STARTERS) {
      const doc = starter.build()
      for (const inst of Object.values(doc.instances)) {
        const def = getPart(inst.defId)
        if (!def) { wrong.push(`${starter.id}: no part ${inst.defId}`); continue }
        const declared = new Map((def.params ?? []).map((p) => [p.key, p]))

        for (const [key, value] of Object.entries(inst.params ?? {})) {
          const spec = declared.get(key)
          if (!spec) {
            wrong.push(`${starter.id}: ${inst.defId} has no parameter "${key}"`)
            continue
          }
          if (spec.type === 'enum') {
            const ok = (spec.options ?? []).some((o) => o.value === value)
            if (!ok) {
              const allowed = (spec.options ?? []).map((o) => o.value).join('|')
              wrong.push(`${starter.id}: ${inst.defId}.${key}=${JSON.stringify(value)} not one of ${allowed}`)
            }
          } else if (spec.type === 'number' && typeof value === 'number') {
            if (spec.min !== undefined && value < spec.min) {
              wrong.push(`${starter.id}: ${inst.defId}.${key}=${value} below min ${spec.min}`)
            }
            if (spec.max !== undefined && value > spec.max) {
              wrong.push(`${starter.id}: ${inst.defId}.${key}=${value} above max ${spec.max}`)
            }
          }
        }
      }
    }

    expect(wrong).toEqual([])
  })
})
