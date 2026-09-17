/**
 * Fetch a CC0 model from Poly Haven into public/models/.
 *
 *   node tools/fetch-model.mjs metal_office_desk steel-desk [1k]
 *
 * Writes public/models/<local-name>/ with the .gltf, its .bin and its
 * textures, and appends the attribution to public/models/LICENSES.md.
 *
 * Why a script rather than a one-off download: the licence line and the file
 * have to arrive together. An asset in the repo with no record of where it
 * came from is a problem you find out about later, from somebody else.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const [slug, localName, res = '1k'] = process.argv.slice(2)
if (!slug || !localName) {
  console.error('usage: node tools/fetch-model.mjs <polyhaven-slug> <local-name> [1k|2k]')
  process.exit(1)
}

const OUT = join('public', 'models', localName)
const LICENSES = join('public', 'models', 'LICENSES.md')

const getJSON = async (url) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`)
  return r.json()
}

const getFile = async (url, dest) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, buf)
  return buf.length
}

const info = await getJSON(`https://api.polyhaven.com/info/${slug}`)
const files = await getJSON(`https://api.polyhaven.com/files/${slug}`)

const entry = files.gltf?.[res]?.gltf
if (!entry) {
  console.error(`No ${res} glTF for "${slug}". Available: ${Object.keys(files.gltf ?? {}).join(', ')}`)
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

let total = 0
const main = entry.url.split('/').pop()
total += await getFile(entry.url, join(OUT, main))
for (const [rel, f] of Object.entries(entry.include ?? {})) {
  total += await getFile(f.url, join(OUT, rel))
  console.log(`  ${rel}`)
}

console.log(`\n${localName}: ${main}, ${(total / 1048576).toFixed(2)} MB total`)

/* --- attribution ------------------------------------------------- */

const authors = Object.keys(info.authors ?? {}).join(', ') || 'Poly Haven'
const line = [
  `## ${localName}`,
  '',
  `- **Title:** ${info.name ?? slug}`,
  `- **Author:** ${authors}`,
  `- **Licence:** CC0 1.0 Universal (public domain dedication)`,
  `- **Source:** https://polyhaven.com/a/${slug}`,
  `- **Files:** \`public/models/${localName}/\` (${res} textures)`,
  '',
].join('\n')

const header = `# Model licences

Every mesh file under \`public/models/\` is listed here with where it came from
and what its licence requires. CC0 asks for nothing, but the credit is recorded
anyway: an asset whose origin is not written down is one nobody can check later.

`

const existing = existsSync(LICENSES) ? readFileSync(LICENSES, 'utf8') : header
if (existing.includes(`## ${localName}`)) {
  console.log('Attribution already recorded.')
} else {
  writeFileSync(LICENSES, existing.trimEnd() + '\n\n' + line)
  console.log(`Attribution appended to ${LICENSES}`)
}
