import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1280, height: 900 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

await page.goto('http://localhost:5173/signin', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const notOpen = await page.getByText('Accounts are not open yet').count()
const cont = await page.getByRole('button', { name: /^Continue$/ }).count()
console.log('sign-in page: "not open yet" notice =', notOpen, '| Continue button =', cont)

if (cont) {
  await page.getByRole('button', { name: /^Continue$/ }).click()
  await page.waitForTimeout(6000)
  const url = page.url()
  console.log('landed on:', url.split('?')[0])
  const q = new URL(url).searchParams
  console.log('  audience sent :', q.get('audience') ?? '(none)')
  console.log('  client_id sent:', (q.get('client_id') ?? '').slice(0, 8) + '…')
  console.log('  redirect_uri  :', q.get('redirect_uri') ?? '(none)')
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  console.log('  FULL MESSAGE  :', body.slice(0, 600))
}
console.log('js errors:', errs.length ? errs.slice(0, 2) : 'none')
await b.close()
