import { chromium } from 'playwright'
const b = await chromium.connectOverCDP('http://localhost:9222')
const page = b.contexts()[0].pages()[0]
for (let i = 0; i < 25; i++) {
  const m = await page.evaluate(() => window.monaco?.editor?.getModels?.().length ?? 0).catch(() => 0)
  if (m > 0) { console.log('SQL EDITOR READY'); await b.close(); process.exit(0) }
  await page.waitForTimeout(14000)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(7000)
}
console.log('still not ready')
await b.close()
