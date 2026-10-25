import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5173'
const out = 'C:/Users/aryan/AppData/Local/Temp/claude/C--Users-aryan-Downloads-BUILDsim/db28cbbf-0297-4773-9e67-ec0dd1d35e99/scratchpad'
const b = await chromium.launch({ channel: 'msedge' })
const bad = []
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => bad.push(`ERR ${e.message}`))
await p.addInitScript(() => { localStorage.setItem('tour.seen.v1', '1'); localStorage.setItem('draftrig.nav.seen.v1', '1') })
await p.goto(BASE + '/projects', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(4000)
await p.screenshot({ path: `${out}/d1-dash.png` })
// Open the room build and look at it.
await p.goto(BASE + '/app?start=room-setup', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(11000)
await p.evaluate(() => { const d = window.draftrig.doc.getState(); d.pinQuality('high'); d.requestFrame('all') })
await p.waitForTimeout(2500)
await p.screenshot({ path: `${out}/d1-room.png` })
const issues = await p.evaluate(() => window.draftrig.sim.getState().issues?.length ?? -1)
console.log('issues:', issues, bad.length ? bad.slice(0, 4).join(' | ') : 'no page errors')
await b.close()
