import { chromium } from 'playwright'
const D = 'dev-nzrzf76dem86ou2l.us.auth0.com'
const CID = 'gJjYhC3ZnoCFfMzaOKJvWh4uHXUYhAx8'
const RU = encodeURIComponent('http://localhost:5173/auth/callback')
const base = `https://${D}/authorize?client_id=${CID}&redirect_uri=${RU}&response_type=code&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=probe`

const cases = {
  'new API  draftrig-api          ': `${base}&scope=${encodeURIComponent('openid profile email')}&audience=${encodeURIComponent('draftrig-api')}`,
  'old API  https://api.draftrig.com': `${base}&scope=${encodeURIComponent('openid profile email')}&audience=${encodeURIComponent('https://api.draftrig.com')}`,
}

const b = await chromium.launch({ channel: 'msedge' })
for (const [label, url] of Object.entries(cases)) {
  const page = await b.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(3500)
  const txt = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
  const host = new URL(page.url()).host
  const ok = host.includes('auth0.com') && /sign in|log in|continue|password|email/i.test(txt)
  const err = txt.match(/Client "[^"]*" ([^.]*\.)/)
  console.log(label, '->', ok ? 'LOGIN PAGE OK' : (err ? err[1] : txt.slice(0, 110) || '(blank)'))
  await page.close()
}
await b.close()
