import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.getByRole('button', { name: 'Show me around', exact: true }).click()
await page.waitForTimeout(800)
const info = await page.evaluate(() => {
  const card = document.querySelector('.tour-card')
  const hole = document.querySelector('.tour-hole')
  const tour = document.querySelector('.tour')
  const d = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
      opacity: cs.opacity, display: cs.display, visibility: cs.visibility,
      zIndex: cs.zIndex, position: cs.position, transform: cs.transform,
      pointerEvents: cs.pointerEvents,
    }
  }
  const anims = (card?.getAnimations?.() ?? []).map((a) => ({
    name: a.animationName, playState: a.playState,
    currentTime: a.currentTime, startTime: a.startTime,
  }))
  return { tour: d(tour), hole: d(hole), card: d(card), anims, docAnims: document.getAnimations().length }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
