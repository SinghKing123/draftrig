import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import '@/parts'
import { buildPart, defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import { registerProducts } from '@/parts/products/registry'
import { dictates, effective, productOf } from '@/parts/products'

/**
 * That choosing a model actually changes the thing on the bench.
 *
 * The point of the product layer is the body: a projector you are about
 * to buy is a specific number of millimetres deep, and that is what
 * decides whether the shelf you are drawing will take it. A layer that
 * only changed a label would be decoration.
 *
 * Registered here rather than in `av.ts` because it is a fixture, not a
 * product: the figures are made up, which is exactly what must never
 * appear in the shipped catalogue.
 */
registerProducts([
  {
    id: 'fixture-testbeam',
    part: 'projector',
    make: 'Fixture',
    model: 'Testbeam',
    size: [312, 111, 246],
    mass: 4.2,
    price: 1234,
    params: { lumens: '2000', throw: 1.13, shift: 60, source: 'lamp' },
    source: 'https://example.invalid/fixture-testbeam',
    checked: '2026-11-05',
  },
])

const def = () => requirePart('projector')
const withModel = (id: string) => ({ ...defaultParams(def()), model: id })

/** The built part's size in mm, which is what a shelf has to clear. */
function sizeOf(params: ReturnType<typeof withModel>): THREE.Vector3 {
  const built = buildPart(def(), params)
  return built.bbox.getSize(new THREE.Vector3())
}

describe('a product applied to a part', () => {
  it('draws the body at the size the maker states', () => {
    const size = sizeOf(withModel('fixture-testbeam'))
    // The lens barrel and feet stand proud of the case, so the bounding
    // box is a little larger than the body. The case is what is being
    // checked, so allow for the fittings and no more.
    expect(size.x).toBeGreaterThanOrEqual(312)
    expect(size.x).toBeLessThan(312 + 40)
    expect(size.z).toBeGreaterThanOrEqual(246)
    expect(size.z).toBeLessThan(246 + 40)
  })

  it('is a different size from the generic part', () => {
    const real = sizeOf(withModel('fixture-testbeam'))
    const generic = sizeOf(withModel('generic'))
    expect(real.z).not.toBeCloseTo(generic.z, 0)
  })

  it('overrides the figures it fixes and leaves the rest alone', () => {
    const p = { ...withModel('fixture-testbeam'), image: 3000 }
    const q = effective(p)
    expect(q.throw).toBe(1.13)
    expect(q.shift).toBe(60)
    // Image width is the wall's, not the projector's, so it stays yours.
    expect(q.image).toBe(3000)
  })

  it('hides the fields the product decides, and only those', () => {
    const p = withModel('fixture-testbeam')
    expect(dictates(p, 'throw')).toBe(true)
    expect(dictates(p, 'lumens')).toBe(true)
    expect(dictates(p, 'image')).toBe(false)
    const spec = def().params.find((q) => q.key === 'throw')
    expect(spec?.showIf?.(p)).toBe(false)
    expect(spec?.showIf?.(withModel('generic'))).toBe(true)
  })

  it('takes the real weight and price', () => {
    const p = withModel('fixture-testbeam')
    expect(def().mass?.(p)).toBeCloseTo(4200, 0)
    expect(def().price?.(p)).toBe(1234)
    expect(productOf(p)?.make).toBe('Fixture')
  })

  it('leaves the generic part exactly as it was', () => {
    const p = withModel('generic')
    expect(productOf(p)).toBeUndefined()
    expect(effective(p)).toEqual(p)
  })
})
