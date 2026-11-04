import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * Records a build assembling itself, as a video file.
 *
 * This replaces the frame sequence the front page used to play by hand in a
 * canvas. That worked and it was the wrong tool: fifty JPEGs is fifty
 * requests and a megabyte and a half before anything moves, the browser
 * decodes them one at a time, and the page has to wait for all of them
 * before it dares start. A video is one request, hardware decoded, starts
 * on the first keyframe, and loops without any code.
 *
 * There is no ffmpeg on this machine, so the encode happens in the browser:
 * `canvas.captureStream()` feeds a MediaRecorder, and the blob that comes
 * back is a finished file. Chrome and Edge will write MP4 directly these
 * days; where they will not, this falls back to WebM.
 *
 *   node tools/record-build.mjs studio-desk --seed=3 --aim=420 --step=260
 *
 *   starter   id from window.draftrig.starters
 *   --seed    parts already placed before recording starts
 *   --aim     mm to lower the orbit centre, to seat the subject in frame
 *   --orbit   degrees of azimuth swept across the recording
 *   --step    milliseconds each part takes to arrive
 *   --hold    milliseconds held on the finished build at the end
 *
 * BASE  dev server (default http://localhost:5174)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const args = process.argv.slice(2)
const starter = args.find((a) => !a.startsWith('--')) ?? 'studio-desk'
const flag = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`))
  return hit ? Number(hit.split('=')[1]) : d
}

const SEED = flag('seed', 3)
const AIM = flag('aim', 420)
const ORBIT = flag('orbit', 26)
const STEP = flag('step', 260)
const HOLD = flag('hold', 2200)
const W = flag('w', 1280)
const H = flag('h', 800)

const OUT = 'public/clips'

const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ws, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats,
  .app-notice, .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
`

mkdirSync(OUT, { recursive: true })

/*
 * Headed, deliberately.
 *
 * A headless window composites nothing, and a canvas capture track in one
 * produces a single frame however it is driven — the first two recordings
 * came back a thirtieth of a second long. With a real window on a real
 * compositor the same code records properly. It opens a browser on the
 * desktop for about half a minute and closes it again.
 */
const browser = await chromium.launch({
  channel: 'msedge',
  headless: false,
  // Lets the page record the canvas without asking, and keeps the frame
  // rate up on a machine with no display attached.
  args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization'],
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.used.v1', '1')
})

const problems = []
page.on('pageerror', (e) => problems.push(e.message.slice(0, 160)))

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 30000 })
await page.addStyleTag({ content: BARE })
await page.evaluate(() => window.draftrig.doc.getState().setView({ grid: false, gizmo: false, ports: false }))

const order = await page.evaluate((id) => {
  const s = window.draftrig.starters.find((x) => x.id === id)
  if (!s) throw new Error('no starter ' + id)
  const d = window.draftrig.doc.getState()
  d.loadDoc(s.build())
  d.select([])
  d.requestFrame('all')
  return window.draftrig.doc.getState().doc.order.slice()
}, starter)
await page.waitForTimeout(3800)

await page.evaluate((aim) => {
  const c = window.draftrig.camera.controls
  c.target.y -= aim
  const t = c.target.clone()
  c.object.position.sub(t).multiplyScalar(0.7).add(t)
  c.update()
}, AIM)

const start = await page.evaluate(() => {
  const c = window.draftrig.camera.controls
  const dir = c.object.position.clone().sub(c.target)
  return { az: (Math.atan2(dir.x, dir.z) * 180) / Math.PI, pol: 68 }
})

/* Hide everything, then put back the seed. */
await page.evaluate(
  ({ seed }) => {
    const d = window.draftrig.doc.getState()
    for (const id of d.doc.order) if (!d.doc.instances[id].hidden) d.toggleHidden(id)
    const s = window.draftrig.doc.getState()
    for (const id of s.doc.order.slice(0, seed)) s.toggleHidden(id)
  },
  { seed: SEED },
)
await page.waitForTimeout(700)

/*
 * Record. The whole run happens inside one page call, because a recorder
 * started from node and driven from node drops frames every time control
 * crosses the bridge.
 */
const result = await page.evaluate(
  async ({ ids, step, hold, orbit, az, pol }) => {
    const canvas = document.querySelector('canvas')
    /*
     * A manually driven track.
     *
     * `captureStream(30)` asks the browser to sample the canvas on a timer,
     * and in a headless window it sampled it exactly once: the recording
     * came back one frame long. `captureStream(0)` hands over a track with
     * `requestFrame()`, which reads the drawing buffer on demand — legal
     * because the context is created with preserveDrawingBuffer — and a
     * rAF loop calling it is a reliable thirty frames a second.
     */
    const stream = canvas.captureStream(0)
    const track = stream.getVideoTracks()[0]
    let pumping = true
    const pump = () => {
      if (!pumping) return
      track.requestFrame()
      requestAnimationFrame(pump)
    }
    const types = [
      'video/mp4;codecs=avc1.4d002a',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm',
    ]
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t))
    if (!mime) return { error: 'no recorder type supported' }

    const chunks = []
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((r) => (rec.onstop = r))
    rec.start()
    requestAnimationFrame(pump)

    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const d = () => window.draftrig.doc.getState()
    const total = ids.length + 6

    for (let i = 0; i < ids.length; i++) {
      d().toggleHidden(ids[i])
      window.draftrig.camera.view(az + (orbit * i) / total, pol)
      await wait(step)
    }
    // Keep orbiting through the hold, so the last thing the loop shows is
    // the finished build moving rather than a freeze frame.
    const frames = Math.round(hold / 60)
    for (let i = 0; i < frames; i++) {
      window.draftrig.camera.view(az + (orbit * (ids.length + (i / frames) * 6)) / total, pol)
      await wait(60)
    }

    pumping = false
    rec.stop()
    await done
    const blob = new Blob(chunks, { type: mime })
    const buf = await blob.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buf)
    const CH = 0x8000
    for (let i = 0; i < bytes.length; i += CH) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
    }
    return { mime, base64: btoa(binary), bytes: bytes.length }
  },
  { ids: order.slice(SEED), step: STEP, hold: HOLD, orbit: ORBIT, az: start.az, pol: start.pol },
)

if (result.error) {
  console.log('recording failed:', result.error)
} else {
  const ext = result.mime.startsWith('video/mp4') ? 'mp4' : 'webm'
  const file = `${OUT}/build-${starter}.${ext}`
  writeFileSync(file, Buffer.from(result.base64, 'base64'))
  console.log(`${file}  ${(result.bytes / 1e6).toFixed(2)} MB  ${result.mime}`)

  /* A poster, so the frame is filled before a byte of video is fetched. */
  const poster = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.78))
  writeFileSync(`${OUT}/build-${starter}.jpg`, Buffer.from(poster.split(',')[1], 'base64'))
  console.log(`${OUT}/build-${starter}.jpg`)
}

if (problems.length) console.log('errors:\n  ' + problems.join('\n  '))
await browser.close()
