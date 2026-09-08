import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e.message}`))
await page.goto(process.env.APP_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
console.log('--- console ---')
console.log(logs.join('\n') || '(none)')
console.log('--- #root html (first 900 chars) ---')
console.log((await page.evaluate(() => document.getElementById('root')?.innerHTML ?? 'NO ROOT')).slice(0, 900))
await browser.close()
