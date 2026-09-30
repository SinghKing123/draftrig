import { chromium } from 'playwright'
const b = await chromium.connectOverCDP('http://localhost:9222')
const page = b.contexts()[0].pages()[0]
const m = await page.evaluate(() => window.monaco?.editor?.getModels?.().length ?? 0)
const txt = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
console.log('monaco models:', m, '| status:', (txt.match(/Coming up|ACTIVE|HEALTHY|paused/i) || ['?'])[0])
await b.close()
