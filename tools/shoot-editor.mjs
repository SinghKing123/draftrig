import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs the editor with its chrome on, which is the thing being judged.
 *
 * Every other shoot tool in here hides the interface to get a clean render of
 * a part. This one does the opposite: panels, top bar, inspector, console and
 * status bar, with a real build loaded, because the question it answers is
 * what the application looks like to use.
 *
 *   node tools/shoot-editor.mjs [starterId] [--empty] [--first-run]
 *
 * BASE  dev server (default http://localhost:5174)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/editor'

const args = process.argv.slice(2)
const empty = args.includes('--empty')
const firstRun = args.includes('--first-run')
const starter = args.find((a) => !a.startsWith('--')) ?? 'ps5-stand'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 })

/*
 * A returning user by default. The flags that say "you have been here"
 * are the whole difference between the first-run experience and the
 * everyday one, and the everyday one is what needs looking at most.
 */
if (!firstRun) {
  await page.addInitScript(() => {
    localStorage.setItem('tour.seen.v1', '1')
    localStorage.setItem('draftrig.nav.seen.v1', '1')
  })
}

const problems = []
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 200)))

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 30000 })

if (!empty) {
  await page.evaluate((id) => {
    const s = window.draftrig.starters.find((x) => x.id === id)
    if (!s) throw new Error('no starter ' + id)
    const d = window.draftrig.doc.getState()
    d.loadDoc(s.build())
    d.select([])
    d.requestFrame('all')
  }, starter)
  await page.waitForTimeout(3000)
  // Select something, so the inspector has content to show.
  await page.evaluate(() => {
    const d = window.draftrig.doc.getState()
    const first = d.doc.order[0]
    if (first) d.select([first])
  })
  await page.waitForTimeout(900)
}
// A workspace to switch to before the shutter, so each page can be seen.
const ws = process.env.WS
if (ws) {
  await page.evaluate((m) => window.draftrig.doc.getState().setMode(m), ws)
  await page.waitForTimeout(1400)
}
await page.waitForTimeout(600)

const tag = empty ? 'empty' : starter
const name = `${tag}${ws ? '-' + ws : ''}${firstRun ? '-first-run' : ''}.png`
await page.screenshot({ path: `${OUT}/${name}` })
console.log(`  ${name}${problems.length ? `\n  errors: ${problems.join('\n          ')}` : ''}`)

await browser.close()
