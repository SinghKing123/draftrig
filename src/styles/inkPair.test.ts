import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * A colour painted on --ink has to say what reads on top of it.
 *
 * --ink is not one colour. The landing page redefines it near-white for its
 * dark theme and the manual redefines it again, so a rule that sets
 * `background: var(--ink)` beside a literal white foreground is legible only
 * in the theme it was written in. That is how the account avatar came to be
 * white letters on a white disc for every signed-in visitor reading the dark
 * page: the circle followed the theme and the letters did not.
 *
 * Checked against the stylesheets themselves rather than a rendered page, so
 * a theme added later cannot quietly bring it back.
 *
 * Read off disk on purpose. Vite's `?raw` would be tidier, but vitest stubs
 * CSS imports and hands back an empty string, and every check below then
 * passes by finding nothing to look at — which is worse than not having them.
 */

const SHEETS = ['site.css', 'site-lp.css', 'manual.css']
const read = (f: string) => readFileSync(`src/styles/${f}`, 'utf8').replace(/\r\n/g, '\n')

/** Rule bodies, crudely: everything between a `{` and its `}`. */
function blocks(css: string): { sel: string; body: string }[] {
  const out: { sel: string; body: string }[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) out.push({ sel: m[1].trim().split('\n').pop()!.trim(), body: m[2] })
  return out
}

/** Relative luminance, for the usual contrast ratio. */
function lum(hex: string): number {
  const n = hex.replace('#', '')
  const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
  const [r, g, b] = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('ink and the colour that reads on it', () => {
  it('finds the stylesheets at all', () => {
    // Guards the checks below from passing because they looked at nothing.
    for (const f of SHEETS) expect(read(f).length, f).toBeGreaterThan(1000)
    expect(SHEETS.flatMap((f) => blocks(read(f))).length).toBeGreaterThan(200)
  })

  it('defines a foreground everywhere it defines --ink', () => {
    const missing: string[] = []
    let found = 0
    for (const f of SHEETS) {
      for (const b of blocks(read(f))) {
        if (!/--ink:\s*#/.test(b.body)) continue
        found++
        if (!/--ink-on:\s*#/.test(b.body)) missing.push(`${f} → ${b.sel}`)
      }
    }
    expect(missing).toEqual([])
    expect(found, 'blocks defining --ink').toBeGreaterThanOrEqual(5)
  })

  it('never puts a hardcoded foreground on an --ink background', () => {
    const bad: string[] = []
    for (const f of SHEETS) {
      for (const b of blocks(read(f))) {
        if (!/background:\s*var\(--ink\)/.test(b.body)) continue
        const colour = b.body.match(/(?:^|[;{\s])color:\s*([^;]+)/)
        if (colour && !colour[1].includes('var(')) bad.push(`${f} → ${b.sel}: color: ${colour[1].trim()}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('leaves every one of those pairs readable', () => {
    let checked = 0
    for (const f of SHEETS) {
      for (const b of blocks(read(f))) {
        const ink = b.body.match(/--ink:\s*(#[0-9A-Fa-f]{6})/)?.[1]
        const on = b.body.match(/--ink-on:\s*(#[0-9A-Fa-f]{6})/)?.[1]
        if (!ink || !on) continue
        const ratio = (Math.max(lum(ink), lum(on)) + 0.05) / (Math.min(lum(ink), lum(on)) + 0.05)
        console.log(`${f}: ${on} on ${ink} = ${ratio.toFixed(1)}:1`)
        expect(ratio, `${f}: ${on} on ${ink}`).toBeGreaterThan(4.5)
        checked++
      }
    }
    expect(checked, 'pairs checked').toBeGreaterThanOrEqual(5)
  })
})
