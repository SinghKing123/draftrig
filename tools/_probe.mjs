import { chromium } from 'playwright'
const OUT = process.env.OUT
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1300, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message))
page.on('console', m => { if (m.type()==='error' && !/glBlit|X3595/.test(m.text())) errs.push('CONSOLE ' + m.text()) })
await page.goto('http://localhost:5173/app?start=bench-clock', { waitUntil: 'networkidle' })
await page.evaluate(() => { localStorage.setItem('tour.seen.v1','1'); localStorage.setItem('draftrig.nav.seen.v1','1') })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(6000)
console.log('parts on bench:', await page.evaluate(() => window.draftrig.doc.getState().doc.order.length))
console.log('catalog size  :', await page.evaluate(async () => (await import('/src/parts/catalog/index.ts')).allParts().length))
console.log('sections      :', await page.evaluate(async () => {
  const m = await import('/src/parts/catalog/index.ts')
  return [...new Set(Object.values(m.CATEGORY_META).map(c => c.section))].join(', ')
}))
await page.screenshot({ path: `${OUT}/after-cull.png` })
console.log('errors:', errs.length ? errs : 'none')
await b.close()
