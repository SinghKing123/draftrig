import { chromium } from 'playwright'

/**
 * Why the live floor does not look like the editor.
 *
 * Reports the computed background and colour of the chrome's panels
 * against the tokens they are supposed to be reading, how long the
 * scene takes to finish placing, and whether any rule in the appended
 * stylesheet failed to parse — a single bad declaration drops every
 * rule after it, which looks exactly like a specificity problem and
 * is not one.
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 160)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
/* The anchor does not exist until React has mounted the page, and a
   scrollIntoView on null is a silent no-op that leaves the section
   below the fold and the observer unfired — which reads as the scene
   refusing to start. */
await page.waitForSelector('#floor', { timeout: 30000 })
await page.evaluate(() => document.getElementById('floor').scrollIntoView())
await page.waitForSelector('.fl canvas', { timeout: 30000 })
await page.waitForTimeout(1500)

const styles = await page.evaluate(() => {
  const pick = (sel, props) => {
    const el = document.querySelector(sel)
    if (!el) return `${sel}: MISSING`
    const s = getComputedStyle(el)
    return `${sel}: ` + props.map((p) => `${p}=${s.getPropertyValue(p)}`).join(' ')
  }
  const fl = document.querySelector('.fl')
  const vars = fl
    ? ['--ed-panel', '--ed-ink', '--ed-bg'].map((v) => `${v}=${getComputedStyle(fl).getPropertyValue(v)}`).join(' ')
    : 'no .fl'
  return [
    'vars on .fl: ' + vars,
    pick('.fl', 'display,grid-template-columns,height'.split(',')),
    pick('.fl-left', 'display,background-color,width'.split(',')),
    pick('.fl-item', 'color,display,padding-left'.split(',')),
    pick('.fl-group button', 'padding-left,height'.split(',')),
    pick('.fl-vp', 'background-image'.split(',')),
  ].join('\n')
})
console.log(styles)

/* Any rule the parser threw away. A stylesheet that fails halfway
   still serves every rule before the break, which is why this looks
   like one panel being ignored rather than a syntax error. */
const sheets = await page.evaluate(() => {
  const out = []
  for (const ss of document.styleSheets) {
    let n = 0
    try {
      n = ss.cssRules.length
    } catch {
      out.push(`${ss.href}: cross-origin`)
      continue
    }
    const text = [...ss.cssRules].map((r) => r.cssText).join('\n')
    out.push(`${(ss.href || 'inline').split('/').pop()}: ${n} rules, .fl-left=${text.includes('.fl-left')}, .fl-item=${text.includes('.fl-item')}, .dr-item=${text.includes('.dr-item')}`)
  }
  return out.join('\n')
})
console.log('\n' + sheets)

const t0 = Date.now()
await page.waitForFunction(() => !document.querySelector('.fl-load'), { timeout: 120000 }).catch(() => {})
const placed = await page.evaluate(() => document.querySelector('.fl-load')?.textContent ?? 'all placed')
console.log(`\nsettled after ${((Date.now() - t0) / 1000).toFixed(1)}s from probe start: ${placed}`)

await b.close()
