import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })

for (const route of ['/', '/app']) {
  const page = await b.newPage()
  const seen = []
  page.on('response', async (r) => {
    const u = new URL(r.url())
    if (!/\.(js|css)$/.test(u.pathname)) return
    const buf = await r.body().catch(() => null)
    seen.push({ name: u.pathname.split('/').pop(), bytes: buf ? buf.length : 0 })
  })
  await page.goto(base + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const total = seen.reduce((a, s) => a + s.bytes, 0)
  console.log(`\n${route}  ${seen.length} files, ${(total / 1024).toFixed(0)} kB uncompressed`)
  for (const s of seen.sort((a, c) => c.bytes - a.bytes)) {
    console.log(`   ${(s.bytes / 1024).toFixed(0).padStart(5)} kB  ${s.name}`)
  }
  await page.close()
}
await b.close()
