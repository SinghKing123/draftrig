import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * The photographs the front page needs for the planning story.
 *
 * The existing `cine-*` set is a board, a message sign and an arcade
 * cabinet: true pictures of what the product used to be about. The page
 * now says the product lays out rooms, and a page that says that over a
 * photograph of a breadboard is a page arguing with its own evidence.
 *
 * Each shot here is a real template, framed by hand rather than by Fit,
 * with a couple of parameters overridden where the template's own finish
 * is wrong for a photograph — the theatre is painted matt black, which is
 * correct for a theatre and unreadable on a page.
 *
 *   node tools/shoot-plan-stills.mjs
 *
 * BASE  dev server (default http://localhost:5174)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'public/shots'

const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ws, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats,
  .app-notice, .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
`

/**
 * One photograph: a template, parameter overrides by part id, and where to
 * stand. `dolly` multiplies the distance Fit chose, `az` and `pol` are
 * degrees, and `aim` nudges the orbit centre in millimetres.
 */
const SHOTS = [
  {
    id: 'cine-plan-room',
    starter: 'home-theatre',
    set: { 'room-shell': { paint: 'grey', floor: 'carpet' } },
    dolly: 0.74,
    az: 28,
    pol: 70,
    aim: [0, 400, 0],
  },
  {
    id: 'cine-plan-seats',
    starter: 'home-theatre',
    set: { 'room-shell': { paint: 'grey', floor: 'carpet' } },
    /* From behind the back row, which is the view the sightline is about. */
    dolly: 0.38,
    az: 3,
    pol: 84,
    aim: [0, 900, -1400],
  },
  {
    id: 'cine-plan-desk',
    starter: 'studio-desk',
    set: {},
    dolly: 0.52,
    az: 34,
    pol: 72,
    aim: [0, 500, 0],
  },
]

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.used.v1', '1')
})
await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 30000 })
await page.addStyleTag({ content: BARE })
await page.evaluate(() => window.draftrig.doc.getState().setView({ grid: false, gizmo: false, ports: false }))

for (const shot of SHOTS) {
  await page.evaluate(
    ({ starter, set }) => {
      const d = window.draftrig.doc.getState()
      d.loadDoc(window.draftrig.starters.find((x) => x.id === starter).build())
      const s = window.draftrig.doc.getState()
      for (const id of s.doc.order) {
        const inst = s.doc.instances[id]
        const over = set[inst.defId]
        if (!over) continue
        for (const [k, v] of Object.entries(over)) s.setParam(id, k, v)
      }
      s.select([])
      s.requestFrame('all')
    },
    { starter: shot.starter, set: shot.set },
  )
  await page.waitForTimeout(3600)

  await page.evaluate(({ dolly, az, pol, aim }) => {
    const c = window.draftrig.camera.controls
    c.target.set(c.target.x + aim[0], c.target.y + aim[1], c.target.z + aim[2])
    const t = c.target.clone()
    c.object.position.sub(t).multiplyScalar(dolly).add(t)
    c.update()
    window.draftrig.camera.view(az, pol)
  }, shot)
  await page.waitForTimeout(1400)

  const data = await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return document.querySelector('canvas').toDataURL('image/jpeg', 0.84)
  })
  writeFileSync(`${OUT}/${shot.id}.jpg`, Buffer.from(data.split(',')[1], 'base64'))
  console.log(`  ${OUT}/${shot.id}.jpg`)
}

await browser.close()
