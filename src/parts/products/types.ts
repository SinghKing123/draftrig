import type { Params, Vec3 } from '../kernel/types'

/**
 * A real product you can go and buy.
 *
 * The catalogue's parts are generic on purpose: a projector is a throw
 * ratio and a lumen figure, and one box serves all of them. That is the
 * right model for learning what a room needs and the wrong one for
 * deciding what to order, because by then you have chosen the thing and
 * the question is whether that thing fits.
 *
 * A product is the second half: a named make and model that fixes the
 * generic part's parameters to the real ones and its body to the real
 * size. It is data, not geometry. No manufacturer mesh is shipped and
 * none is needed — the mesh answers what it looks like, and the
 * questions people actually have before buying are how big it is, how
 * far back it goes, what it weighs, what it draws and what sockets it
 * has. Those are specifications, and specifications are facts.
 *
 * Every entry carries where its numbers came from, and a test enforces
 * it. A spec database nobody can check is worse than no database: a
 * wrong figure here becomes a shelf built to the wrong depth.
 */
export interface Product {
  /** Stable id, `make-model` lowercased and hyphenated. */
  id: string
  /** The `PartDef` this configures. */
  part: string
  make: string
  model: string
  /**
   * Body size in mm, width by height by depth, as the maker states it.
   * Excluding feet and lens barrel unless the maker includes them.
   */
  size: Vec3
  /** Kilograms. */
  mass?: number
  /** Typical street price in the catalogue's currency. */
  price?: number
  /**
   * Parameter values this product fixes, by the part's own param keys.
   * Anything absent stays under the user's control.
   */
  params: Params
  /** Where the numbers came from. A URL, and a real one. */
  source: string
  /** ISO date the figures were last checked against that source. */
  checked?: string
  /** Anything a buyer would want flagged: no lens shift, loud, huge. */
  notes?: string
}
