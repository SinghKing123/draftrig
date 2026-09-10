import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 900, height: 700 } })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
for (const id of process.argv.slice(2)) {
  await page.evaluate((s) => {
    const st = window.draftrig.starters.find((x) => x.id === s)
    window.draftrig.doc.getState().loadDoc(st.build())
  }, id)
  await page.waitForTimeout(900)
  const line = await page.locator('.statusbar, footer').first().innerText().catch(() => '')
  const m = line.match(/Mass\s+([\d.]+\s*\w+)/)
  const c = line.match(/cost\s+\$([\d,.]+)/i)
  console.log(id.padEnd(14), 'mass', (m ? m[1] : '?').padEnd(10), 'cost $' + (c ? c[1] : '?'))
}
await b.close()
