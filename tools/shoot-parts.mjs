import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs one part at a time, framed, so a new part can be checked by eye.
 *
 * A part that typechecks and passes the catalog tests can still be wrong in
 * the only way that matters: a mesh fitted to the wrong axis, a scan that
 * came with a backdrop in it, a model nine times the size of the solids it
 * replaced. None of that is visible from the test suite, and all of it is
 * obvious in a picture.
 *
 *   node tools/shoot-parts.mjs chair-task keyboard-desk desk-lamp
 *   node tools/shoot-parts.mjs chair-task:style=gaming
 *
 * A `:key=value` suffix sets parameters, which is how a part whose mesh is
 * gated on a configuration gets checked in that configuration.
 *
 * BASE  dev server (default http://localhost:5174)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/parts'

const args = process.argv.slice(2)
if (!args.length) {
  console.log('usage: shoot-parts.mjs <partId[:key=value,key=value]> …')
  process.exit(1)
}

/** Chrome off, canvas full bleed — the same stripping the reel shots use. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats { display: none !important; }
  .app-center { border: 0 !important; }
`

mkdirSync(OUT, { recursive: true })

/*
 * Edge, and a long shutter. The bundled headless shell reports its fonts
 * loaded and then never returns a frame of a live WebGL canvas this size.
 */
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.console.open.v1', '0')
  localStorage.setItem('draftrig.bom.open.v1', '0')
})

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 160))
})

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 30000 })
await page.addStyleTag({ content: BARE })

for (const arg of args) {
  const [id, paramStr] = arg.split(':')
  const params = Object.fromEntries(
    (paramStr ?? '')
      .split(',')
      .filter(Boolean)
      .map((kv) => {
        const [k, v] = kv.split('=')
        return [k, v === 'true' ? true : v === 'false' ? false : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v]
      }),
  )

  const before = errors.length
  const placed = await page.evaluate(
    ([partId, overrides]) => {
      const d = window.draftrig.doc.getState()
      d.newDoc()
      const inst = d.addPart(partId, [0, 0, 0], Object.keys(overrides).length ? overrides : undefined)
      if (!inst) return null
      window.draftrig.doc.getState().select([])
      window.draftrig.doc.getState().requestFrame('all')
      return inst
    },
    [id, params],
  )

  if (!placed) {
    console.log(`  ${arg.padEnd(34)} NO SUCH PART`)
    continue
  }
  // The model loader fetches the glb after the part lands, and the frame
  // request is a token the viewport acts on next tick — so wait for both.
  await page.waitForTimeout(2600)
  await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
  await page.waitForTimeout(1200)

  const name = arg.replace(/[:=,]/g, '-') + '.png'
  /*
   * The viewport, not the canvas element.
   *
   * An element screenshot waits for the element to hold still, and a live
   * WebGL canvas never does — it reports "waiting for element to be stable"
   * until it times out. The chrome is hidden above, so the viewport is the
   * canvas anyway.
   */
  await page.screenshot({ path: `${OUT}/${name}` })
  const fresh = errors.slice(before)
  console.log(`  ${arg.padEnd(34)} ${name}${fresh.length ? `  ERRORS: ${fresh.join(' | ')}` : ''}`)
}

await browser.close()
console.log(`\n${args.length} parts in ${OUT}/`)
