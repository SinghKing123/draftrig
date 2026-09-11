import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const v = await page.evaluate(() => {
  const el = document.querySelector('.shot.stage video')
  if (!el) return { present: false }
  return {
    present: true,
    playing: !el.paused && el.currentTime > 0,
    currentTime: Number(el.currentTime.toFixed(2)),
    duration: Number.isFinite(el.duration) ? Number(el.duration.toFixed(1)) : null,
    w: el.videoWidth,
    h: el.videoHeight,
  }
})
console.log('video:', JSON.stringify(v))
await page.waitForTimeout(3000)
const later = await page.evaluate(() => {
  const el = document.querySelector('.shot.stage video')
  return el ? Number(el.currentTime.toFixed(2)) : null
})
console.log('time after 3s more:', later)
console.log('errors:', errors.length ? errors : 'none')
await page.screenshot({ path: 'hero-live.png' })
await b.close()
