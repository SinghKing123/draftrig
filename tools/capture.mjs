import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs = []

// Regenerate the hero screenshot from the current build.
const app = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
app.on('pageerror', (e) => errs.push('editor: ' + e.message))
await app.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await app.waitForTimeout(2500)
// Drive through the store rather than the onboarding UI: more robust, and it
// is the same path a saved project takes.
await app.evaluate(() => {
  const tb = window.twinbench
  const s = tb.starters.find((x) => x.id === 'led')
  tb.doc.getState().loadDoc(s.build())
  tb.engine.reset()
  localStorage.setItem('tour.seen.v1', '1')
})
await app.waitForTimeout(600)
await app.reload({ waitUntil: 'networkidle' })
await app.waitForTimeout(2500)
await app.evaluate(() => {
  const tb = window.twinbench
  const s = tb.starters.find((x) => x.id === 'led')
  tb.doc.getState().loadDoc(s.build())
  tb.engine.reset()
})
await app.waitForTimeout(2000)
await app.keyboard.press('Space')
await app.waitForTimeout(2500)
await app.keyboard.press('f')
await app.waitForTimeout(2200)
const b = await app.locator('canvas').first().boundingBox()
for (let i = 0; i < 4; i++) { await app.mouse.move(b.x + b.width * .52, b.y + b.height * .46); await app.mouse.wheel(0, -200); await app.waitForTimeout(80) }
await app.waitForTimeout(2200)
await app.keyboard.press('Space')
await app.waitForTimeout(600)
await app.screenshot({ path: 'public/hero.png' })
console.log('hero.png regenerated')
await app.close()

console.log(errs.length ? 'PROBLEMS: ' + [...new Set(errs)].join(' | ') : 'no errors')
await browser.close()
