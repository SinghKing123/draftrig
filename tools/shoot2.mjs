import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const problems = []
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
page.on('pageerror', (e) => problems.push(String(e.message)))

await page.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await page.getByText('LED on a breadboard').click()
await page.waitForTimeout(2000)

// Select the LED via the search box + library is awkward; use the scene store.
await page.evaluate(() => {
  const ids = Object.values(window.__doc?.getState?.().doc.instances ?? {})
  return ids.length
})

// Run, then frame the whole build and zoom in with the wheel.
await page.keyboard.press('Space')
await page.waitForTimeout(1200)
await page.keyboard.press('f')
await page.waitForTimeout(1200)
const box = await page.locator('canvas').first().boundingBox()
for (let i = 0; i < 12; i++) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45)
  await page.mouse.wheel(0, -220)
  await page.waitForTimeout(60)
}
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shots/06-led-closeup.png' })

// Bill of materials.
await page.getByRole('button', { name: /Bill of materials/i }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/07-bom.png' })

console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'No console errors.')
await browser.close()
