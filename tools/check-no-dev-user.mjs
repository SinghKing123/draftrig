import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The pretend account must not exist in a production build.
 *
 * It is behind `import.meta.env.DEV`, which Vite replaces with the literal
 * `false` so the minifier removes the branch. That is the theory. This is the
 * check, because "I am sure it is tree-shaken" and "I have looked" are
 * different statements, and the thing being asserted is that a build cannot
 * hand somebody an account they did not sign in to.
 *
 *   npm run build && node tools/check-no-dev-user.mjs
 */

const DIST = 'dist'

/** Strings that only exist inside the development-only module. */
const FORBIDDEN = [
  'Pat Example',
  'pat@example.test',
  'dev|pretend-account',
  'draftrig.devuser.v1',
  'Pretend account',
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(js|css|html)$/.test(name)) out.push(full)
  }
  return out
}

let bad = 0
let scanned = 0
for (const file of walk(DIST)) {
  scanned++
  const text = readFileSync(file, 'utf8')
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) {
      console.error(`FAIL  ${file} contains ${JSON.stringify(needle)}`)
      bad++
    }
  }
}

if (bad) {
  console.error(`\n${bad} leak${bad === 1 ? '' : 's'} of the development-only account into ${DIST}.`)
  process.exit(1)
}

console.log(`no development-only account in ${scanned} built files`)
