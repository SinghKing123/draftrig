import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * The editor with its panels on, for the front page.
 *
 * The preset shooter does the opposite — it hides every panel so the
 * render stands alone — and the front page needs both. A bare render
 * shows what the thing looks like; only a frame with the parts tree,
 * the inspector and the status bar in it shows what the product is.
 *
 * Panels are left alone rather than styled away, so these are
 * screenshots in the ordinary sense. The one thing injected is a rule
 * hiding the first-run notice, which is a thing a first-time visitor
 * sees and a screenshot should not carry.
 *
 * `page.screenshot` is safe here, unlike in the preset shooter: that
 * one photographs a bare canvas, where the composited surface can come
 * back stale, while the viewport runs with preserveDrawingBuffer so a
 * full-page grab composites correctly.
 *
 *   node tools/shoot-ui.mjs out/dir
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = process.argv[2] ?? 'public/shots/ui'

/* starter, file, camera [azimuth, polar, fill], part to select, workspace */
const SHOTS = [
  ['studio-desk', 'ui-desk', [38, 64, 0.72], 'desk', 'build'],
  ['esp-weather', 'ui-code', [30, 58, 0.8], 'board-esp32', 'code'],
  ['eight-bit', 'ui-wire', [26, 56, 0.85], null, 'wire'],
  ['home-theatre', 'ui-theatre', { at: [1100, 1800, 2200], to: [2600, 1400, 6450] }, 'receiver-av', 'build'],
  ['home-theatre', 'ui-seats', { at: [2400, 1500, 300], to: [2400, 1200, 6540] }, 'seating-cinema', 'build'],

  /* The carousel: planning and electronics alternating, none of them a
     build that already appears elsewhere on the page in the same form. */
  ['shop-rack', 'car-1', [36, 62, 0.78], '*', 'build'],
  ['matrix', 'car-2', [28, 56, 0.8], '*', 'wire'],
  ['desk-setup', 'car-3', [40, 64, 0.76], '*', 'build'],
  ['control-cabinet', 'car-4', [30, 58, 0.82], '*', 'wire'],
  ['workbench', 'car-5', [34, 62, 0.78], '*', 'build'],
  ['quadcopter', 'car-6', [32, 58, 0.8], '*', 'build'],
  ['message-board', 'car-7', [30, 60, 0.8], '*', 'build'],
  ['pi-case', 'car-8', [34, 58, 0.82], '*', 'build'],
]

mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
await ctx.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})

for (const [starter, name, cam, pick, workspace] of SHOTS) {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 140)))
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await page.addStyleTag({ content: `.app-notice, .ai-fab { display: none !important; }` })
  await page.evaluate(() => {
    const d = window.draftrig.doc.getState()
    d.pinQuality('high')
    d.setView({ gizmo: false, ports: false })
  })

  await page.evaluate((id) => {
    const s = window.draftrig.starters.find((x) => x.id === id)
    window.draftrig.doc.getState().loadDoc(s.build())
    window.draftrig.engine.reset()
    window.draftrig.sim.getState().setRunning(true)
  }, starter)
  await page.waitForTimeout(2600)

  /* The fitted distance, read after the load, so the orbit shots pull
     in from where Fit put the camera rather than from the last shot. */
  const fitted = await page.evaluate(() => {
    const c = window.draftrig.camera.controls
    return c.object.position.distanceTo(c.target)
  })

  if (Array.isArray(cam)) {
    await page.evaluate(
      ([az, pol, fill, d0]) => {
        window.draftrig.camera.view(az, pol)
        const c = window.draftrig.camera.controls
        const v = c.object.position.clone().sub(c.target).normalize().multiplyScalar(d0 * fill)
        c.object.position.copy(c.target).add(v)
        c.object.lookAt(c.target)
        c.update()
      },
      [cam[0], cam[1], cam[2], fitted],
    )
  } else {
    await page.evaluate(({ at, to }) => {
      const c = window.draftrig.camera.controls
      c.target.set(to[0], to[1], to[2])
      c.object.position.set(at[0], at[1], at[2])
      c.object.lookAt(c.target)
      c.update()
    }, cam)
  }

  /* Select something, so the inspector has a part in it. An empty
     inspector is a screenshot of the product not being used. */
  if (pick) {
    await page.evaluate((defId) => {
      const st = window.draftrig.doc.getState()
      /* '*' means "anything": an empty inspector is a screenshot of the
         product not being used, and for most builds it does not matter
         which part is in it. */
      const id =
        defId === '*'
          ? st.doc.order[0]
          : st.doc.order.find((i) => st.doc.instances[i].defId === defId)
      if (id) st.select([id])
    }, pick)
  }

  /* The workspace last, so the panels it opens are laid out against a
     camera and a selection that are already settled. */
  await page.evaluate((m) => window.draftrig.doc.getState().setMode(m), workspace ?? 'build')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 })
  const check = await page.evaluate(() => {
    const cv = document.querySelector('canvas')
    return { w: cv.width, h: cv.height, parts: window.draftrig.doc.getState().doc.order.length }
  })
  console.log(`${name}.jpg  canvas ${check.w}x${check.h}  ${check.parts} parts`)
  await page.close()
}

await b.close()
