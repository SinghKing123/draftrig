import { chromium } from 'playwright'

/**
 * Photographs the front page's live room, for the front page's live room.
 *
 * The room is 26 MB of mesh and it takes a few seconds to arrive. What
 * used to sit in the viewport while it did was a chip counting parts,
 * which is a page telling you to wait. What sits there now is this
 * picture: the same room, from the same camera, held over the canvas
 * until the last part has landed and then dissolved away.
 *
 * The dissolve only works if the two frames agree, so two things are
 * arranged to make them agree.
 *
 * The camera drifts while nobody is touching it, and `scene.ts`
 * restarts that drift the moment the last part lands — so the frame
 * the still is replaced by is the frame at the start of a drift, which
 * is the frame this shoots. A second of phase is about a degree of
 * azimuth, which is why the shot is taken as soon as the room is up.
 *
 * The window is the wide one. Above 1680px the viewport is a fixed
 * 822x645 box, so a shot taken there is exact for every large screen;
 * narrower layouts stretch it by a few per cent, which `.fl-still`
 * handles by matching the width of the frame and letting the height
 * crop, the same way the camera's own fit is bound by width.
 *
 *   node tools/shoot-floor-still.mjs
 *
 * BASE  dev server (default http://localhost:5173)
 */

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = 'public/floor-still.jpg'

const browser = await chromium.launch({ channel: 'msedge', headless: false })
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 })

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.fl-vp canvas', { timeout: 60000 })

/* `data-gone` is set 620ms after the last part is reported, which is
   also long enough for the last part to finish easing up to size. */
await page.waitForFunction(() => document.querySelector('.fl-still')?.dataset.gone === 'true', { timeout: 300000 })

/* The previous still, the toolbar, the clock and the tags are all DOM
   over the canvas. This is a photograph of the canvas. */
await page.addStyleTag({ content: '.fl-still,.fl-tools,.fl-tick,.fl-tags{display:none!important}' })
await page.waitForTimeout(120)

const vp = await page.$('.fl-vp')
await vp.screenshot({ path: OUT, type: 'jpeg', quality: 80 })

const box = await page.evaluate(() => {
  const r = document.querySelector('.fl-vp').getBoundingClientRect()
  return [Math.round(r.width), Math.round(r.height)]
})
console.log(`wrote ${OUT} from a ${box[0]}x${box[1]} viewport at 2x`)
await browser.close()
