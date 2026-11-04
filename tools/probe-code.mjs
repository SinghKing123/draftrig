import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5174'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1680, height: 1000 } })
await page.addInitScript(() => { localStorage.setItem('tour.seen.v1', '1'); localStorage.setItem('draftrig.used.v1', '1') })
await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function')
await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'lcd')
  window.draftrig.doc.getState().loadDoc(s.build())
})
await page.waitForTimeout(1500)
await page.evaluate(() => window.draftrig.doc.getState().setMode('code'))
await page.waitForTimeout(1500)
const out = await page.evaluate(() => {
  const body = document.querySelector('.app-body')
  const cs = getComputedStyle(body)
  const rows = [...body.children].map((el) => {
    const r = el.getBoundingClientRect()
    const c = getComputedStyle(el)
    return `${el.className.split(' ')[0].padEnd(16)} display=${c.display.padEnd(7)} pos=${c.position.padEnd(8)} col=${c.gridColumnStart}  x=${Math.round(r.x)} w=${Math.round(r.width)} y=${Math.round(r.y)} h=${Math.round(r.height)}`
  })
  return { cols: cs.gridTemplateColumns, bodyW: Math.round(body.getBoundingClientRect().width), rows }
})
console.log('grid-template-columns:', out.cols, ' body width:', out.bodyW)
for (const r of out.rows) console.log('  ' + r)
await b.close()
