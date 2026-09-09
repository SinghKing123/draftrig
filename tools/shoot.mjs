// Visual smoke check: load the built app in Edge, drive it, capture screenshots
// and report any console/page errors.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = process.env.SHOT_DIR || 'shots'
mkdirSync(OUT, { recursive: true })
const URL = process.env.APP_URL || 'http://localhost:4173/app'

const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 })

const problems = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/01-empty.png` })

// Open the LED starter.
await page.getByText('LED on a breadboard').click()
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/02-led-build.png` })

// Select the resistor to exercise the inspector.
await page.getByText('Series resistor', { exact: false }).first().click().catch(() => {})
await page.waitForTimeout(400)

// Run the simulation.
await page.keyboard.press('Space')
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/03-led-sim.png` })

// Bill of materials.
await page.getByRole('button', { name: /Bill of materials/i }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/04-bom.png` })

// The frame starter, the mechanical side.
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await page.getByText('2020 frame cube').click()
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/05-frame.png` })

console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'No console errors.')
await browser.close()
