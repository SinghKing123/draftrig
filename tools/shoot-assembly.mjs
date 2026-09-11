import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

/**
 * The hero animation: a frame and the electronics on it coming together.
 *
 * Rendered from the running editor and recorded off its own canvas, so the
 * landing page can show real parts at full quality without shipping a 3D engine
 * to everyone who visits. The alternative, a live scene on the page, costs
 * three.js plus the part kernel plus the catalog, which is most of a megabyte
 * for a page people mostly scroll past.
 *
 * Produces public/assembly.webm and a poster frame beside it.
 */

const base = process.env.BASE ?? 'http://localhost:4173'
const SECONDS = 10
const FPS = 30

const b = await chromium.launch({
  channel: 'msedge',
  args: ['--autoplay-policy=no-user-gesture-required'],
})
/*
 * Recorded at 1x. captureStream takes the canvas at its backing resolution, so
 * a 2x device pixel ratio records a 2560 wide video for a hero that is shown
 * about a thousand pixels wide, and costs three times the bytes for it.
 */
const page = await b.newPage({ viewport: { width: 1700, height: 940 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2600)

// The editor's own furniture has no business in a hero. Hide it for the take.
await page.addStyleTag({
  content: `
    .vp-toolbar, .vp-hint, .vp-stats, .ai-fab, .wire-palette, .vp-empty { display: none !important; }
    /* The canvas is what is being recorded, so give it the whole window. The
       side panels were squeezing it to a third of the width, and the video
       came out smaller than the space it is shown in. */
    .app-body { grid-template-columns: 1fr !important; }
    .app-body > aside, .app-body > .panel, .app-body > :last-child { display: none !important; }
    .app-body > .app-center { display: flex !important; flex-direction: column; }
    .app-center > :last-child { display: none !important; }
  `,
})

/* ------------------------------------------------------------------ */
/* Build the scene, then take it apart so it can come back together     */
/* ------------------------------------------------------------------ */

const plan = await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  d.loadDoc({ name: 'Assembly', instances: {}, order: [], connections: {}, connectionOrder: [] })

  const S = 170 // frame side, mm
  const H = 110 // post height
  const half = S / 2

  const put = (defId, pos, params, rot) => d.addPart(defId, pos, params)
  const ids = {}

  // Four corner posts.
  ids.posts = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const id = put('extrusion-tslot', [sx * half, 0, sz * half], { size: '2020', length: H, finish: 'alu-anod-black' })
      d.rotateInstance(id, [0, 0, 90], true)
      d.moveInstance(id, [sx * half, H / 2, sz * half], true)
      ids.posts.push(id)
    }
  }

  // Rails, bottom then top.
  const rail = (y, axis, sign) => {
    const id = put('extrusion-tslot', [0, y, 0], { size: '2020', length: S - 40, finish: 'alu-anod-black' })
    if (axis === 'z') d.rotateInstance(id, [0, 90, 0], true)
    d.moveInstance(id, axis === 'x' ? [0, y, sign * half] : [sign * half, y, 0], true)
    return id
  }
  ids.lower = [rail(10, 'x', -1), rail(10, 'x', 1), rail(10, 'z', -1), rail(10, 'z', 1)]
  ids.upper = [rail(H - 10, 'x', -1), rail(H - 10, 'x', 1), rail(H - 10, 'z', -1), rail(H - 10, 'z', 1)]

  // Deck.
  ids.deck = put('panel-sheet', [0, 20, 0], { material: 'plywood', width: S - 44, depth: S - 44, thickness: 12 })

  // Electronics standing on the deck.
  ids.board = put('mcu-board', [-18, 32, 26], { program: 'lcd-clock', text1: 'DRAFTRIG' })
  ids.lcd = put('display-lcd-character', [22, 32, -26], { format: '1602' })

  d.select([])
  d.requestFrame('all')
  return ids
})

await page.evaluate((ids) => { window.__ids = ids }, plan)
await page.waitForTimeout(1500)

// Fitting the document leaves the build small in a wide viewport.
{
  const box = await page.locator('canvas').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -220)
    await page.waitForTimeout(140)
  }
  await page.waitForTimeout(500)
}

// Remember where everything belongs, then scatter it.
const home = await page.evaluate(() => {
  const doc = window.draftrig.doc.getState().doc
  const out = {}
  for (const id of doc.order) out[id] = [...doc.instances[id].pos]
  return out
})

/* ------------------------------------------------------------------ */
/* The timeline                                                        */
/* ------------------------------------------------------------------ */

const order = [
  ...plan.posts.map((id, i) => ({ id, from: 0.25 + i * 0.12, lift: 260, out: 90 })),
  ...plan.lower.map((id, i) => ({ id, from: 1.05 + i * 0.1, lift: 150, out: 150 })),
  ...plan.upper.map((id, i) => ({ id, from: 1.75 + i * 0.1, lift: 230, out: 150 })),
  { id: plan.deck, from: 2.55, lift: 210, out: 0 },
  { id: plan.board, from: 3.1, lift: 150, out: 120 },
  { id: plan.lcd, from: 3.5, lift: 150, out: 120 },
]
const TRAVEL = 0.85

await page.evaluate(
  ([home, order]) => {
    // Park every part above and away from where it lives, so the first frame
    // is an empty bench rather than a finished build.
    const d = window.draftrig.doc.getState()
    const start = {}
    for (const step of order) {
      const p = home[step.id]
      const away = Math.hypot(p[0], p[2]) || 1
      start[step.id] = [
        p[0] + (p[0] / away) * step.out,
        p[1] + step.lift,
        p[2] + (p[2] / away) * step.out,
      ]
      d.moveInstance(step.id, start[step.id], false)
    }
    window.__assembly = { home, order, start }
  },
  [home, order],
)
await page.waitForTimeout(400)

/* ------------------------------------------------------------------ */
/* Record                                                              */
/* ------------------------------------------------------------------ */

console.log('recording', SECONDS, 'seconds...')

const dataUrl = await page.evaluate(
  async ([seconds, fps, travel]) => {
    const canvas = document.querySelector('canvas')
    const stream = canvas.captureStream(fps)
    const chunks = []
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_700_000 })
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.start()

    const { home, order, start } = window.__assembly
    const d = window.draftrig.doc.getState()
    const t0 = performance.now()
    // Cubic ease out: fast in, settles rather than stopping dead.
    const ease = (x) => 1 - Math.pow(1 - x, 3)

    let wired = false
    let powered = false

    await new Promise((resolve) => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000
        const updates = []
        for (const step of order) {
          const k = Math.min(1, Math.max(0, (t - step.from) / travel))
          const e = ease(k)
          const a = start[step.id]
          const bpos = home[step.id]
          updates.push({
            id: step.id,
            pos: [
              a[0] + (bpos[0] - a[0]) * e,
              a[1] + (bpos[1] - a[1]) * e,
              a[2] + (bpos[2] - a[2]) * e,
            ],
          })
        }
        d.transformInstances(updates, false)

        // Wires, once everything has landed.
        if (!wired && t > 4.3) {
          wired = true
          const s = window.draftrig.doc.getState()
          const ids = window.__ids
          const pairs = [
            ['v5', 'vdd', '#E34B4B'], ['gnd', 'vss', '#1C1F24'],
            ['v5', 'a', '#E34B4B'], ['gnd2', 'k', '#1C1F24'],
            ['gnd3', 'rw', '#1C1F24'], ['d12', 'rs', '#3DD68C'],
            ['d11', 'e', '#3DD68C'], ['d5', 'd4', '#4C8DFF'],
            ['d4', 'd5', '#4C8DFF'], ['d3', 'd6', '#4C8DFF'],
            ['d2', 'd7', '#4C8DFF'],
          ]
          for (const [a, bb, colour] of pairs) {
            s.connect(
              { instanceId: ids.board, portId: a },
              { instanceId: ids.lcd, portId: bb },
              { color: colour, gauge: 0.205 },
            )
          }
        }

        // Then switch it on, so the panel comes up before the clip ends.
        if (!powered && t > 4.6) {
          powered = true
          window.draftrig.engine.reset()
          window.draftrig.sim.getState().setRunning(true)
        }

        if (t >= seconds) {
          rec.stop()
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    await new Promise((r) => { rec.onstop = r })
    const blob = new Blob(chunks, { type: 'video/webm' })
    const buf = await blob.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    }
    return btoa(binary)
  },
  [SECONDS, FPS, TRAVEL],
)

writeFileSync('public/assembly.webm', Buffer.from(dataUrl, 'base64'))
console.log('wrote public/assembly.webm', Math.round(Buffer.from(dataUrl, 'base64').length / 1024), 'kB')

// A poster of the finished build, for before the video plays.
await page.waitForTimeout(600)
await page.locator('canvas').first().screenshot({ path: 'public/assembly-poster.png' })
console.log('wrote public/assembly-poster.png')
console.log('errors:', errors.length ? errors : 'none')
await b.close()
