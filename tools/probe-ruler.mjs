import { chromium } from 'playwright'

/**
 * The ruler, driven the way a hand drives it.
 *
 * The arithmetic has unit tests. What they cannot cover is the part that
 * actually goes wrong in a 3D tool: whether the click reaches the ruler
 * instead of selecting a part, whether the ray finds the thing under the
 * pointer, and whether what it snaps to is the corner you meant.
 *
 * Two identical parts are placed a known distance apart, so there is a
 * right answer: snapped to the middle of each, the span is exactly the
 * separation.
 *
 *   node tools/probe-ruler.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://localhost:4178'
const APART = 1500

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 40000 })

/* The first-run tour sits over the canvas and eats every pointer event. */
const skip = page.getByRole('button', { name: 'Skip' })
if (await skip.count()) await skip.first().click()
await page.waitForTimeout(400)

/* Two of the same part, level, a known distance apart on X. */
const ids = await page.evaluate((apart) => {
  const d = window.draftrig.doc.getState()
  d.newDoc()
  const a = d.addPart('projector', [-apart / 2, 0, 0])
  const b = d.addPart('projector', [apart / 2, 0, 0])
  window.draftrig.doc.getState().select([])
  window.draftrig.doc.getState().requestFrame('all')
  return [a, b]
}, APART)
await page.waitForTimeout(2200)

const canvas = await page.locator('canvas').first().boundingBox()

/**
 * Walk the pointer over the view until the wanted part is under it.
 *
 * A grid rather than a row: the camera looks down at an angle, so two
 * parts side by side in the room are at different heights on screen.
 * Having found it, close in on the middle of the run of pixels that
 * belong to it, which is where the part's centre snap point will be.
 */
async function hover(instanceId) {
  for (let fy = 0.3; fy < 0.86; fy += 0.025) {
    const y = canvas.y + canvas.height * fy
    const on = []
    for (let fx = 0.12; fx < 0.92; fx += 0.014) {
      const x = canvas.x + canvas.width * fx
      await page.mouse.move(x, y)
      const got = await page.evaluate(() => window.draftrig.doc.getState().hovered)
      if (got === instanceId) on.push(x)
      else if (on.length) break
    }
    if (on.length >= 2) return { x: on[Math.floor(on.length / 2)], y }
  }
  return null
}

await page.keyboard.press('m')
const on = await page.evaluate(() => !!document.querySelector('[aria-pressed="true"][title^="Measure"]'))
console.log(`ruler on after pressing m: ${on}`)

const pA = await hover(ids[0])
if (!pA) throw new Error('never found the first part under the pointer')
await page.mouse.click(pA.x, pA.y)

const pB = await hover(ids[1])
if (!pB) throw new Error('never found the second part under the pointer')
await page.mouse.move(pB.x, pB.y)
await page.waitForTimeout(120)
await page.mouse.click(pB.x, pB.y)
await page.waitForTimeout(300)

const tag = await page.locator('.measure-tag').first()
const shown = (await tag.count()) ? (await tag.innerText()).replace(/\s+/g, ' ') : null
console.log(`readout: ${shown}`)

/* Nothing may have been selected: the ruler owns the click. */
const selected = await page.evaluate(() => window.draftrig.doc.getState().selection.length)
console.log(`parts selected by those clicks: ${selected}`)

await page.screenshot({ path: 'C:/Users/aryan/AppData/Local/Temp/claude/86a6f29862cc08de/db28cbbf-0297-4773-9e67-ec0dd1d35e99/scratchpad/ruler.png' })

/* Escape puts it away. */
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
const gone = (await page.locator('.measure-tag').count()) === 0
console.log(`cleared by Escape: ${gone}`)
console.log(`console errors: ${errors.length}${errors.length ? ' -> ' + errors[0].slice(0, 160) : ''}`)

await browser.close()
