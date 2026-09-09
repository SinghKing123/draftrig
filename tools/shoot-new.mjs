import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2600)
await page.screenshot({ path: 'shots/new-hero.png' })
// Scroll through so every reveal fires before the full-page capture.
for (let y = 0; y < 5200; y += 600) { await page.mouse.wheel(0, 600); await page.waitForTimeout(140) }
await page.waitForTimeout(900)
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/new-full.png', fullPage: true })

// The interactive check, in its failing state.
await page.evaluate(() => document.querySelector('#check')?.scrollIntoView())
await page.waitForTimeout(700)
await page.getByRole('tab', { name: /Straight to 5/ }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/new-check.png' })

// The editor's first-run welcome.
await page.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shots/new-welcome.png' })
await page.getByRole('button', { name: 'Show me around', exact: true }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'shots/new-tour1.png' })
await page.getByRole('button', { name: 'Next' }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'shots/new-tour2.png' })

console.log(errs.length ? 'PROBLEMS:\n' + [...new Set(errs)].join('\n') : 'No console errors.')
await browser.close()
