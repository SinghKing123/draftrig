import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * The front page's "Steps" row: one frame per stage of a project.
 *
 * Same rig as shoot-ui.mjs — panels on, first-run notice hidden — but
 * each frame is cropped to the part of the editor its stage is about,
 * because four of these share a row and a whole 1600-pixel editor at a
 * quarter of the page is a picture of panels. A crop of a screenshot is
 * still a screenshot: nothing is restyled except the notice.
 *
 *   node tools/shoot-steps.mjs [out/dir] [only,names]
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = process.argv[2] ?? 'public/shots/steps'
const ONLY = process.argv[3]

/*
 * name      the file
 * starter   the build loaded
 * cam       [azimuth, polar, fill] against the fitted distance
 * pick      defId to select, '*' for any, null for none
 * mode      the workspace
 * probes    [defId, portId, label] put on the scope, which opens it
 * window    scope window in seconds
 * board     the board to open in the Code workspace, by its label
 * vh        viewport height (the width is always 1600)
 * clip      the crop, from the top-left so the workspace tabs stay in
 *           frame; every clip is 13:9 so the row lines up
 */
const SHOTS = [
  {
    name: 'layout',
    starter: 'room-setup',
    cam: [34, 52, 0.66],
    pick: 'desk',
    mode: 'build',
    vh: 900,
    clip: { x: 0, y: 0, width: 1300, height: 900 },
  },
  {
    name: 'wire',
    starter: 'lcd',
    cam: [24, 50, 0.7],
    pick: null,
    mode: 'wire',
    vh: 900,
    clip: { x: 0, y: 0, width: 1300, height: 900 },
  },
  {
    name: 'code',
    starter: 'control-cabinet',
    cam: [30, 58, 0.82],
    pick: null,
    mode: 'code',
    board: 'ESP32',
    vh: 1000,
    clip: { x: 0, y: 0, width: 940, height: 651 },
  },
  {
    name: 'sim',
    starter: 'thrust-rig',
    cam: [32, 60, 0.74],
    pick: null,
    mode: 'sim',
    probes: [['mcu-board', 'd5', 'D5 throttle']],
    window: '0.01',
    /* Narrower than the others: Simulate adds a speed menu at the top
       right, and at 1300 the crop cut it in half. */
    vh: 866,
    clip: { x: 0, y: 0, width: 1250, height: 866 },
  },
]

/* Three times the widest a card gets on a desktop row. */
const MAX_W = 960

mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
await ctx.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.console.open.v1', '0')
})

for (const s of SHOTS) {
  if (ONLY && !ONLY.split(',').includes(s.name)) continue
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1600, height: s.vh ?? 1000 })
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
    const st = window.draftrig.starters.find((x) => x.id === id)
    window.draftrig.doc.getState().loadDoc(st.build())
    window.draftrig.engine.reset()
    window.draftrig.sim.getState().setRunning(true)
  }, s.starter)
  await page.waitForTimeout(2600)

  const fitted = await page.evaluate(() => {
    const c = window.draftrig.camera.controls
    return c.object.position.distanceTo(c.target)
  })
  await page.evaluate(
    ([az, pol, fill, d0]) => {
      window.draftrig.camera.view(az, pol)
      const c = window.draftrig.camera.controls
      const v = c.object.position.clone().sub(c.target).normalize().multiplyScalar(d0 * fill)
      c.object.position.copy(c.target).add(v)
      c.object.lookAt(c.target)
      c.update()
    },
    [s.cam[0], s.cam[1], s.cam[2], fitted],
  )

  if (s.pick) {
    await page.evaluate((defId) => {
      const st = window.draftrig.doc.getState()
      const id =
        defId === '*'
          ? st.doc.order[0]
          : st.doc.order.find((i) => st.doc.instances[i].defId === defId)
      if (id) st.select([id])
    }, s.pick)
  }

  await page.evaluate((m) => window.draftrig.doc.getState().setMode(m), s.mode)
  await page.waitForTimeout(800)

  /* The Code workspace opens on the first board in the build; the one
     with the sketch worth showing is picked from its list. */
  if (s.board) {
    await page.locator('.code-boards, aside, nav').getByText(s.board, { exact: true }).first().click()
    await page.waitForTimeout(500)
  }

  /* Probes the way a click on a terminal adds them, and the scope
     opened by its tab, since the drawer is not on the debug handle. */
  if (s.probes) {
    await page.evaluate((list) => {
      const st = window.draftrig.doc.getState()
      for (const [defId, port, label] of list) {
        const id = st.doc.order.find((i) => st.doc.instances[i].defId === defId)
        if (id) window.draftrig.sim.getState().addProbe({ label, key: `${id}:${port}`, color: '', kind: 'voltage' })
      }
    }, s.probes)
    await page.locator('button', { hasText: 'Scope' }).first().click()
    if (s.window) await page.selectOption('.scope-legend select', s.window)
  }

  await page.waitForTimeout(3500)
  /* Shot as PNG, then scaled and encoded once in the page's own canvas,
     so the JPEG is not compressed twice. */
  const png = await page.screenshot({ type: 'png', clip: s.clip })
  const jpg = await page.evaluate(
    async ([b64, maxW]) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const w = Math.min(maxW, img.naturalWidth)
      const h = Math.round((img.naturalHeight * w) / img.naturalWidth)
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      const g = cv.getContext('2d')
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, 0, 0, w, h)
      return cv.toDataURL('image/jpeg', 0.84).split(',')[1]
    },
    [png.toString('base64'), MAX_W],
  )
  writeFileSync(`${OUT}/${s.name}.jpg`, Buffer.from(jpg, 'base64'))
  const info = await page.evaluate(() => {
    const st = window.draftrig.doc.getState()
    const sim = window.draftrig.sim.getState()
    return {
      parts: st.doc.order.length,
      conns: Object.keys(st.doc.connections ?? {}).length,
      t: sim.time.toFixed(3),
    }
  })
  console.log(`${s.name}.jpg  ${s.starter}  ${JSON.stringify(info)}`)
  await page.close()
}

await b.close()
