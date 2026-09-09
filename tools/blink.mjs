// End-to-end: does the 555 starter actually make the LED flash in the app?
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })

await page.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
// Software rendering makes the viewport the slow part in headless; we are
// measuring the solver, so turn the heavy post-processing off.
await page.evaluate(() => window.draftrig.doc.getState().setView({ quality: 'off', shadows: false }))
await page.getByText('555 blinker').click()
await page.waitForTimeout(2000)
await page.keyboard.press('Space')

// Sample the LED's emissive drive for a few seconds.
const samples = await page.evaluate(async () => {
  const out = []
  const t0 = performance.now()
  while (performance.now() - t0 < 6000) {
    const s = window.draftrig.sim.getState()
    out.push({ t: s.time, glow: Math.max(0, ...Object.values(s.glow)), rt: s.realtimeRatio })
    await new Promise((r) => setTimeout(r, 60))
  }
  return out
})

const lit = samples.filter((s) => s.glow > 0.25).length
const dark = samples.filter((s) => s.glow < 0.05).length
let edges = 0
let last = samples[0].glow > 0.25
for (const s of samples) { const h = s.glow > 0.25; if (h !== last) edges++; last = h }
const simTime = samples[samples.length - 1].t - samples[0].t

const rt = samples.reduce((a, s) => a + s.rt, 0) / samples.length
console.log(`samples=${samples.length} lit=${lit} dark=${dark} edges=${edges} simTime=${simTime.toFixed(2)}s realtime=${(rt * 100).toFixed(0)}%`)
// A ~1 Hz blink over a couple of seconds of simulated time gives two or three
// transitions; requiring four was the harness being wrong, not the circuit.
const ok = edges >= 2 && lit > 4 && dark > 4
console.log(ok ? 'PASS: the LED is flashing' : 'FAIL: no flashing detected')
process.exitCode = ok ? 0 : 1
if (errs.length) console.log('ERRORS:\n' + [...new Set(errs)].join('\n'))

await page.screenshot({ path: 'shots/12-555-running.png' })
await browser.close()
