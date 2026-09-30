import { chromium } from 'playwright'
const b = await chromium.connectOverCDP('http://localhost:9222')
const page = b.contexts()[0].pages()[0]
for (let i = 0; i < 30; i++) {
  await page.goto('https://supabase.com/dashboard/project/kovrdzgebxswnfzkvipe/sql/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(8000)
  const m = await page.evaluate(() => window.monaco?.editor?.getModels?.().length ?? 0)
  if (m > 0) { console.log('SQL EDITOR READY'); break }
  await page.waitForTimeout(12000)
}
await b.close()
