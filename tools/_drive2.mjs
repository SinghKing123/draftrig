import { chromium } from 'playwright'
const b = await chromium.connectOverCDP('http://localhost:9222')
const ctx = b.contexts()[0]
const page = await ctx.newPage()
await page.goto('https://manage.auth0.com/dashboard/us/dev-nzrzf76dem86ou2l/actions/library', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(7000)
const txt = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
console.log('url:', page.url().slice(0, 95))
const k = txt.search(/Actions|Library|Custom/i)
console.log('shows:', txt.slice(k, k + 400))
await page.close()
await b.close()
