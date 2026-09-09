import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4173/signin', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shots/site-signin-live.png' })
await page.goto('http://localhost:4173/projects', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'shots/site-projects.png' })
console.log(errs.length ? 'errors: ' + [...new Set(errs)].join(' | ') : 'no page errors')
await browser.close()
