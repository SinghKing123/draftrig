import '@/parts'
import { allParts, defaultParams, CATEGORY_META } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'

/**
 * Writes the front page's catalogue strip as real data.
 *
 * The strip is the one section of that page that cannot be written: it is a
 * list of what is actually in the product, at the sizes the product actually
 * holds, and a hand-typed version of it goes stale the first time a part
 * changes. This prints it for pasting, with the section each part belongs to
 * and the box it occupies in its default configuration.
 *
 *   npx vite-node tools/probe-catalogue.ts > /dev/null   (to check it runs)
 */

const PICK = [
  'room-shell', 'screen-projection', 'seating-cinema', 'speaker-surround', 'receiver-av',
  'projector', 'riser-seating', 'desk', 'monitor-desk', 'chair-task', 'rug-floor',
  'plant-potted', 'panel-acoustic', 'rack-network', 'nas-enclosure', 'access-point',
  'printer-3d', 'oscilloscope', 'station-solder', 'monitor-studio', 'mic-condenser',
  'tv-set', 'soundbar', 'pc-tower', 'console-game', 'extension-lead', 'outlet-mains',
  'heater-fan', 'door-interior', 'window-casement', 'shelf-wall', 'strip-cob-24v',
]

const byId = new Map(allParts().map((d) => [d.id, d]))
const rows: string[] = []
for (const id of PICK) {
  const def = byId.get(id)
  if (!def) {
    console.error(`missing ${id}`)
    continue
  }
  const b = buildPart(def, defaultParams(def)).body
  const w = Math.round(b.max.x - b.min.x)
  const h = Math.round(b.max.y - b.min.y)
  const d = Math.round(b.max.z - b.min.z)
  const meta = CATEGORY_META[def.category]
  rows.push(`  { name: ${JSON.stringify(def.name)}, where: ${JSON.stringify(meta?.label ?? def.category)}, size: '${w} x ${h} x ${d}' },`)
}
console.log(`/* ${allParts().length} parts in the catalogue. */`)
console.log('export const SHELF = [')
console.log(rows.join('\n'))
console.log(']')
