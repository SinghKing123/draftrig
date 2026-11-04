import '@/parts'
import { allParts, defaultParams } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'

/**
 * Prints the box each part declares in its default configuration.
 *
 * Wiring a model to a part is arithmetic against this number: the mesh has
 * one shape and the part has another, and `planFit` only draws the mesh where
 * the two agree. Reading the box off the source means reading the solids
 * function in your head, so this asks the kernel instead.
 *
 *   npx vite-node tools/probe-boxes.ts [idSubstring ...]
 */

const want = process.argv.slice(2)
const defs = allParts().filter((d) => !want.length || want.some((w) => d.id.includes(w)))
for (const d of defs.sort((a, b) => a.id.localeCompare(b.id))) {
  const b = buildPart(d, defaultParams(d)).body
  const dim = (lo: number, hi: number) => Math.round(hi - lo)
  console.log(
    `${d.id.padEnd(24)} ${String(dim(b.min.x, b.max.x)).padStart(5)} x ${String(dim(b.min.y, b.max.y)).padStart(5)} x ${String(dim(b.min.z, b.max.z)).padStart(5)}` +
      `   y ${Math.round(b.min.y)}..${Math.round(b.max.y)}   ${d.model ? 'has model' : ''}`,
  )
}
