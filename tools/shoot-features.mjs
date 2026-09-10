import { chromium } from 'playwright'

/**
 * Product imagery for the landing page.
 *
 * Photographed from the running editor rather than mocked up, so the page can
 * never show something the software does not do. Each shot is framed at the
 * thing it is illustrating instead of being a whole window shrunk down.
 */

const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2400)

const load = async (starter) => {
  await page.evaluate((s) => {
    const st = window.draftrig.starters.find((x) => x.id === s)
    window.draftrig.doc.getState().loadDoc(st.build())
    window.draftrig.engine.reset()
    window.draftrig.doc.getState().select([])
  }, starter)
  await page.waitForTimeout(1400)
}

const run = async (untilSeconds) => {
  await page.evaluate(() => window.draftrig.sim.getState().setRunning(true))
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    await page.waitForTimeout(400)
    if ((await page.evaluate(() => window.draftrig.sim.getState().time)) > untilSeconds) break
  }
}

/** Fitting a whole document leaves it small and dark; close in afterwards. */
const zoom = async (notches) => {
  const box = await page.locator('canvas').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < notches; i++) {
    await page.mouse.wheel(0, -220)
    await page.waitForTimeout(130)
  }
  await page.waitForTimeout(600)
}

const frameOn = async (match) => {
  await page.evaluate((m) => {
    const d = window.draftrig.doc.getState()
    const id = d.doc.order.find((i) => d.doc.instances[i].defId.includes(m))
    if (id) {
      d.select([id])
      d.requestFrame('selection')
    }
  }, match)
  await page.waitForTimeout(1300)
  await page.evaluate(() => window.draftrig.doc.getState().select([]))
  await page.waitForTimeout(400)
}

/* 1. A display, driven, close up. */
await load('lcd')
await run(0.45)
await frameOn('lcd')
await page.locator('canvas').first().screenshot({ path: 'public/feature-display.png' })
console.log('wrote feature-display.png')

/* 2. The checks panel, catching real problems. */
await load('pc-sff')
await page.waitForTimeout(1600)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => /Checks/.test(b.textContent ?? ''))
  el?.click()
})
await page.waitForTimeout(600)
await page.locator('.console, .app-center > :last-child').last().screenshot({ path: 'public/feature-checks.png' })
console.log('wrote feature-checks.png')

/* 3. A whole machine. The open build rather than a gaming one: the tower is a
   large dark box that pulls the camera back and leaves the parts unlit. */
await load('pc')
await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
await page.waitForTimeout(1400)
await zoom(3)
await page.locator('canvas').first().screenshot({ path: 'public/feature-pc.png' })
console.log('wrote feature-pc.png')

/* 4. Structure, which is the half nobody expects. */
await load('frame')
await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
await page.waitForTimeout(1400)
await zoom(2)
await page.locator('canvas').first().screenshot({ path: 'public/feature-frame.png' })
console.log('wrote feature-frame.png')

/* 5. The parts library. */
await page.evaluate(() => {
  const groups = document.querySelectorAll('.lib-group[data-open="false"]')
  for (let i = 0; i < 3 && i < groups.length; i++) groups[i].click()
})
await page.waitForTimeout(500)
await page.locator('.panel').first().screenshot({ path: 'public/feature-parts.png' })
console.log('wrote feature-parts.png')

console.log('errors:', errors.length ? errors : 'none')
await b.close()
