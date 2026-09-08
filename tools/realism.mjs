// Close-up render check: drop a few representative parts and look at them hard.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const problems = []
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
page.on('pageerror', (e) => problems.push(String(e.message)))

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)

async function addPart(name) {
  await page.locator('.search input').fill(name)
  await page.waitForTimeout(350)
  await page.locator('.part-item').first().click()
  await page.waitForTimeout(500)
}

for (const p of ['Resistor', 'LED', 'Electrolytic', '555']) await addPart(p)
await page.locator('.search .clear').click().catch(() => {})
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.keyboard.press('f')
await page.waitForTimeout(1800)

const canvas = await page.locator('canvas').first().boundingBox()
const cx = canvas.x + canvas.width / 2
const cy = canvas.y + canvas.height / 2
for (let i = 0; i < 8; i++) {
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -200)
  await page.waitForTimeout(70)
}
await page.waitForTimeout(2500)
await page.screenshot({ path: 'shots/10-parts-closeup.png' })

// Now the frame, for the metal.
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByText('2020 frame cube').click()
await page.waitForTimeout(2500)
for (let i = 0; i < 7; i++) {
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -200)
  await page.waitForTimeout(70)
}
await page.waitForTimeout(2500)
await page.screenshot({ path: 'shots/11-frame-closeup.png' })

console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'No console errors.')
await browser.close()
