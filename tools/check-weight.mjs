import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the split that keeps the 3D engine off the marketing page.
 *
 * The failure this exists for is quiet: nothing breaks, no test fails, the
 * landing page simply starts downloading a megabyte of three.js because some
 * shared dependency drifted into the wrong chunk. The tell is a modulepreload
 * for the 3D chunks in index.html, so that is what this looks at.
 */

const DIST = 'dist'
/**
 * Uncompressed budget for everything index.html pulls in eagerly, kB.
 *
 * This is the drift alarm, not the real invariant — the real one is the list
 * of banned chunks below, which fails if three.js or the postprocessing stack
 * ever reaches the front page. The number is a baseline plus headroom, and it
 * moves when something is added on purpose.
 *
 * It moved from 800 when Auth0 arrived. Its SDK is about 235 kB raw, 68 kB
 * over the wire, and the landing page pays for it because the account menu in
 * the header shows a signed-in visitor their own avatar — which means knowing
 * who they are before they have asked for anything. The alternative was
 * showing everyone "Sign in" and correcting it a moment later.
 */
const EAGER_BUDGET_KB = 950

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1])

const failures = []

const banned = refs.filter((f) => /^(three|postfx|r3f)-/.test(f))
if (banned.length) {
  failures.push(
    `index.html loads the 3D chunks eagerly: ${banned.join(', ')}.\n` +
      '    Something on the landing path now imports three, or a shared package\n' +
      '    drifted into a 3D chunk. See manualChunks in vite.config.ts.',
  )
}

let eager = 0
for (const f of refs) {
  if (!/\.(js|css)$/.test(f)) continue
  eager += statSync(join(DIST, 'assets', f)).size
}
const eagerKb = Math.round(eager / 1024)
if (eagerKb > EAGER_BUDGET_KB) {
  failures.push(`The eager bundle is ${eagerKb} kB, over the ${EAGER_BUDGET_KB} kB budget.`)
}

const all = readdirSync(join(DIST, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ f, kb: Math.round(statSync(join(DIST, 'assets', f)).size / 1024) }))
  .sort((a, b) => b.kb - a.kb)

console.log(`Eager: ${eagerKb} kB across ${refs.length} files`)
for (const { f, kb } of all) {
  console.log(`  ${String(kb).padStart(5)} kB  ${f}${refs.includes(f) ? '   (eager)' : ''}`)
}

if (failures.length) {
  console.error('\nFAIL')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('\nOK: the 3D stack stays behind the editor.')
