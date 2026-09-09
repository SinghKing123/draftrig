// Capture the hero screenshot for the landing page, then check the site itself.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs = []

// 1. The editor, running the 555 blinker, for the hero image.
const app = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
app.on('pageerror', (e) => errs.push('editor: ' + e.message))
app.on('console', (m) => { if (m.type() === 'error') errs.push('editor: ' + m.text()) })
await app.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await app.waitForTimeout(2500)
// The breadboard build reads best at a glance: dense, colourful, obviously
// electronics. Run it briefly so the LED is lit, then pause so the status bar
// is not advertising a software-renderer frame rate.
await app.getByText('LED on a breadboard').click()
await app.waitForTimeout(2500)
await app.keyboard.press('Space')
await app.waitForTimeout(2500)
await app.keyboard.press('f')
await app.waitForTimeout(2500)
const box = await app.locator('canvas').first().boundingBox()
for (let i = 0; i < 4; i++) {
  await app.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.46)
  await app.mouse.wheel(0, -200)
  await app.waitForTimeout(80)
}
await app.waitForTimeout(2500)
await app.keyboard.press('Space')
await app.waitForTimeout(600)
await app.screenshot({ path: 'public/hero.png' })
console.log('wrote public/hero.png')
await app.close()

// 2. The landing page.
const site = await browser.newPage({ viewport: { width: 1440, height: 900 } })
site.on('pageerror', (e) => errs.push('site: ' + e.message))
site.on('console', (m) => { if (m.type() === 'error') errs.push('site: ' + m.text()) })
await site.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await site.waitForTimeout(1500)
await site.screenshot({ path: 'shots/site-hero.png' })
await site.screenshot({ path: 'shots/site-full.png', fullPage: true })

// 3. Sign-in page.
await site.goto('http://localhost:4173/signin', { waitUntil: 'networkidle' })
await site.waitForTimeout(800)
await site.screenshot({ path: 'shots/site-signin.png' })

// 4. Projects page.
await site.goto('http://localhost:4173/projects', { waitUntil: 'networkidle' })
await site.waitForTimeout(1000)
await site.screenshot({ path: 'shots/site-projects.png' })

console.log(errs.length ? 'PROBLEMS:\n' + [...new Set(errs)].join('\n') : 'No console errors.')
await browser.close()
