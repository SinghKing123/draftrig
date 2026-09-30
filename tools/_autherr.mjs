import { chromium } from 'playwright'
const D = 'dev-nzrzf76dem86ou2l.us.auth0.com'
const CID = 'gJjYhC3ZnoCFfMzaOKJvWh4uHXUYhAx8'
const RU = encodeURIComponent('http://localhost:5173/auth/callback')
const url = `https://${D}/authorize?client_id=${CID}&redirect_uri=${RU}&response_type=code`
  + `&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=probe`
  + `&scope=${encodeURIComponent('openid profile email')}&audience=${encodeURIComponent('draftrig-api')}`

const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage()
const seen = []
page.on('framenavigated', (f) => { if (f === page.mainFrame()) seen.push(f.url()) })
await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
await page.waitForTimeout(4000)
for (const u of seen) {
  const q = new URL(u).searchParams
  const err = q.get('error')
  if (err) {
    console.log('HOST        :', new URL(u).host)
    console.log('error       :', err)
    console.log('description :', q.get('error_description'))
  }
}
if (!seen.some((u) => new URL(u).searchParams.get('error'))) console.log('no error param; chain:', seen.map((u) => new URL(u).host + new URL(u).pathname).join(' -> '))
await b.close()
