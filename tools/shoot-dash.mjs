import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs the signed-in dashboard.
 *
 * `projects-shot.mjs` does this too, but it first manufactures projects from
 * three starter ids that no longer exist, so it dies before it reaches the
 * page. This one just looks at the dashboard.
 *
 *   BASE=http://localhost:5174 node tools/shoot-dash.mjs [section]
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/editor'
const section = process.argv[2] ?? 'home'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1020 }, deviceScaleFactor: 1 })

const problems = []
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 180)))
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 180)) })

// The dashboard is behind an account; the dev user is the way in without one.
await page.addInitScript(() => {
  localStorage.setItem('draftrig.devuser.v1', '1')
  localStorage.setItem('tour.seen.v1', '1')
})
await page.goto(BASE + '/projects', { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

// An optional question, so the answering state can be photographed too.
const askFor = process.env.ASK
if (askFor) {
  await page.fill('.sp-input', askFor)
  await page.click('.sp-bar button[type=submit]')
  await page.waitForTimeout(1200)
}
await page.screenshot({ path: `${OUT}/dashboard-${section}.png`, fullPage: false })
console.log(`  dashboard-${section}.png${problems.length ? '\n  errors: ' + problems.join('\n          ') : ''}`)

await browser.close()
