import { STARTERS } from '@/io/starters'
import { allParts, getPart } from '@/parts/kernel/registry'
import '@/parts'

/**
 * Real figures for every starter, for the front page's gallery captions.
 *
 * The captions under those renders have to be numbers the editor
 * actually produces, not numbers that sound right — the whole claim of
 * the page is that every figure on it is reproducible by opening the
 * thing it describes. This builds each starter the way the editor does
 * and counts what came out.
 *
 *   npx vite-node tools/probe-builds.ts
 */

void allParts

const rows = STARTERS.map((s) => {
  const doc = s.build()
  const parts = doc.order.length
  const conns = doc.connectionOrder.length

  /* Watts, where a part declares them. Most electronics parts do not —
     a resistor's dissipation is a result, not a property — so this is
     reported only when the build is actually a mains build. */
  let watts = 0
  for (const id of doc.order) {
    const inst = doc.instances[id]
    const def = getPart(inst.defId)
    const p = { ...(def?.defaults ?? {}), ...inst.params } as Record<string, unknown>
    const w = p.watts ?? p.power ?? p.draw
    if (typeof w === 'number') watts += w
  }

  /* The bounding box of everything placed, in millimetres. */
  let lo = [Infinity, Infinity, Infinity]
  let hi = [-Infinity, -Infinity, -Infinity]
  for (const id of doc.order) {
    const p = doc.instances[id].pos
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p[i])
      hi[i] = Math.max(hi[i], p[i])
    }
  }
  const span = lo[0] === Infinity ? [0, 0, 0] : hi.map((h, i) => Math.round(h - lo[i]))

  return { id: s.id, title: s.title, kind: s.kind, parts, conns, watts, span, blurb: s.blurb }
})

rows.sort((a, b) => b.parts - a.parts)
for (const r of rows) {
  console.log(
    `${r.id.padEnd(18)} ${r.kind.padEnd(8)} ${String(r.parts).padStart(3)} parts ` +
      `${String(r.conns).padStart(3)} conns ${String(r.watts).padStart(5)} W  ` +
      `${r.span.join(' x ').padEnd(22)} ${r.title}`,
  )
}
console.log(`\n${rows.length} starters`)
