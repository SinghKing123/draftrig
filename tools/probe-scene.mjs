import { chromium } from 'playwright'

/**
 * Lists what a starter actually put in the scene, and where.
 *
 * For when a photograph is missing something that the template plainly
 * adds: the screen was absent from four interior shots of the theatre and
 * the question "is it off-camera, or is it not drawn" cannot be answered
 * by taking a fifth photograph.
 */

const base = process.env.BASE ?? 'http://localhost:5174'
const id = process.argv[2] ?? 'home-theatre'

const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 860, height: 538 } })
await page.goto(base + '/app', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)

const rows = await page.evaluate((starter) => {
  const s = window.draftrig.starters.find((x) => x.id === starter)
  const d = window.draftrig.doc.getState()
  d.loadDoc(s.build())
  const cur = window.draftrig.doc.getState()
  return cur.doc.order.map((iid) => {
    const inst = cur.doc.instances[iid]
    return {
      def: inst.defId,
      name: inst.name,
      pos: inst.pos.map((v) => Math.round(v)),
      hidden: !!inst.hidden,
      params: inst.defId === 'screen-projection' ? inst.params : undefined,
    }
  })
}, id)

for (const r of rows) {
  console.log(
    `${r.def.padEnd(20)} ${String(r.name).padEnd(16)} [${r.pos.join(', ')}]${r.hidden ? '  HIDDEN' : ''}` +
      (r.params ? `\n    ${JSON.stringify(r.params)}` : ''),
  )
}
console.log(`\n${rows.length} instances`)
await b.close()
