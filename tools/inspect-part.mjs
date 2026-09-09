import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
page.on('pageerror', (e) => console.log('ERR', e.message))
await page.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const part = process.argv[2] || 'bench-supply'
await page.evaluate((id) => {
  const doc = window.twinbench.doc.getState()
  doc.newDoc()
  doc.addPart(id, [0, 0, 0])
  doc.requestFrame('all')
}, part)
await page.waitForTimeout(3000)
await page.screenshot({ path: `shots/part-${part}.png`, clip: { x: 270, y: 45, width: 720, height: 620 } })
console.log(`shots/part-${part}.png`)
await browser.close()
