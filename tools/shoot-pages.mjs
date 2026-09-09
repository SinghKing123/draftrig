import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
for (const [path, name] of [['/', 'site-hero'], ['/signin', 'site-signin'], ['/projects', 'site-projects']]) {
  await page.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `shots/${name}.png` })
  if (path === '/') await page.screenshot({ path: 'shots/site-full.png', fullPage: true })
}
console.log(errs.length ? 'PROBLEMS:\n' + [...new Set(errs)].join('\n') : 'No console errors.')
await browser.close()
