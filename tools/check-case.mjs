import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Every relative import, checked against the filename git actually has.
 *
 * Windows and macOS resolve `./floor` to `Floor.tsx` without complaint;
 * a Linux build machine does not, and the error it gives — "failed to
 * resolve import" — reads as a missing file rather than as a spelling.
 * This asks git for the real names rather than the filesystem, because
 * the filesystem here is the one that cannot tell the difference.
 *
 *   node tools/check-case.mjs           the working tree
 *   node tools/check-case.mjs HEAD      exactly what was pushed
 */

const rev = process.argv[2] ?? null
const list = rev ? `git ls-tree -r --name-only ${rev}` : 'git ls-files'
const tracked = execSync(list, { encoding: 'utf8' }).split('\n').filter(Boolean)
const read = (f) => (rev ? execSync(`git show ${rev}:${f}`, { encoding: 'utf8', maxBuffer: 64e6 }) : readFileSync(f, 'utf8'))

const exact = new Set(tracked)
const lower = new Map()
for (const f of tracked) {
  const k = f.toLowerCase()
  if (!lower.has(k)) lower.set(k, [])
  lower.get(k).push(f)
}

let bad = 0

/* Two files whose names differ only by case cannot both survive a
   checkout on a case-insensitive filesystem. */
for (const [, names] of lower) {
  if (names.length > 1) {
    bad++
    console.log('CASE COLLISION:', names.join('  '))
  }
}

const EXT = ['', '.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx', '.js', '.json', '.css']
const src = tracked.filter((f) => /^src\/.*\.(ts|tsx)$/.test(f))

for (const file of src) {
  if (!rev && !existsSync(file)) continue
  const text = read(file)
  const dir = path.posix.dirname(file)
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]((?:\.|@\/)[^'"]+)['"]/g)) {
    const spec = m[1]
    /* `@/` is the alias vite.config.ts maps to src/, so it resolves
       against the repo root rather than against this file. */
    const base = spec.startsWith('@/')
      ? 'src/' + spec.slice(2)
      : path.posix.normalize(path.posix.join(dir, spec)).split(path.sep).join('/')
    if (EXT.some((e) => exact.has(base + e))) continue
    const near = EXT.map((e) => (base + e).toLowerCase()).flatMap((p) => lower.get(p) ?? [])
    bad++
    console.log(`${file}\n  imports "${spec}"\n  ${near.length ? 'REAL NAME: ' + near.join(', ') : 'NO SUCH FILE IN GIT'}`)
  }
}

console.log(bad ? `\n${bad} thing(s) a Linux checkout cannot resolve` : '\nevery relative import matches a tracked file')
process.exit(bad ? 1 : 0)
