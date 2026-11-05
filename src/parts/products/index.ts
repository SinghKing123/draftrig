/**
 * Registers every real product and nothing else.
 *
 * Imports no part and no geometry, so the marketing site and the tests
 * can count and check this data without the 3D engine.
 */
import './av'

export { GENERIC, allProducts, dictates, effective, getProduct, productOf, productOptions, productOf as chosenProduct, productSize, productsFor } from './registry'
export type { Product } from './types'
