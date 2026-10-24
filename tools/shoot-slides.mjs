import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * The panels in the front-page deck, every one the same size.
 *
 * The deck used to mix four video clips at 1280x720 with two screenshots at
 * the same aspect and four preset renders at 16:10, which meant every press
 * of the arrow changed the shape of the thing you were looking at. These are
 * one set, one size, one aspect: 1728 by 1080 at a device ratio of two.
 *
 * Two kinds of shot. A build is photographed from the bench with the chrome
 * hidden, the way tools/shoot-presets.mjs does it. A panel shot keeps the
 * chrome, because the chrome is the subject.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/shoot-slides.mjs
 *   BASE=http://localhost:5173 node tools/shoot-slides.mjs setup sign
 */

const base = process.env.BASE ?? 'http://localhost:5173'
const only = process.argv.slice(2)

/** 16:10, which is the shape the deck and the figure plates are already in. */
const W = 864
const H = 540

/**
 * build id, fill, azimuth, polar.
 *
 * Fill multiplies the distance the editor's own Fit settled on. The angles
 * are not shared with the preset cards on purpose: a card is a thumbnail and
 * wants the whole object, a deck panel is nearly full width and can come in.
 */
const BUILDS = [
  ['setup', 'desk-setup', 0.62, 24, 68],
  ['sign', 'message-board', 0.66, 6, 66],
  ['rack', 'shop-rack', 0.72, 34, 62],
  ['board', 'eight-bit', 0.54, 22, 44],
]

/** Builds whose displays need clocking before they read. */
const SETTLE = { setup: 2600, sign: 2600, board: 3000, rack: 700 }

const BARE = `
  .vp-toolbar, .vp-hint, .vp-stats, .vp-modes, .wire-colors, .bom-tab,
  .sketch-tab, .mbar, .vp-empty, .empty-hint { display: none !important; }
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .app-body > .panel, .app-body > .bom-panel, .app-body > .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
  .app-center > .console, .topbar, .statusbar { display: none !important; }
`

mkdirSync('public/slides', { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const errors = []

/* ---- the builds, photographed off the bench ---- */

const wanted = (id) => only.length === 0 || only.includes(id)

if (BUILDS.some(([id]) => wanted(id))) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    localStorage.setItem('tour.seen.v1', '1')
    localStorage.setItem('draftrig.nav.seen.v1', '1')
  })
  await page.goto(base + '/app', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await page.evaluate(() => {
    const d = window.draftrig.doc.getState()
    d.pinQuality('high')
    d.setView({ gizmo: false, grid: false, ports: false })
  })
  await page.addStyleTag({ content: BARE })
  // Hiding the panels widens the canvas, and the renderer finds out on resize.
  await page.waitForTimeout(400)
  await page.setViewportSize({ width: W - 1, height: H })
  await page.waitForTimeout(600)
  await page.setViewportSize({ width: W, height: H })
  await page.waitForTimeout(600)

  for (const [id, starter, fill, az, pol] of BUILDS) {
    if (!wanted(id)) continue
    const ok = await page.evaluate((s) => {
      const b = window.draftrig.starters.find((x) => x.id === s)
      if (!b) return false
      const d = window.draftrig.doc.getState()
      d.loadDoc(b.build())
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      d.select([])
      return true
    }, starter)
    if (!ok) {
      console.log(`no such build: ${starter}`)
      continue
    }
    await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
    await page.waitForTimeout(1700)
    await page.mouse.move(2, 2)
    await page.evaluate(() => {
      const d = window.draftrig.doc.getState()
      d.clearSelection()
      d.setHovered(null)
    })
    await page.waitForTimeout(600)
    await page.evaluate(([a, p, f]) => {
      window.draftrig.camera.view(a, p)
      const c = window.draftrig.camera.controls
      const v = c.object.position.clone().sub(c.target).multiplyScalar(f)
      c.object.position.copy(c.target).add(v)
      c.object.lookAt(c.target)
      c.update()
    }, [az, pol, fill])
    await page.waitForTimeout(SETTLE[id] ?? 900)
    await page.locator('canvas').first().screenshot({
      path: `public/slides/${id}.jpg`, type: 'jpeg', quality: 90, timeout: 90_000,
    })
    console.log(`wrote public/slides/${id}.jpg`)
  }
  await page.close()
}

/* ---- the two panel shots, which keep the chrome ---- */

/*
 * The two panels that keep the chrome, shot at a real desktop size.
 *
 * 1440 by 900 at a device ratio of 1.2, which lands on the same 1728 by 1080
 * as everything else. Shot at the deck's own 864 the editor's three columns
 * were crushed and the bill of materials fell off the right edge, so the
 * panel advertising the bill of materials did not contain one.
 *
 * The sketch editor is not here and cannot be: writing a sketch needs an
 * account, so shooting it signed out photographs the sign-in wall. The
 * build list takes its place, which is newer anyway.
 */
const PW = 1440
const PH = 900
const PANELS = [
  { id: 'editor', starter: 'desk-setup', tab: 'build' },
  { id: 'bom', starter: 'bench-clock', storage: 'draftrig.bom.open.v1' },
]

for (const panel of PANELS) {
  if (!wanted(panel.id)) continue
  const page = await browser.newPage({ viewport: { width: PW, height: PH }, deviceScaleFactor: 1.2 })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript((k) => {
    localStorage.setItem('tour.seen.v1', '1')
    localStorage.setItem('draftrig.nav.seen.v1', '1')
    if (k) localStorage.setItem(k, '1')
  }, panel.storage ?? '')
  await page.goto(`${base}/app?start=${panel.starter}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await page.evaluate(() => {
    window.draftrig.engine.reset()
    window.draftrig.sim.getState().setRunning(true)
  })
  if (panel.tab === 'build') {
    /* The build list, with something picked so the inspector has content. */
    await page.locator('.side-tabs button').nth(1).click().catch(() => {})
    await page.waitForTimeout(600)
    await page.locator('.out-row').nth(4).click().catch(() => {})
    await page.waitForTimeout(900)
  }
  await page.mouse.move(4, 4)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `public/slides/${panel.id}.jpg`, type: 'jpeg', quality: 92 })
  console.log(`wrote public/slides/${panel.id}.jpg`)
  await page.close()
}

console.log(errors.length ? `errors: ${[...new Set(errors)].slice(0, 4).join(' | ')}` : 'errors: none')
await browser.close()
