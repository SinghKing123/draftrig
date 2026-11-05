import { registerProducts } from './registry'
import type { Product } from './types'

/**
 * Real AV products, by make and model.
 *
 * Add rows here. Every field except `notes` and `checked` is needed, and
 * `source` has to be a page that actually states the figures — a
 * manufacturer spec sheet or product page, not a retailer listing, which
 * goes out of date and gets the depth wrong by including the box.
 *
 * A complete row looks like this:
 *
 *     {
 *       id: 'benq-w2700',
 *       part: 'projector',
 *       make: 'BenQ',
 *       model: 'W2700',
 *       size: [380, 127, 263],
 *       mass: 4.2,
 *       price: 1100,
 *       params: {
 *         lumens: '2000',
 *         throw: 1.13,
 *         shift: 10,
 *         source: 'lamp',
 *         aspect: '16:9',
 *       },
 *       source: 'https://www.benq.com/en-us/projector/.../specifications.html',
 *       checked: '2026-11-05',
 *       notes: 'Vertical shift only, and not much of it: plan the mount height.',
 *     }
 *
 * The keys inside `params` are the part's own parameter keys. For the
 * projector they are in `setup2.ts`: lumens, throw, image, aspect, gain,
 * hours, source, shift. Anything left out stays adjustable, which is
 * right for the ones that describe the room rather than the product —
 * image width and screen gain belong to your wall, not to the projector.
 *
 * `size` is the body in mm, width by height by depth, as the maker gives
 * it. That is what makes the thing worth having: a shelf is built to a
 * depth, and 263 mm either fits or it does not.
 *
 * Figures must come from the source, not from memory. A wrong number
 * here is worse than a missing one, because it is a shelf cut to it.
 */
const AV: Product[] = []

registerProducts(AV)
