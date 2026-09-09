// A/B the render settings to find what is drawing the grid through solids.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

await page.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByText('2020 frame cube').click()
await page.waitForTimeout(2500)

const shot = async (label, patch) => {
  await page.evaluate((p) => window.twinbench.doc.getState().setView(p), patch)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `shots/ab-${label}.png`, clip: { x: 270, y: 45, width: 700, height: 600 } })
}

await shot('1-baseline', {})
await shot('2-postfx-off', { quality: 'off' })
await shot('3-postfx-on-nogrid', { quality: 'high', grid: false })
await shot('4-postfx-off-grid', { quality: 'off', grid: true })

console.log('done')
await browser.close()
