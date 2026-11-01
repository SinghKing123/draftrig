import { chromium } from 'playwright'

/**
 * Prints the framing the editor itself chooses for a starter build.
 *
 * For aiming a cinematic take. A shot is declared as a look-at point and a
 * camera distance in millimetres, and the numbers that frame a thrust rig
 * 300mm across are nowhere near the ones a room 4.6 metres across needs.
 * Guessing costs a two-minute recording to find out it was wrong.
 *
 * It does not measure the document. A bounding box of part origins would say
 * a room is a single point, because a room is one `room-shell` instance
 * sitting at the origin with four and a half metres of geometry hanging off
 * it. Instead the build is loaded the ordinary way and `CameraRig` is allowed
 * to frame it, exactly as it does for someone opening that starter — then the
 * camera it settled on is read back and converted into the azimuth, polar and
 * distance a take is written in.
 *
 *   npm run dev
 *   BASE=http://localhost:5174 node tools/reel/measure.mjs room-setup ps5-stand
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const ids = process.argv.slice(2)
if (!ids.length) {
  console.log('usage: measure.mjs <starter id> [more ids…]')
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.draftrig?.starters?.length > 0, { timeout: 30000 })

for (const id of ids) {
  const m = await page.evaluate(async (starterId) => {
    const s = window.draftrig.starters.find((x) => x.id === starterId)
    if (!s) return { error: `no starter "${starterId}"` }
    const doc = s.build()
    window.draftrig.doc.getState().loadDoc(doc)
    window.draftrig.doc.getState().select([])
    /*
     * Framing has to be asked for.
     *
     * The editor stopped re-framing on every document and selection change
     * ("Frame when asked, not when the selection changes"), so loading a
     * build and reading the camera back just reports wherever the camera
     * already was — which is how every one of these first measured at the
     * default 4000mm, including a stand 560mm tall.
     */
    window.draftrig.doc.getState().requestFrame('all')
    // The re-frame is an animation about a third of a second long.
    await new Promise((r) => setTimeout(r, 1600))

    const c = window.draftrig.camera.controls
    const p = c.object.position
    const t = c.target
    const dx = p.x - t.x
    const dy = p.y - t.y
    const dz = p.z - t.z
    const dist = Math.hypot(dx, dy, dz)
    /* The take's angles: azimuth around Y from +Z, polar down from +Y. */
    const azimuth = (Math.atan2(dx, dz) * 180) / Math.PI
    const polar = (Math.acos(dy / dist) * 180) / Math.PI

    /* The spread of part origins as well — it says nothing about a room but
       it is the right number for a frame or a stack made of many pieces. */
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (const iid of doc.order) {
      const q = doc.instances[iid]?.pos
      if (!q) continue
      const v = Array.isArray(q) ? q : [q.x, q.y, q.z]
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], v[k])
        hi[k] = Math.max(hi[k], v[k])
      }
    }
    const spread = hi.map((h, k) => Math.round(h - lo[k]))

    return {
      parts: doc.order.length,
      wires: doc.connectionOrder.length,
      target: [t.x, t.y, t.z].map((n) => Math.round(n)),
      azimuth: Math.round(azimuth),
      polar: Math.round(polar),
      dist: Math.round(dist),
      spread: spread.every(Number.isFinite) ? spread : null,
      mid: spread.every(Number.isFinite) ? hi.map((h, k) => Math.round((h + lo[k]) / 2)) : null,
      kinds: [...new Set(doc.order.map((i) => doc.instances[i].defId))].slice(0, 12),
    }
  }, id)

  if (m.error) {
    console.log(`${id}: ${m.error}`)
    continue
  }
  console.log(`\n${id}  —  ${m.parts} parts, ${m.wires} wires`)
  console.log(`  take target  [${m.target.join(', ')}]`)
  console.log(`  take camera  [${m.azimuth}, ${m.polar}, ${m.dist}]   ← azimuth, polar, distance`)
  if (m.spread) console.log(`  origins span ${m.spread.join(' × ')} mm, centred [${m.mid.join(', ')}]`)
  console.log(`  parts: ${m.kinds.join(', ')}`)
}

await browser.close()
