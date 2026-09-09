import { chromium } from 'playwright'
const base = 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage()
const errs = []
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

await p.goto(base, { waitUntil: 'networkidle' })
console.log('title      :', await p.title())
console.log('wordmark   :', (await p.locator('.wordmark').first().innerText()).replace(/\n/g, ''))
console.log('solver copy:', (await p.locator('#how .sec-sub').first().innerText()).slice(0, 46))
console.log('footer     :', await p.locator('.fine').innerText())
console.log('addr bar   :', await p.locator('.shot .addr').innerText())
console.log('stats      :', await p.locator('.stats .stat b').first().innerText())

await p.goto(base + '/app', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
console.log('app title  :', await p.title())
console.log('welcome    :', await p.locator('.welcome h2, .tour-card h3').first().innerText())
const hooked = await p.evaluate(() => typeof window.draftrig === 'object' && !!window.draftrig.doc)
console.log('window.draftrig:', hooked)
const openBtn = await p.locator('button[title]').filter({ hasText: '' }).count()
console.log('open btn tip:', await p.locator('button[title*="Open a"]').getAttribute('title'))

console.log('console errors:', errs.length ? errs : 'none')
await b.close()
