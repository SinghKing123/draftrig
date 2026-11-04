import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Counts the catalogue and photographs the library panel.
 *
 * The catalogue is the one thing in here that cannot be counted from the
 * source: parts are registered at import time and several files register a
 * family from a loop, so grepping for `category:` undercounts. This asks the
 * registry, which is the only number worth quoting.
 *
 *   node tools/probe-library.mjs [categoryToOpen]
 *
 * BASE  dev server (default http://localhost:5174)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/library'
const openCat = process.argv[2] ?? null

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 })

await page.addInitScript((cat) => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.used.v1', '1')
  if (cat) localStorage.setItem('draftrig.library.open.v1', JSON.stringify({ [cat]: true }))
}, openCat)

const problems = []
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 200)))

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.parts?.allParts === 'function', { timeout: 30000 })

const report = await page.evaluate(() => {
  const { allParts, CATEGORY_META } = window.draftrig.parts
  const parts = allParts()
  const bySection = {}
  const byCategory = {}
  for (const p of parts) {
    const meta = CATEGORY_META[p.category]
    const section = meta ? meta.section : '(none)'
    bySection[section] = (bySection[section] ?? 0) + 1
    const label = meta ? meta.label : p.category
    byCategory[label] = (byCategory[label] ?? 0) + 1
  }
  const modelled = parts.filter((p) => p.model).length
  return { total: parts.length, bySection, byCategory, modelled }
})

console.log(`catalogue: ${report.total} parts, ${report.modelled} with a mesh`)
for (const [section, n] of Object.entries(report.bySection)) console.log(`  ${section.padEnd(12)} ${n}`)
console.log('')
for (const [label, n] of Object.entries(report.byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${label}`)
}

// How much of the panel one screen holds, which is the thing being changed.
const rows = await page.evaluate(() => {
  const panel = document.querySelector('.panel .panel-body')
  const item = document.querySelector('.part-item')
  const group = document.querySelector('.lib-group')
  return {
    panelHeight: panel ? Math.round(panel.clientHeight) : null,
    rowHeight: item ? Math.round(item.getBoundingClientRect().height) : null,
    groupHeight: group ? Math.round(group.getBoundingClientRect().height) : null,
  }
})
console.log(`\npanel ${rows.panelHeight}px, row ${rows.rowHeight}px, group ${rows.groupHeight}px`)
if (rows.rowHeight) console.log(`  ${Math.floor(rows.panelHeight / rows.rowHeight)} parts visible at once`)

await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/library${openCat ? '-' + openCat : ''}.png` })
console.log(`\n  shots/library/library${openCat ? '-' + openCat : ''}.png${problems.length ? `\n  errors: ${problems.join('\n          ')}` : ''}`)

await browser.close()
