import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

console.log('url after opening /app :', page.url())

// Build something.
await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  d.addPart('resistor-axial', [0, 0, 0])
  d.addPart('led-5mm', [30, 0, 0])
})
await page.waitForTimeout(3000)
console.log('save indicator         :', await page.locator('.topbar span').filter({ hasText: /Saved|Saving|Error/ }).first().innerText().catch(() => 'not found'))
console.log('url after editing      :', page.url())

const stored = await page.evaluate(() => {
  const idx = localStorage.getItem('draftrig.projects')
  return idx ? JSON.parse(idx) : null
})
console.log('projects in storage    :', stored ? stored.length : 0, stored ? JSON.stringify(stored[0]) : '')

// Can the name be changed?
const title = page.locator('.topbar input, .topbar .doc-name').first()
console.log('name is editable       :', await title.count() > 0 ? await title.evaluate((e) => e.tagName) : 'no field found')

// Does the projects page show it?
await page.goto(base + '/projects', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const cards = await page.locator('.proj').count()
console.log('cards on /projects     :', cards)
if (cards) console.log('first card             :', (await page.locator('.proj').first().innerText()).replace(/\n/g, ' | '))

// Reopen it and check the parts came back.
if (cards) {
  await page.locator('.proj').first().click()
  await page.waitForTimeout(2600)
  console.log('reopened url           :', page.url())
  console.log('parts after reopen     :', await page.evaluate(() => window.draftrig.doc.getState().doc.order.length))
}
console.log('errors                 :', errors.length ? errors : 'none')
await b.close()
