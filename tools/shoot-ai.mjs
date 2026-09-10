import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

await page.getByRole('button', { name: 'Assistant' }).click()
await page.waitForTimeout(500)
console.log('key prompt :', await page.locator('.assistant h3').innerText().catch(() => 'none'))
await page.screenshot({ path: 'ai-key.png' })

// Pretend a key is present so the compose view can be checked too.
await page.evaluate(() => localStorage.setItem('draftrig.ai.key', 'sk-ant-not-a-real-key'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.getByRole('button', { name: 'Assistant' }).click()
await page.waitForTimeout(500)
const chips = await page.locator('.ai-examples .chip').allInnerTexts()
console.log('examples   :', chips.length)
await page.locator('.ai-examples .chip').first().click()
await page.waitForTimeout(200)
console.log('prompt set :', JSON.stringify((await page.locator('.ai-input').inputValue()).slice(0, 40)))
await page.screenshot({ path: 'ai-panel.png' })
console.log('errors     :', errors.length ? errors : 'none')
await b.close()
