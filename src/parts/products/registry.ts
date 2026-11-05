import type { Params, Vec3 } from '../kernel/types'
import type { Product } from './types'

/**
 * Every real product the catalogue knows, by id.
 *
 * Deliberately free of any part import, so the data can be counted,
 * tested and listed without building geometry.
 */
const BY_ID = new Map<string, Product>()
const BY_PART = new Map<string, Product[]>()

/** The value of a product-bearing part's `model` param when it is generic. */
export const GENERIC = 'generic'

export function registerProducts(list: Product[]): void {
  for (const prod of list) {
    if (BY_ID.has(prod.id)) throw new Error(`duplicate product id: ${prod.id}`)
    BY_ID.set(prod.id, prod)
    const group = BY_PART.get(prod.part)
    if (group) group.push(prod)
    else BY_PART.set(prod.part, [prod])
  }
}

export function getProduct(id: string): Product | undefined {
  return BY_ID.get(id)
}

export function allProducts(): Product[] {
  return [...BY_ID.values()]
}

/** Every product that configures one part, make then model. */
export function productsFor(partId: string): Product[] {
  return [...(BY_PART.get(partId) ?? [])].sort((a, b) =>
    a.make === b.make ? a.model.localeCompare(b.model) : a.make.localeCompare(b.make),
  )
}

/**
 * The `model` param's options for a part.
 *
 * Always starts with Generic, which is the part as it has always been:
 * every figure under your own control, nothing claimed about any real
 * product. Choosing a model takes that control away on the figures the
 * product decides, which is the point of choosing it.
 */
export function productOptions(partId: string): { value: string; label: string }[] {
  return [
    { value: GENERIC, label: 'Generic, set it yourself' },
    ...productsFor(partId).map((p) => ({ value: p.id, label: `${p.make} ${p.model}` })),
  ]
}

/** The product a set of params names, if it names one that exists. */
export function productOf(p: Params): Product | undefined {
  const id = p.model
  return typeof id === 'string' && id !== GENERIC ? BY_ID.get(id) : undefined
}

/**
 * Params as the part should read them: the user's, with the chosen
 * product's figures laid over the top.
 *
 * The product wins. A part whose body is a real 312 mm wide and whose
 * brightness slider still said 2,500 lm would be a drawing of two
 * different projectors, so the fields a product decides are hidden in
 * the inspector while one is chosen — see `dictates`.
 */
export function effective(p: Params): Params {
  const prod = productOf(p)
  return prod ? { ...p, ...prod.params } : p
}

/** Whether a product is chosen and fixes this param key. */
export function dictates(p: Params, key: string): boolean {
  const prod = productOf(p)
  return !!prod && key in prod.params
}

/** The product's body size, when it gives one. */
export function productSize(p: Params): Vec3 | undefined {
  return productOf(p)?.size
}
