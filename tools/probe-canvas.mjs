import { chromium } from 'playwright'

/**
 * Reports the size of the editor's canvas under the shooting stylesheet.
 *
 * The preset photographs came out 1718 x 300 — a letterbox strip rather
 * than the 16:10 card they are framed for — and a strip is what you get
 * when the canvas element's own box is a strip, whatever the camera is
 * doing. This prints the box, the drawing buffer and the grid tracks
 * around it, so the collapse can be found rather than guessed at.
 */

const base = process.env.BASE ?? 'http://localhost:5174'
const BARE = `
  .vp-toolbar, .vp-hint, .vp-stats, .vp-modes, .wire-colors, .bom-tab,
  .sketch-tab, .mbar, .vp-empty, .empty-hint { display: none !important; }
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .app-body > .panel, .app-body > .bom-panel, .app-body > .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
  .app-center > .console, .topbar, .statusbar { display: none !important; }
`

const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 860, height: 538 }, deviceScaleFactor: 2 })
await page.goto(base + '/app', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)

const before = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const r = c.getBoundingClientRect()
  return { css: [Math.round(r.width), Math.round(r.height)], buf: [c.width, c.height] }
})

await page.addStyleTag({ content: BARE })
await page.waitForTimeout(600)
const vp = page.viewportSize()
await page.setViewportSize({ width: vp.width - 1, height: vp.height })
await page.waitForTimeout(900)

const after = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const r = c.getBoundingClientRect()
  /* Walk up from the canvas, so whichever ancestor is the short one shows. */
  const chain = []
  for (let el = c; el && el !== document.body; el = el.parentElement) {
    const b2 = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    chain.push(
      `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ` +
        `${Math.round(b2.width)}x${Math.round(b2.height)} display=${st.display} rows=${st.gridTemplateRows}`,
    )
  }
  return { css: [Math.round(r.width), Math.round(r.height)], buf: [c.width, c.height], chain }
})

console.log('before bare:', JSON.stringify(before))
console.log('after  bare:', JSON.stringify({ css: after.css, buf: after.buf }))
console.log('ancestors:\n  ' + after.chain.join('\n  '))
await b.close()
