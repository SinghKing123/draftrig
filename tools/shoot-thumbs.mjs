import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { Buffer } from 'node:buffer'

/**
 * Photographs the whole catalogue, one part at a time, for the front
 * page's part search.
 *
 * The search box on the landing page is the library panel with the
 * editor taken away: you type "socket" and the catalogue answers. That
 * only works if a result carries a picture of the thing, and the only
 * honest picture of a part in this product is the part itself rendered
 * by the editor — not an icon somebody drew, and not a rectangle at the
 * part's bounding size, which is what the old shelf tiles were.
 *
 * So this places each part on an empty document, lets the model loader
 * finish, frames it, and takes a small frame of the viewport. It writes
 * the index beside the images, because the index has to come from the
 * registry: parts are registered at import time and several files
 * register a family from a loop, so a list written by hand drifts the
 * day somebody adds a part.
 *
 *   node tools/shoot-thumbs.mjs            all 266
 *   node tools/shoot-thumbs.mjs socket     only ids matching "socket"
 *
 * BASE   dev server (default http://localhost:5174)
 * REDO   1 to re-shoot parts that already have a file
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const REDO = process.env.REDO === '1'
const OUT = 'public/shots/parts'
const INDEX = 'src/routes/lp/library.gen.ts'
const only = process.argv[2] ?? null

/*
 * Shot at window size and written small.
 *
 * The window has to be a desktop window or the editor lays itself out
 * for a phone and the chrome this hides is a different chrome. The
 * file has to be small: a result row shows it at about 64 px wide, so
 * 400 x 300 is already twice what the densest screen asks for, and two
 * hundred and sixty-six of them have to be a download somebody can
 * afford. So the canvas is read and redrawn at size in the page —
 * `preserveDrawingBuffer` is on in the viewport, which is what makes
 * `toDataURL` return the frame that is actually on screen rather than
 * a cleared buffer.
 */
const WINDOW = { width: 960, height: 720 }
const THUMB = { w: 400, h: 300 }

mkdirSync(OUT, { recursive: true })

/** Chrome off, canvas full bleed — the same stripping the reel shots use. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats { display: none !important; }
  .app-center { border: 0 !important; }
`

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: WINDOW, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.used.v1', '1')
  localStorage.setItem('draftrig.console.open.v1', '0')
  localStorage.setItem('draftrig.bom.open.v1', '0')
})

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)))

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.parts?.allParts === 'function', { timeout: 40000 })
await page.addStyleTag({ content: BARE })

/* The registry, as the editor's own library panel reads it. */
const catalogue = await page.evaluate(() => {
  const { allParts, CATEGORY_META } = window.draftrig.parts
  return allParts().map((p) => {
    const meta = CATEGORY_META[p.category]
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      section: meta ? meta.section : 'Other',
      label: meta ? meta.label : p.category,
      blurb: p.blurb ?? '',
      tags: p.tags ?? [],
    }
  })
})

const wanted = only ? catalogue.filter((p) => p.id.includes(only) || p.name.toLowerCase().includes(only)) : catalogue
console.log(`${catalogue.length} parts in the registry, ${wanted.length} to shoot\n`)

const done = []
const failed = []

for (const [i, part] of wanted.entries()) {
  const file = `${OUT}/${part.id}.jpg`
  if (!REDO && existsSync(file)) {
    done.push(part.id)
    continue
  }

  const before = errors.length
  const ok = await page.evaluate((id) => {
    const d = window.draftrig.doc.getState()
    d.newDoc()
    const inst = d.addPart(id, [0, 0, 0])
    if (!inst) return false
    window.draftrig.doc.getState().select([])
    window.draftrig.doc.getState().requestFrame('all')
    return true
  }, part.id)

  if (!ok) {
    failed.push(`${part.id}: addPart returned nothing`)
    continue
  }

  /* The glb lands after the part does, and the frame request is a token
     the viewport acts on next tick, so both need waiting out. The
     second deselect is not redundant: placing a part selects it, and a
     selected part wears a transform gizmo that would be photographed
     as though it were part of the thing. */
  await page.waitForTimeout(1700)
  await page.evaluate(() => {
    const d = window.draftrig.doc.getState()
    d.select([])
    d.requestFrame('all')
  })
  await page.waitForTimeout(800)

  const data = await page.evaluate(
    ([w, h]) => {
      const src = document.querySelector('canvas')
      if (!src) return null
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const g = out.getContext('2d')
      /* Cover, so a wide viewport does not letterbox a part into a
         band with two black margins round it. */
      const scale = Math.max(w / src.width, h / src.height)
      const dw = src.width * scale
      const dh = src.height * scale
      g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh)
      return out.toDataURL('image/jpeg', 0.74)
    },
    [THUMB.w, THUMB.h],
  )

  if (!data) {
    failed.push(`${part.id}: no canvas`)
    continue
  }
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'))

  const fresh = errors.slice(before)
  if (fresh.length) failed.push(`${part.id}: ${fresh.join(' | ')}`)
  done.push(part.id)
  if (i % 20 === 0) console.log(`  ${String(i).padStart(3)} / ${wanted.length}  ${part.id}`)
}

/* Only the parts that have a picture go in the index: a result row with
   a hole where the part should be is worse than one fewer result. */
const shot = new Set(done)
const rows = catalogue
  .filter((p) => shot.has(p.id) || existsSync(`${OUT}/${p.id}.jpg`))
  .map((p) => {
    const tags = p.tags.slice(0, 10).join(' ')
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `  { id: '${p.id}', n: '${esc(p.name)}', s: '${esc(p.section)}', c: '${esc(p.label)}', t: '${esc(tags)}' },`
  })

writeFileSync(
  INDEX,
  `/**
 * The catalogue, for the front page's part search. GENERATED.
 *
 *   node tools/shoot-thumbs.mjs
 *
 * Written from the registry rather than by hand, because parts are
 * registered at import time and several files register a family from a
 * loop — a list typed in here drifts the day somebody adds a part. The
 * picture for each row is \`/shots/parts/<id>.jpg\`, shot by the same
 * tool out of the editor's own viewport.
 */

export interface LibRow {
  id: string
  /** Name, as the library panel shows it. */
  n: string
  /** Section heading, e.g. "AV & cinema". */
  s: string
  /** Category label within the section. */
  c: string
  /** Search tags, space separated. */
  t: string
}

export const LIBRARY: LibRow[] = [
${rows.join('\n')}
]
`,
  'utf8',
)

await browser.close()
console.log(`\n${done.length} shot, ${failed.length} with errors, index at ${INDEX}`)
for (const f of failed.slice(0, 20)) console.log('  ! ' + f)
