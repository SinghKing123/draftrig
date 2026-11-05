import { describe, expect, it } from 'vitest'
import '@/parts'
import '@/parts/products'
import { allProducts, productsFor } from '@/parts/products'
import { getPart } from '@/parts/kernel/registry'

/**
 * The rules a product row has to keep.
 *
 * This database exists to be trusted. Somebody builds a shelf to a depth
 * they read here, so a row with a figure nobody can check is worse than
 * no row at all — these are the checks that stop one being added by
 * accident.
 *
 * It passes on an empty catalogue by design: the mechanism shipped
 * before the data, and an empty table is an honest state.
 */
describe('product catalogue', () => {
  it('every product configures a part that exists', () => {
    for (const prod of allProducts()) {
      expect(getPart(prod.part), `${prod.id} names part ${prod.part}`).toBeTruthy()
    }
  })

  it('every product cites a source that can be opened', () => {
    for (const prod of allProducts()) {
      expect(prod.source, `${prod.id} has no source`).toBeTruthy()
      expect(prod.source, `${prod.id} source is not a URL`).toMatch(/^https?:\/\/\S+$/)
    }
  })

  it('only sets parameters its part actually has', () => {
    for (const prod of allProducts()) {
      const def = getPart(prod.part)
      if (!def) continue
      const keys = new Set(def.params.map((q) => q.key))
      for (const key of Object.keys(prod.params)) {
        expect(keys.has(key), `${prod.id} sets ${key}, which ${prod.part} does not have`).toBe(true)
      }
    }
  })

  it('states a body size in millimetres', () => {
    for (const prod of allProducts()) {
      expect(prod.size, `${prod.id} has no size`).toHaveLength(3)
      for (const mm of prod.size) {
        // Millimetres, not metres and not inches: a 0.31 here is a
        // projector the size of a grain of rice, and it would be drawn.
        expect(mm, `${prod.id} has an implausible dimension`).toBeGreaterThan(5)
        expect(mm, `${prod.id} has an implausible dimension`).toBeLessThan(5000)
      }
    }
  })

  it('gives every id once, in make-model form', () => {
    const seen = new Set<string>()
    for (const prod of allProducts()) {
      expect(seen.has(prod.id), `${prod.id} is registered twice`).toBe(false)
      seen.add(prod.id)
      expect(prod.id, `${prod.id} is not a slug`).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })

  it('lists its products against the part that uses them', () => {
    for (const prod of allProducts()) {
      expect(productsFor(prod.part).map((q) => q.id)).toContain(prod.id)
    }
  })
})
